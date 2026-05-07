import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAuth } from 'firebase/auth';
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { savePrayer } from "../lib/prayerStore";

// ─────────────────────────────────────────────────────────────────
// 型別
// ─────────────────────────────────────────────────────────────────
type TranscriptMsg = {
  type: "transcript";
  transcript: string;
  is_final?: boolean;
  speech_final?: boolean;
};

const getAuthToken = async (): Promise<string> => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('使用者未登入');
  }
  
  return await user.getIdToken();
};

type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";

/** 定位授權流程狀態 */
type LocationPermState =
  | "idle"        // 尚未詢問
  | "asking"      // 正在顯示詢問 UI
  | "granted"     // 已同意
  | "denied";     // 已拒絕

// ⭐ 新增：預覽資料類型
type PreviewData = {
  suggestedTitle: string;
  suggestedTags: string[];
  suggestedBibleQuote: string | null;
  content: string;
};

const WS_URL = "ws://localhost:3000/ws/transcribe"; // ⭐ 已改成 3000
const API_URL = "http://localhost:3000"; // ⭐ 新增 API URL

// ─────────────────────────────────────────────────────────────────
// 輔助：選擇 MIME
// ─────────────────────────────────────────────────────────────────
function pickMimeType(): string | "" {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of candidates) {
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === "function" && MR.isTypeSupported(t))
      return t;
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────
// 定位授權說明卡（在「開始祈禱」之前顯示）
// ─────────────────────────────────────────────────────────────────
function LocationConsentCard({
  onGrant,
  onDeny,
}: {
  onGrant: () => void;
  onDeny: () => void;
}) {
  return (
    <div style={cardStyle}>
      {/* 地點 Icon */}
      <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>

      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 17, color: "#3a2a00" }}>
        記錄祈禱位置
      </p>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6b5020", lineHeight: 1.6 }}>
        允許此功能後，您的祈禱將以
        <strong>十字架標記</strong>
        顯示在朝聖地圖上，與其他信徒共同見證。
        <br />
        位置資訊<strong>僅用於地圖顯示</strong>，不會對外分享。
      </p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button style={btnPrimaryStyle} onClick={onGrant}>
          ✝ 同意，記錄位置
        </button>
        <button style={btnSecondaryStyle} onClick={onDeny}>
          不同意
        </button>
      </div>

      <p style={{ margin: "14px 0 0", fontSize: 12, color: "#b09060", lineHeight: 1.5 }}>
        不同意時，您的祈禱仍會被保存，<br />
        並以<em>匿名方式</em>標示在聖殿附近。
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

// ─────────────────────────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────────────────────────
export default function Pray() {
  // ── 定位授權 ────────────────────────────────────────────────────
  const router = useRouter();
  const [locationPerm, setLocationPerm] = useState<LocationPermState>("idle");
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // ── 麥克風 / 錄音 ────────────────────────────────────────────────
  const [lang, setLang] = useState<"zh-TW" | "en-US">("zh-TW");

  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording]           = useState(false);
  const [wsStatus, setWsStatus]                 = useState<WsStatus>("idle");
  const [error, setError]                       = useState<string>("");

  const [finalText, setFinalText]       = useState("");
  const [interimText, setInterimText]   = useState("");
  const [showCross, setShowCross]       = useState(false);
  const [recordSaved, setRecordSaved]   = useState(false);
  const [isSaving, setIsSaving]         = useState(false);

  // ⭐ 新增狀態
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [debug, setDebug] = useState<string[]>([]);
  const pushDebug = (line: string) =>
    setDebug((prev) => {
      const next = [...prev, line];
      return next.length > 200 ? next.slice(-200) : next;
    });

  const socketRef   = useRef<WebSocket | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mimeType    = useMemo(() => pickMimeType(), []);

  const combinedText = useMemo(() => {
    const a = finalText.trim();
    const b = interimText.trim();
    if (!a && !b) return "";
    if (a && b) return `${a} ${b}`;
    return a || b;
  }, [finalText, interimText]);

  // ── 取得 GPS 座標 ────────────────────────────────────────────────
  const fetchLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      // expo-location 同時支援 Android / iOS
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        pushDebug("[位置] 系統定位權限被拒");
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      pushDebug(`[位置] lat=${pos.coords.latitude.toFixed(5)} lng=${pos.coords.longitude.toFixed(5)}`);
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch (e) {
      pushDebug(`[位置] 取得座標失敗: ${(e as Error)?.message}`);
      return null;
    }
  };

  // ── 使用者同意定位 ────────────────────────────────────────────────
  const handleGrantLocation = async () => {
    setLocationPerm("asking"); // 防止重複點擊
    const coords = await fetchLocation();
    if (coords) {
      setUserCoords(coords);
      setLocationPerm("granted");
    } else {
      // 系統層拒絕 → 退回 denied 流程
      setLocationPerm("denied");
    }
  };

  // ── 使用者拒絕定位 ────────────────────────────────────────────────
  const handleDenyLocation = () => {
    setLocationPerm("denied");
    pushDebug("[位置] 使用者選擇不同意定位");
  };

  // ── 麥克風授權 ────────────────────────────────────────────────────
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
      stream.getTracks().forEach((t) => t.stop());
      setHasMicPermission(true);
      pushDebug("[前端] 麥克風權限：允許");
    } catch {
      setHasMicPermission(false);
      setError("麥克風權限被拒絕或裝置不可用。");
      pushDebug("[前端] 麥克風權限：拒絕/失敗");
    }
  };

  // ── WebSocket ─────────────────────────────────────────────────────
  const openWs = (): Promise<WebSocket> => {
    setError("");
    setWsStatus("connecting");

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(`${WS_URL}?lang=${lang}`);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => { setWsStatus("open"); resolve(ws); };
        ws.onclose = (ev) => {
          setWsStatus("closed");
          pushDebug(`[WS] 已關閉 code=${ev.code}`);
        };
        ws.onerror = () => {
          setWsStatus("error");
          reject(new Error("WebSocket 連線失敗"));
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data)) as TranscriptMsg;
            if (msg?.type === "transcript" && typeof msg.transcript === "string") {
              const t = msg.transcript.trim();
              if (!t) return;
              if (msg.is_final) {
                setFinalText((prev) => (prev ? prev + "，" + t : t));
                setInterimText("");
              } else {
                setInterimText(t);
              }
            }
            pushDebug(`[前端] WS(JSON)：${String(event.data).slice(0, 200)}`);
          } catch {
            const t = String(event.data || "").trim();
            if (t) setFinalText((prev) => (prev ? prev + " " + t : t));
          }
        };

        socketRef.current = ws;
      } catch (e) { reject(e); }
    });
  };

  // ── 開始錄音 ──────────────────────────────────────────────────────
  const startRecording = async () => {
    setError("");
    setShowCross(false);
    setRecordSaved(false);

    try {
      const ws = await openWs();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;

      recorder.onstart = () => {
        setIsRecording(true);
        pushDebug(`[前端] MediaRecorder start mime=${recorder.mimeType}`);
      };
      recorder.onstop = () => pushDebug("[前端] MediaRecorder stop");
      recorder.onerror = (ev) => {
        const msg = (ev as any)?.error?.message || "MediaRecorder 錯誤";
        setError(msg);
      };
      recorder.ondataavailable = async (ev: BlobEvent) => {
        try {
          if (!ev.data || ev.data.size === 0) return;
          if (ws.readyState !== WebSocket.OPEN) return;

          const buf = await ev.data.arrayBuffer();
          ws.send(buf);
          pushDebug(`[音訊] ${buf.byteLength} bytes`);
        } catch (e) {
          pushDebug(`[前端] ondataavailable send error: ${(e as Error)?.message || String(e)}`);
        }
      };

      recorder.start(250);

      setInterimText("");
    } catch (e) {
      const msg = (e as Error)?.message || "啟動錄音失敗";
      setError(msg);
      pushDebug(`[前端] startRecording 失敗: ${msg}`);
      await stopRecording();
    }
  };

  // ── 停止錄音 ──────────────────────────────────────────────────────
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
  };

  // ── 確認記錄 ──────────────────────────────────────────────────────
  const handleConfirmRecord = async () => {
    if (isSaving || recordSaved) return;
    setIsSaving(true);
    try {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      }
      recorderRef.current = null;

      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;

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

      // 有座標 → 傳 GPS；沒有 → prayerStore 自動用聖殿附近偏移
      await savePrayer(combinedText, userCoords ?? undefined);
      setRecordSaved(true);
      pushDebug(`[前端] 已儲存 locationSource=${userCoords ? "gps" : "default"}`);
    } catch (e) {
      setError("儲存失敗，請稍後再試。");
    } finally {
      setIsSaving(false);
    }
  };

  // ⭐ 新增：預覽功能
  const loadPreview = async () => {
    const textToPreview = combinedText.trim();
    
    if (!textToPreview) {
      setError("沒有可預覽的內容");
      return;
    }

    setIsLoadingPreview(true);
    setError("");

    try {
      console.log("👁️ 載入預覽...");
      
      const token = await getAuthToken();
      
      if (!token) {
        setError("請先登入");
        return;
      }

      const response = await fetch(`${API_URL}/api/diary/preview-prayer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          transcript: textToPreview,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        console.log("✅ 預覽載入成功:", result.data);
        setPreviewData(result.data);
      } else {
        setError(result.error || "預覽生成失敗");
        console.error("❌ 預覽失敗:", result.error);
      }
    } catch (error) {
      console.error("❌ 預覽錯誤:", error);
      setError("網路錯誤，請稍後再試");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // ⭐ 新增：儲存為日記
  const saveToDiary = async () => {
    if (!previewData) {
      setError("請先預覽");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      console.log("💾 儲存日記...");
      
      const token = await getAuthToken();
      
      if (!token) {
        setError("請先登入");
        return;
      }

      const response = await fetch(`${API_URL}/api/diary/from-prayer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          transcript: combinedText.trim(),
          collectId: null,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        console.log("✅ 儲存成功:", result.data);
        
        setSaveSuccess(true);
        
        setTimeout(() => {
          setFinalText("");
          setInterimText("");
          setPreviewData(null);
          setSaveSuccess(false);
          setShowCross(false);
        }, 3000);

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("✨ 祈禱已記錄", {
            body: `標題：${result.data.diary_title}`,
          });
        }
      } else {
        setError(result.error || "儲存失敗");
        console.error("❌ 儲存失敗:", result.error);
      }
    } catch (error) {
      console.error("❌ 儲存錯誤:", error);
      setError("網路錯誤，請稍後再試");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasMicPermission(false);
      setError("此瀏覽器不支援 getUserMedia。");
    }
    setHasMicPermission(null);
  }, []);

  useEffect(() => { return () => { void stopRecording(); }; }, []);

  // ⭐ 請求通知權限
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── 是否已進入「可以祈禱」的狀態 ─────────────────────────────────
  const canPray = locationPerm === "granted" || locationPerm === "denied";

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
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

      {/* ── 步驟一：取得定位授權 ──────────────────────────────────── */}
      {locationPerm === "idle" && (
        <LocationConsentCard
          onGrant={handleGrantLocation}
          onDeny={handleDenyLocation}
        />
      )}

      {/* ⭐ 成功通知 */}
      {saveSuccess && (
        <div style={{
          padding: 12,
          marginBottom: 12,
          backgroundColor: "#4CAF50",
          color: "white",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <span style={{ fontSize: 20 }}>✨</span>
          <span>祈禱已成功轉換為日記！</span>
        </div>
      )}

      {error ? (
        <div style={{ padding: 12, marginBottom: 12, border: "1px solid #c00", color: "#c00", borderRadius: 6 }}>
          {error}
        </div>
      ) : null}

      {/* ⭐ 新增：預覽區域 */}
      {previewData && (
        <div style={{ 
          padding: 16, 
          marginBottom: 12, 
          backgroundColor: "#f0f7ff", 
          border: "2px solid #2196F3", 
          borderRadius: 8 
        }}>
          <h3 style={{ margin: "0 0 12px 0", color: "#2196F3" }}>📋 日記預覽</h3>
          
          <div style={{ marginBottom: 12 }}>
            <strong>標題：</strong>
            <div style={{ padding: 8, backgroundColor: "white", borderRadius: 4, marginTop: 4 }}>
              {previewData!.suggestedTitle}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <strong>語音內容：</strong>
            <div style={{ padding: 8, backgroundColor: "white", borderRadius: 4, marginTop: 4 }}>
              {previewData!.content}
            </div>
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <strong>標籤：</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              {previewData!.suggestedTags.map((tag, index) => (
                <span key={index} style={{ 
                  padding: "4px 12px", 
                  backgroundColor: "#2196F3", 
                  color: "white", 
                  borderRadius: 16,
                  fontSize: 14
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {previewData!.suggestedBibleQuote && (
            <div style={{ marginBottom: 12 }}>
              <strong>聖經經文：</strong>
              <div style={{ 
                padding: 8, 
                backgroundColor: "white", 
                borderRadius: 4, 
                marginTop: 4,
                fontStyle: "italic",
                borderLeft: "4px solid #2196F3",
                paddingLeft: 12
              }}>
                {previewData!.suggestedBibleQuote}
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
            setPreviewData(null); // ⭐ 修改內容後清除預覽
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

      {/* 取得中 */}
      {locationPerm === "asking" && (
        <p style={{ color: "#8b6020", textAlign: "center", padding: 24 }}>
          正在取得位置資訊…
        </p>
      )}

      {/* 定位狀態標籤 */}
      {(locationPerm === "granted" || locationPerm === "denied") && (
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
          {locationPerm === "granted" ? "📍 已記錄真實位置" : "🏛 將標示於聖殿附近（匿名）"}
        </div>
      )}

      {/* ── 步驟二：祈禱錄音區（定位授權後才顯示）────────────────── */}
      {canPray && (
        <div>步驟二</div>
      )}

      {/* ── 步驟三：祈禱完成 → 確認記錄 ─────────────────────────── */}
      {showCross && canPray && (
        <div>步驟三</div>
      )}
    </div>
  );
}