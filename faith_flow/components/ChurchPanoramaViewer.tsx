import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { ThemedText } from "./themed-text";
import { GOOGLE_MAPS_API_KEY } from "../config/mapConfig";

type Props = {
  coordinates: [number, number]; // [lat, lng]
  basilicaName: string;
  onClose: () => void;
  heading?: number;
};

export function ChurchPanoramaViewer({ coordinates, basilicaName, onClose, heading = 0 }: Props) {
  const insets = useSafeAreaInsets();
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
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <WebView
            source={{ html }}
            style={{ flex: 1 }}
            javaScriptEnabled
            allowsFullscreenVideo
            originWhitelist={["*"]}
            mixedContentMode="always"
          />

          <View style={styles.hintBar}>
            <Text style={styles.hintText}>拖曳旋轉視角・雙指縮放</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#0a0a14" },
  container: {
    flex: 1,
    backgroundColor: "#0a0a14", overflow: "hidden",
  },
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
  hintBar: { paddingVertical: 8, alignItems: "center", backgroundColor: "rgba(10,10,20,0.9)" },
  hintText: { fontSize: 11, color: "rgba(255,255,255,0.4)" },
});
