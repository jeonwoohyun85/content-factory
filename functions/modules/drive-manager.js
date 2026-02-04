// Google Drive 폴더 및 이미지 관리 모듈

const { normalizeSubdomain, fetchWithTimeout } = require('./utils.js');

// 포스팅당 최대 이미지 개수
const MAX_IMAGES_PER_POSTING = 10;

async function getFolderImagesForPosting(subdomain, folderName, accessToken, env, logs) {

    const DRIVE_FOLDER_ID = env.DRIVE_FOLDER_ID || '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';



    const businessFolderQuery = `mimeType = 'application/vnd.google-apps.folder' and name contains '${subdomain}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`;



    const businessFolderResponse = await fetch(

        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(businessFolderQuery)}&fields=files(id,
  name)`,

        { headers: { Authorization: `Bearer ${accessToken}` } }

    );



    const businessFolderData = await businessFolderResponse.json();

    if (!businessFolderData.files || businessFolderData.files.length === 0) {

        logs.push('이미지 조회: 거래처 폴더 없음');

        return [];

    }



    const businessFolderId = businessFolderData.files[0].id;

    logs.push(`이미지 조회: 거래처 폴더 ID ${businessFolderId}`);



    const targetFolderQuery = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and '${businessFolderId}' in parents and trashed = false`;



    const targetFolderResponse = await fetch(

        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(targetFolderQuery)}&fields=files(id,
  name)`,

        { headers: { Authorization: `Bearer ${accessToken}` } }

    );



    const targetFolderData = await targetFolderResponse.json();

    logs.push(`타겟 폴더 검색 결과: ${JSON.stringify(targetFolderData)}`);



    if (!targetFolderData.files || targetFolderData.files.length === 0) {

        logs.push('이미지 조회: 타겟 폴더 없음');

        return [];

    }



    const targetFolderId = targetFolderData.files[0].id;

    logs.push(`이미지 조회: 타겟 폴더 ID ${targetFolderId}`);



    const filesQuery = `'${targetFolderId}' in parents and trashed = false`;



    const filesResponse = await fetch(

        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(filesQuery)}&fields=files(id,
  name,
  mimeType)&pageSize=100`,

        { headers: { Authorization: `Bearer ${accessToken}` } }

    );



    const filesData = await filesResponse.json();

    logs.push(`파일 검색 결과: ${JSON.stringify(filesData)}`);



    let imageFiles = (filesData.files || []).filter(f => f.mimeType && f.mimeType.startsWith('image/'));

    logs.push(`이미지 파일 ${imageFiles.length}개 필터링됨`);



    // 최대 이미지 개수 초과 시 랜덤 선택

    if (imageFiles.length > MAX_IMAGES_PER_POSTING) {

        imageFiles = imageFiles.sort(() => Math.random() - 0.5).slice(0, MAX_IMAGES_PER_POSTING);

        logs.push(`${MAX_IMAGES_PER_POSTING}개 초과: 랜덤 ${imageFiles.length}개 선택`);

    }



    // 병렬 다운로드 (속도 향상)

    const downloadPromises = imageFiles.map(async (file) => {

        try {

            logs.push(`썸네일 다운로드: ${file.name}`);



            // Google Drive 썸네일 API 사용 (w400 크기)

            const thumbnailUrl = `https://lh3.googleusercontent.com/d/${file.id}=w400`;

            const imageResponse = await fetch(thumbnailUrl);



            if (!imageResponse.ok) {

                logs.push(`썸네일 다운로드 실패: ${file.name} - ${imageResponse.status}`);

                return null;

            }



            const arrayBuffer = await imageResponse.arrayBuffer();

            const bytes = new Uint8Array(arrayBuffer);



            let binary = '';

            const chunkSize = 8192;

            for (let i = 0; i < bytes.length; i += chunkSize) {

                const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));

                binary += String.fromCharCode.apply(null, chunk);

            }

            const base64 = btoa(binary);



            logs.push(`썸네일 다운로드 완료: ${file.name}`);

            return {

                id: file.id,

                name: file.name,

                mimeType: file.mimeType,

                data: base64

            };

        } catch (error) {

            logs.push(`썸네일 다운로드 에러: ${file.name} - ${error.message}`);

            return null;

        }

    });



    const results = await Promise.all(downloadPromises);

    const images = results.filter(img => img !== null);



    logs.push(`총 ${images.length}개 이미지 다운로드 완료`);

    return images;

}

async function getClientFoldersForPosting(folderName, subdomain, accessToken, env, logs) {

    const DRIVE_FOLDER_ID = env.DRIVE_FOLDER_ID || '1JiVmIkliR9YrPIUPOn61G8Oh7h9HTMEt';



    // 폴더명이 있으면 정확한 매칭, 없으면 subdomain 포함 검색 (폴백)

    const businessFolderQuery = folderName

        ? `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`

        : `mimeType = 'application/vnd.google-apps.folder' and name contains '${subdomain}' and '${DRIVE_FOLDER_ID}' in parents and trashed = false`;



    const businessFolderResponse = await fetch(

        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(businessFolderQuery)}&fields=files(id,
  name)`,

        { headers: { Authorization: `Bearer ${accessToken}` } }

    );



    const businessFolderData = await businessFolderResponse.json();

    logs.push(`거래처 폴더 검색 결과: ${JSON.stringify(businessFolderData)}`);



    if (!businessFolderData.files || businessFolderData.files.length === 0) {

        logs.push('거래처 폴더를 찾을 수 없음');

        return [];

    }



    const businessFolderId = businessFolderData.files[0].id;

    logs.push(`거래처 폴더 ID: ${businessFolderId}`);



    const subFoldersQuery = `mimeType = 'application/vnd.google-apps.folder' and '${businessFolderId}' in parents and trashed = false`;



    const subFoldersResponse = await fetch(

        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subFoldersQuery)}&fields=files(id,
  name)&orderBy=name`,

        { headers: { Authorization: `Bearer ${accessToken}` } }

    );



    const subFoldersData = await subFoldersResponse.json();

    logs.push(`하위 폴더 조회 결과: ${JSON.stringify(subFoldersData)}`);



    const folders = (subFoldersData.files || [])

        .map(f => f.name)

        .filter(name => {

            const lowerName = name.toLowerCase();

            return lowerName !== 'info' && lowerName !== 'video';

        })

        .sort();



    logs.push(`필터링된 폴더: ${JSON.stringify(folders)}`);



    return folders;

}

async function getLastUsedFolderForPosting(subdomain, accessToken, env) {

    try {
        const latestSheetName = env.LATEST_POSTING_SHEET_NAME || '최신_포스팅';
        const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${encodeURIComponent("'" + latestSheetName + "'!A:Z")}`;

        const response = await fetchWithTimeout(
            sheetsUrl,
            { headers: { Authorization: `Bearer ${accessToken}` } },
            10000
        );

        if (!response.ok) return { lastFolder: null };

        const data = await response.json();
        const rows = data.values || [];

        if (rows.length < 2) return { lastFolder: null };

        const headers = rows[0];
        const domainIndex = headers.indexOf('도메인');
        const folderIndex = headers.indexOf('폴더명');

        if (domainIndex === -1 || folderIndex === -1) return { lastFolder: null };

        // 해당 거래처 찾기
        const targetDomain = `${subdomain}.make-page.com`;
        for (let i = 1; i < rows.length; i++) {
            const rowDomain = normalizeSubdomain(rows[i][domainIndex] || '');
            if (rowDomain === subdomain) {
                return { lastFolder: rows[i][folderIndex] || null };
            }
        }

        return { lastFolder: null };
    } catch (error) {
        console.error('getLastUsedFolderForPosting error:', error);
        return { lastFolder: null };
    }

}

function getNextFolderForPosting(folders, lastFolder) {

    if (folders.length === 0) {

        return null;

    }



    // 순환 로직

    if (!lastFolder) {

        return folders[0];

    }



    const currentIndex = folders.indexOf(lastFolder);

    if (currentIndex === -1) {

        return folders[0];

    }



    const nextIndex = (currentIndex + 1) % folders.length;

    return folders[nextIndex];

}

module.exports = {
    getFolderImagesForPosting,
    getClientFoldersForPosting,
    getLastUsedFolderForPosting,
    getNextFolderForPosting
};
