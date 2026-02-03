const functions = require('@google-cloud/functions-framework');

// TODO: 모듈 import 및 Cloud Functions 로직 구현
// 현재는 Worker 코드를 Functions로 이전 중

functions.http('main', async (req, res) => {
  res.json({
    status: 'Cloud Functions initialized',
    message: 'Migration in progress'
  });
});
