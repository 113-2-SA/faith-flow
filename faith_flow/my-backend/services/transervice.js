// ==================== services/transService.js ====================
const WebSocket = require('ws');

class TranscriptionService {
  constructor() {
    this.DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
    if (!this.DEEPGRAM_API_KEY) throw new Error('缺少 DEEPGRAM_API_KEY 環境變數');
    this.KEEPALIVE_INTERVAL_MS = 5000;
  }

  async handleConnection(clientWs, req) {
    const params = new URLSearchParams((req?.url || '').split('?')[1] || '');
    const lang = params.get('lang') || 'zh-TW';
    const deepgramUrl =
      'wss://api.deepgram.com/v1/listen' +
      `?language=${lang}` +
      '&model=nova-2' +
      '&punctuate=true' +
      '&smart_format=true' +
      '&channels=1' +
      '&interim_results=true' +
      '&endpointing=300';

    console.log(`🙏 [Transcription] 祈禱者已連線 lang=${lang}`);

    let deepgramWs = null;
    let keepaliveInterval = null;
    let isClosing = false;
    let isConnecting = false;
    const audioQueue = [];

    // ── 建立 Deepgram 連線（可重複呼叫，自帶 guard）─────────────────────────
    const connectDeepgram = () => {
      if (isClosing || isConnecting) return;
      if (deepgramWs?.readyState <= WebSocket.OPEN) return; // CONNECTING(0) or OPEN(1)
      isConnecting = true;

      const dg = new WebSocket(deepgramUrl, {
        headers: { Authorization: `Token ${this.DEEPGRAM_API_KEY}` },
      });
      deepgramWs = dg;

      dg.on('open', () => {
        console.log('✅ [Transcription] Deepgram 連線成功');
        isConnecting = false;
        this.sendToClient(clientWs, { type: 'status', status: 'connected', message: 'Deepgram 已連線' });

        if (keepaliveInterval) clearInterval(keepaliveInterval);
        keepaliveInterval = setInterval(() => {
          if (dg.readyState === WebSocket.OPEN) dg.send(JSON.stringify({ type: 'KeepAlive' }));
        }, this.KEEPALIVE_INTERVAL_MS);

        // 把排隊中的音訊一次沖出去
        while (audioQueue.length > 0) dg.send(audioQueue.shift());
      });

      dg.on('message', (data) => {
        try {
          const result = JSON.parse(data.toString());
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
          console.log(`[Deepgram] conf=${confidence.toFixed(2)} final=${isFinal} text='${transcript.substring(0, 50)}'`);
          this.sendToClient(clientWs, {
            type: 'transcript',
            transcript,
            is_final: isFinal,
            speech_final: Boolean(result.speech_final),
            confidence,
          });
        } catch (err) {
          console.error('❌ [Transcription] 解析 Deepgram 訊息失敗:', err.message);
        }
      });

      dg.on('error', (err) => {
        console.error('❌ [Transcription] Deepgram 錯誤:', err.message);
        isConnecting = false;
        this.sendToClient(clientWs, { type: 'error', error: 'Deepgram 連線錯誤', detail: err.message });
      });

      dg.on('close', (code, reason) => {
        const reasonStr = reason?.toString() || '(none)';
        console.log(`🔌 [Transcription] Deepgram 已關閉 code=${code} reason=${reasonStr}`);
        isConnecting = false;
        if (keepaliveInterval) { clearInterval(keepaliveInterval); keepaliveInterval = null; }
        if (!isClosing && code !== 1000) {
          this.sendToClient(clientWs, {
            type: 'error',
            error: `語音服務連線中斷 (code=${code})，請確認 Deepgram API Key 是否有效`,
          });
        }
      });
    };

    // ── 接收 APP 音訊 ────────────────────────────────────────────────────────
    clientWs.on('message', (data, isBinary) => {
      if (isClosing) return;

      if (isBinary) {
        const buf = Buffer.isBuffer(data)
          ? data
          : Array.isArray(data)
          ? Buffer.concat(data)
          : Buffer.from(data);

        if (deepgramWs?.readyState === WebSocket.OPEN) {
          console.log(`[音訊] ${buf.length} bytes → Deepgram`);
          deepgramWs.send(buf);
        } else {
          // Deepgram 尚未連線或已斷 → 排隊並觸發連線
          audioQueue.push(buf);
          connectDeepgram();
        }
      } else {
        try {
          const message = JSON.parse(data.toString());
          console.log('[APP] 控制訊息:', message);
          if (message.type === 'stop') this.closeConnection(deepgramWs, keepaliveInterval);
        } catch (err) {
          console.error('❌ [Transcription] 解析控制訊息失敗:', err.message);
        }
      }
    });

    clientWs.on('close', () => {
      console.log('❌ [Transcription] APP 已斷線');
      isClosing = true;
      this.closeConnection(deepgramWs, keepaliveInterval);
    });

    clientWs.on('error', (err) => {
      console.error('❌ [Transcription] APP WebSocket 錯誤:', err.message);
    });
  }

  sendToClient(clientWs, data) {
    if (clientWs?.readyState === WebSocket.OPEN) {
      try {
        clientWs.send(JSON.stringify(data));
      } catch (err) {
        console.error('❌ [Transcription] 發送訊息失敗:', err.message);
      }
    }
  }

  closeConnection(deepgramWs, keepaliveInterval) {
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    if (deepgramWs?.readyState === WebSocket.OPEN) {
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
