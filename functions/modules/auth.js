// Google OAuth using google-auth-library
const { GoogleAuth } = require('google-auth-library');

async function getGoogleAccessTokenForPosting(env) {
  const auth = new GoogleAuth({
    credentials: JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON),
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
