import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Image, ActivityIndicator, TextInput, TouchableOpacity,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useFocusEffect } from "expo-router";
import { GlassCard } from "./GlassCard";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { MAP_CONFIG } from "../config/mapConfig";
import { db } from "../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useChurchPhoto } from "../hooks/useChurchPhoto";
import { ChurchPanoramaViewer } from "./ChurchPanoramaViewer";
import { ChurchVideoViewer } from "./ChurchVideoViewer";
import { loadPrayers, PrayerRecord, clearPrayers } from "../app/prayerStore";

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── ChurchPhoto sub-component ───────────────────────────────────────────────
function ChurchPhoto({ nameEn, nameCh }: { nameEn: string; nameCh?: string }) {
  const { photoUrl, loading, error } = useChurchPhoto(nameEn, nameCh);
  if (loading) {
    return (
      <View style={photoStyles.container}>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
        <ThemedText style={photoStyles.hint}>載入教堂圖片中...</ThemedText>
      </View>
    );
  }
  if (error || !photoUrl) return null;
  return (
    <Image source={{ uri: photoUrl }} style={photoStyles.image} resizeMode="cover" />
  );
}

const photoStyles = StyleSheet.create({
  container: {
    height: 160, alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 12,
  },
  hint: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  image: { width: "100%", height: 160, borderRadius: 10, marginBottom: 12 },
});

// ─── Main component ───────────────────────────────────────────────────────────
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
  const mapRef = useRef<MapView>(null);
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
    if (!selectedId) return;
    const sel = basilicas.find((b) => b.id === selectedId);
    if (sel && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: sel.coordinates[0], longitude: sel.coordinates[1],
        latitudeDelta: 0.05, longitudeDelta: 0.05,
      }, 1000);
    }
    if (detailY > 0) {
      setTimeout(() => scrollViewRef.current?.scrollTo({ y: detailY - 10, animated: true }), 100);
    }
  }, [selectedId, detailY, basilicas]);

  useEffect(() => {
    if (!mapRef.current || filtered.length === 0) return;
    if (searchText.trim() === "" && filterType === "all") return;
    if (filtered.length === 1) {
      mapRef.current.animateToRegion({
        latitude: filtered[0].coordinates[0], longitude: filtered[0].coordinates[1],
        latitudeDelta: 0.05, longitudeDelta: 0.05,
      }, 1000);
    } else {
      mapRef.current.fitToCoordinates(
        filtered.map((b) => ({ latitude: b.coordinates[0], longitude: b.coordinates[1] })),
        { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true },
      );
    }
  }, [filtered, searchText, filterType]);

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
    <ThemedView style={styles.root}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <ThemedText type="title" style={styles.headerTitle}>🌍 朝聖地圖</ThemedText>
          <ThemedText style={styles.headerSubtitle}>探索世界教堂的靈修之旅</ThemedText>
        </View>

        {/* ── 地圖（教堂 + 祈禱標記合一） ─────────────────────── */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: MAP_CONFIG.defaultCenter.lat,
              longitude: MAP_CONFIG.defaultCenter.lng,
              latitudeDelta: 50, longitudeDelta: 50,
            }}
            showsUserLocation
            showsCompass
          >
            {/* 教堂標記 */}
            {filtered.map((b) => (
              <Marker
                key={`church-${b.id}`}
                coordinate={{ latitude: b.coordinates[0], longitude: b.coordinates[1] }}
                title={b.name}
                description={b.location}
                onPress={() => setSelectedId(b.id)}
              >
                <View style={styles.churchMarker}>
                  <View style={styles.churchCrossV} />
                  <View style={styles.churchCrossH} />
                </View>
              </Marker>
            ))}

            {/* 祈禱標記 */}
            {prayers.map((p) => (
              <Marker
                key={`prayer-${p.id}`}
                coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                tracksViewChanges={false}
              >
                <View style={[
                  styles.prayerMarker,
                  p.locationSource === "gps" ? styles.prayerMarkerGps : styles.prayerMarkerAnon,
                ]}>
                  <View style={[styles.prayerCrossV, p.locationSource === "gps" ? styles.crossGoldV : styles.crossSilverV]} />
                  <View style={[styles.prayerCrossH, p.locationSource === "gps" ? styles.crossGoldH : styles.crossSilverH]} />
                </View>
              </Marker>
            ))}
          </MapView>
        </View>

        {/* ── 圖例 ─────────────────────────────────────────────── */}
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: "rgba(102,126,234,0.9)" }]} />
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
              style={styles.searchTextInput}
              placeholder="教堂名稱、位置、奉獻對象..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={searchText}
              onChangeText={setSearchText}
              underlineColorAndroid="transparent"
              cursorColor="#ffffff"
              selectionColor="rgba(255,255,255,0.5)"
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText("")} style={styles.clearBtn} hitSlop={8}>
                <Text style={styles.clearBtnText}>✕</Text>
              </Pressable>
            )}
          </View>
        </GlassCard>

        {/* ── 選中教堂詳情 ─────────────────────────────────────── */}
        {selectedBasilica ? (
          <View onLayout={(e) => setDetailY(e.nativeEvent.layout.y)}>
            <GlassCard style={styles.detailCard} intensity={90}>
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator nestedScrollEnabled>
                <ChurchPhoto nameEn={selectedBasilica.nameEn} nameCh={selectedBasilica.name} />
                <ThemedText type="title" style={styles.detailName}>{selectedBasilica.name}</ThemedText>
                <ThemedText style={styles.detailNameEn}>{selectedBasilica.nameEn}</ThemedText>
                <View style={styles.detailDivider} />
                {[
                  ["📍 位置", selectedBasilica.location],
                  ["⏰ 建立", `${selectedBasilica.founded} 年`],
                  ["✝️ 奉獻", selectedBasilica.dedication],
                  ["🎨 風格", selectedBasilica.style],
                ].map(([label, value]) => (
                  <View key={label} style={styles.detailInfoRow}>
                    <ThemedText style={styles.detailLabel}>{label}</ThemedText>
                    <ThemedText style={styles.detailValue}>{value}</ThemedText>
                  </View>
                ))}
                <View style={styles.detailSection2}>
                  <ThemedText type="defaultSemiBold" style={styles.detailSectionTitle}>聖經關聯</ThemedText>
                  <ThemedText style={styles.detailDescription}>{selectedBasilica.significance}</ThemedText>
                </View>
                <View style={styles.detailSection2}>
                  <ThemedText type="defaultSemiBold" style={styles.detailSectionTitle}>介紹</ThemedText>
                  <ThemedText style={styles.detailDescription}>{selectedBasilica.description}</ThemedText>
                </View>
                {selectedBasilica.videoUrl ? (
                  <Pressable
                    onPress={() => { setShowVideo(true); scrollViewRef.current?.scrollTo({ y: 0, animated: true }); }}
                    style={({ pressed }) => [styles.actionBtn, styles.videoBtn, pressed && styles.videoBtnPressed]}
                  >
                    <View style={styles.actionBtnInner}>
                      <Text style={styles.actionBtnIcon}>🎬</Text>
                      <View>
                        <ThemedText style={styles.actionBtnLabel}>查看影片</ThemedText>
                        <ThemedText style={styles.actionBtnSub}>教堂介紹影片</ThemedText>
                      </View>
                      <Text style={styles.actionBtnArrow}>›</Text>
                    </View>
                  </Pressable>
                ) : null}
                {selectedBasilica.panoramaId ? (
                  <Pressable
                    onPress={() => { setShowPanorama(true); scrollViewRef.current?.scrollTo({ y: 0, animated: true }); }}
                    style={({ pressed }) => [styles.actionBtn, styles.panoramaBtn, pressed && styles.panoramaBtnPressed]}
                  >
                    <View style={styles.actionBtnInner}>
                      <Text style={styles.actionBtnIcon}>🌐</Text>
                      <View>
                        <ThemedText style={styles.actionBtnLabel}>進入 360° 全景</ThemedText>
                        <ThemedText style={styles.actionBtnSub}>互動式環景體驗</ThemedText>
                      </View>
                      <Text style={styles.actionBtnArrow}>›</Text>
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.noPanoramaHint}>
                    <ThemedText style={styles.noPanoramaText}>此教堂暫無全景資料</ThemedText>
                  </View>
                )}
              </ScrollView>
            </GlassCard>
          </View>
        ) : null}

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

      {/* ── 浮動影片 ─────────────────────────────────────────────── */}
      {showVideo && selectedBasilica?.videoUrl && (
        <ChurchVideoViewer
          videoUrl={selectedBasilica.videoUrl}
          basilicaName={selectedBasilica.name}
          onClose={() => setShowVideo(false)}
        />
      )}

      {/* ── 浮動全景 ─────────────────────────────────────────────── */}
      {showPanorama && selectedBasilica?.panoramaId && (
        <ChurchPanoramaViewer
          panoramaId={selectedBasilica.panoramaId}
          basilicaName={selectedBasilica.name}
          onClose={() => setShowPanorama(false)}
          heading={selectedBasilica.panoramaHeading}
        />
      )}
    </ThemedView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const GOLD_LIGHT = "#f5d680";
const GOLD       = "#c8922a";
const SILVER     = "#b0b8c8";
const WHITE_90   = "rgba(255,255,255,0.90)";
const WHITE_70   = "rgba(255,255,255,0.70)";
const WHITE_60   = "rgba(255,255,255,0.60)";
const WHITE_18   = "rgba(255,255,255,0.18)";

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 18, color: "#fff" },
  errorText: { fontSize: 16, color: "rgba(255,0,0,0.8)" },

  container: { paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 32 },

  headerSection: { marginTop: 8, marginBottom: 16, paddingLeft: 72 },
  headerTitle: { fontSize: 32, fontWeight: "700", marginBottom: 4 },
  headerSubtitle: { fontSize: 14, opacity: 0.7 },

  // ── Map ──
  mapContainer: { justifyContent: "center", alignItems: "center", marginBottom: 12, width: "100%" },
  map: { width: "90%", height: 300, borderRadius: 12 },

  // 教堂標記
  churchMarker: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(102,126,234,0.9)",
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 2, elevation: 4,
  },
  churchCrossV: { position: "absolute", width: 4, height: 20, backgroundColor: "#fff", borderRadius: 2, top: 6 },
  churchCrossH: { position: "absolute", width: 14, height: 4, backgroundColor: "#fff", borderRadius: 2, top: 11 },

  // 祈禱標記
  prayerMarker: { width: 26, height: 34, alignItems: "center", justifyContent: "center", position: "relative", borderRadius: 4 },
  prayerMarkerGps: { backgroundColor: "rgba(0,0,0,0.5)" },
  prayerMarkerAnon: { backgroundColor: "rgba(60,60,80,0.45)" },
  prayerCrossV: { position: "absolute", width: 5, height: 28, borderRadius: 2 },
  prayerCrossH: { position: "absolute", top: 6, width: 20, height: 5, borderRadius: 2 },
  crossGoldV: { backgroundColor: GOLD_LIGHT, shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 4, elevation: 4 },
  crossGoldH: { backgroundColor: GOLD_LIGHT, shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 4, elevation: 4 },
  crossSilverV: { backgroundColor: SILVER },
  crossSilverH: { backgroundColor: SILVER },

  // ── 圖例 ──
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 6, paddingHorizontal: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: WHITE_60 },

  // ── 祈禱統計 ──
  prayerStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statBadge: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: "rgba(200,146,42,0.18)", borderWidth: 1, borderColor: "rgba(200,146,42,0.4)",
  },
  statGps: { backgroundColor: "rgba(58,138,90,0.15)", borderColor: "rgba(58,138,90,0.4)" },
  statAnon: { backgroundColor: "rgba(100,100,130,0.18)", borderColor: "rgba(160,160,200,0.4)" },
  statText: { fontSize: 12, fontWeight: "600", color: GOLD_LIGHT },

  // ── 搜尋 ──
  searchCard: { marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.01)" },
  searchLabel: { fontSize: 12, opacity: 0.6, marginBottom: 6 },
  searchInputRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchTextInput: { flex: 1, fontSize: 14, color: WHITE_90, paddingVertical: 0 },
  clearBtn: { padding: 4, marginLeft: 4 },
  clearBtnText: { fontSize: 14, color: WHITE_60 },

  // ── 教堂詳情 ──
  detailCard: { paddingHorizontal: 16, paddingVertical: 14, maxHeight: 420, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.01)" },
  detailScroll: { flex: 1 },
  detailName: { fontSize: 22, fontWeight: "700", color: WHITE_90 },
  detailNameEn: { fontSize: 12, color: WHITE_70, fontStyle: "italic", marginTop: 2 },
  detailDivider: { height: 1, backgroundColor: "rgba(0,0,0,0.08)", marginVertical: 12 },
  detailInfoRow: { marginBottom: 10 },
  detailLabel: { fontSize: 12, color: WHITE_70, fontWeight: "600", marginBottom: 4 },
  detailValue: { fontSize: 14, color: WHITE_90 },
  detailSection2: { marginTop: 14 },
  detailSectionTitle: { fontSize: 13, color: WHITE_70, marginBottom: 6 },
  detailDescription: { fontSize: 12, color: WHITE_70, lineHeight: 18 },

  actionBtn: { marginTop: 16, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
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

  // ── 篩選 ──
  filterScroll: { marginBottom: 12, marginHorizontal: -12 },
  filterContent: { paddingHorizontal: 12, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  filterBtnActive: { backgroundColor: "rgba(102,126,234,0.6)", borderColor: "rgba(102,126,234,1)" },
  filterText: { fontSize: 12, color: WHITE_70 },
  filterTextActive: { color: WHITE_90, fontWeight: "600" },

  // ── 教堂列表 ──
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

  // ── 最近祈禱 ──
  recentCard: { marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12 },
  recentTitle: { fontSize: 13, fontWeight: "700", color: WHITE_60, marginBottom: 8 },
  recentItem: { backgroundColor: WHITE_18, borderRadius: 10, padding: 10, gap: 4, marginBottom: 8 },
  recentTime: { fontSize: 11, color: GOLD_LIGHT, fontWeight: "600" },
  recentText: { fontSize: 13, color: WHITE_90, lineHeight: 18 },

  // ── Footer 統計 ──
  footerCard: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 10 },
  footerRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  footerItem: { flex: 1, alignItems: "center", gap: 4 },
  footerValue: { fontSize: 20, fontWeight: "700", color: "rgba(102,126,234,0.95)" },
  footerLabel: { fontSize: 11, color: WHITE_60 },
  footerDivider: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 8 },

  // ── DEV ──
  devClearBtn: { marginTop: 12, padding: 8, alignItems: "center" },
  devClearText: { fontSize: 12, color: "#c00" },
});
