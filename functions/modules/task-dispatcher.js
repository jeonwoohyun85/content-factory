// Cloud Tasks Dispatcher - 거래처별 포스팅 Task 생성

const { CloudTasksClient } = require('@google-cloud/tasks');

const client = new CloudTasksClient();

/**
 * Cloud Tasks에 포스팅 Task 등록
 * @param {string} subdomain - 거래처 서브도메인
 * @param {string} projectId - GCP 프로젝트 ID
 * @param {string} location - Cloud Tasks 큐 리전
 * @param {string} queue - Cloud Tasks 큐 이름
 * @param {string} functionUrl - Cloud Functions URL
 * @returns {Promise<void>}
 */
async function createPostingTask(subdomain, projectId, location, queue, functionUrl) {
  const parent = client.queuePath(projectId, location, queue);

  const task = {
    httpRequest: {
      httpMethod: 'POST',
      url: `${functionUrl}/task/posting`,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify({ subdomain })).toString('base64'),
      oidcToken: {
        serviceAccountEmail: `${projectId}@appspot.gserviceaccount.com`,
      },
    },
  };

  try {
    const [response] = await client.createTask({ parent, task });
    console.log(`[TASK] Created: ${subdomain} - ${response.name}`);
    return response;
  } catch (error) {
    console.error(`[TASK ERROR] ${subdomain}: ${error.message}`);
    throw error;
  }
}

/**
 * 배치로 Task 생성 (병렬 처리)
 * @param {Array<string>} subdomains - 거래처 서브도메인 배열
 * @param {string} projectId - GCP 프로젝트 ID
 * @param {string} location - Cloud Tasks 큐 리전
 * @param {string} queue - Cloud Tasks 큐 이름
 * @param {string} functionUrl - Cloud Functions URL
 * @param {number} batchSize - 배치 크기 (기본: 100)
 * @returns {Promise<Object>} - 성공/실패 카운트
 */
async function createPostingTasksBatch(subdomains, projectId, location, queue, functionUrl, batchSize = 100) {
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  console.log(`[TASK BATCH] 시작: ${subdomains.length}개 거래처, 배치 크기 ${batchSize}`);

  // 배치로 분할 처리
  for (let i = 0; i < subdomains.length; i += batchSize) {
    const batch = subdomains.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(`[TASK BATCH ${batchNum}] 처리 중: ${batch.length}개`);

    const batchPromises = batch.map(subdomain =>
      createPostingTask(subdomain, projectId, location, queue, functionUrl)
        .then(() => {
          successCount++;
          return { subdomain, success: true };
        })
        .catch(error => {
          failCount++;
          errors.push({ subdomain, error: error.message });
          return { subdomain, success: false, error: error.message };
        })
    );

    await Promise.all(batchPromises);

    console.log(`[TASK BATCH ${batchNum}] 완료: ${batch.length}개 (성공: ${successCount}, 실패: ${failCount})`);
  }

  console.log(`[TASK BATCH] 전체 완료: ${successCount}/${subdomains.length} 성공`);

  return {
    total: subdomains.length,
    success: successCount,
    fail: failCount,
    errors: errors.slice(0, 10), // 최대 10개 에러만 반환
  };
}

module.exports = {
  createPostingTask,
  createPostingTasksBatch,
};
