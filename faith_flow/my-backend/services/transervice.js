// ==================== services/transService.js ====================
const WebSocket = require('ws');

/**
 * 語音轉錄服務 - 使用 Deepgram API
 */
class TranscriptionService {
  constructor() {
    this.DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "86ea6356170653e13a993f5c27ea0892938ca8aa";
    this.DEEPGRAM_URL = 
      "wss://api.deepgram.com/v1/listen" +
      "?language=zh-TW" +
      "&model=nova-2" +
      "&punctuate=true" +
      "&smart_format=true" +
      "&channels=1" +
      "&interim_results=true" +
      "&endpointing=300";
    this.KEEPALIVE_INTERVAL_MS = 5000;
  }

  /**
   * 處理客戶端 WebSocket 連線
   * @param {WebSocket} clientWs - 來自 APP 的 WebSocket 連線
   */
  async handleConnection(clientWs) {
    console.log('🙏 [Transcription] 祈禱者已連線');

    let deepgramWs = null;
    let keepaliveInterval = null;
    let isClosing = false;

    try {
      // 連接到 Deepgram
      deepgramWs = new WebSocket(this.DEEPGRAM_URL, {
        headers: {
          'Authorization': `Token ${this.DEEPGRAM_API_KEY}`
        }
      });

      // Deepgram 連線成功
      deepgramWs.on('open', () => {
        console.log('✅ [Transcription] Deepgram 連線成功');

        // 發送連線成功訊息給 APP
        this.sendToClient(clientWs, {
          type: 'status',
          status: 'connected',
          message: 'Deepgram 已連線'
        });

        // 啟動 keepalive（保持 Deepgram 連線）
        keepaliveInterval = setInterval(() => {
          if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, this.KEEPALIVE_INTERVAL_MS);
      });

      // 接收 Deepgram 轉錄結果
      deepgramWs.on('message', (data) => {
        try {
          const result = JSON.parse(data.toString());
          
          // 只處理轉錄結果
          if (result.type !== 'Results') {
            console.log(`[Deepgram] type=${result.type}`);
            return;
          }

          const alt = result.channel?.alternatives?.[0];
          if (!alt) return;

          const transcript = (alt.transcript || '').trim();
          if (!transcript) return;

          const confidence = alt.confidence || 0;
          const isFinal = Boolean(result.is_final);

          console.log(`[Deepgram] conf=${confidence.toFixed(2)} final=${isFinal} text='${transcript.substring(0, 50)}...'`);

          // 發送轉錄結果給 APP
          this.sendToClient(clientWs, {
            type: 'transcript',
            transcript: transcript,
            is_final: isFinal,
            speech_final: Boolean(result.speech_final),
            confidence: confidence
          });

        } catch (err) {
          console.error('❌ [Transcription] 解析 Deepgram 訊息失敗:', err.message);
        }
      });

      // Deepgram 錯誤處理
      deepgramWs.on('error', (err) => {
        console.error('❌ [Transcription] Deepgram 錯誤:', err.message);
        this.sendToClient(clientWs, {
          type: 'error',
          error: 'Deepgram 連線錯誤',
          detail: err.message
        });
      });

      // Deepgram 連線關閉
      deepgramWs.on('close', (code, reason) => {
        console.log(`🔌 [Transcription] Deepgram 已關閉 code=${code} reason=${reason || '(none)'}`);
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
        }
      });

      // 接收 APP 傳來的音訊資料
      clientWs.on('message', (data) => {
        if (isClosing) return;

        try {
          // APP 傳來的是音訊 binary data
          if (Buffer.isBuffer(data)) {
            if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
              console.log(`[音訊] ${data.length} bytes`);
              deepgramWs.send(data);
            }
          } 
          // 也支援 JSON 控制訊息
          else {
            const message = JSON.parse(data.toString());
            console.log('[APP] 控制訊息:', message);
            
            // 處理控制訊息（例如停止錄音）
            if (message.type === 'stop') {
              this.closeConnection(deepgramWs, keepaliveInterval);
            }
          }
        } catch (err) {
          console.error('❌ [Transcription] 處理 APP 訊息失敗:', err.message);
        }
      });

      // APP 斷線處理
      clientWs.on('close', () => {
        console.log('❌ [Transcription] APP 已斷線');
        isClosing = true;
        this.closeConnection(deepgramWs, keepaliveInterval);
      });

      // APP 錯誤處理
      clientWs.on('error', (err) => {
        console.error('❌ [Transcription] APP WebSocket 錯誤:', err.message);
      });

    } catch (err) {
      console.error('❌ [Transcription] 連線建立失敗:', err);
      
      this.sendToClient(clientWs, {
        type: 'error',
        error: '轉錄服務錯誤',
        detail: err.message
      });
      
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, '伺服器錯誤');
      }
    }
  }

  /**
   * 發送訊息給 APP 客戶端
   */
  sendToClient(clientWs, data) {
    if (clientWs && clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.send(JSON.stringify(data));
      } catch (err) {
        console.error('❌ [Transcription] 發送訊息失敗:', err.message);
      }
    }
  }

  /**
   * 關閉連線（清理資源）
   */
  closeConnection(deepgramWs, keepaliveInterval) {
    if (keepaliveInterval) {
      clearInterval(keepaliveInterval);
    }

    if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
      try {
        deepgramWs.send(JSON.stringify({ type: 'CloseStream' }));
        deepgramWs.close();
      } catch (err) {
        console.error('❌ [Transcription] 關閉 Deepgram 失敗:', err.message);
      }
    }
  }
}

module.exports = new TranscriptionService();