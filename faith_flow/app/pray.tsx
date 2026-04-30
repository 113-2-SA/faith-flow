import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { auth } from "../lib/firebase";
import { API_BASE_URL } from "../lib/api";

// ─── 型別 ───────────────────────────────────────────────────────────────────
type TranscriptMsg = {
  type: "transcript";
  transcript: string;
  is_final?: boolean;
  speech_final?: boolean;
};

type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";

type LocationPermState = "idle" | "asking" | "granted" | "denied";

type PreviewData = {
  suggestedTitle: string;
  suggestedTags: string[];
  suggestedBibleQuote: string | null;
  content: string;
};

// ─── 常數 ───────────────────────────────────────────────────────────────────
const WS_URL = `${API_BASE_URL.replace(/^http/, "ws")}/ws/transcribe`;

// ─── 工具函式 ────────────────────────────────────────────────────────────────
const getAuthToken = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error("使用者未登入");
  return await user.getIdToken(true);
};

function pickMimeType(): string | "" {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of candidates) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === "function" && MR.isTypeSupported(t))
      return t;
  }
  return "";
}

// ─── 定位同意卡片 ─────────────────────────────────────────────────────────────
function LocationConsentCard({
  onGrant,
  onDeny,
}: {
  onGrant: () => void;
  onDeny: () => void;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 17, color: "#3a2a00" }}>
        記錄祈禱位置
      </p>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6b5020", lineHeight: 1.6 }}>
        允許此功能後，您的祈禱將以
        <strong>教堂標記</strong>
        顯示在聖殿地圖上，與其他信徒共享見證。
        <br />
        位置資訊<strong>僅用於地圖顯示</strong>，不會對外分享。
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button style={btnPrimaryStyle} onClick={onGrant}>
          ✓ 同意，記錄位置
        </button>
        <button style={btnSecondaryStyle} onClick={onDeny}>
          不同意
        </button>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 12, color: "#b09060", lineHeight: 1.5 }}>
        不同意時，您的祈禱仍會被儲存，<br />
        並以<em>匿名方式</em>標示在聖殿鄰近。
      </p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  maxWidth: 360,
  margin: "20px auto",
  padding: "28px 24px",
  borderRadius: 16,
  border: "1px solid rgba(200,146,42,0.35)",
  background: "linear-gradient(135deg, #fffdf5 0%, #fff8e7 100%)",
  boxShadow: "0 4px 24px rgba(180,130,40,0.13)",
  textAlign: "center",
};
const btnPrimaryStyle: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 24,
  border: "none",
  background: "linear-gradient(135deg, #c8922a, #f5d680)",
  color: "#4a2e00",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
const btnSecondaryStyle: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 24,
  border: "1px solid #c8922a",
  background: "transparent",
  color: "#8b6020",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

// ─── 主元件 ───────────────────────────────────────────────────────────────────
export default function Pray() {
  const router = useRouter();

  // 定位
  const [locationPerm, setLocationPerm] = useState<LocationPermState>("idle");
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // 語言
  const [lang, setLang] = useState<"zh-TW" | "en-US">("zh-TW");

  // 錄音
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [error, setError] = useState<string>("");

  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showCross, setShowCross] = useState(false);

  // 預覽 / 儲存
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [debug, setDebug] = useState<string[]>([]);
  const pushDebug = (line: string) =>
    setDebug((prev) => {
      const next = [...prev, line];
      return next.length > 200 ? next.slice(-200) : next;
    });

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

  // ── 定位 ────────────────────────────────────────────────────────────────────
  const fetchLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        pushDebug("[位置] 系統定位權限被拒");
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      pushDebug(
        `[位置] lat=${pos.coords.latitude.toFixed(5)} lng=${pos.coords.longitude.toFixed(5)}`
      );
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch (e) {
      pushDebug(`[位置] 取得座標失敗: ${(e as Error)?.message}`);
      return null;
    }
  };

  const handleGrantLocation = async () => {
    setLocationPerm("asking");
    const coords = await fetchLocation();
    if (coords) {
      setUserCoords(coords);
      setLocationPerm("granted");
    } else {
      setLocationPerm("denied");
    }
  };

  const handleDenyLocation = () => {
    setLocationPerm("denied");
    pushDebug("[位置] 使用者選擇不同意定位");
  };

  // ── 麥克風 ───────────────────────────────────────────────────────────────────
  const requestMic = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setHasMicPermission(true);
      pushDebug("[前端] 麥克風權限：允許");
    } catch {
      setHasMicPermission(false);
      setError("麥克風權限被拒絕或裝置不可用。");
      pushDebug("[前端] 麥克風權限：拒絕/失敗");
    }
  };

  // ── WebSocket ────────────────────────────────────────────────────────────────
  const openWs = (): Promise<WebSocket> => {
    setError("");
    setWsStatus("connecting");
    const url = `${WS_URL}?lang=${lang}`;
    pushDebug(`[前端] WebSocket 連線中：${url}`);

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
          setWsStatus("open");
          pushDebug("[前端] WebSocket 已連線");
          resolve(ws);
        };
        ws.onclose = (ev) => {
          setWsStatus("closed");
          pushDebug(`[前端] WebSocket 已關閉 code=${ev.code}`);
        };
        ws.onerror = () => {
          setWsStatus("error");
          pushDebug("[前端] WebSocket 發生錯誤");
          reject(new Error("WebSocket 連線失敗"));
        };
        ws.onmessage = (event) => {
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
          } catch {
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

  // ── 開始錄音 ──────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    setError("");
    setShowCross(false);
    setSaveSuccess(false);
    setPreviewData(null);

    try {
      const ws = await openWs();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorderRef.current = recorder;

      recorder.onstart = () => {
        setIsRecording(true);
        pushDebug(`[前端] MediaRecorder start mime=${recorder.mimeType}`);
      };
      recorder.onstop = () => pushDebug("[前端] MediaRecorder stop");
      recorder.onerror = (ev) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = (ev as any)?.error?.message || "MediaRecorder 錯誤";
        setError(msg);
      };
      recorder.ondataavailable = async (ev: BlobEvent) => {
        if (!ev.data || ev.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        const buf = await ev.data.arrayBuffer();
        ws.send(buf);
      };

      recorder.start(250);
      setInterimText("");
    } catch (e) {
      const msg = (e as Error)?.message || "啟動錄音失敗";
      setError(msg);
      await stopRecording();
    }
  };

  // ── 停止錄音 ──────────────────────────────────────────────────────────────────
  const stopRecording = async () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const ws = socketRef.current;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
    socketRef.current = null;

    setIsRecording(false);
    setWsStatus("closed");
    setInterimText("");
    setShowCross(true);
    pushDebug("[前端] 已停止錄音並清理連線");
  };

  // ── AI 預覽 ───────────────────────────────────────────────────────────────────
  const loadPreview = async () => {
    const text = combinedText.trim();
    if (!text) { setError("沒有可預覽的內容"); return; }

    setIsLoadingPreview(true);
    setError("");
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/diary/preview-prayer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transcript: text }),
      });
      const data = await res.json();
      if (data.ok) {
        setPreviewData(data.data);
        pushDebug("[預覽] AI 建議已取得");
      } else {
        setError(data.error || "預覽生成失敗");
      }
    } catch (e) {
      setError("網路錯誤，請稍後再試");
      pushDebug(`[預覽] 失敗: ${(e as Error)?.message}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // ── 儲存為日記 ────────────────────────────────────────────────────────────────
  const saveToDiary = async () => {
    if (!previewData || isSaving || saveSuccess) return;
    setIsSaving(true);
    setError("");
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/diary/from-prayer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          transcript: combinedText.trim(),
          collectId: null,
          latitude: userCoords?.latitude ?? null,
          longitude: userCoords?.longitude ?? null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSaveSuccess(true);
        pushDebug(
          `[前端] 日記已儲存 ID=${data.data?.diary_id} location=${userCoords ? "GPS" : "無"}`
        );
      } else {
        setError(data.error ?? "儲存失敗");
      }
    } catch (e) {
      setError("網路錯誤，請稍後再試");
      pushDebug(`[儲存] 失敗: ${(e as Error)?.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── 生命週期 ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasMicPermission(false);
      setError("此瀏覽器不支援 getUserMedia。");
    }
  }, []);

  useEffect(() => { return () => { void stopRecording(); }; }, []);

  const canPray = locationPerm === "granted" || locationPerm === "denied";

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <h2 style={{ margin: "0 0 12px" }}>即時祈禱轉錄</h2>

      {/* 步驟一：定位同意 */}
      {locationPerm === "idle" && (
        <LocationConsentCard onGrant={handleGrantLocation} onDeny={handleDenyLocation} />
      )}

      {locationPerm === "asking" && (
        <p style={{ color: "#8b6020", textAlign: "center", padding: 24 }}>
          正在取得位置資訊…
        </p>
      )}

      {/* 定位狀態標籤 */}
      {canPray && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 14px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 14,
            background:
              locationPerm === "granted"
                ? "rgba(58,138,90,0.12)"
                : "rgba(160,100,10,0.10)",
            color: locationPerm === "granted" ? "#2e7d52" : "#8b6020",
            border: `1px solid ${locationPerm === "granted" ? "#6fcf97" : "#c8a050"}`,
          }}
        >
          {locationPerm === "granted" ? "📍 已記錄真實位置" : "📍 標示於聖殿鄰近（匿名）"}
        </div>
      )}

      {/* 步驟二：錄音操作（定位確認後顯示） */}
      {canPray && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={requestMic} disabled={isRecording} style={{ padding: "8px 12px" }}>
              允許麥克風
            </button>

            {/* 語言選擇 */}
            {(["zh-TW", "en-US"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                disabled={isRecording}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #c8922a",
                  background: lang === l ? "#c8922a" : "transparent",
                  color: lang === l ? "#fff" : "#c8922a",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {l === "zh-TW" ? "中文" : "English"}
              </button>
            ))}

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
              onClick={loadPreview}
              disabled={isRecording || !combinedText.trim() || isLoadingPreview}
              style={{
                padding: "8px 12px",
                backgroundColor: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor:
                  isRecording || !combinedText.trim() || isLoadingPreview
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  isRecording || !combinedText.trim() || isLoadingPreview ? 0.5 : 1,
              }}
            >
              {isLoadingPreview ? "⏳ 生成中..." : "👁️ 預覽日記"}
            </button>

            <button
              onClick={saveToDiary}
              disabled={!previewData || isSaving || saveSuccess}
              style={{
                padding: "8px 12px",
                backgroundColor: saveSuccess ? "#4CAF50" : "#2196F3",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: !previewData || isSaving || saveSuccess ? "not-allowed" : "pointer",
                opacity: !previewData || isSaving || saveSuccess ? 0.5 : 1,
              }}
            >
              {isSaving ? "⏳ 儲存中..." : saveSuccess ? "✅ 已儲存！" : "💾 儲存為日記"}
            </button>

            <button
              onClick={() => {
                setFinalText("");
                setInterimText("");
                setDebug([]);
                setError("");
                setShowCross(false);
                setPreviewData(null);
                setSaveSuccess(false);
              }}
              disabled={isRecording}
              style={{ padding: "8px 12px" }}
            >
              清除
            </button>

            <div style={{ alignSelf: "center", fontSize: 12, opacity: 0.8 }}>
              WS：{wsStatus} | 錄音：{isRecording ? "進行中" : "未開始"}
            </div>
          </div>

          {saveSuccess && (
            <div
              style={{
                padding: 12,
                marginBottom: 12,
                backgroundColor: "#4CAF50",
                color: "white",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 20 }}>✨</span>
              <span>祈禱已成功轉換為日記！</span>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 12,
                marginBottom: 12,
                border: "1px solid #c00",
                color: "#c00",
                borderRadius: 6,
              }}
            >
              {error}
            </div>
          )}

          {/* AI 預覽卡片 */}
          {previewData && (
            <div
              style={{
                padding: 16,
                marginBottom: 12,
                backgroundColor: "#f0f7ff",
                border: "2px solid #2196F3",
                borderRadius: 8,
              }}
            >
              <h3 style={{ margin: "0 0 12px", color: "#2196F3" }}>📋 日記預覽</h3>

              <div style={{ marginBottom: 12 }}>
                <strong>標題：</strong>
                <div
                  style={{
                    padding: 8,
                    backgroundColor: "white",
                    borderRadius: 4,
                    marginTop: 4,
                  }}
                >
                  {previewData.suggestedTitle}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <strong>語音內容：</strong>
                <div
                  style={{
                    padding: 8,
                    backgroundColor: "white",
                    borderRadius: 4,
                    marginTop: 4,
                  }}
                >
                  {previewData.content}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <strong>標籤：</strong>
                <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  {previewData.suggestedTags.map((tag, i) => (
                    <span
                      key={i}
                      style={{
                        padding: "4px 12px",
                        backgroundColor: "#2196F3",
                        color: "white",
                        borderRadius: 16,
                        fontSize: 14,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {previewData.suggestedBibleQuote && (
                <div style={{ marginBottom: 12 }}>
                  <strong>聖經金句：</strong>
                  <div
                    style={{
                      padding: "8px 8px 8px 12px",
                      backgroundColor: "white",
                      borderRadius: 4,
                      marginTop: 4,
                      fontStyle: "italic",
                      borderLeft: "4px solid #2196F3",
                    }}
                  >
                    {previewData.suggestedBibleQuote}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                💡 確認無誤後，點擊「儲存為日記」即可存入資料庫
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>
              即時結果（可修改）
            </div>
            <textarea
              value={combinedText}
              onChange={(e) => {
                setFinalText(e.target.value);
                setInterimText("");
                setPreviewData(null);
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
          </div>

          <details>
            <summary style={{ cursor: "pointer", marginBottom: 8 }}>除錯訊息</summary>
            <div
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                fontSize: 12,
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
                maxHeight: 260,
                overflow: "auto",
              }}
            >
              {debug.length ? debug.join("\n") : "（目前沒有）"}
            </div>
          </details>
        </>
      )}

      {/* 十字架動畫 + 儲存後導航 */}
      {showCross && canPray && (
        <>
          <style>{`
            @keyframes crossFadeIn {
              0%   { opacity:0; transform:translateY(18px) scale(0.88); }
              60%  { opacity:1; transform:translateY(-4px) scale(1.04); }
              100% { opacity:1; transform:translateY(0) scale(1); }
            }
            @keyframes glowPulse {
              0%,100% { filter: drop-shadow(0 0 10px rgba(255,220,100,.55)); }
              50%     { filter: drop-shadow(0 0 22px rgba(255,230,120,.85)); }
            }
            @keyframes beamExpand {
              from { opacity:0; transform:scaleY(0.2); }
              to   { opacity:0.18; transform:scaleY(1); }
            }
            @keyframes btnSlideIn {
              from { opacity:0; transform:translateY(10px); }
              to   { opacity:1; transform:translateY(0); }
            }
            .cross-wrap { display:flex; flex-direction:column; align-items:center; padding:36px 0 24px; gap:14px; }
            .cross-container { position:relative; display:flex; align-items:center; justify-content:center; }
            .cross-svg { animation: crossFadeIn .9s cubic-bezier(.22,1,.36,1) forwards, glowPulse 3.2s ease-in-out .9s infinite; }
            .cross-beam { position:absolute; left:50%; top:0; transform:translateX(-50%); width:56px; height:260px;
              background:linear-gradient(to bottom,rgba(255,230,120,0),rgba(255,220,100,.55),rgba(255,230,120,0));
              border-radius:50%; animation:beamExpand 1.1s cubic-bezier(.22,1,.36,1) .5s forwards; opacity:0; pointer-events:none; }
            .cross-caption { font-size:15px; letter-spacing:.12em; color:#8b7355; opacity:0;
              animation:crossFadeIn .8s ease 1.1s forwards; font-style:italic; }
            .nav-btn { margin-top:4px; padding:11px 32px; border:none; border-radius:24px; font-size:15px; font-weight:600;
              letter-spacing:.08em; cursor:pointer; animation:btnSlideIn .7s ease 1.4s both; transition:opacity .2s,transform .15s; }
            .nav-btn:active { transform:scale(0.96); }
            .btn-gold  { background:linear-gradient(135deg,#c8922a,#f5d680); color:#4a2e00; box-shadow:0 2px 12px rgba(200,146,42,.35); }
            .btn-green { background:linear-gradient(135deg,#3a8a5a,#6fcf97); color:#fff; box-shadow:0 2px 12px rgba(58,138,90,.3); }
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
                <rect x="40" y="8" width="16" height="112" rx="3" fill="url(#gV)" />
                <rect x="12" y="34" width="72" height="16" rx="3" fill="url(#gH)" />
                <circle cx="48" cy="42" r="5" fill="#fffbe6" opacity=".85" />
                <defs>
                  <linearGradient id="gV" x1="48" y1="8" x2="48" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f5d680" />
                    <stop offset="45%" stopColor="#c8922a" />
                    <stop offset="100%" stopColor="#a06a10" />
                  </linearGradient>
                  <linearGradient id="gH" x1="12" y1="42" x2="84" y2="42" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a06a10" />
                    <stop offset="50%" stopColor="#f5d680" />
                    <stop offset="100%" stopColor="#a06a10" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="cross-caption">祈禱已蒙垂聽</div>

            {saveSuccess ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="nav-btn btn-green"
                  onClick={() => router.push("/diary/list" as any)}
                >
                  前往日記
                </button>
                <button
                  className="nav-btn btn-gold"
                  onClick={() => router.push("/pilgrimage" as any)}
                >
                  前往聖殿地圖
                </button>
              </div>
            ) : (
              locationPerm === "denied" && (
                <p
                  style={{
                    fontSize: 12,
                    color: "#8b6020",
                    textAlign: "center",
                    maxWidth: 280,
                    lineHeight: 1.5,
                  }}
                >
                  您的祈禱將以匿名方式標示在聖殿鄰近。
                </p>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
