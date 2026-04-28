import React, { useCallback, useState } from "react";
import { Stack, useFocusEffect } from "expo-router";
import { GlassCard } from "../components/GlassCard";
import { VideoBackground } from "../components/VideoBackground";
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
} from "react-native";
import { loadPrayers, PrayerRecord, BASILICA_COORDS, clearPrayers } from "./prayerStore";
import MapWrapper from "../components/MapWrapper";

// ─────────────────────────────────────────────────────────────────
// 主頁
// ─────────────────────────────────────────────────────────────────
export default function PilgrimageTab() {
  const [prayers, setPrayers] = useState<PrayerRecord[]>([]);

  // 每次切換到此頁重新載入
  useFocusEffect(
    useCallback(() => {
      loadPrayers().then(setPrayers);
    }, [])
  );

  const gpsCount = prayers.filter((p) => p.locationSource === "gps").length;
  const defaultCount = prayers.filter((p) => p.locationSource === "default").length;

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
        <GlassCard style={{ flex: 1, minHeight: 520 }}>

          <Text style={styles.title}>朝聖地圖</Text>

          {/* ── 地圖 ─────────────────────────────────────────────── */}
          <MapWrapper prayers={prayers} center={BASILICA_COORDS} />

          {/* ── 統計 Badge ───────────────────────────────────────── */}
          {prayers.length > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statBadge}>
                <Text style={styles.statText}>✝ {prayers.length} 次祈禱</Text>
              </View>
              {gpsCount > 0 && (
                <View style={[styles.statBadge, styles.statGps]}>
                  <Text style={styles.statText}>📍 {gpsCount} 有位置</Text>
                </View>
              )}
              {defaultCount > 0 && (
                <View style={[styles.statBadge, styles.statAnon]}>
                  <Text style={styles.statText}>🏛 {defaultCount} 匿名</Text>
                </View>
              )}
            </View>
          )}

          {/* ── 圖例 ─────────────────────────────────────────────── */}
          <View style={styles.legendRow}>
            <View style={[styles.crossV, styles.crossGoldV, { width: 4, height: 14, borderRadius: 2 }]} />
            <Text style={styles.legendText}>金色 = 有位置</Text>
            <View style={{ width: 12 }} />
            <View style={[styles.crossV, styles.crossSilverV, { width: 4, height: 14, borderRadius: 2 }]} />
            <Text style={styles.legendText}>銀色 = 匿名（聖殿附近）</Text>
          </View>

          {/* ── 最近祈禱清單 ─────────────────────────────────────── */}
          {prayers.length > 0 && (
            <View style={styles.recentList}>
              <Text style={styles.recentTitle}>最近祈禱</Text>
              {prayers
                .slice(-3)
                .reverse()
                .map((p) => {
                  const d = new Date(p.createdAt);
                  const t = `${d.getMonth() + 1}/${d.getDate()} `
                    + `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                  return (
                    <View key={p.id} style={styles.recentItem}>
                      <Text style={styles.recentTime}>
                        {p.locationSource === "gps" ? "📍" : "🏛"} {t}
                      </Text>
                      <Text style={styles.recentText} numberOfLines={2}>
                        {p.text}
                      </Text>
                    </View>
                  );
                })}
            </View>
          )}

          {/* ── 清除（開發用） ───────────────────────────────────── */}
          {__DEV__ && prayers.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={async () => { await clearPrayers(); setPrayers([]); }}
            >
              <Text style={styles.clearBtnText}>清除所有記錄（DEV）</Text>
            </TouchableOpacity>
          )}
        </GlassCard>
      </ScrollView>
    </VideoBackground>
  );
}

// ─────────────────────────────────────────────────────────────────
// 樣式
// ─────────────────────────────────────────────────────────────────
const GOLD = "#c8922a";
const GOLD_LIGHT = "#f5d680";
const SILVER = "#b0b8c8";
const WHITE_90 = "rgba(255,255,255,0.90)";
const WHITE_60 = "rgba(255,255,255,0.60)";
const WHITE_18 = "rgba(255,255,255,0.18)";

const styles = StyleSheet.create({
  title: {
    fontSize: 22, fontWeight: "700", color: WHITE_90, marginBottom: 14,
  },

  // 十字臂（用於圖例）
  crossV: { position: "absolute", width: 5, height: 28, borderRadius: 2 },
  crossGoldV: { backgroundColor: GOLD_LIGHT },
  crossSilverV: { backgroundColor: SILVER },

  // 統計 Badge
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  statBadge: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: "rgba(200,146,42,0.18)",
    borderWidth: 1, borderColor: "rgba(200,146,42,0.4)",
  },
  statGps: { backgroundColor: "rgba(58,138,90,0.15)", borderColor: "rgba(58,138,90,0.4)" },
  statAnon: { backgroundColor: "rgba(100,100,130,0.18)", borderColor: "rgba(160,160,200,0.4)" },
  statText: { fontSize: 12, fontWeight: "600", color: GOLD_LIGHT },

  // 圖例
  legendRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 6 },
  legendText: { fontSize: 11, color: WHITE_60 },

  // 最近清單
  recentList: { marginTop: 16, gap: 8 },
  recentTitle: { fontSize: 13, fontWeight: "700", color: WHITE_60, marginBottom: 4 },
  recentItem: { backgroundColor: WHITE_18, borderRadius: 10, padding: 10, gap: 4 },
  recentTime: { fontSize: 11, color: GOLD_LIGHT, fontWeight: "600" },
  recentText: { fontSize: 13, color: WHITE_90, lineHeight: 18 },

  // DEV 清除
  clearBtn: { marginTop: 16, padding: 8, alignItems: "center" },
  clearBtnText: { fontSize: 12, color: "#c00" },
});