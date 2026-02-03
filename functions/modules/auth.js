// Google OAuth using Application Default Credentials
const { GoogleAuth } = require('google-auth-library');

async function getGoogleAccessTokenForPosting(env) {
  // Use Application Default Credentials (Cloud Functions Service Account)
  const auth = new GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly'
    ]
  });
  
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  
  return accessToken.token;
}

module.exports = { getGoogleAccessTokenForPosting };
