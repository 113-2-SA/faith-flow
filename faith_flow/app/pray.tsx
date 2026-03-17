import React, { useEffect, useMemo, useRef, useState } from "react";

type TranscriptMsg = {
  type: "transcript";
  transcript: string;
  is_final?: boolean;
  speech_final?: boolean;
};

type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";

const WS_URL = "ws://localhost:8000/ws/transcribe";

function pickMimeType(): string | "" {
  // 盡量用 opus/webm（Deepgram live 常見）
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of candidates) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === "function" && MR.isTypeSupported(t)) return t;
  }
  return "";
}

export default function Pray() {
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [error, setError] = useState<string>("");

  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showCross, setShowCross] = useState(false);

  const [debug, setDebug] = useState<string[]>([]);
  const pushDebug = (line: string) => {
    setDebug((prev) => {
      const next = [...prev, line];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  };

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const mimeType = useMemo(() => pickMimeType(), []);

  const combinedText = useMemo(() => {
    const a = finalText.trim();
    const b = interimText.trim();
    if (!a && !b) return "";
    if (a && b) return `${a} ${b}`;
    return a || b;
  }, [finalText, interimText]);

  const requestMic = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // 先拿到就先停掉，避免佔用；真正錄音時再開
      stream.getTracks().forEach((t) => t.stop());
      setHasMicPermission(true);
      pushDebug("[前端] 麥克風權限：允許");
    } catch (e) {
      setHasMicPermission(false);
      setError("麥克風權限被拒絕或裝置不可用。請確認瀏覽器權限與系統輸入裝置。");
      pushDebug("[前端] 麥克風權限：拒絕/失敗");
    }
  };

  const openWs = (): Promise<WebSocket> => {
    setError("");
    setWsStatus("connecting");
    pushDebug(`[前端] WebSocket 連線中：${WS_URL}`);

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(WS_URL);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
          setWsStatus("open");
          pushDebug("[前端] WebSocket 已連線");
          resolve(ws);
        };

        ws.onclose = (ev) => {
          setWsStatus("closed");
          pushDebug(`[前端] WebSocket 已關閉 code=${ev.code} reason=${ev.reason || "(none)"}`);
        };

        ws.onerror = () => {
          setWsStatus("error");
          pushDebug("[前端] WebSocket 發生錯誤");
          reject(new Error("WebSocket 連線失敗"));
        };

        ws.onmessage = (event) => {
          // 後端建議回 JSON：{type:"transcript", transcript, is_final}
          try {
            const msg = JSON.parse(String(event.data)) as TranscriptMsg;

            if (msg?.type === "transcript" && typeof msg.transcript === "string") {
              const t = msg.transcript.trim();
              if (!t) return;

              if (msg.is_final) {
                setFinalText((prev) => (prev ? prev + " " + t : t));
                setInterimText("");
              } else {
                setInterimText(t);
              }
              return;
            }

            // 若後端回其他 JSON，保留 debug
            pushDebug(`[前端] WS(JSON)：${String(event.data).slice(0, 200)}`);
          } catch {
            // 若後端直接回純文字 transcript
            const t = String(event.data || "").trim();
            if (t) {
              setFinalText((prev) => (prev ? prev + " " + t : t));
              setInterimText("");
            }
          }
        };

        socketRef.current = ws;
      } catch (e) {
        reject(e);
      }
    });
  };

  const startRecording = async () => {
    setError("");

    try {
      // 1) 建立 WS
      const ws = await openWs();

      // 2) 開麥克風
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 3) 建 MediaRecorder
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;

      recorder.onstart = () => {
        setIsRecording(true);
        pushDebug(`[前端] MediaRecorder start mime=${recorder.mimeType || "(browser default)"}`);
      };

      recorder.onstop = () => {
        pushDebug("[前端] MediaRecorder stop");
      };

      recorder.onerror = (ev) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = (ev as any)?.error?.message || "MediaRecorder 錯誤";
        setError(msg);
        pushDebug(`[前端] MediaRecorder error: ${msg}`);
      };

      recorder.ondataavailable = async (ev: BlobEvent) => {
        try {
          if (!ev.data || ev.data.size === 0) return;
          if (ws.readyState !== WebSocket.OPEN) return;

          // 送 binary
          const buf = await ev.data.arrayBuffer();
          ws.send(buf);
          pushDebug(`[音訊] ${buf.byteLength} bytes`);
        } catch (e) {
          pushDebug(`[前端] ondataavailable send error: ${(e as Error)?.message || String(e)}`);
        }
      };

      // 4) 開始分段輸出（越小越即時；250ms 常用）
      recorder.start(250);

      // 5) 清空上一輪 interim（final 你可選擇要不要清）
      setInterimText("");
    } catch (e) {
      const msg = (e as Error)?.message || "啟動錄音失敗";
      setError(msg);
      pushDebug(`[前端] startRecording 失敗: ${msg}`);
      await stopRecording(); // 盡量清理
    }
  };

  const stopRecording = async () => {
    setError("");

    try {
      // 停 recorder
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      }
      recorderRef.current = null;

      // 停 mic tracks
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;

      // 關 ws
      const ws = socketRef.current;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
      socketRef.current = null;

      setIsRecording(false);
      setWsStatus("closed");
      setInterimText("");
      setShowCross(true);
      pushDebug("[前端] 已停止錄音並清理連線");
    } catch (e) {
      const msg = (e as Error)?.message || "停止錄音失敗";
      setError(msg);
      pushDebug(`[前端] stopRecording 失敗: ${msg}`);
    }
  };

  useEffect(() => {
    // 初始檢查權限（不會跳彈窗）
    // 若你希望一進來就彈窗，就直接呼叫 requestMic()
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasMicPermission(false);
      setError("此瀏覽器不支援 getUserMedia，無法使用麥克風。");
      return;
    }
    // 不主動請求，等使用者按允許
    setHasMicPermission(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 元件卸載時清理
    return () => {
      void stopRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h2 style={{ margin: "0 0 12px 0" }}>即時祈禱轉錄</h2>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          onClick={requestMic}
          disabled={isRecording}
          style={{ padding: "8px 12px" }}
        >
          允許麥克風
        </button>

        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={hasMicPermission === false}
            style={{ padding: "8px 12px" }}
          >
            開始祈禱（錄音轉錄）
          </button>
        ) : (
          <button onClick={stopRecording} style={{ padding: "8px 12px" }}>
            結束祈禱
          </button>
        )}

        <button
          onClick={() => {
            setFinalText("");
            setInterimText("");
            setDebug([]);
            setError("");
            setShowCross(false);
          }}
          disabled={isRecording}
          style={{ padding: "8px 12px" }}
        >
          清除
        </button>

        <div style={{ alignSelf: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            麥克風權限：
            {hasMicPermission === true ? "已允許" : hasMicPermission === false ? "未允許" : "未確認"}
            {" | "}
            WS：
            {wsStatus}
            {" | "}
            錄音：
            {isRecording ? "進行中" : "未開始"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            音訊格式：{mimeType || "browser default"}
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ padding: 12, marginBottom: 12, border: "1px solid #c00", color: "#c00", borderRadius: 6 }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>
          即時結果（可修改）
        </div>
        <textarea
          value={combinedText}
          onChange={(e) => {
            setFinalText(e.target.value);
            setInterimText("");
          }}
          placeholder="等待語音輸入..."
          rows={6}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
            lineHeight: 1.5,
            fontSize: 16,
          }}
        />
        <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
          提示：講話中會顯示 interim（暫時結果），停頓後會轉成 final（定稿）累加。
        </div>
      </div>

      <details>
        <summary style={{ cursor: "pointer", marginBottom: 8 }}>除錯訊息（Debug）</summary>
        <div style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12, border: "1px solid #ddd", borderRadius: 8, padding: 12, maxHeight: 260, overflow: "auto" }}>
          {debug.length ? debug.join("\n") : "（目前沒有）"}
        </div>
      </details>

      {showCross && (
        <>
          <style>{`
            @keyframes crossFadeIn {
              0%   { opacity: 0; transform: translateY(18px) scale(0.88); }
              60%  { opacity: 1; transform: translateY(-4px) scale(1.04); }
              100% { opacity: 1; transform: translateY(0)   scale(1);    }
            }
            @keyframes glowPulse {
              0%, 100% { filter: drop-shadow(0 0 10px rgba(255,220,100,0.55)) drop-shadow(0 0 28px rgba(255,200,60,0.28)); }
              50%       { filter: drop-shadow(0 0 22px rgba(255,230,120,0.85)) drop-shadow(0 0 52px rgba(255,210,80,0.45)); }
            }
            @keyframes beamExpand {
              0%   { opacity: 0; transform: scaleY(0.2); }
              100% { opacity: 0.18; transform: scaleY(1); }
            }
            .cross-wrap {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 36px 0 24px;
              gap: 14px;
            }
            .cross-svg {
              animation: crossFadeIn 0.9s cubic-bezier(0.22,1,0.36,1) forwards,
                         glowPulse 3.2s ease-in-out 0.9s infinite;
            }
            .cross-beam {
              position: absolute;
              left: 50%;
              top: 0;
              transform: translateX(-50%);
              width: 56px;
              height: 260px;
              background: linear-gradient(to bottom, rgba(255,230,120,0.0), rgba(255,220,100,0.55), rgba(255,230,120,0.0));
              border-radius: 50%;
              animation: beamExpand 1.1s cubic-bezier(0.22,1,0.36,1) 0.5s forwards;
              opacity: 0;
              pointer-events: none;
            }
            .cross-container {
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .cross-caption {
              font-size: 15px;
              letter-spacing: 0.12em;
              color: #8b7355;
              opacity: 0;
              animation: crossFadeIn 0.8s ease 1.1s forwards;
              font-style: italic;
            }
          `}</style>
          <div className="cross-wrap">
            <div className="cross-container">
              <div className="cross-beam" />
              <svg
                className="cross-svg"
                width="96"
                height="128"
                viewBox="0 0 96 128"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="40" y="8" width="16" height="112" rx="3"
                  fill="url(#goldV)" />
                <rect x="12" y="34" width="72" height="16" rx="3"
                  fill="url(#goldH)" />
                <circle cx="48" cy="42" r="5" fill="#fffbe6"
                  opacity="0.85" />
                <defs>
                  <linearGradient id="goldV" x1="48" y1="8" x2="48" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%"  stopColor="#f5d680" />
                    <stop offset="45%" stopColor="#c8922a" />
                    <stop offset="100%" stopColor="#a06a10" />
                  </linearGradient>
                  <linearGradient id="goldH" x1="12" y1="42" x2="84" y2="42" gradientUnits="userSpaceOnUse">
                    <stop offset="0%"  stopColor="#a06a10" />
                    <stop offset="50%" stopColor="#f5d680" />
                    <stop offset="100%" stopColor="#a06a10" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="cross-caption">祈禱已蒙垂聽</div>
          </div>
        </>
      )}
    </div>
  );
}