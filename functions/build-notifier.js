// Cloud Build 완료 시 Telegram 알림
// Pub/Sub 트리거

const axios = require('axios');

exports.buildNotifier = async (message, context) => {
  try {
    // Pub/Sub 메시지 디코딩
    const buildData = JSON.parse(Buffer.from(message.data, 'base64').toString());

    const buildId = buildData.id;
    const status = buildData.status;
    const substitutions = buildData.substitutions || {};

    // SUCCESS 또는 FAILURE만 알림
    if (status !== 'SUCCESS' && status !== 'FAILURE' && status !== 'TIMEOUT') {
      console.log(`Skipping notification for status: ${status}`);
      return;
    }

    // 빌드 시간 계산
    const timing = buildData.timing || {};
    const buildTiming = timing.BUILD || {};
    let duration = '';
    if (buildTiming.startTime && buildTiming.endTime) {
      const start = new Date(buildTiming.startTime);
      const end = new Date(buildTiming.endTime);
      const seconds = Math.floor((end - start) / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      duration = minutes > 0 ? `${minutes}분 ${secs}초` : `${secs}초`;
    }

    // Commit SHA에서 메시지 추출
    const source = buildData.source || {};
    const repoSource = source.repoSource || {};
    const commitSha = repoSource.commitSha || substitutions.COMMIT_SHA || 'unknown';

    // GitHub API로 commit message 조회
    let commitMessage = '(커밋 메시지 없음)';
    if (commitSha && commitSha !== 'unknown') {
      try {
        const githubUrl = `https://api.github.com/repos/jeonwoohyun85/content-factory/commits/${commitSha}`;
        const response = await axios.get(githubUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Content-Factory-Build-Notifier'
          }
        });
        commitMessage = response.data.commit.message.split('\n')[0]; // 첫 줄만
      } catch (error) {
        console.error('GitHub API error:', error.message);
      }
    }

    // KST 시간
    const kstNow = new Date(Date.now() + (9 * 60 * 60 * 1000));
    const dateStr = kstNow.toISOString().split('T')[0];
    const timeStr = kstNow.toTimeString().split(' ')[0].slice(0, 5);

    // Telegram 메시지 구성
    const emoji = status === 'SUCCESS' ? '✅' : '❌';
    const statusText = status === 'SUCCESS' ? '배포 성공' : '배포 실패';

    let telegramMessage = `${emoji} ${statusText}\n\n`;
    telegramMessage += `작업: ${commitMessage}\n\n`;
    if (duration) {
      telegramMessage += `시간: ${duration}\n`;
    }
    telegramMessage += `빌드: ${buildId.substring(0, 8)}\n`;
    telegramMessage += `배포 시각: ${dateStr} ${timeStr} KST`;

    if (status === 'FAILURE') {
      const logUrl = buildData.logUrl || `https://console.cloud.google.com/cloud-build/builds/${buildId}?project=content-factory-1770105623`;
      telegramMessage += `\n\n로그: ${logUrl}`;
    }

    // Telegram 전송 (Secret Manager에서 토큰/챗ID 가져오기)
    // Cloud Functions Gen2는 환경변수로 자동 주입됨
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Telegram credentials not found');
      return;
    }

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: telegramMessage,
      parse_mode: 'HTML'
    });

    console.log(`Notification sent for build ${buildId}: ${status}`);
  } catch (error) {
    console.error('Build notifier error:', error);
    throw error;
  }
};
