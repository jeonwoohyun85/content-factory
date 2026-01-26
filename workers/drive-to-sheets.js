// Drive → Sheets 자동화 Worker
// 단일 책임: Google Drive 사진 업로드 감지 → Google Sheets 자동 업데이트

export default {
  async scheduled(event, env, ctx) {
    try {
      await processDriveChanges(env);
    } catch (error) {
      console.error('Drive to Sheets automation error:', error);
    }
  },

  async fetch(request, env) {
    // Manual trigger for testing
    if (request.method === 'POST') {
      try {
        const result = await processDriveChanges(env);
        return new Response(JSON.stringify(result || { status: 'completed' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message,
          stack: error.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return new Response('Drive to Sheets Automation Worker', { status: 200 });
  }
};

async function processDriveChanges(env) {
  const logs = [];

  // Check if SERVICE ACCOUNT JSON exists
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return {
      error: 'GOOGLE_SERVICE_ACCOUNT_JSON not found in env',
      filesFound: 0,
      filesProcessed: 0,
      logs
    };
  }

  logs.push('Getting access token...');
  const accessToken = await getGoogleAccessToken(env);
  logs.push(`Access token obtained: ${accessToken.substring(0, 20)}...`);

  logs.push(`Searching Drive folder: ${env.DRIVE_FOLDER_ID}`);
  // Get recent files from Drive (last 10 minutes)
  const files = await getRecentDriveFiles(accessToken, env.DRIVE_FOLDER_ID, logs);

  logs.push(`Total files found: ${files.length}`);

  if (files.length === 0) {
    return {
      filesFound: 0,
      filesProcessed: 0,
      message: 'No files found - check Service Account permissions',
      logs
    };
  }

  let processed = 0;
  for (const file of files) {
    logs.push(`Processing: ${file.path}`);
    const result = await processFile(file, accessToken, env, logs);
    if (result.success) {
      processed++;
      logs.push(`✓ Success: ${file.name}`);
    } else {
      logs.push(`✗ Failed: ${file.name} - ${result.error}`);
    }
  }

  return {
    filesFound: files.length,
    filesProcessed: processed,
    message: 'Success',
    logs
  };
}

async function processFile(file, accessToken, env, logs) {
  try {
    // Extract business name from path
    const businessName = extractBusinessNameFromPath(file.path);

    if (!businessName) {
      logs.push(`  Skipped: no business name in path`);
      return { success: false, error: 'No business name' };
    }

    logs.push(`  Business: ${businessName}`);

    // Make file public
    await makeFilePublic(file.id, accessToken);
    logs.push(`  Made public`);

    // Generate mobile-optimized thumbnail URL (800px width)
    const publicUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w800`;
    logs.push(`  URL: ${publicUrl}`);

    // Update Google Sheets
    const updateResult = await updateSheets(businessName, publicUrl, accessToken, env.SHEETS_ID, logs);

    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    return { success: true };
  } catch (error) {
    logs.push(`  Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function getGoogleAccessToken(env) {
  const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);

  const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));

  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const jwtClaimSetEncoded = btoa(JSON.stringify(jwtClaimSet));
  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;

  // Import private key
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signatureInput)
  );

  const jwtSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${signatureInput}.${jwtSignature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getRecentDriveFiles(accessToken, folderId, logs = []) {
  // Simplified: Just get business folders, don't recurse
  const foldersQuery = `mimeType = 'application/vnd.google-apps.folder' and '${folderId}' in parents and trashed = false`;

  logs.push(`Searching business folders...`);

  const foldersResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(foldersQuery)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const foldersData = await foldersResponse.json();
  const businessFolders = foldersData.files || [];

  logs.push(`Found ${businessFolders.length} business folders`);

  if (businessFolders.length === 0) {
    if (foldersData.error) {
      logs.push(`Error: ${foldersData.error.message}`);
    }
    return [];
  }

  // For each business folder, find INFO subfolder
  const allFiles = [];

  for (const businessFolder of businessFolders) {
    logs.push(`Checking ${businessFolder.name}...`);

    // Find "Info" subfolder
    const infoQuery = `mimeType = 'application/vnd.google-apps.folder' and name = 'Info' and '${businessFolder.id}' in parents and trashed = false`;

    const infoResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(infoQuery)}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const infoData = await infoResponse.json();
    const infoFolders = infoData.files || [];

    if (infoFolders.length === 0) {
      logs.push(`  No Info folder found`);
      continue;
    }

    const infoFolder = infoFolders[0];
    logs.push(`  Found Info folder: ${infoFolder.id}`);

    // Get all images in Info folder
    const imagesQuery = `mimeType contains 'image/' and '${infoFolder.id}' in parents and trashed = false`;

    const imagesResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(imagesQuery)}&fields=files(id,name)&pageSize=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const imagesData = await imagesResponse.json();
    const images = imagesData.files || [];

    logs.push(`  Found ${images.length} images`);

    images.forEach(img => {
      allFiles.push({
        ...img,
        businessName: businessFolder.name,
        path: `/콘텐츠팩토리/${businessFolder.name}/Info/${img.name}`
      });
    });
  }

  return allFiles;
}

function extractBusinessNameFromPath(path) {
  // Extract business name from path
  // Example: /콘텐츠팩토리/상상피아노/INFO/photo.jpg -> 상상피아노
  // Example: /콘텐츠팩토리/00001/INFO/photo.jpg -> 00001

  const parts = path.split('/').filter(p => p);

  // Expected structure: /콘텐츠팩토리/[business_name]/INFO/photo.jpg
  // Index 0: 콘텐츠팩토리
  // Index 1: business_name
  // Index 2: INFO
  // Index 3: photo.jpg

  if (parts.length >= 2 && parts[0] === '콘텐츠팩토리') {
    return parts[1]; // business name or subdomain
  }

  return null;
}

async function makeFilePublic(fileId, accessToken) {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    }
  );
}

async function updateSheets(businessName, publicUrl, accessToken, sheetsId, logs) {
  try {
    // Get all rows
    logs.push(`  Reading Sheets...`);
    const getResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/Sheet1!A:L`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      logs.push(`  Sheets read error: ${getResponse.status} - ${errorText}`);
      return { success: false, error: `Sheets read failed: ${getResponse.status}` };
    }

    const getData = await getResponse.json();
    const rows = getData.values || [];
    logs.push(`  Found ${rows.length} rows`);

    // Find row with matching business_name
    let rowIndex = -1;
    let currentImages = '';
    let matchedBusinessName = '';

    for (let i = 1; i < rows.length; i++) { // Skip header
      const rowBusinessName = rows[i][1]; // Column B = business_name
      const rowSubdomain = rows[i][0]; // Column A = subdomain

      // Match by business_name OR subdomain
      if (rowBusinessName === businessName || rowSubdomain === businessName) {
        rowIndex = i + 1; // Sheet rows are 1-indexed
        currentImages = rows[i][8] || ''; // Column I = info_images
        matchedBusinessName = rowBusinessName || rowSubdomain;
        logs.push(`  Matched row ${rowIndex}: ${matchedBusinessName}`);
        break;
      }
    }

    if (rowIndex === -1) {
      logs.push(`  Business "${businessName}" not found in Sheets`);
      return { success: false, error: 'Business not found' };
    }

    // Append new URL
    const updatedImages = currentImages
      ? `${currentImages},${publicUrl}`
      : publicUrl;

    logs.push(`  Updating I${rowIndex}...`);

    // Update cell
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/Sheet1!I${rowIndex}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [[updatedImages]]
        })
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      logs.push(`  Sheets update error: ${updateResponse.status} - ${errorText}`);
      return { success: false, error: `Sheets update failed: ${updateResponse.status}` };
    }

    logs.push(`  Updated info_images for "${matchedBusinessName}"`);
    return { success: true };
  } catch (error) {
    logs.push(`  Exception: ${error.message}`);
    return { success: false, error: error.message };
  }
}
