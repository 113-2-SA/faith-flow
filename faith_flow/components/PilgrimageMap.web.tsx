import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, TouchableOpacity } from "react-native";
import React, { useMemo, useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { ChurchPanoramaViewer } from "./ChurchPanoramaViewer";
import { ChurchVideoViewer } from "./ChurchVideoViewer";
import { GlassCard } from "./GlassCard";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { db } from "../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { loadPrayers, PrayerRecord, clearPrayers } from "../lib/prayerStore";

const GoogleMapsComponent = lazy(() => import("./GoogleMapsComponent.web"));

export type Basilica = {
  id: string;
  name: string;
  nameEn: string;
  location: string;
  coordinates: [number, number];
  type: "major" | "cathedral" | "chapel";
  founded: number;
  dedication: string;
  style: string;
  significance: string;
  description: string;
  viewerUrl: string;
  panoramaId?: string | null;
  panoramaHeading?: number;
  videoUrl?: string | null;
};

type FilterType = "all" | "major" | "cathedral" | "chapel";

export function PilgrimageMap() {
  // prayer
  const [prayers, setPrayers] = useState<PrayerRecord[]>([]);
  // church
  const [basilicas, setBasilicas] = useState<Basilica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchText, setSearchText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const [detailY, setDetailY] = useState(0);
  const [displayCount, setDisplayCount] = useState(3);
  const [showPanorama, setShowPanorama] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useFocusEffect(useCallback(() => { loadPrayers().then(setPrayers); }, []));

  useEffect(() => { setShowPanorama(false); setShowVideo(false); }, [selectedId]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(query(collection(db, "basilicas"), orderBy("name")));
        const data: Basilica[] = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id, name: d.name, nameEn: d.nameEn, location: d.location,
            coordinates: d.coordinates, type: d.type, founded: d.founded,
            dedication: d.dedication, style: d.style, significance: d.significance,
            description: d.description, viewerUrl: d.viewerUrl,
            panoramaId: d.panoramaId || null,
            panoramaHeading: d.panoramaHeading ?? undefined,
            videoUrl: d.videoUrl || null,
          };
        });
        setBasilicas(data);
      } catch (err) {
        console.error("Error fetching basilicas:", err);
        setError("無法載入教堂資料");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => basilicas.filter((b) => {
    const matchType = filterType === "all" || b.type === filterType;
    const matchSearch =
      searchText === "" ||
      b.name.toLowerCase().includes(searchText.toLowerCase()) ||
      b.location.toLowerCase().includes(searchText.toLowerCase()) ||
      b.dedication.toLowerCase().includes(searchText.toLowerCase());
    return matchType && matchSearch;
  }), [basilicas, filterType, searchText]);

  useEffect(() => { setDisplayCount(3); }, [filterType, searchText]);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed !== "") {
      const exact = basilicas.find(
        (b) =>
          b.name.toLowerCase() === trimmed.toLowerCase() ||
          b.nameEn.toLowerCase() === trimmed.toLowerCase()
      );
      if (exact) setSelectedId(exact.id);
    }
  }, [searchText, basilicas]);

  useEffect(() => {
    if (selectedId && detailY > 0) {
      setTimeout(() => scrollViewRef.current?.scrollTo({ y: detailY - 10, animated: true }), 100);
    }
  }, [selectedId, detailY]);

  const displayedBasilicas = filtered.slice(0, displayCount);
  const selectedBasilica = selectedId ? basilicas.find((b) => b.id === selectedId) : null;
  const gpsCount = prayers.filter((p) => p.locationSource === "gps").length;
  const defaultCount = prayers.filter((p) => p.locationSource === "default").length;

  if (loading) {
    return (
      <ThemedView style={styles.root}>
        <View style={styles.center}><Text style={styles.loadingText}>載入教堂資料中...</Text></View>
      </ThemedView>
    );
  }
  if (error) {
    return (
      <ThemedView style={styles.root}>
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
      </ThemedView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.root}
        contentContainerStyle={styles.container}
        scrollEnabled={!showPanorama}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <ThemedText type="title" style={styles.headerTitle}>
            <Text style={{ color: "#fff" }}>🌍 朝聖地圖</Text>
          </ThemedText>
          <ThemedText style={styles.headerSubtitle}>探索世界教堂的靈修之旅</ThemedText>
        </View>

        {/* ── 地圖（教堂 + 祈禱標記合一） ─────────────────────── */}
        <View style={styles.mapContainer}>
          <Suspense fallback={
            <View style={styles.mapFallback}>
              <Text style={{ color: "rgba(255,255,255,0.5)" }}>🗺️ 地圖載入中...</Text>
            </View>
          }>
            <GoogleMapsComponent
              markers={filtered}
              onMarkerPress={(id) => setSelectedId(id)}
              selectedId={selectedId}
              autoFitBounds={searchText.trim() !== "" || filterType !== "all"}
              prayers={prayers}
            />
          </Suspense>
        </View>

        {/* ── 圖例 ─────────────────────────────────────────────── */}
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: "#666fee" }]} />
          <Text style={styles.legendText}>教堂</Text>
          <View style={{ width: 10 }} />
          <View style={[styles.legendDot, { backgroundColor: "#f5d680" }]} />
          <Text style={styles.legendText}>祈禱（有位置）</Text>
          <View style={{ width: 10 }} />
          <View style={[styles.legendDot, { backgroundColor: "#b0b8c8" }]} />
          <Text style={styles.legendText}>祈禱（匿名）</Text>
        </View>

        {/* ── 祈禱統計 ─────────────────────────────────────────── */}
        {prayers.length > 0 && (
          <View style={styles.prayerStatsRow}>
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

        {/* ── 搜尋 ─────────────────────────────────────────────── */}
        <GlassCard style={styles.searchCard} intensity={85}>
          <ThemedText style={styles.searchLabel}>搜尋教堂</ThemedText>
          <View style={styles.searchInputRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchTextInput, { outline: "none", caretColor: "#ffffff" } as any]}
              placeholder="教堂名稱、位置、奉獻對象..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText("")} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </Pressable>
            )}
          </View>
        </GlassCard>

        {/* ── 選中教堂詳情 ─────────────────────────────────────── */}
        <View onLayout={(e) => setDetailY(e.nativeEvent.layout.y)}>
          {selectedBasilica ? (
            <View style={styles.detailSection}>
              <GlassCard style={styles.detailCard} intensity={100}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailIconText}>⛪</Text>
                  <View style={styles.detailHeaderText}>
                    <ThemedText type="title" style={styles.detailName}>{selectedBasilica.name}</ThemedText>
                    <ThemedText style={styles.detailNameEn}>{selectedBasilica.nameEn}</ThemedText>
                  </View>
                </View>
                <View style={styles.detailDivider} />
                {[
                  ["📍 位置", selectedBasilica.location],
                  ["⏰ 建立", `${selectedBasilica.founded} 年`],
                  ["✝️ 奉獻給", selectedBasilica.dedication],
                  ["🎨 建築風格", selectedBasilica.style],
                ].map(([label, value]) => (
                  <View key={label} style={styles.detailInfoRow}>
                    <ThemedText style={styles.detailLabel}>{label}</ThemedText>
                    <ThemedText style={styles.detailValue}>{value}</ThemedText>
                  </View>
                ))}
                <View style={styles.detailSection2}>
                  <ThemedText type="defaultSemiBold" style={styles.detailSectionTitle}>宗教意義</ThemedText>
                  <ThemedText style={styles.detailDescription}>{selectedBasilica.significance}</ThemedText>
                </View>
                <View style={styles.detailSection2}>
                  <ThemedText type="defaultSemiBold" style={styles.detailSectionTitle}>介紹</ThemedText>
                  <ThemedText style={styles.detailDescription}>{selectedBasilica.description}</ThemedText>
                </View>
                {selectedBasilica.videoUrl ? (
                  <Pressable
                    onPress={() => setShowVideo(true)}
                    style={({ pressed }) => [styles.actionBtn, styles.videoBtn, pressed && styles.videoBtnPressed]}
                  >
                    <View style={styles.actionBtnInner}>
                      <Text style={styles.actionBtnIcon}>🎬</Text>
                      <View>
                        <ThemedText style={styles.actionBtnLabel}>查看影片</ThemedText>
                        <ThemedText style={[styles.actionBtnSub, { color: "rgba(220,80,60,0.9)" }]}>教堂介紹影片</ThemedText>
                      </View>
                      <Text style={[styles.actionBtnArrow, { color: "rgba(220,80,60,0.8)" }]}>›</Text>
                    </View>
                  </Pressable>
                ) : null}
                {selectedBasilica.panoramaId ? (
                  <Pressable
                    onPress={() => setShowPanorama(true)}
                    style={({ pressed }) => [styles.actionBtn, styles.panoramaBtn, pressed && styles.panoramaBtnPressed]}
                  >
                    <View style={styles.actionBtnInner}>
                      <Text style={styles.actionBtnIcon}>🌐</Text>
                      <View>
                        <ThemedText style={styles.actionBtnLabel}>進入 360° 全景</ThemedText>
                        <ThemedText style={[styles.actionBtnSub, { color: "rgba(102,126,234,0.9)" }]}>互動式環景體驗</ThemedText>
                      </View>
                      <Text style={[styles.actionBtnArrow, { color: "rgba(102,126,234,0.8)" }]}>›</Text>
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.noPanoramaHint}>
                    <ThemedText style={styles.noPanoramaText}>此教堂暫無全景資料</ThemedText>
                  </View>
                )}
              </GlassCard>
            </View>
          ) : (
            <View style={styles.detailSection}>
              <GlassCard style={styles.detailCard} intensity={70}>
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🗺️</Text>
                  <ThemedText type="subtitle" style={styles.emptyTitle}>選擇教堂</ThemedText>
                  <ThemedText style={styles.emptyText}>在地圖或列表中點擊教堂</ThemedText>
                  <ThemedText style={styles.emptyText}>查看詳細信息</ThemedText>
                </View>
              </GlassCard>
            </View>
          )}
        </View>

        {/* ── 篩選 Tabs ─────────────────────────────────────────── */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.filterScroll} contentContainerStyle={styles.filterContent}
        >
          {(["all", "major", "cathedral", "chapel"] as FilterType[]).map((type) => (
            <Pressable
              key={type}
              onPress={() => setFilterType(type)}
              style={[styles.filterBtn, filterType === type && styles.filterBtnActive]}
            >
              <ThemedText style={[styles.filterText, filterType === type && styles.filterTextActive]}>
                {type === "all" ? "全部" : type === "major" ? "聖殿" : type === "cathedral" ? "主教座堂" : "聖堂"}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── 教堂列表 ─────────────────────────────────────────── */}
        <View style={styles.listSection}>
          {displayedBasilicas.length > 0 ? (
            <>
              {displayedBasilicas.map((b) => (
                <Pressable key={b.id} onPress={() => setSelectedId(b.id)} style={styles.listItem}>
                  <GlassCard intensity={selectedId === b.id ? 100 : 70} style={styles.listItemCard}>
                    <View style={styles.listItemIcon}><Text style={styles.listIcon}>⛪</Text></View>
                    <View style={styles.listItemContent}>
                      <ThemedText type="defaultSemiBold" style={styles.listItemName}>{b.name}</ThemedText>
                      <ThemedText style={styles.listItemLocation}>📍 {b.location}</ThemedText>
                      <ThemedText style={styles.listItemYear}>⏰ {b.founded} 年建立</ThemedText>
                    </View>
                  </GlassCard>
                </Pressable>
              ))}
              {filtered.length > displayCount && (
                <Pressable onPress={() => setDisplayCount((n) => n + 3)} style={styles.viewMoreBtn}>
                  <ThemedText style={styles.viewMoreBtnText}>查看更多</ThemedText>
                </Pressable>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <ThemedText type="subtitle" style={styles.emptyTitle}>未找到教堂</ThemedText>
              <ThemedText style={styles.emptyText}>試試其他搜尋或篩選條件</ThemedText>
            </View>
          )}
        </View>

        {/* ── 最近祈禱 ─────────────────────────────────────────── */}
        {prayers.length > 0 && (
          <GlassCard style={styles.recentCard} intensity={80}>
            <Text style={styles.recentTitle}>最近祈禱</Text>
            {prayers.slice(-3).reverse().map((p) => {
              const d = new Date(p.createdAt);
              const t = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
              return (
                <View key={p.id} style={styles.recentItem}>
                  <Text style={styles.recentTime}>{p.locationSource === "gps" ? "📍" : "🏛"} {t}</Text>
                  <Text style={styles.recentText} numberOfLines={2}>{p.text}</Text>
                </View>
              );
            })}
          </GlassCard>
        )}

        {/* ── 統計 Footer ───────────────────────────────────────── */}
        <GlassCard style={styles.footerCard} intensity={80}>
          <View style={styles.footerRow}>
            {[
              [basilicas.length, "教堂"],
              [filtered.length, "篩選結果"],
              [prayers.length, "次祈禱"],
            ].map(([val, label], i) => (
              <React.Fragment key={String(label)}>
                {i > 0 && <View style={styles.footerDivider} />}
                <View style={styles.footerItem}>
                  <ThemedText style={styles.footerValue}>{val}</ThemedText>
                  <ThemedText style={styles.footerLabel}>{label}</ThemedText>
                </View>
              </React.Fragment>
            ))}
          </View>
        </GlassCard>

        {/* ── 清除（開發用） ───────────────────────────────────── */}
        {__DEV__ && prayers.length > 0 && (
          <TouchableOpacity
            style={styles.devClearBtn}
            onPress={async () => { await clearPrayers(); setPrayers([]); }}
          >
            <Text style={styles.devClearText}>清除所有記錄（DEV）</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {showVideo && selectedBasilica?.videoUrl && (
        <ChurchVideoViewer videoUrl={selectedBasilica.videoUrl} basilicaName={selectedBasilica.name} onClose={() => setShowVideo(false)} />
      )}
      {showPanorama && selectedBasilica?.panoramaId && (
        <ChurchPanoramaViewer panoramaId={selectedBasilica.panoramaId} basilicaName={selectedBasilica.name} onClose={() => setShowPanorama(false)} heading={selectedBasilica.panoramaHeading} />
      )}
    </View>
  );
}

const GOLD_LIGHT = "#f5d680";
const WHITE_90 = "rgba(255,255,255,0.90)";
const WHITE_70 = "rgba(255,255,255,0.70)";
const WHITE_60 = "rgba(255,255,255,0.60)";
const WHITE_18 = "rgba(255,255,255,0.18)";

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 18, color: "#fff" },
  errorText: { fontSize: 16, color: "rgba(255,0,0,0.8)" },
  container: { paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 32 },

  headerSection: { marginTop: 8, marginBottom: 16, paddingLeft: 72 },
  headerTitle: { fontSize: 32, fontWeight: "700", marginBottom: 4 },
  headerSubtitle: { fontSize: 14, opacity: 0.7 },

  mapContainer: { justifyContent: "center", alignItems: "center", marginBottom: 12, width: "100%" },
  mapFallback: { width: "90%", height: 300, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 12 },

  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 6, paddingHorizontal: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: WHITE_60 },

  prayerStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statBadge: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "rgba(200,146,42,0.18)", borderWidth: 1, borderColor: "rgba(200,146,42,0.4)" },
  statGps: { backgroundColor: "rgba(58,138,90,0.15)", borderColor: "rgba(58,138,90,0.4)" },
  statAnon: { backgroundColor: "rgba(100,100,130,0.18)", borderColor: "rgba(160,160,200,0.4)" },
  statText: { fontSize: 12, fontWeight: "600", color: GOLD_LIGHT },

  searchCard: { marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.01)" },
  searchLabel: { fontSize: 12, opacity: 0.6, marginBottom: 6 },
  searchInputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchTextInput: { flex: 1, fontSize: 14, color: WHITE_90, paddingVertical: 0 },
  clearBtn: { padding: 4, marginLeft: 4, cursor: "pointer" as any },
  clearBtnText: { fontSize: 14, color: WHITE_60 },

  detailSection: { marginBottom: 12 },
  detailCard: { paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.01)" },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, gap: 10 },
  detailIconText: { fontSize: 32, marginTop: 2 },
  detailHeaderText: { flex: 1 },
  detailName: { fontSize: 22, fontWeight: "700", color: WHITE_90 },
  detailNameEn: { fontSize: 12, color: WHITE_70, fontStyle: "italic", marginTop: 2 },
  detailDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 12 },
  detailInfoRow: { marginBottom: 10 },
  detailLabel: { fontSize: 12, color: WHITE_70, fontWeight: "600", marginBottom: 4 },
  detailValue: { fontSize: 14, color: WHITE_90 },
  detailSection2: { marginTop: 14 },
  detailSectionTitle: { fontSize: 13, color: WHITE_70, marginBottom: 6 },
  detailDescription: { fontSize: 12, color: WHITE_70, lineHeight: 18 },

  actionBtn: { marginTop: 16, borderRadius: 14, overflow: "hidden", borderWidth: 1, cursor: "pointer" as any },
  actionBtnInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  actionBtnIcon: { fontSize: 28 },
  actionBtnLabel: { fontSize: 14, fontWeight: "700", color: WHITE_90 },
  actionBtnSub: { fontSize: 11, marginTop: 2 },
  actionBtnArrow: { fontSize: 24, marginLeft: "auto" as any },
  videoBtn: { borderColor: "rgba(220,80,60,0.6)", backgroundColor: "rgba(220,80,60,0.18)" },
  videoBtnPressed: { backgroundColor: "rgba(220,80,60,0.38)", borderColor: "rgba(220,80,60,1)" },
  panoramaBtn: { borderColor: "rgba(102,126,234,0.6)", backgroundColor: "rgba(102,126,234,0.18)" },
  panoramaBtnPressed: { backgroundColor: "rgba(102,126,234,0.38)", borderColor: "rgba(102,126,234,1)" },
  noPanoramaHint: { marginTop: 12, paddingVertical: 8, alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  noPanoramaText: { fontSize: 11, color: "rgba(255,255,255,0.4)" },

  filterScroll: { marginBottom: 12, marginHorizontal: -12 },
  filterContent: { paddingHorizontal: 12, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  filterBtnActive: { backgroundColor: "rgba(102,126,234,0.6)", borderColor: "rgba(102,126,234,1)" },
  filterText: { fontSize: 12, color: WHITE_70 },
  filterTextActive: { color: WHITE_90, fontWeight: "600" },

  listSection: { marginBottom: 12 },
  listItem: { marginBottom: 10 },
  listItemCard: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.01)" },
  listItemIcon: { alignItems: "center", marginBottom: 6 },
  listIcon: { fontSize: 28 },
  listItemContent: { gap: 4 },
  listItemName: { fontSize: 14, color: WHITE_90 },
  listItemLocation: { fontSize: 12, color: WHITE_70 },
  listItemYear: { fontSize: 11, color: WHITE_60 },
  viewMoreBtn: { alignItems: "center", paddingVertical: 12, marginTop: 4, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  viewMoreBtnText: { fontSize: 14, fontWeight: "600", color: WHITE_70 },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, color: WHITE_70 },
  emptyText: { fontSize: 12, color: WHITE_60 },

  recentCard: { marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12 },
  recentTitle: { fontSize: 13, fontWeight: "700", color: WHITE_60, marginBottom: 8 },
  recentItem: { backgroundColor: WHITE_18, borderRadius: 10, padding: 10, gap: 4, marginBottom: 8 },
  recentTime: { fontSize: 11, color: GOLD_LIGHT, fontWeight: "600" },
  recentText: { fontSize: 13, color: WHITE_90, lineHeight: 18 },

  footerCard: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 10 },
  footerRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  footerItem: { flex: 1, alignItems: "center", gap: 4 },
  footerValue: { fontSize: 20, fontWeight: "700", color: "rgba(102,126,234,0.95)" },
  footerLabel: { fontSize: 11, color: WHITE_60 },
  footerDivider: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 8 },

  devClearBtn: { marginTop: 12, padding: 8, alignItems: "center" },
  devClearText: { fontSize: 12, color: "#c00" },
});
