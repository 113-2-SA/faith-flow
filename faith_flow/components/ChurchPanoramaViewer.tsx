import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { WebView } from "react-native-webview";
import { ThemedText } from "./themed-text";
import { GOOGLE_MAPS_API_KEY } from "../config/mapConfig";
import { auth } from "../lib/firebase";
import { API_BASE_URL } from "../lib/api";

type Props = {
  coordinates: [number, number]; // [lat, lng]
  basilicaName: string;
  onClose: () => void;
  heading?: number;
};

type RecordStatus = "idle" | "recording" | "transcribing" | "saved" | "error";

const WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/ws/transcribe";

export function ChurchPanoramaViewer({ coordinates, basilicaName, onClose, heading = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const [recordStatus, setRecordStatus] = useState<RecordStatus>("idle");
  const recordingRef = useRef<Audio.Recording | null>(null);

  const embedUrl =
    `https://www.google.com/maps/embed/v1/streetview` +
    `?key=${GOOGLE_MAPS_API_KEY}&location=${coordinates[0]},${coordinates[1]}&heading=${heading}&pitch=0&fov=90`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; background: #000; }
    iframe { width: 100%; height: 100%; border: none; display: block; }
  </style>
</head>
<body>
  <iframe src="${embedUrl}" allowfullscreen></iframe>
</body>
</html>`;

  const transcribeAudio = (uri: string): Promise<string> =>
    new Promise((resolve) => {
      const ws = new WebSocket(`${WS_URL}?lang=zh-TW`);
      let result = "";
      let timer: ReturnType<typeof setTimeout> | null = null;

      const done = (text: string) => {
        if (timer) clearTimeout(timer);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
        resolve(text);
      };

      ws.onopen = async () => {
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" as any });
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          ws.send(bytes.buffer as ArrayBuffer);
          timer = setTimeout(() => done(result), 15000);
        } catch { done(result); }
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(String(e.data));
          if (msg?.type === "transcript" && msg.transcript) {
            const t = msg.transcript.trim();
            if (t) result += (result ? "，" : "") + t;
            if (msg.is_final) done(result);
          }
        } catch {}
      };

      ws.onerror = () => done(result);
      ws.onclose = () => resolve(result);
    });

  const saveToAPI = async (transcript: string) => {
    const user = auth.currentUser;
    if (!user || !transcript) return;
    const token = await user.getIdToken();
    await fetch(`${API_BASE_URL}/api/diary/from-prayer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        transcript,
        latitude: coordinates[0],
        longitude: coordinates[1],
      }),
    });
  };

  const startPrayer = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setRecordStatus("recording");
    } catch {
      setRecordStatus("error");
    }
  };

  const stopPrayer = async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    setRecordStatus("transcribing");
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      recordingRef.current = null;
      if (uri) {
        const transcript = await transcribeAudio(uri);
        await saveToAPI(transcript);
      }
      setRecordStatus("saved");
      setTimeout(() => setRecordStatus("idle"), 2500);
    } catch {
      setRecordStatus("error");
      setTimeout(() => setRecordStatus("idle"), 2000);
    }
  };

  const isActive = recordStatus === "recording" || recordStatus === "transcribing";

  return (
    <Modal visible={true} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>🌐</Text>
              <ThemedText style={styles.headerTitle} numberOfLines={1}>
                {basilicaName}
              </ThemedText>
              <Text style={styles.badge}>360°</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} disabled={isActive}>
              <Text style={[styles.closeBtnText, isActive && { opacity: 0.3 }]}>✕</Text>
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            <WebView
              source={{ html }}
              style={{ flex: 1 }}
              javaScriptEnabled
              allowsFullscreenVideo
              originWhitelist={["*"]}
              mixedContentMode="always"
            />

            {/* 十字架 overlay（錄音 / 轉錄中顯示） */}
            {isActive && (
              <View style={styles.crossOverlay} pointerEvents="none">
                <View style={styles.crossWrapper}>
                  <View style={styles.crossV} />
                  <View style={styles.crossH} />
                </View>
                {recordStatus === "transcribing" && (
                  <ActivityIndicator color="rgba(220,20,60,0.85)" size="large" style={styles.crossSpinner} />
                )}
              </View>
            )}

            {/* 儲存成功提示 */}
            {recordStatus === "saved" && (
              <View style={styles.savedOverlay} pointerEvents="none">
                <Text style={styles.savedText}>✝ 祈禱已記錄於地圖</Text>
              </View>
            )}
          </View>

          {/* 底列 */}
          <View style={styles.hintBar}>
            {recordStatus === "idle" && (
              <>
                <Text style={styles.hintText}>拖曳旋轉視角・雙指縮放</Text>
                <Pressable onPress={startPrayer} style={styles.recordBtn}>
                  <Text style={styles.recordBtnText}>🎙 錄音祈禱</Text>
                </Pressable>
              </>
            )}

            {recordStatus === "recording" && (
              <Pressable onPress={stopPrayer} style={styles.stopBtn}>
                <View style={styles.stopIcon} />
                <Text style={styles.stopBtnText}>結束祈禱</Text>
              </Pressable>
            )}

            {recordStatus === "transcribing" && (
              <View style={styles.transcribingRow}>
                <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
                <Text style={styles.transcribingText}>正在轉錄祈禱內容…</Text>
              </View>
            )}

            {recordStatus === "saved" && (
              <Text style={styles.savedBarText}>✝ 已儲存至日記與地圖</Text>
            )}

            {recordStatus === "error" && (
              <Text style={styles.errorBarText}>⚠ 儲存失敗，請再試一次</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CROSS_W = 48;
const CROSS_H = 150;
const CROSS_COLOR = "rgba(210, 30, 50, 0.72)";

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#0a0a14" },
  container: { flex: 1, backgroundColor: "#0a0a14", overflow: "hidden" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: "rgba(10,10,20,0.98)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginRight: 12 },
  headerIcon: { fontSize: 20 },
  headerTitle: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.95)" },
  badge: {
    fontSize: 10, fontWeight: "700", color: "rgba(102,126,234,1)",
    backgroundColor: "rgba(102,126,234,0.15)", paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: "rgba(102,126,234,0.4)",
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontSize: 16, color: "rgba(255,255,255,0.85)" },

  // 十字架 overlay
  crossOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  crossWrapper: { width: CROSS_H, height: CROSS_H, justifyContent: "center", alignItems: "center" },
  crossV: {
    position: "absolute",
    width: CROSS_W,
    height: CROSS_H,
    backgroundColor: CROSS_COLOR,
    borderRadius: 6,
    shadowColor: "#dc143c", shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  crossH: {
    position: "absolute",
    width: CROSS_H,
    height: CROSS_W,
    top: 28,
    backgroundColor: CROSS_COLOR,
    borderRadius: 6,
    shadowColor: "#dc143c", shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  crossSpinner: { position: "absolute", bottom: -50 },

  // 儲存成功 overlay
  savedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  savedText: {
    fontSize: 20, fontWeight: "700", color: "rgba(255,255,255,0.95)",
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16,
  },

  // 底列
  hintBar: {
    paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(10,10,20,0.92)", minHeight: 52,
  },
  hintText: { fontSize: 11, color: "rgba(255,255,255,0.4)" },
  recordBtn: {
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14, paddingVertical: 5,
  },
  recordBtnText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.88)" },

  stopBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderWidth: 1, borderColor: "rgba(220,20,60,0.55)", borderRadius: 26,
    paddingVertical: 10, backgroundColor: "rgba(220,20,60,0.10)",
  },
  stopIcon: { width: 14, height: 14, backgroundColor: "rgba(220,20,60,0.9)", borderRadius: 3 },
  stopBtnText: { fontSize: 16, fontWeight: "700", color: "rgba(220,20,60,0.95)", letterSpacing: 0.5 },

  transcribingRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  transcribingText: { fontSize: 14, color: "rgba(255,255,255,0.65)" },

  savedBarText: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "600", color: "rgba(100,220,130,0.95)" },
  errorBarText: { flex: 1, textAlign: "center", fontSize: 13, color: "rgba(255,140,120,0.90)" },
});
