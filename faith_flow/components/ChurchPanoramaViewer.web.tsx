/**
 * ChurchPanoramaViewer.web.tsx  ← Web 平台
 *
 * 360° 街景 + 內嵌錄音祈禱（位置授權 → 錄音 → 儲存日記），
 * 全程以 360 環景作為底圖。
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "./themed-text";
import { GOOGLE_MAPS_API_KEY } from "../config/mapConfig";
import { API_BASE_URL } from "../lib/api";
import { auth } from "../lib/firebase";

// ── 型別 ─────────────────────────────────────────────────────────────────────
type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";
type LocationPerm = "idle" | "asking" | "granted" | "denied";
type PreviewData = { title: string; bibleQuote: string | null };

// ── 常數 / 工具函式 ───────────────────────────────────────────────────────────
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

async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("使用者未登入");
  return user.getIdToken();
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  coordinates: [number, number];
  basilicaName: string;
  onClose: () => void;
  heading?: number;
};

export function ChurchPanoramaViewer({
  coordinates,
  basilicaName,
  onClose,
  heading = 0,
}: Props) {
  // ── 底部選單 ─────────────────────────────────────────────────────────────
  const [showSheet, setShowSheet] = useState(false);
  const sheetAnim = useRef(new Animated.Value(300)).current;

  // ── 祈禱 overlay 開關 ────────────────────────────────────────────────────
  const [showPrayOverlay, setShowPrayOverlay] = useState(false);

  // ── 位置授權 ─────────────────────────────────────────────────────────────
  const [locationPerm, setLocationPerm] = useState<LocationPerm>("idle");
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // ── 錄音 ─────────────────────────────────────────────────────────────────
  const [lang, setLang] = useState<"zh-TW" | "en-US">("zh-TW");
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [error, setError] = useState("");
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
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

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasMicPermission(false);
      setError("此瀏覽器不支援麥克風。");
    }
  }, []);

  useEffect(() => {
    return () => { void stopRecording(); };
  }, []);

  // ── 底部選單動畫 ─────────────────────────────────────────────────────────
  const openSheet = () => {
    setShowSheet(true);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeSheet = (callback?: () => void) => {
    Animated.timing(sheetAnim, {
      toValue: 300,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setShowSheet(false);
      callback?.();
    });
  };

  // ── 進入祈禱 overlay ──────────────────────────────────────────────────────
  const handleRecord = () =>
    closeSheet(() => {
      setLocationPerm("idle");
      setShowPrayOverlay(true);
    });

  // ── 關閉 overlay 並重置 ──────────────────────────────────────────────────
  const closeOverlay = () => {
    void stopRecording();
    setShowPrayOverlay(false);
    setLocationPerm("idle");
    setFinalText("");
    setInterimText("");
    setError("");
    setPreviewData(null);
    setSaveSuccess(false);
    setWsStatus("idle");
    setHasMicPermission(null);
  };

  // ── 位置授權 ─────────────────────────────────────────────────────────────
  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
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

  // ── 麥克風 ───────────────────────────────────────────────────────────────
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

  // ── WebSocket ────────────────────────────────────────────────────────────
  const openWs = (): Promise<WebSocket> => {
    setError("");
    setWsStatus("connecting");
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(`${WS_URL}?lang=${lang}`);
        ws.binaryType = "arraybuffer";
        ws.onopen = () => { setWsStatus("open"); resolve(ws); };
        ws.onclose = () => setWsStatus("closed");
        ws.onerror = () => {
          setWsStatus("error");
          reject(new Error("WebSocket 連線失敗"));
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data));
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
          } catch {
            const t = String(event.data || "").trim();
            if (t) setFinalText((prev) => (prev ? prev + " " + t : t));
          }
        };
        socketRef.current = ws;
      } catch (e) { reject(e); }
    });
  };

  // ── 錄音開始 / 停止 ──────────────────────────────────────────────────────
  const startRecording = async () => {
    setError("");
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
      recorder.onerror = (ev: any) =>
        setError(ev?.error?.message || "MediaRecorder 錯誤");
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
  };

  // ── 預覽 / 儲存 ──────────────────────────────────────────────────────────
  const loadPreview = async () => {
    if (!combinedText.trim()) { setError("沒有可儲存的內容"); return; }
    setIsLoadingPreview(true);
    setError("");
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/diary/preview-prayer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transcript: combinedText.trim() }),
      });
      const result = await res.json();
      if (result.ok) {
        setPreviewData({
          title: result.data.suggestedTitle,
          bibleQuote: result.data.suggestedBibleQuote ?? null,
        });
      } else { setError(result.error || "預覽失敗"); }
    } catch { setError("網路錯誤，請稍後再試"); }
    finally { setIsLoadingPreview(false); }
  };

  const saveToDiary = async () => {
    setIsSaving(true);
    setError("");
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/diary/from-prayer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          transcript: combinedText.trim(),
          latitude: userCoords?.latitude ?? null,
          longitude: userCoords?.longitude ?? null,
        }),
      });
      const result = await res.json();
      if (result.ok) {
        setPreviewData(null);
        setSaveSuccess(true);
        setTimeout(() => {
          setFinalText(""); setInterimText(""); setSaveSuccess(false);
        }, 3000);
      } else { setError(result.error || "儲存失敗"); }
    } catch { setError("網路錯誤，請稍後再試"); }
    finally { setIsSaving(false); }
  };

  // ── 建立 URL ─────────────────────────────────────────────────────────────
  const embedUrl =
    `https://www.google.com/maps/embed/v1/streetview` +
    `?key=${GOOGLE_MAPS_API_KEY}&location=${coordinates[0]},${coordinates[1]}&heading=${heading}&pitch=0&fov=90`;

  const canRecord = locationPerm === "granted" || locationPerm === "denied";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal visible={true} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>🌐</Text>
              <ThemedText style={styles.headerTitle} numberOfLines={1}>
                {basilicaName}
              </ThemedText>
              <Text style={styles.badge}>360°</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* ── 360 iframe（永遠在最底層）───────────────────────────────── */}
          {/* @ts-ignore — iframe is valid in React Native Web */}
          <iframe
            src={embedUrl}
            style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />

          {/* ── 底部提示列 + 祈禱觸發鈕（無 overlay 時顯示）────────────── */}
          {!showPrayOverlay && (
            <View style={styles.bottomBar}>
              <Text style={styles.hintText}>拖曳旋轉視角・滾輪縮放</Text>
              <Pressable
                onPress={openSheet}
                style={({ pressed }) => [
                  styles.prayTrigger,
                  pressed && styles.prayTriggerPressed,
                ]}
              >
                <Text style={styles.prayTriggerIcon}>🎙️</Text>
                <Text style={styles.prayTriggerText}>祈禱</Text>
              </Pressable>
            </View>
          )}

          {/* ── 底部上拉式選單 ───────────────────────────────────────────── */}
          {showSheet && !showPrayOverlay && (
            <>
              <Pressable style={styles.sheetBackdrop} onPress={() => closeSheet()} />
              <Animated.View
                style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}
              >
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>在此刻獻上祈禱</Text>
                <Text style={styles.sheetSubtitle}>{basilicaName}</Text>

                <Pressable
                  onPress={handleRecord}
                  style={({ pressed }) => [
                    styles.sheetBtn,
                    styles.recordSheetBtn,
                    pressed && styles.recordSheetBtnPressed,
                  ]}
                >
                  <Text style={styles.sheetBtnIcon}>🎙️</Text>
                  <Text style={styles.sheetBtnText}>錄音祈禱</Text>
                </Pressable>

                <Pressable onPress={() => closeSheet()} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>取消</Text>
                </Pressable>
              </Animated.View>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════
              祈禱 Overlay — 以 360 環景為底圖
          ══════════════════════════════════════════════════════════════ */}
          {showPrayOverlay && (
            <View
              style={[
                styles.prayOverlay,
                isRecording && styles.prayOverlayRecording,
              ]}
              pointerEvents={isRecording ? "box-none" : "auto"}
            >
              {/* 錄音中：僅顯示停止按鈕懸浮於底部 */}
              {isRecording && (
                <View style={styles.recordingBar}>
                  <TouchableOpacity
                    onPress={stopRecording}
                    style={[styles.recordBtn, styles.recordBtnActive]}
                  >
                    <MaterialCommunityIcons
                      name="stop"
                      size={20}
                      color="rgba(255,100,80,0.95)"
                    />
                    <Text style={styles.recordBtnTextActive}>結束祈禱</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 非錄音中：顯示完整 UI ─────────────────────────────── */}
              {!isRecording && (
                <>
              {/* 關閉 overlay */}
              <TouchableOpacity onPress={closeOverlay} style={styles.overlayClose}>
                <Text style={styles.overlayCloseText}>✕</Text>
              </TouchableOpacity>

              {/* ── 位置授權畫面 ─────────────────────────────────────── */}
              {(locationPerm === "idle" || locationPerm === "asking") && (
                <View style={styles.consentWrapper}>
                  <View style={styles.consentCard}>
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={40}
                      color="rgba(255,255,255,0.90)"
                      style={{ marginBottom: 12 }}
                    />
                    <Text style={styles.consentTitle}>記錄祈禱位置</Text>
                    <Text style={styles.consentBody}>
                      允許此功能後，您的祈禱將以{"\n"}
                      <Text style={styles.consentBold}>十字架標記</Text>
                      顯示在朝聖地圖上，與其他信徒共同見證。{"\n"}
                      位置資訊
                      <Text style={styles.consentBold}>僅用於地圖顯示</Text>
                      ，不會對外分享。
                    </Text>

                    {locationPerm === "asking" ? (
                      <ActivityIndicator
                        color="rgba(255,255,255,0.8)"
                        style={{ marginVertical: 14 }}
                      />
                    ) : (
                      <View style={styles.consentBtnRow}>
                        <TouchableOpacity
                          style={styles.primaryBtn}
                          onPress={handleGrantLocation}
                        >
                          <Text style={styles.primaryBtnText}>✝ 同意，記錄位置</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.secondaryBtn}
                          onPress={handleDenyLocation}
                        >
                          <Text style={styles.secondaryBtnText}>不同意</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={styles.consentFootnote}>
                      不同意時，您的祈禱仍會被保存，{"\n"}
                      並以匿名方式標示在聖殿附近。
                    </Text>
                  </View>
                </View>
              )}

              {/* ── 錄音 UI ─────────────────────────────────────────── */}
              {canRecord && (
                <ScrollView
                  style={styles.recordScroll}
                  contentContainerStyle={styles.recordScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.recordTitle}>即時祈禱轉錄</Text>

                  {/* 位置標籤 */}
                  <View style={styles.locationTag}>
                    <Text style={styles.locationTagText}>
                      {locationPerm === "granted"
                        ? "📍 已記錄真實位置"
                        : "📍 標示於聖殿鄰近（匿名）"}
                    </Text>
                  </View>

                  {/* 麥克風 + 語言 + 錄音按鈕 */}
                  <View style={styles.controlCard}>
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
                          <Text
                            style={[
                              styles.langBtnText,
                              lang === l && styles.langBtnTextActive,
                            ]}
                          >
                            {l === "zh-TW" ? "中文" : "English"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {!isRecording ? (
                      <TouchableOpacity
                        onPress={startRecording}
                        disabled={hasMicPermission === false}
                        style={[
                          styles.recordBtn,
                          hasMicPermission === false && styles.btnDisabled,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="microphone"
                          size={20}
                          color="rgba(0,0,0,0.75)"
                        />
                        <Text style={styles.recordBtnText}>開始祈禱（錄音轉錄）</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={stopRecording}
                        style={[styles.recordBtn, styles.recordBtnActive]}
                      >
                        <MaterialCommunityIcons
                          name="stop"
                          size={20}
                          color="rgba(255,100,80,0.95)"
                        />
                        <Text style={styles.recordBtnTextActive}>結束祈禱</Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.wsRow}>
                      <Text style={styles.wsText}>
                        WS：{wsStatus} | 錄音：{isRecording ? "進行中" : "未開始"}
                      </Text>
                    </View>
                  </View>

                  {/* 儲存 / 清除 */}
                  <View style={[styles.controlCard, { marginTop: 10 }]}>
                    <TouchableOpacity
                      onPress={loadPreview}
                      disabled={
                        !combinedText.trim() ||
                        isLoadingPreview ||
                        isSaving ||
                        saveSuccess ||
                        isRecording ||
                        !!previewData
                      }
                      style={[
                        styles.outlineBtn,
                        (!combinedText.trim() ||
                          isLoadingPreview ||
                          isSaving ||
                          saveSuccess ||
                          isRecording ||
                          !!previewData) &&
                          styles.btnDisabled,
                      ]}
                    >
                      <Text style={styles.outlineBtnText}>
                        {isLoadingPreview
                          ? "⏳ 生成預覽中..."
                          : saveSuccess
                          ? "✅ 已儲存！"
                          : "💾 儲存為日記"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setFinalText("");
                        setInterimText("");
                        setError("");
                        setSaveSuccess(false);
                        setWsStatus("idle");
                      }}
                      disabled={isRecording}
                      style={[styles.outlineBtn, isRecording && styles.btnDisabled]}
                    >
                      <Text style={styles.outlineBtnText}>清除</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 轉錄文字 */}
                  <View style={styles.transcriptCard}>
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
                  </View>

                  {/* 預覽卡 */}
                  {previewData && !saveSuccess && (
                    <View style={styles.previewCard}>
                      <Text style={styles.previewSectionLabel}>📖 聖經經文</Text>
                      <Text style={styles.previewBible}>
                        {previewData.bibleQuote || "（AI 未推薦經文）"}
                      </Text>
                      <Text style={styles.previewTitle}>
                        建議標題：{previewData.title}
                      </Text>
                      <View style={styles.previewBtnRow}>
                        <TouchableOpacity
                          style={[styles.primaryBtn, isSaving && styles.btnDisabled]}
                          onPress={saveToDiary}
                          disabled={isSaving}
                        >
                          <Text style={styles.primaryBtnText}>
                            {isSaving ? "⏳ 儲存中..." : "✝ 確認儲存"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.secondaryBtn, isSaving && styles.btnDisabled]}
                          onPress={() => setPreviewData(null)}
                          disabled={isSaving}
                        >
                          <Text style={styles.secondaryBtnText}>取消</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {saveSuccess && (
                    <View style={styles.successCard}>
                      <Text style={styles.successText}>
                        ✨ 祈禱已成功轉換為日記！
                      </Text>
                    </View>
                  )}

                  {!!error && (
                    <View style={styles.errorCard}>
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <View style={{ height: 40 }} />
                </ScrollView>
              )}
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── 樣式 ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#0a0a14" },
  container: { flex: 1, backgroundColor: "#0a0a14", overflow: "hidden" as any },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(10,10,20,0.98)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    zIndex: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  headerIcon: { fontSize: 20 },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.95)",
  },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(102,126,234,1)",
    backgroundColor: "rgba(102,126,234,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden" as any,
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.4)",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer" as any,
  },
  closeBtnText: { fontSize: 16, color: "rgba(255,255,255,0.85)" },

  // 底部提示列
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(10,10,20,0.9)",
    zIndex: 10,
  },
  hintText: { fontSize: 11, color: "rgba(255,255,255,0.4)" },
  prayTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(200,146,42,0.22)",
    borderWidth: 1,
    borderColor: "rgba(200,146,42,0.6)",
  },
  prayTriggerPressed: {
    backgroundColor: "rgba(200,146,42,0.42)",
    borderColor: "rgba(200,146,42,1)",
  },
  prayTriggerIcon: { fontSize: 14 },
  prayTriggerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f5d680",
    letterSpacing: 0.4,
  },

  // 上拉式底部選單
  sheetBackdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 30,
  },
  sheet: {
    position: "absolute" as any,
    left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(15,15,28,0.97)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
    alignItems: "center",
    zIndex: 40,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 17, fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
  },
  sheetSubtitle: {
    fontSize: 12, color: "rgba(255,255,255,0.5)",
    textAlign: "center", marginTop: -8,
  },
  sheetBtn: {
    width: "100%" as any,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  recordSheetBtn: {
    backgroundColor: "rgba(200,146,42,0.22)",
    borderColor: "rgba(200,146,42,0.6)",
  },
  recordSheetBtnPressed: {
    backgroundColor: "rgba(200,146,42,0.42)",
    borderColor: "rgba(200,146,42,1)",
  },
  sheetBtnIcon: { fontSize: 18 },
  sheetBtnText: {
    fontSize: 15, fontWeight: "700",
    color: "#f5d680", letterSpacing: 0.5,
  },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 24 },
  cancelText: { fontSize: 14, color: "rgba(255,255,255,0.45)" },

  // ── 祈禱 Overlay（覆蓋在 iframe 之上）───────────────────────────────────
  prayOverlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(8,8,18,0.80)",
    zIndex: 50,
  },
  // 錄音中：overlay 完全透明，只露出底部停止按鈕列
  prayOverlayRecording: {
    backgroundColor: "transparent",
  },
  // 錄音中底部停止按鈕列
  recordingBar: {
    position: "absolute" as any,
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 28,
    backgroundColor: "rgba(8,8,18,0.88)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
    zIndex: 55,
  },
  overlayClose: {
    position: "absolute" as any,
    top: 14, right: 16,
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    cursor: "pointer" as any,
  },
  overlayCloseText: { fontSize: 16, color: "rgba(255,255,255,0.8)" },

  // 位置授權置中卡
  consentWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  consentCard: {
    width: "100%" as any,
    maxWidth: 480,
    backgroundColor: "rgba(20,20,36,0.92)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 28,
    alignItems: "center",
  },
  consentTitle: {
    fontSize: 17, fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    marginBottom: 10, textAlign: "center",
  },
  consentBody: {
    fontSize: 14, color: "rgba(255,255,255,0.80)",
    lineHeight: 22, textAlign: "center", marginBottom: 20,
  },
  consentBold: { fontWeight: "700", color: "rgba(255,255,255,0.95)" },
  consentBtnRow: { flexDirection: "row", gap: 12, marginBottom: 14 },
  consentFootnote: {
    fontSize: 12, color: "rgba(255,255,255,0.50)",
    textAlign: "center", lineHeight: 18,
  },

  // 錄音 UI 滾動區
  recordScroll: { flex: 1 },
  recordScrollContent: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  recordTitle: {
    fontSize: 22, fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    marginBottom: 4,
  },

  // 共用按鈕
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "700", color: "rgba(0,0,0,0.75)" },
  secondaryBtn: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    paddingVertical: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.80)" },

  // 位置標籤
  locationTag: {
    alignSelf: "flex-start" as any,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 14,
  },
  locationTagText: {
    fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.85)",
  },

  // 控制卡
  controlCard: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 16,
    gap: 12,
    marginBottom: 0,
  },
  langRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  langLabel: { fontSize: 13, color: "rgba(255,255,255,0.70)" },
  langBtn: {
    borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    paddingHorizontal: 14, paddingVertical: 5,
  },
  langBtnActive: {
    backgroundColor: "rgba(255,255,255,0.20)",
    borderColor: "rgba(255,255,255,0.60)",
  },
  langBtnText: { fontSize: 13, color: "rgba(255,255,255,0.65)" },
  langBtnTextActive: { color: "rgba(255,255,255,0.95)", fontWeight: "600" },

  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 30,
    paddingVertical: 14,
    gap: 8,
  },
  recordBtnActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,100,80,0.60)",
  },
  recordBtnText: { fontSize: 16, fontWeight: "700", color: "rgba(0,0,0,0.75)" },
  recordBtnTextActive: { fontSize: 16, fontWeight: "700", color: "rgba(255,100,80,0.95)" },

  wsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  wsText: { fontSize: 13, color: "rgba(255,255,255,0.55)" },

  outlineBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
  },
  outlineBtnText: { color: "rgba(255,255,255,0.90)", fontSize: 14, fontWeight: "600" },
  btnDisabled: { opacity: 0.4 },

  // 轉錄卡
  transcriptCard: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 16,
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 11, color: "rgba(255,255,255,0.55)",
    marginBottom: 6, fontWeight: "600", letterSpacing: 0.5,
  },
  transcriptInput: {
    fontSize: 15, color: "rgba(255,255,255,0.90)",
    lineHeight: 22, minHeight: 80, textAlignVertical: "top",
  },
  interimText: {
    fontSize: 14, color: "rgba(255,255,255,0.40)",
    fontStyle: "italic", marginTop: 6, lineHeight: 20,
  },

  // 預覽卡
  previewCard: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 16,
    marginTop: 10,
  },
  previewSectionLabel: {
    fontSize: 11, color: "rgba(255,255,255,0.55)",
    marginBottom: 6, fontWeight: "600", letterSpacing: 0.5,
  },
  previewBible: {
    fontSize: 15, color: "rgba(255,255,220,0.95)",
    fontStyle: "italic", lineHeight: 22, marginBottom: 10,
  },
  previewTitle: {
    fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 14,
  },
  previewBtnRow: { flexDirection: "row", gap: 12 },

  // 成功 / 錯誤
  successCard: {
    backgroundColor: "rgba(52,168,83,0.15)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(52,168,83,0.4)",
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  successText: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.95)" },
  errorCard: {
    backgroundColor: "rgba(255,80,80,0.12)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.35)",
    padding: 14,
    marginTop: 10,
  },
  errorText: { fontSize: 14, color: "rgba(255,160,150,0.95)" },
});
