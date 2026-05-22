import React, { useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { VideoBackground } from "../components/VideoBackground";
import { HEADER_CONTENT_HEIGHT } from "../components/AppShell";
import { GlassCard } from "../components/GlassCard";
import { auth } from "../lib/firebase";
import { API_BASE_URL } from "../lib/api";
type TranscriptMsg = {
  type: "transcript";
  transcript: string;
  is_final?: boolean;
};

const getAuthToken = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error("使用者未登入");
  return await user.getIdToken();
};

type WsStatus = "idle" | "connecting" | "open" | "transcribing" | "closed" | "error";
type LocationPermState = "idle" | "asking" | "granted" | "denied";
type PreviewData = { title: string; bibleQuote: string | null };
const WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/ws/transcribe";
const API_URL = API_BASE_URL;

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
  const router = useRouter();
  const { basilicaLat, basilicaLng, basilicaName: paramBasilicaName } = useLocalSearchParams<{
    basilicaLat?: string;
    basilicaLng?: string;
    basilicaName?: string;
  }>();

  const presetCoords = basilicaLat && basilicaLng
    ? { latitude: parseFloat(String(basilicaLat)), longitude: parseFloat(String(basilicaLng)) }
    : null;

  const [locationPerm, setLocationPerm] = useState<LocationPermState>(presetCoords ? "granted" : "idle");
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(presetCoords);
  const [lang, setLang] = useState<"zh-TW" | "en-US">("zh-TW");
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [error, setError] = useState<string>("");
  const [finalText, setFinalText] = useState("");
  const [showCross, setShowCross] = useState(false);
  const [recordSaved, setRecordSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);

  const combinedText = finalText.trim();

  // 啟動時請求麥克風權限
  useEffect(() => {
    Audio.requestPermissionsAsync().then(({ status }) => {
      setHasMicPermission(status === "granted");
    });
  }, []);

  // 離開頁面時清理錄音
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

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
    const { status } = await Audio.requestPermissionsAsync();
    if (status === "granted") {
      setHasMicPermission(true);
    } else {
      setHasMicPermission(false);
      setError("麥克風權限被拒絕，請至設定開啟。");
    }
  };

  const startRecording = async () => {
    setError("");
    setShowCross(false);
    setRecordSaved(false);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setWsStatus("open");
    } catch (e) {
      setError("啟動錄音失敗：" + (e as Error)?.message);
    }
  };

  // 停止錄音後，將音訊檔送往後端 WebSocket 進行轉錄
  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    setIsRecording(false);
    setWsStatus("transcribing");

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("無法取得錄音檔案");
      await sendAudioForTranscription(uri);
    } catch (e) {
      setError("錄音處理失敗：" + (e as Error)?.message);
      setWsStatus("error");
    } finally {
      setShowCross(true);
    }
  };

  // 讀取音訊檔案，透過 WebSocket 送給後端轉錄
  // 送完音訊後等待 is_final 結果才關閉，避免後端 Deepgram 還沒連上就被終止
  const sendAudioForTranscription = (uri: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?lang=${lang}`);
      let finishTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = () => {
        if (finishTimer) clearTimeout(finishTimer);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };

      ws.onopen = async () => {
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64" as any,
          });
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          ws.send(bytes.buffer as ArrayBuffer);
          // 送完後等 Deepgram 回傳，15 秒內無結果則視為逾時
          finishTimer = setTimeout(finish, 15000);
        } catch (err) {
          reject(err);
          finish();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as TranscriptMsg;
          if (msg?.type === "transcript" && msg.transcript) {
            const t = msg.transcript.trim();
            if (t) setFinalText((prev) => (prev ? prev + "，" + t : t));
            // 收到最終結果才關閉，讓後端有時間完成轉錄
            if (msg.is_final) finish();
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsStatus("closed");
        resolve();
      };

      ws.onerror = () => {
        setWsStatus("error");
        setError("WebSocket 連線失敗，請確認後端伺服器正在運行。");
        reject(new Error("WebSocket error"));
      };
    });
  };

  const loadPreview = async () => {
    if (!combinedText) { setError("沒有可儲存的內容"); return; }
    setIsLoadingPreview(true);
    setError("");
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api/diary/preview-prayer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ transcript: combinedText }),
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
          transcript: combinedText,
          latitude: userCoords?.latitude ?? null,
          longitude: userCoords?.longitude ?? null,
        }),
      });
      const result = await response.json();
      if (result.ok) {
        setPreviewData(null);
        setRecordSaved(true);
        setSaveSuccess(true);
        setTimeout(() => {
          setFinalText("");
          setSaveSuccess(false); setShowCross(false); setRecordSaved(false);
        }, 3000);
      } else {
        setError(result.error || "儲存失敗");
      }
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setIsSaving(false);
    }
  };

  const canPray = locationPerm === "granted" || locationPerm === "denied";
  const isTranscribing = wsStatus === "transcribing";

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <View style={{ flex: 1 }}>
        <View style={styles.backFloatRow}>
          <Pressable
            style={styles.backFloatBtn}
            onPress={() => router.canGoBack() ? router.back() : router.replace("/pilgrimage" as any)}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="arrow-left" size={26} color="rgba(255,255,255,0.95)" />
          </Pressable>
        </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardDismissMode="on-drag">
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
              {presetCoords
                ? `⛪ 虛擬朝聖位置：${paramBasilicaName ?? "教堂"}`
                : locationPerm === "granted" ? "📍 已記錄真實位置" : "📍 標示於聖殿鄰近（匿名）"}
            </Text>
          </View>
        )}

        {canPray && (
          <>
            <GlassCard style={styles.controlCard}>
              {hasMicPermission === false && (
                <TouchableOpacity onPress={requestMic} style={styles.outlineBtn}>
                  <Text style={styles.outlineBtnText}>🎙 允許麥克風</Text>
                </TouchableOpacity>
              )}

              <View style={styles.langRow}>
                <Text style={styles.langLabel}>語言：</Text>
                {(["zh-TW", "en-US"] as const).map((l) => (
                  <TouchableOpacity
                    key={l}
                    onPress={() => setLang(l)}
                    disabled={isRecording || isTranscribing}
                    style={[styles.langBtn, lang === l && styles.langBtnActive]}
                  >
                    <Text style={[styles.langBtnText, lang === l && styles.langBtnTextActive]}>
                      {l === "zh-TW" ? "中文" : "English"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isTranscribing ? (
                <View style={styles.recordBtn}>
                  <ActivityIndicator color="rgba(0,0,0,0.6)" size="small" />
                  <Text style={styles.recordBtnText}>轉錄中，請稍候…</Text>
                </View>
              ) : !isRecording ? (
                <TouchableOpacity
                  onPress={startRecording}
                  disabled={hasMicPermission === false}
                  style={[styles.recordBtn, hasMicPermission === false && styles.btnDisabled]}
                >
                  <MaterialCommunityIcons name="microphone" size={20} color="rgba(0,0,0,0.75)" />
                  <Text style={styles.recordBtnText}>開始祈禱（錄音）</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={stopRecording} style={[styles.recordBtn, styles.recordBtnActive]}>
                  <MaterialCommunityIcons name="stop" size={20} color="rgba(255,100,80,0.95)" />
                  <Text style={styles.recordBtnTextActive}>結束祈禱</Text>
                </TouchableOpacity>
              )}

              <View style={styles.wsRow}>
                <Text style={styles.wsText}>
                  狀態：{isRecording ? "🔴 錄音中" : isTranscribing ? "🔄 轉錄中" : wsStatus === "closed" ? "✅ 完成" : wsStatus === "error" ? "❌ 錯誤" : "待機"}
                </Text>
              </View>
            </GlassCard>

            <GlassCard style={styles.controlCard}>
              <TouchableOpacity
                onPress={loadPreview}
                disabled={!combinedText || isLoadingPreview || isSaving || saveSuccess || isRecording || isTranscribing || !!previewData}
                style={[styles.outlineBtn, (!combinedText || isLoadingPreview || isSaving || saveSuccess || isRecording || isTranscribing || !!previewData) && styles.btnDisabled]}
              >
                <Text style={styles.outlineBtnText}>
                  {isLoadingPreview ? "⏳ 生成預覽中..." : saveSuccess ? "✅ 已儲存！" : "💾 儲存為日記"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setFinalText(""); setError("");
                  setShowCross(false);
                  setSaveSuccess(false); setWsStatus("idle");
                }}
                disabled={isRecording || isTranscribing}
                style={[styles.outlineBtn, (isRecording || isTranscribing) && styles.btnDisabled]}
              >
                <Text style={styles.outlineBtnText}>清除</Text>
              </TouchableOpacity>
            </GlassCard>

            {previewData && !saveSuccess && (
              <GlassCard style={styles.previewCard}>
                <Text style={styles.previewSectionLabel}>📖 聖經福音</Text>
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

            <GlassCard style={styles.transcriptCard}>
              <Text style={styles.fieldLabel}>轉錄內容</Text>
              <TextInput
                style={styles.transcriptInput}
                value={finalText}
                onChangeText={setFinalText}
                placeholder="語音轉錄結果將顯示於此，也可直接輸入..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                textAlignVertical="top"
                editable={!isRecording && !isTranscribing}
              />
            </GlassCard>

            {showCross && recordSaved && (
              <GlassCard style={styles.savedCard} glassColor="rgba(52,168,83,0.22)">
                <MaterialCommunityIcons name="check-circle-outline" size={32} color="rgba(100,200,130,0.95)" />
                <Text style={styles.savedText}>祈禱已記錄 ✝</Text>
              </GlassCard>
            )}

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
      </View>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  backFloatRow: { position: "absolute", top: -(HEADER_CONTENT_HEIGHT - 10), right: 16, zIndex: 500 },
  backFloatBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
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

  wsRow: { alignItems: "center" },
  wsText: { fontSize: 12, color: "rgba(255,255,255,0.55)" },

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

  savedCard: { alignItems: "center", gap: 8 },
  savedText: { fontSize: 16, fontWeight: "700", color: "rgba(255,255,255,0.95)" },

  previewCard: { marginBottom: 12 },
  previewSectionLabel: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 6, fontWeight: "600", letterSpacing: 0.5 },
  previewBible: { fontSize: 15, color: "rgba(255,255,220,0.95)", fontStyle: "italic", lineHeight: 22, marginBottom: 10 },
  previewTitle: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 14 },
  previewBtnRow: { flexDirection: "row", gap: 12 },
});
