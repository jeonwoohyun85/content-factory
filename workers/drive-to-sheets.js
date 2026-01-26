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
      await processDriveChanges(env);
      return new Response('Processing completed', { status: 200 });
    }
    return new Response('Drive to Sheets Automation Worker', { status: 200 });
  }
};

async function processDriveChanges(env) {
  const accessToken = await getGoogleAccessToken(env);

  // Get recent files from Drive (last 10 minutes)
  const files = await getRecentDriveFiles(accessToken, env.DRIVE_FOLDER_ID);

  if (files.length === 0) {
    console.log('No new files found');
    return;
  }

  console.log(`Found ${files.length} new files`);

  for (const file of files) {
    await processFile(file, accessToken, env);
  }
}

async function processFile(file, accessToken, env) {
  try {
    // Extract subdomain from path
    const subdomain = extractSubdomainFromPath(file.parents, file.name);

    if (!subdomain) {
      console.log(`Skipping ${file.name} - no valid subdomain in path`);
      return;
    }

    console.log(`Processing ${file.name} for subdomain ${subdomain}`);

    // Make file public
    await makeFilePublic(file.id, accessToken);

    // Generate public URL
    const publicUrl = `https://drive.google.com/uc?export=view&id=${file.id}`;

    // Update Google Sheets
    await updateSheets(subdomain, publicUrl, accessToken, env.SHEETS_ID);

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
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const query = `'${folderId}' in parents and mimeType contains 'image/' and createdTime > '${tenMinutesAgo}' and trashed = false`;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,parents,webViewLink)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const data = await response.json();
  return data.files || [];
}

function extractSubdomainFromPath(parents, filename) {
  // TODO: Need to get full path from Drive API
  // For now, assuming filename or parent folder contains subdomain
  // Example: /콘텐츠팩토리/00001/INFO/photo.jpg

  // Simple extraction from parent folder name (needs improvement)
  const match = filename.match(/(\d{5})/);
  return match ? match[1] : null;
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

async function updateSheets(subdomain, publicUrl, accessToken, sheetsId) {
  // Get all rows
  const getResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/Sheet1!A:L`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const getData = await getResponse.json();
  const rows = getData.values || [];

  // Find row with matching subdomain
  let rowIndex = -1;
  let currentImages = '';

  for (let i = 1; i < rows.length; i++) { // Skip header
    if (rows[i][0] === subdomain) { // Column A = subdomain
      rowIndex = i + 1; // Sheet rows are 1-indexed
      currentImages = rows[i][8] || ''; // Column I = info_images
      break;
    }
  }

  if (rowIndex === -1) {
    console.log(`Subdomain ${subdomain} not found in Sheets`);
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

  console.log(`Updated info_images for subdomain ${subdomain}`);
}
