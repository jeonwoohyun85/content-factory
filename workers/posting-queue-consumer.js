// CAPS Posting Queue Consumer Worker
// 포스팅 생성 요청을 Queue에서 받아서 처리

export default {
  async queue(batch, env) {
    console.log(`Processing ${batch.messages.length} messages from queue`);

    for (const message of batch.messages) {
      try {
        const { client_id, scheduled_time, attempt = 1 } = message.body;

        console.log(`Processing posting for client ${client_id} (attempt ${attempt})`);

        // API 서버에 포스팅 생성 요청
        const response = await fetch(`${env.API_BASE_URL}/api/generate-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id,
            scheduled_time,
            from_queue: true
          }),
          signal: AbortSignal.timeout(180000) // 3분 타임아웃
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to generate posting: ${response.status} ${errorText}`);

          // 3회 미만이면 재시도
          if (attempt < 3) {
            console.log(`Retrying (${attempt + 1}/3)...`);
            message.retry();
          } else {
            console.error(`Max retries reached for client ${client_id}, giving up`);
            // DLQ로 이동 (자동)
            message.ack(); // 메시지 확인 후 제거
          }
        } else {
          const result = await response.json();
          console.log(`Successfully generated posting for client ${client_id}: ${result.title || 'N/A'}`);
          message.ack(); // 성공 시 메시지 확인
        }

      } catch (error) {
        console.error(`Error processing message: ${error.message}`);

        const attempt = message.body.attempt || 1;

        // 3회 미만이면 재시도
        if (attempt < 3) {
          console.log(`Retrying due to error (${attempt + 1}/3)...`);
          message.retry({
            delaySeconds: 60 // 1분 후 재시도
          });
        } else {
          console.error(`Max retries reached, moving to DLQ`);
          message.ack(); // 메시지 확인 후 제거 (자동 DLQ 이동)
        }
      }
    }
  }
};
