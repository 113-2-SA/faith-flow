import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAuth } from 'firebase/auth';
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { savePrayer } from "./prayerStore";

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
  const [isSaving, setIsSaving] = useState(false);
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

        {/* ⭐ 新增：預覽按鈕 */}
        <button
          onClick={loadPreview}
          disabled={isRecording || !combinedText.trim() || isLoadingPreview}
          style={{ 
            padding: "8px 12px",
            backgroundColor: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: isRecording || !combinedText.trim() || isLoadingPreview ? "not-allowed" : "pointer",
            opacity: isRecording || !combinedText.trim() || isLoadingPreview ? 0.5 : 1
          }}
        >
          {isLoadingPreview ? "⏳ 生成中..." : "👁️ 預覽日記"}
        </button>

        {/* ⭐ 新增：儲存按鈕（只有預覽後才能按） */}
        <button
          onClick={saveToDiary}
          disabled={!previewData || isSaving}
          style={{
            padding: "8px 12px",
            backgroundColor: saveSuccess ? "#4CAF50" : "#2196F3",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: !previewData || isSaving ? "not-allowed" : "pointer",
            opacity: !previewData || isSaving ? 0.5 : 1
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
            padding: "8px 12px",
            backgroundColor: saveSuccess ? "#4CAF50" : "#2196F3",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: !previewData || isSaving ? "not-allowed" : "pointer",
            opacity: !previewData || isSaving ? 0.5 : 1
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
              {previewData.suggestedTitle}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <strong>語音內容：</strong>
            <div style={{ padding: 8, backgroundColor: "white", borderRadius: 4, marginTop: 4 }}>
              {previewData.content}
            </div>
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <strong>標籤：</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              {previewData.suggestedTags.map((tag, index) => (
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

          {previewData.suggestedBibleQuote && (
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
      )}

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
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={requestMic} disabled={isRecording} style={{ padding: "8px 12px" }}>
              允許麥克風
            </button>

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
              onClick={() => {
                setFinalText(""); setInterimText("");
                setDebug([]); setError("");
                setShowCross(false); setRecordSaved(false);
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

          {error && (
            <div style={{ padding: 12, marginBottom: 12, border: "1px solid #c00", color: "#c00", borderRadius: 6 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>即時結果（可修改）</div>
            <textarea
              value={combinedText}
              onChange={(e) => { setFinalText(e.target.value); setInterimText(""); }}
              placeholder="等待語音輸入..."
              rows={6}
              style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ccc", fontSize: 16, lineHeight: 1.5 }}
            />
          </div>

          <details>
            <summary style={{ cursor: "pointer", marginBottom: 8 }}>除錯訊息</summary>
            <div style={{ fontFamily: "monospace", fontSize: 12, border: "1px solid #ddd", borderRadius: 8, padding: 12, maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap" }}>
              {debug.join("\n") || "（無）"}
            </div>
          </details>
        </>
      )}

      {/* ── 步驟三：祈禱完成 → 確認記錄 ─────────────────────────── */}
      {showCross && canPray && (
        <>
          {/* 十字架動畫（保持原樣）*/}
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
            .cross-wrap      { display:flex; flex-direction:column; align-items:center; padding:36px 0 24px; gap:14px; }
            .cross-container { position:relative; display:flex; align-items:center; justify-content:center; }
            .cross-svg       { animation: crossFadeIn .9s cubic-bezier(.22,1,.36,1) forwards, glowPulse 3.2s ease-in-out .9s infinite; }
            .cross-beam      { position:absolute; left:50%; top:0; transform:translateX(-50%); width:56px; height:260px; background:linear-gradient(to bottom,rgba(255,230,120,0),rgba(255,220,100,.55),rgba(255,230,120,0)); border-radius:50%; animation:beamExpand 1.1s cubic-bezier(.22,1,.36,1) .5s forwards; opacity:0; pointer-events:none; }
            .cross-caption   { font-size:15px; letter-spacing:.12em; color:#8b7355; opacity:0; animation:crossFadeIn .8s ease 1.1s forwards; font-style:italic; }
            .confirm-btn     { margin-top:4px; padding:11px 32px; border:none; border-radius:24px; font-size:15px; font-weight:600; letter-spacing:.08em; cursor:pointer; animation:btnSlideIn .7s ease 1.4s both; transition:opacity .2s,transform .15s; }
            .confirm-btn:active   { transform:scale(0.96); }
            .confirm-btn:disabled { cursor:default; opacity:.65; }
            .btn-gold  { background:linear-gradient(135deg,#c8922a,#f5d680); color:#4a2e00; box-shadow:0 2px 12px rgba(200,146,42,.35); }
            .btn-green { background:linear-gradient(135deg,#3a8a5a,#6fcf97); color:#fff; box-shadow:0 2px 12px rgba(58,138,90,.3); }
          `}</style>

          <div className="cross-wrap">
            <div className="cross-container">
              <div className="cross-beam" />
              <svg className="cross-svg" width="96" height="128" viewBox="0 0 96 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="40" y="8"  width="16" height="112" rx="3" fill="url(#gV)" />
                <rect x="12" y="34" width="72" height="16"  rx="3" fill="url(#gH)" />
                <circle cx="48" cy="42" r="5" fill="#fffbe6" opacity=".85" />
                <defs>
                  <linearGradient id="gV" x1="48" y1="8" x2="48" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%"   stopColor="#f5d680" />
                    <stop offset="45%"  stopColor="#c8922a" />
                    <stop offset="100%" stopColor="#a06a10" />
                  </linearGradient>
                  <linearGradient id="gH" x1="12" y1="42" x2="84" y2="42" gradientUnits="userSpaceOnUse">
                    <stop offset="0%"   stopColor="#a06a10" />
                    <stop offset="50%"  stopColor="#f5d680" />
                    <stop offset="100%" stopColor="#a06a10" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="cross-caption">祈禱已蒙垂聽</div>

            {!recordSaved ? (
              <button
                className="confirm-btn btn-gold"
                onClick={handleConfirmRecord}
                disabled={isSaving}
              >
                {isSaving ? "記錄中…" : "✝  確認記錄此次祈禱"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <button className="confirm-btn btn-green" disabled>
                  ✓  已標記於朝聖地圖
                </button>
                <button
                  className="confirm-btn btn-gold"
                  onClick={() => router.push("/pilgrimage")}
                >
                  前往朝聖地圖
                </button>
              </div>
            )}

            {recordSaved && locationPerm === "denied" && (
              <p style={{ fontSize: 12, color: "#8b6020", textAlign: "center", maxWidth: 280, lineHeight: 1.5 }}>
                您的祈禱以匿名方式標示在聖殿附近。
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}