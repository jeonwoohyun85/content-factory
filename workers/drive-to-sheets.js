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
  // Check if SERVICE ACCOUNT JSON exists
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return {
      error: 'GOOGLE_SERVICE_ACCOUNT_JSON not found in env',
      filesFound: 0,
      filesProcessed: 0
    };
  }

  const accessToken = await getGoogleAccessToken(env);

  // Get recent files from Drive (last 10 minutes)
  const files = await getRecentDriveFiles(accessToken, env.DRIVE_FOLDER_ID);

  console.log(`Total files found: ${files.length}`);

  if (files.length === 0) {
    console.log('No files found - check Service Account permissions');
    return {
      filesFound: 0,
      filesProcessed: 0,
      message: 'No files found - check Service Account permissions'
    };
  }

  let processed = 0;
  for (const file of files) {
    console.log(`Processing: ${file.path}`);
    await processFile(file, accessToken, env);
    processed++;
  }

  return {
    filesFound: files.length,
    filesProcessed: processed,
    message: 'Success'
  };
}

async function processFile(file, accessToken, env) {
  try {
    // Extract business name from path
    const businessName = extractBusinessNameFromPath(file.path);

    if (!businessName) {
      console.log(`Skipping ${file.path} - no valid business name in path`);
      return;
    }

    console.log(`Processing ${file.path} for business ${businessName}`);

    // Make file public
    await makeFilePublic(file.id, accessToken);

    // Generate mobile-optimized thumbnail URL (800px width)
    const publicUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w800`;

    // Update Google Sheets
    await updateSheets(businessName, publicUrl, accessToken, env.SHEETS_ID);

    console.log(`Successfully processed ${file.name}`);
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
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

async function getRecentDriveFiles(accessToken, folderId) {
  // Step 1: Find all subdirectories under콘텐츠팩토리 (business name folders)
  const foldersQuery = `mimeType = 'application/vnd.google-apps.folder' and '${folderId}' in parents and trashed = false`;

  console.log(`Searching folders with query: ${foldersQuery}`);
  console.log(`Access token (first 20 chars): ${accessToken.substring(0, 20)}...`);

  const foldersResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(foldersQuery)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  console.log(`Drive API Response Status: ${foldersResponse.status}`);

  const foldersData = await foldersResponse.json();
  const businessFolders = foldersData.files || [];

  console.log(`Found ${businessFolders.length} business folders`);

  if (businessFolders.length === 0) {
    console.log('No business folders found. Response:', JSON.stringify(foldersData));
    if (foldersData.error) {
      console.error('Google Drive API Error:', JSON.stringify(foldersData.error));
    }
  }

  businessFolders.forEach(f => console.log(`  - ${f.name} (${f.id})`));

  // Step 2: For each business folder, find all image files recursively
  const allFiles = [];

  for (const businessFolder of businessFolders) {
    console.log(`Searching in folder: ${businessFolder.name}`);
    const images = await getImagesInFolder(businessFolder.id, businessFolder.name, accessToken);
    allFiles.push(...images);
  }

  console.log(`Found ${allFiles.length} total image files`);

  return allFiles;
}

async function getImagesInFolder(folderId, businessName, accessToken) {
  const images = [];

  // Find all files (images and folders) in this folder
  const query = `'${folderId}' in parents and trashed = false`;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const data = await response.json();
  const files = data.files || [];

  for (const file of files) {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      // Recursively search subfolders
      const subImages = await getImagesInFolder(file.id, businessName, accessToken);
      images.push(...subImages);
    } else if (file.mimeType.startsWith('image/')) {
      // Image file found
      const path = await getFilePath(file, accessToken);
      images.push({ ...file, path });
      console.log(`Found image: ${path}`);
    }
  }

  return images;
}

async function getFilePath(file, accessToken) {
  const pathParts = [file.name];
  let currentParents = file.parents || [];

  while (currentParents.length > 0) {
    const parentId = currentParents[0];

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${parentId}?fields=name,parents`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const parentData = await response.json();
    pathParts.unshift(parentData.name);
    currentParents = parentData.parents || [];
  }

  return '/' + pathParts.join('/');
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

async function updateSheets(businessName, publicUrl, accessToken, sheetsId) {
  // Get all rows
  const getResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/Sheet1!A:L`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const getData = await getResponse.json();
  const rows = getData.values || [];

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
      break;
    }
  }

  if (rowIndex === -1) {
    console.log(`Business name "${businessName}" not found in Sheets`);
    return;
  }

  // Append new URL
  const updatedImages = currentImages
    ? `${currentImages},${publicUrl}`
    : publicUrl;

  // Update cell
  await fetch(
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

  console.log(`Updated info_images for "${matchedBusinessName}"`);
}
