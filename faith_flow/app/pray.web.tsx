import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { VideoBackground } from "../components/VideoBackground";
import { GlassCard } from "../components/GlassCard";
import { auth } from "../lib/firebase";
import { API_BASE_URL } from "../lib/api";
type TranscriptMsg = {
  type: "transcript";
  transcript: string;
  is_final?: boolean;
  speech_final?: boolean;
};

const getAuthToken = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error("使用者未登入");
  return await user.getIdToken();
};

type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";
type LocationPermState = "idle" | "asking" | "granted" | "denied";
type PreviewData = { title: string; bibleQuote: string | null };

const WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/ws/transcribe";
const API_URL = API_BASE_URL;

function pickMimeType(): string {
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

function LocationConsentCard({ onGrant, onDeny }: { onGrant: () => void; onDeny: () => void }) {
  return (
    <GlassCard style={styles.consentCard}>
      <MaterialCommunityIcons name="map-marker" size={40} color="rgba(255,255,255,0.90)" style={{ marginBottom: 12 }} />
      <Text style={styles.consentTitle}>記錄祈禱位置</Text>
      <Text style={styles.consentBody}>
        允許此功能後，您的祈禱將以{"\n"}
        <Text style={styles.consentBold}>十字架標記</Text>
        顯示在朝聖地圖上，與其他信徒共同見證。{"\n"}
        位置資訊<Text style={styles.consentBold}>僅用於地圖顯示</Text>，不會對外分享。
      </Text>
      <View style={styles.consentBtnRow}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onGrant}>
          <Text style={styles.primaryBtnText}>✝ 同意，記錄位置</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onDeny}>
          <Text style={styles.secondaryBtnText}>不同意</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.consentFootnote}>
        不同意時，您的祈禱仍會被保存，{"\n"}並以匿名方式標示在聖殿附近。
      </Text>
    </GlassCard>
  );
}

export default function Pray() {
  const [locationPerm, setLocationPerm] = useState<LocationPermState>("idle");
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [lang, setLang] = useState<"zh-TW" | "en-US">("zh-TW");
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [error, setError] = useState<string>("");
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showCross, setShowCross] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

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

  const fetchLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      return null;
    }
  };

  const handleGrantLocation = async () => {
    setLocationPerm("asking");
    const coords = await fetchLocation();
    if (coords) { setUserCoords(coords); setLocationPerm("granted"); }
    else { setLocationPerm("denied"); }
  };

  const handleDenyLocation = () => setLocationPerm("denied");

  const requestMic = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setHasMicPermission(true);
    } catch {
      setHasMicPermission(false);
      setError("麥克風權限被拒絕或裝置不可用。");
    }
  };

  const openWs = (): Promise<WebSocket> => {
    setError("");
    setWsStatus("connecting");
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(`${WS_URL}?lang=${lang}`);
        ws.binaryType = "arraybuffer";
        ws.onopen = () => { setWsStatus("open"); resolve(ws); };
        ws.onclose = (ev) => { setWsStatus("closed"); };
        ws.onerror = () => { setWsStatus("error"); reject(new Error("WebSocket 連線失敗")); };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data)) as TranscriptMsg;
            if (msg?.type === "transcript" && typeof msg.transcript === "string") {
              const t = msg.transcript.trim();
              if (!t) return;
              if (msg.is_final) { setFinalText((prev) => (prev ? prev + "，" + t : t)); setInterimText(""); }
              else { setInterimText(t); }
            }
          } catch {
            const t = String(event.data || "").trim();
            if (t) setFinalText((prev) => (prev ? prev + " " + t : t));
          }
        };
        socketRef.current = ws;
      } catch (e) { reject(e); }
    });
  };

  const startRecording = async () => {
    setError("");
    setShowCross(false);
    try {
      const ws = await openWs();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;
      recorder.onstart = () => setIsRecording(true);
      recorder.onerror = (_ev) => setError((_ev as any)?.error?.message || "MediaRecorder 錯誤");
      recorder.ondataavailable = async (ev: BlobEvent) => {
        if (!ev.data || ev.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(await ev.data.arrayBuffer());
      };
      recorder.start(250);
      setInterimText("");
    } catch (e) {
      setError((e as Error)?.message || "啟動錄音失敗");
      await stopRecording();
    }
  };

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

  const loadPreview = async () => {
    if (!combinedText.trim()) { setError("沒有可儲存的內容"); return; }
    setIsLoadingPreview(true);
    setError("");
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api/diary/preview-prayer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ transcript: combinedText.trim() }),
      });
      const result = await response.json();
      if (result.ok) {
        setPreviewData({ title: result.data.suggestedTitle, bibleQuote: result.data.suggestedBibleQuote ?? null });
      } else {
        setError(result.error || "預覽失敗");
      }
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const saveToDiary = async () => {
    setIsSaving(true);
    setError("");
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api/diary/from-prayer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          transcript: combinedText.trim(),
          latitude: userCoords?.latitude ?? null,
          longitude: userCoords?.longitude ?? null,
        }),
      });
      const result = await response.json();
      if (result.ok) {
        setPreviewData(null);
        setSaveSuccess(true);
        setTimeout(() => {
          setFinalText(""); setInterimText("");
          setSaveSuccess(false); setShowCross(false);
        }, 3000);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("✨ 祈禱已記錄", { body: `標題：${result.data.diary_title}` });
        }
      } else {
        setError(result.error || "儲存失敗");
      }
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasMicPermission(false);
      setError("此瀏覽器不支援麥克風。");
    }
  }, []);

  useEffect(() => { return () => { void stopRecording(); }; }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const canPray = locationPerm === "granted" || locationPerm === "denied";

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>即時祈禱轉錄</Text>

        {locationPerm === "idle" && (
          <LocationConsentCard onGrant={handleGrantLocation} onDeny={handleDenyLocation} />
        )}

        {locationPerm === "asking" && (
          <GlassCard style={styles.noticeCard}>
            <ActivityIndicator color="rgba(255,255,255,0.8)" />
            <Text style={styles.noticeText}>正在取得位置資訊…</Text>
          </GlassCard>
        )}

        {canPray && (
          <View style={styles.locationTag}>
            <Text style={styles.locationTagText}>
              {locationPerm === "granted" ? "📍 已記錄真實位置" : "📍 標示於聖殿鄰近（匿名）"}
            </Text>
          </View>
        )}

        {canPray && (
          <>
            <GlassCard style={styles.controlCard}>
              <TouchableOpacity
                onPress={requestMic}
                disabled={isRecording}
                style={[styles.outlineBtn, isRecording && styles.btnDisabled]}
              >
                <Text style={styles.outlineBtnText}>允許麥克風</Text>
              </TouchableOpacity>

              <View style={styles.langRow}>
                <Text style={styles.langLabel}>語言：</Text>
                {(["zh-TW", "en-US"] as const).map((l) => (
                  <TouchableOpacity
                    key={l}
                    onPress={() => setLang(l)}
                    disabled={isRecording}
                    style={[styles.langBtn, lang === l && styles.langBtnActive]}
                  >
                    <Text style={[styles.langBtnText, lang === l && styles.langBtnTextActive]}>
                      {l === "zh-TW" ? "中文" : "English"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!isRecording ? (
                <TouchableOpacity
                  onPress={startRecording}
                  disabled={hasMicPermission === false}
                  style={[styles.recordBtn, hasMicPermission === false && styles.btnDisabled]}
                >
                  <MaterialCommunityIcons name="microphone" size={20} color="rgba(0,0,0,0.75)" />
                  <Text style={styles.recordBtnText}>開始祈禱（錄音轉錄）</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={stopRecording} style={[styles.recordBtn, styles.recordBtnActive]}>
                  <MaterialCommunityIcons name="stop" size={20} color="rgba(255,100,80,0.95)" />
                  <Text style={styles.recordBtnTextActive}>結束祈禱</Text>
                </TouchableOpacity>
              )}

              <View style={styles.wsRow}>
                <Text style={styles.wsText}>WS：{wsStatus} | 錄音：{isRecording ? "進行中" : "未開始"}</Text>
              </View>
            </GlassCard>

            <GlassCard style={styles.controlCard}>
              <TouchableOpacity
                onPress={loadPreview}
                disabled={!combinedText.trim() || isLoadingPreview || isSaving || saveSuccess || isRecording || !!previewData}
                style={[styles.outlineBtn, (!combinedText.trim() || isLoadingPreview || isSaving || saveSuccess || isRecording || !!previewData) && styles.btnDisabled]}
              >
                <Text style={styles.outlineBtnText}>
                  {isLoadingPreview ? "⏳ 生成預覽中..." : saveSuccess ? "✅ 已儲存！" : "💾 儲存為日記"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setFinalText(""); setInterimText(""); setError("");
                  setShowCross(false); setSaveSuccess(false); setWsStatus("idle");
                }}
                disabled={isRecording}
                style={[styles.outlineBtn, isRecording && styles.btnDisabled]}
              >
                <Text style={styles.outlineBtnText}>清除</Text>
              </TouchableOpacity>
            </GlassCard>

            <GlassCard style={styles.transcriptCard}>
              <Text style={styles.fieldLabel}>轉錄內容</Text>
              <TextInput
                style={[styles.transcriptInput, { outline: "none" } as any]}
                value={finalText}
                onChangeText={setFinalText}
                placeholder="語音轉錄結果將顯示於此，也可直接輸入..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                textAlignVertical="top"
                editable={!isRecording}
              />
              {!!interimText && (
                <Text style={styles.interimText}>{interimText}</Text>
              )}
            </GlassCard>

            {previewData && !saveSuccess && (
              <GlassCard style={styles.previewCard}>
                <Text style={styles.previewSectionLabel}>📖 聖經經文</Text>
                <Text style={styles.previewBible}>{previewData.bibleQuote || "（AI 未推薦經文）"}</Text>
                <Text style={styles.previewTitle}>建議標題：{previewData.title}</Text>
                <View style={styles.previewBtnRow}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, isSaving && styles.btnDisabled]}
                    onPress={saveToDiary}
                    disabled={isSaving}
                  >
                    <Text style={styles.primaryBtnText}>{isSaving ? "⏳ 儲存中..." : "✝ 確認儲存"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, isSaving && styles.btnDisabled]}
                    onPress={() => setPreviewData(null)}
                    disabled={isSaving}
                  >
                    <Text style={styles.secondaryBtnText}>取消</Text>
                  </TouchableOpacity>
                </View>
              </GlassCard>
            )}

            {saveSuccess && (
              <GlassCard style={styles.successCard}>
                <Text style={styles.successText}>✨ 祈禱已成功轉換為日記！</Text>
              </GlassCard>
            )}

            {!!error && (
              <GlassCard style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </GlassCard>
            )}

            {showCross && saveSuccess && (
              <GlassCard style={styles.savedCard} glassColor="rgba(52,168,83,0.22)">
                <MaterialCommunityIcons name="check-circle-outline" size={32} color="rgba(100,200,130,0.95)" />
                <Text style={styles.savedText}>祈禱已記錄 ✝</Text>
              </GlassCard>
            )}

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: "700", color: "rgba(255,255,255,0.95)", marginBottom: 4 },

  consentCard: { marginBottom: 16, alignItems: "center" },
  consentTitle: { fontSize: 17, fontWeight: "700", color: "rgba(255,255,255,0.95)", marginBottom: 10, textAlign: "center" },
  consentBody: { fontSize: 14, color: "rgba(255,255,255,0.80)", lineHeight: 22, textAlign: "center", marginBottom: 20 },
  consentBold: { fontWeight: "700", color: "rgba(255,255,255,0.95)" },
  consentBtnRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  consentFootnote: { fontSize: 12, color: "rgba(255,255,255,0.50)", textAlign: "center", lineHeight: 18 },

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 24, paddingVertical: 10, paddingHorizontal: 18 },
  primaryBtnText: { fontSize: 14, fontWeight: "700", color: "rgba(0,0,0,0.75)" },
  secondaryBtn: { borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.55)", paddingVertical: 10, paddingHorizontal: 18, justifyContent: "center" },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.80)" },

  noticeCard: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  noticeText: { color: "rgba(255,255,255,0.80)", fontSize: 14 },

  successCard: { marginBottom: 12, alignItems: "center" },
  successText: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.95)" },

  errorCard: { marginBottom: 12 },
  errorText: { fontSize: 14, color: "rgba(255,160,150,0.95)" },

  locationTag: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.30)", paddingHorizontal: 14, paddingVertical: 5, marginBottom: 12 },
  locationTagText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.85)" },

  controlCard: { marginBottom: 12, gap: 12 },
  langRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  langLabel: { fontSize: 13, color: "rgba(255,255,255,0.70)" },
  langBtn: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.30)", paddingHorizontal: 14, paddingVertical: 5 },
  langBtnActive: { backgroundColor: "rgba(255,255,255,0.20)", borderColor: "rgba(255,255,255,0.60)" },
  langBtnText: { fontSize: 13, color: "rgba(255,255,255,0.65)" },
  langBtnTextActive: { color: "rgba(255,255,255,0.95)", fontWeight: "600" },

  recordBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 30, paddingVertical: 14, gap: 8 },
  recordBtnActive: { backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,100,80,0.60)" },
  recordBtnText: { fontSize: 16, fontWeight: "700", color: "rgba(0,0,0,0.75)" },
  recordBtnTextActive: { color: "rgba(255,100,80,0.95)" },

  wsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  wsText: { fontSize: 13, color: "rgba(255,255,255,0.65)" },

  outlineBtn: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.30)" },
  outlineBtnText: { color: "rgba(255,255,255,0.90)", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.4 },

  transcriptCard: { marginBottom: 12 },
  fieldLabel: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, fontWeight: "600", letterSpacing: 0.5 },
  transcriptInput: {
    fontSize: 15,
    color: "rgba(255,255,255,0.90)",
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: "top",
  },
  interimText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.40)",
    fontStyle: "italic",
    marginTop: 6,
    lineHeight: 20,
  },

  savedCard: { alignItems: "center", gap: 8 },
  savedText: { fontSize: 16, fontWeight: "700", color: "rgba(255,255,255,0.95)" },

  previewCard: { marginBottom: 12 },
  previewSectionLabel: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, fontWeight: "600", letterSpacing: 0.5 },
  previewBible: { fontSize: 15, color: "rgba(255,255,220,0.95)", fontStyle: "italic", lineHeight: 22, marginBottom: 10 },
  previewTitle: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 14 },
  previewBtnRow: { flexDirection: "row", gap: 12 },
});
