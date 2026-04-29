/**
 * ChurchPanoramaViewer.tsx  ← Native 平台（iOS / Android）
 *
 * 使用 react-native-webview 內嵌 Google Maps Embed Street View，
 * 讓使用者在 App 內以全螢幕互動方式瀏覽 360° 教堂全景。
 *
 * 安裝依賴（首次使用前執行一次）：
 *   npx expo install react-native-webview
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import WebView from "react-native-webview";
import { ThemedText } from "./themed-text";
import { GOOGLE_MAPS_API_KEY } from "../config/mapConfig";

type Props = {
  panoramaId: string;
  basilicaName: string;
  onClose: () => void;
  heading?: number; // 朝向建築正面的方位角（0=北, 90=東, 180=南, 270=西）
};

export function ChurchPanoramaViewer({ panoramaId, basilicaName, onClose, heading = 0 }: Props) {
  const embedUrl =
    `https://www.google.com/maps/embed/v1/streetview` +
    `?key=${GOOGLE_MAPS_API_KEY}&pano=${panoramaId}&heading=${heading}&pitch=0&fov=90`;

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
            <Text style={styles.headerIcon}>🌐</Text>
            <ThemedText style={styles.headerTitle} numberOfLines={1}>
              {basilicaName}
            </ThemedText>
            <Text style={styles.badge}>360°</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* 360° Viewer */}
        <WebView
          source={{ uri: embedUrl }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="rgba(102,126,234,0.9)" />
              <Text style={styles.loadingText}>載入 360° 全景中…</Text>
            </View>
          )}
          javaScriptEnabled
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />

        {/* Hint bar */}
        <View style={styles.hintBar}>
          <Text style={styles.hintText}>拖曳旋轉視角・雙指縮放</Text>
        </View>
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
    height: "85%",
    backgroundColor: "#0a0a14",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.4)",
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
    color: "rgba(102,126,234,1)",
    backgroundColor: "rgba(102,126,234,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.4)",
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
  hintBar: {
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "rgba(10,10,20,0.9)",
  },
  hintText: { fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 0.3 },
});
