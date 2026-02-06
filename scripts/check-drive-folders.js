const fetch = require('node-fetch');
const { GoogleAuth } = require('google-auth-library');

async function listDriveFolders() {
  try {
    const auth = new GoogleAuth({
      keyFile: 'C:\\Users\\A1-M4\\.config\\gcloud\\content-factory-sa-key.json',
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const DRIVE_FOLDER_ID = '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';
    const query = `mimeType = 'application/vnd.google-apps.folder' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`;

    console.log('Drive 폴더 조회 중...\n');

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name`,
      { headers: { Authorization: `Bearer ${accessToken.token}` } }
    );

    const data = await response.json();

    if (data.files && data.files.length > 0) {
      console.log(`총 ${data.files.length}개 폴더:\n`);
      data.files.forEach(f => console.log(`- ${f.name} (${f.id})`));
    } else {
      console.log('폴더가 없습니다.');
    }

  } catch (error) {
    console.error('에러:', error.message);
  }
}

listDriveFolders();
