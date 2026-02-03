// Google OAuth JWT 인증

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

async function getGoogleAccessTokenForPosting(env) {

  const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);



  // Base64URL 인코딩 (UTF-8 안전)

  function base64urlEncode(str) {

    const base64 = btoa(unescape(encodeURIComponent(str)));

    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  }



  const jwtHeader = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));

  const now = Math.floor(Date.now() / 1000);

  const jwtClaimSet = {

    iss: serviceAccount.client_email,

    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',

    aud: 'https://oauth2.googleapis.com/token',

    exp: now + 3600,

    iat: now

  };



  const jwtClaimSetEncoded = base64urlEncode(JSON.stringify(jwtClaimSet));

  const signatureInput = `${jwtHeader}.${jwtClaimSetEncoded}`;



  const privateKey = await crypto.subtle.importKey(

    'pkcs8',

    pemToArrayBuffer(serviceAccount.private_key),

    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },

    false,

    ['sign']

  );



  const signature = await crypto.subtle.sign(

    'RSASSA-PKCS1-v1_5',

    privateKey,

    new TextEncoder().encode(signatureInput)

  );



  const jwtSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))

    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');



  const jwt = `${signatureInput}.${jwtSignature}`;



  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {

    method: 'POST',

    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },

    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`

  });



  if (!tokenResponse.ok) {

    const errorText = await tokenResponse.text();

    throw new Error(`OAuth token error (${tokenResponse.status}): ${errorText}`);

  }



  const responseText = await tokenResponse.text();

  if (!responseText) {

    throw new Error('Empty OAuth token response');

  }



  const tokenData = JSON.parse(responseText);

  return tokenData.access_token;

}

module.exports = { getGoogleAccessTokenForPosting };
