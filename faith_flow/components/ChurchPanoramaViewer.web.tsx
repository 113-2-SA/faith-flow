/**
 * ChurchPanoramaViewer.web.tsx  ← Web 平台
 *
 * 在全螢幕遮罩層內以 <iframe> 嵌入 Google Maps Embed Street View，
 * 讓使用者在瀏覽器中互動瀏覽 360° 教堂全景。
 */

import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { ThemedText } from "./themed-text";
import { GOOGLE_MAPS_API_KEY } from "../config/mapConfig";

type Props = {
  panoramaId: string;
  basilicaName: string;
  onClose: () => void;
};

export function ChurchPanoramaViewer({ panoramaId, basilicaName, onClose }: Props) {
  const embedUrl =
    `https://www.google.com/maps/embed/v1/streetview` +
    `?key=${GOOGLE_MAPS_API_KEY}&pano=${panoramaId}&heading=0&pitch=0&fov=90`;

  return (
    <Modal visible={true} transparent={true} animationType="fade" onRequestClose={onClose}>
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
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* iframe viewer */}
        {/* @ts-ignore — iframe is valid in React Native Web */}
        <iframe
          src={embedUrl}
          style={{
            flex: 1,
            border: "none",
            width: "100%",
            height: "100%",
          }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* Hint */}
        <View style={styles.hintBar}>
          <Text style={styles.hintText}>拖曳旋轉視角・滾輪縮放</Text>
        </View>
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    width: "92%",
    maxWidth: 900,
    // 最高不超過視窗高度的 88%
    maxHeight: "88vh" as unknown as number,
    height: "88%",
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
    backgroundColor: "rgba(10,10,20,0.98)",
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
  headerIcon: {
    fontSize: 20,
  },
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
    overflow: "hidden",
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
    cursor: "pointer",
  },
  closeBtnText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
  },
  hintBar: {
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "rgba(10,10,20,0.9)",
  },
  hintText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
});
