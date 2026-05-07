/**
 * ChurchVideoViewer.tsx  ← Native 平台（iOS / Android）
 *
 * 使用 react-native-webview 內嵌影片連結（支援 YouTube embed 等），
 * 讓使用者在 App 內以全螢幕方式觀看教堂相關影片。
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
} from "react-native";
import WebView from "react-native-webview";
import { ThemedText } from "./themed-text";

type Props = {
  videoUrl: string;
  basilicaName: string;
  onClose: () => void;
};

function toEmbedUrl(url: string): string {
  if (url.includes("youtube.com/embed/")) return url;
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  return url;
}

export function ChurchVideoViewer({ videoUrl, basilicaName, onClose }: Props) {
  const embedUrl = toEmbedUrl(videoUrl);
  return (
    <Modal
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>🎬</Text>
              <ThemedText style={styles.headerTitle} numberOfLines={1}>
                {basilicaName}
              </ThemedText>
              <Text style={styles.badge}>影片</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Video Viewer */}
          <WebView
            source={{ uri: embedUrl }}
            style={styles.webview}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="rgba(220,80,60,0.9)" />
                <Text style={styles.loadingText}>載入影片中…</Text>
              </View>
            )}
            javaScriptEnabled
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    width: "92%",
    height: "75%",
    backgroundColor: "#0a0a14",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(220,80,60,0.4)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(10,10,20,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
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
    flex: 1,
  },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(220,80,60,1)",
    backgroundColor: "rgba(220,80,60,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(220,80,60,0.4)",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 16, color: "rgba(255,255,255,0.85)" },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0a14",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 13, color: "rgba(255,255,255,0.6)" },
});
