const { google } = require('googleapis');

async function listDriveFolders() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: 'C:\\Users\\A1-M4\\.config\\gcloud\\content-factory-sa-key.json',
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const drive = google.drive({ version: 'v3', auth });
    const DRIVE_FOLDER_ID = '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';

    console.log('Drive 폴더 조회 중...\n');

    const response = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name)',
      orderBy: 'name'
    });

    const files = response.data.files;

    if (files && files.length > 0) {
      console.log(`총 ${files.length}개 폴더:\n`);
      files.forEach(f => console.log(`- ${f.name}`));

      // 00005 관련 폴더 찾기
      console.log('\n00005 관련 폴더:');
      const related = files.filter(f => f.name.includes('00005') || f.name.includes('USA'));
      if (related.length > 0) {
        related.forEach(f => console.log(`✓ ${f.name} (${f.id})`));
      } else {
        console.log('없음');
      }
    } else {
      console.log('폴더가 없습니다.');
    }

  } catch (error) {
    console.error('에러:', error.message);
    console.error(error.stack);
  }
}

listDriveFolders();
