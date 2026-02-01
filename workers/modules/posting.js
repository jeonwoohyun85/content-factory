// 포스팅 자동화 메인 오케스트레이션

import {
  getClientFromSheetsForPosting,
  searchWithGeminiForPosting,
  generatePostWithGeminiForPosting,
  getFolderImagesForPosting,
  getClientFoldersForPosting,
  getLastUsedFolderForPosting,
  getNextFolderForPosting,
  saveToLatestPostingSheet
} from './posting-helpers.js';
import { getGoogleAccessTokenForPosting } from './auth.js';
import { deleteCachedHTML } from './cache.js';

export async function generatePostingForClient(subdomain, env) {

  const logs = [];



  try {

    // Step 1: 거래처 정보 조회

    logs.push('거래처 정보 조회 중...');

    const client = await getClientFromSheetsForPosting(subdomain, env);

    if (!client) {

      return { success: false, error: 'Client not found', logs };

    }

    logs.push(`거래처: ${client.business_name}`);



    // Step 1.5: Google Drive 폴더 순환 선택

    logs.push('Google Drive 폴더 조회 중...');

    const accessToken = await getGoogleAccessTokenForPosting(env);

    const normalizedSubdomain = client.subdomain.replace('.make-page.com', '').replace('/', '');



    // 폴더명 컬럼 사용 (없으면 subdomain 기반 검색으로 폴백)

    const folderName = client.folder_name || null;

    if (folderName) {

      logs.push(`Drive 폴더 검색: 폴더명="${folderName}"`);

    } else {

      logs.push(`Drive 폴더 검색: subdomain=${normalizedSubdomain} (폴더명 컬럼 없음)`);

    }



    const folders = await getClientFoldersForPosting(folderName, normalizedSubdomain, accessToken, env, logs);



    if (folders.length === 0) {

      return { success: false, error: 'No folders found (Info/Video excluded)', logs };

    }



    logs.push(`폴더 ${folders.length}개 발견`);



    const folderData = await getLastUsedFolderForPosting(subdomain, accessToken, env);

    const lastFolder = folderData?.lastFolder || null;

    const archiveHeaders = folderData?.archiveHeaders || [];

    const nextFolder = getNextFolderForPosting(folders, lastFolder);

    logs.push(`선택된 폴더: ${nextFolder}`);



    // Step 1.7: 선택된 폴더에서 모든 이미지 가져오기

    logs.push('폴더 내 이미지 조회 중...');

    const images = await getFolderImagesForPosting(normalizedSubdomain, nextFolder, accessToken, env, logs);

    logs.push(`이미지 ${images.length}개 발견`);



    // 이미지 없어도 텍스트 포스팅 생성 진행



    // Step 2: 웹 검색 (Gemini 2.5 Flash)

    logs.push('웹 검색 시작...');

    const trendsData = await searchWithGeminiForPosting(client, env);

    logs.push(`웹 검색 완료: ${trendsData.substring(0, 100)}...`);



    // Step 3: 포스팅 생성 (Gemini 3.0 Pro)

    logs.push('포스팅 생성 시작...');

    const postData = await generatePostWithGeminiForPosting(client, trendsData, images, env);

    logs.push(`포스팅 생성 완료: ${postData.title}`);



    // Step 3.5: 이미지 URL 추가

    const imageUrls = images.map(img => `https://drive.google.com/thumbnail?id=${img.id}&sz=w800`).join(',');

    postData.images = imageUrls;



    // Step 4: 저장소 + 최신 포스팅 시트 저장

    logs.push('저장소/최신포스팅 시트 저장 시작...');

    await saveToLatestPostingSheet(client, postData, normalizedSubdomain, nextFolder, accessToken, env, archiveHeaders);

    logs.push('저장소/최신포스팅 시트 저장 완료');

    

    // Step 5: 캐시 무효화 (최신 포스팅 즉시 반영)

    await deleteCachedHTML(normalizedSubdomain, env);

    logs.push('캐시 삭제 완료');



    return {

      success: true,

      post: postData,

      logs

    };



  } catch (error) {

    logs.push(`에러: ${error.message}`);

    return {

      success: false,

      error: error.message,

      logs

    };

  }

}
