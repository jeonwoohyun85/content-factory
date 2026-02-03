// 포스팅 자동화 메인 오케스트레이션

const { getClientFromSheetsForPosting, searchWithClaudeForPosting, generatePostWithClaudeForPosting, getFolderImagesForPosting, getClientFoldersForPosting, getLastUsedFolderForPosting, getNextFolderForPosting, removeDuplicatesFromLatestPosting, saveToLatestPostingSheet } = require('./posting-helpers.js');
const { sendNtfyAlert } = require('./utils.js');

async function generatePostingForClient(subdomain, env) {

  const logs = [];
  let client = null;
  let nextFolder = null;
  let images = [];



  try {

    // Step 1: 거래처 정보 조회

    logs.push('거래처 정보 조회 중...');

    client = await getClientFromSheetsForPosting(subdomain, env);

    if (!client) {

      throw new Error('Client not found');

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

      throw new Error('No folders found (Info/Video excluded)');

    }



    logs.push(`폴더 ${folders.length}개 발견`);



    const folderData = await getLastUsedFolderForPosting(subdomain, accessToken, env);

    const lastFolder = folderData?.lastFolder || null;

    const archiveHeaders = folderData?.archiveHeaders || [];

    nextFolder = getNextFolderForPosting(folders, lastFolder);

    logs.push(`선택된 폴더: ${nextFolder}`);



    // Step 1.7: 선택된 폴더에서 모든 이미지 가져오기

    logs.push('폴더 내 이미지 조회 중...');

    images = await getFolderImagesForPosting(normalizedSubdomain, nextFolder, accessToken, env, logs);

    logs.push(`이미지 ${images.length}개 발견`);



    // 이미지 없어도 텍스트 포스팅 생성 진행



    // Step 2: 웹 검색 (Claude Haiku 4.5)

    logs.push('웹 검색 시작...');

    const trendsData = await searchWithClaudeForPosting(client, env);

    logs.push(`웹 검색 완료: ${trendsData.substring(0, 100)}...`);



    // Step 3: 포스팅 생성 (Claude Sonnet 4.5)

    logs.push('포스팅 생성 시작...');

    const postData = await generatePostWithClaudeForPosting(client, trendsData, images, env);

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



    // 품질 검증 정보 추가
    const specialCharCount = (postData.title.match(/[^a-zA-Z0-9가-힣\s]/g) || []).length;
    const specialCharRatio = specialCharCount / postData.title.length;

    // 인터리브 검증: 이미지 위치 분석
    const bodyHtml = postData.body;
    const bodyLength = bodyHtml.length;
    const imgRegex = /<img[^>]*>/g;
    const imgMatches = [...bodyHtml.matchAll(imgRegex)];
    const imgPositions = imgMatches.map(m => m.index);
    
    let firstImagePercent = 0;
    let lastImagePercent = 0;
    let imageDistribution = 'none';
    
    if (imgPositions.length > 0) {
      firstImagePercent = Math.round((imgPositions[0] / bodyLength) * 100);
      lastImagePercent = Math.round((imgPositions[imgPositions.length - 1] / bodyLength) * 100);
      
      // 이미지가 골고루 퍼져있는지 (간격이 15% 이상) 확인
      if (imgPositions.length >= 2) {
        const gaps = [];
        for (let i = 0; i < imgPositions.length - 1; i++) {
          const gap = ((imgPositions[i + 1] - imgPositions[i]) / bodyLength) * 100;
          gaps.push(gap);
        }
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        imageDistribution = avgGap > 15 ? 'interleaved' : 'clustered';
      } else {
        imageDistribution = 'single';
      }
    }

    return {
      success: true,
      post: postData,
      logs,
      validation: {
        title_length: postData.title.length,
        body_length: postData.body.length,
        image_count: images.length,
        language: client.language,
        subdomain: normalizedSubdomain,
        business_name: client.business_name,
        special_char_ratio: Math.round(specialCharRatio * 100),
        first_image_position: firstImagePercent,
        last_image_position: lastImagePercent,
        image_distribution: imageDistribution
      }
    };



  } catch (error) {

    logs.push(`에러: ${error.message}`);

    // 실패 단계 파악
    let stage = '알 수 없음';
    if (logs.some(log => log.includes('저장소/최신포스팅'))) {
      stage = '시트 저장';
    } else if (logs.some(log => log.includes('포스팅 생성'))) {
      stage = '포스팅 생성';
    } else if (logs.some(log => log.includes('웹 검색'))) {
      stage = '웹 검색';
    } else if (logs.some(log => log.includes('이미지 조회'))) {
      stage = '이미지 조회';
    } else if (logs.some(log => log.includes('폴더 조회'))) {
      stage = '폴더 조회';
    } else if (logs.some(log => log.includes('거래처 정보'))) {
      stage = '거래처 조회';
    }

    // ntfy 제거됨 - 텔레그램 사용

    return {

      success: false,

      error: error.message,

      logs

    };

  }

}
module.exports = { generatePostingForClient };
