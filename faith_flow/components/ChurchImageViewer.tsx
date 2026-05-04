import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, Modal,
  ActivityIndicator, ScrollView, Image, Dimensions,
} from "react-native";
import { ThemedText } from "./themed-text";
import { useChurchPhotos } from "../hooks/useChurchPhotos";

type Props = {
  nameEn: string;
  basilicaName: string;
  onClose: () => void;
};

const COL = 3;
const H_PAD = 16;
const GAP = 6;
const containerW = Dimensions.get("window").width * 0.92;
const IMG_SIZE = (containerW - H_PAD * 2 - GAP * (COL - 1)) / COL;

export function ChurchImageViewer({ nameEn, basilicaName, onClose }: Props) {
  const { photoUrls, loading, error } = useChurchPhotos(nameEn);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  return (
    <Modal animationType="fade" transparent onRequestClose={selectedUrl ? () => setSelectedUrl(null) : onClose}>
      {selectedUrl ? (
        <View style={styles.fullOverlay}>
          <Pressable style={styles.fullClose} onPress={() => setSelectedUrl(null)} hitSlop={12}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
          <Image source={{ uri: selectedUrl }} style={styles.fullImg} resizeMode="contain" />
        </View>
      ) : (
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerIcon}>🖼️</Text>
                <ThemedText style={styles.headerTitle} numberOfLines={1}>
                  {basilicaName}
                </ThemedText>
                <Text style={styles.badge}>圖片</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="rgba(52,168,83,0.9)" />
                <Text style={styles.loadingText}>載入圖片中…</Text>
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.grid}>
                {photoUrls.map((url, i) => (
                  <Pressable key={i} onPress={() => setSelectedUrl(url)}>
                    <Image
                      source={{ uri: url }}
                      style={styles.img}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      )}
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
    borderColor: "rgba(52,168,83,0.4)",
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
    color: "rgba(52,168,83,1)",
    backgroundColor: "rgba(52,168,83,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(52,168,83,0.4)",
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 13, color: "rgba(255,255,255,0.6)" },
  errorText: { fontSize: 13, color: "rgba(255,100,100,0.8)" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: H_PAD,
    gap: GAP,
  },
  img: {
    width: IMG_SIZE,
    height: IMG_SIZE,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  fullOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullClose: {
    position: "absolute",
    top: 44,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  fullImg: {
    width: "100%",
    height: "80%",
  },
});
