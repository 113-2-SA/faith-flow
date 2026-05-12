import React, { useMemo, useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChurchPanoramaViewer } from "./ChurchPanoramaViewer";
import { ChurchImageViewer } from "./ChurchImageViewer";
import { ChurchVideoViewer } from "./ChurchVideoViewer";
import { GlassCard } from "./GlassCard";
import { db } from "../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { loadPrayers, PrayerRecord } from "../lib/prayerStore";

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
const FILTER_LABELS: Record<FilterType, string> = {
  all: "全部",
  major: "聖殿",
  cathedral: "主教座堂",
  chapel: "聖堂",
};


const WIN_H = Dimensions.get("window").height;
const SHEET_H = Math.round(WIN_H * 0.80);
const HANDLE_H = 80;
const COLLAPSED_Y = SHEET_H - HANDLE_H;

export function BasilicaMap() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [basilicas, setBasilicas] = useState<Basilica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchText, setSearchText] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [displayCount, setDisplayCount] = useState(10);
  const [showPanorama, setShowPanorama] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prayerRecords, setPrayerRecords] = useState<PrayerRecord[]>([]);

  const searchWidth = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(COLLAPSED_Y)).current;
  const currentSheetY = useRef(COLLAPSED_Y);
  const searchInputRef = useRef<TextInput>(null);

  // ── Sheet ────────────────────────────────────────────────────────
  const openSheet = () => {
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    currentSheetY.current = 0;
    setSheetOpen(true);
  };

  const closeSheet = () => {
    Animated.spring(sheetY, { toValue: COLLAPSED_Y, useNativeDriver: true, bounciness: 4 }).start();
    currentSheetY.current = COLLAPSED_Y;
    setSheetOpen(false);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        sheetY.stopAnimation((val) => { currentSheetY.current = val; });
      },
      onPanResponderMove: (_, g) => {
        const next = currentSheetY.current + g.dy;
        sheetY.setValue(Math.max(0, Math.min(COLLAPSED_Y, next)));
      },
      onPanResponderRelease: (_, g) => {
        const projected = currentSheetY.current + g.dy;
        const fastUp = g.vy < -0.5;
        const fastDown = g.vy > 0.5;
        if (fastUp || projected < COLLAPSED_Y * 0.5) {
          openSheet();
        } else if (fastDown || projected >= COLLAPSED_Y * 0.5) {
          closeSheet();
        }
      },
    })
  ).current;

  // ── Search ───────────────────────────────────────────────────────
  const expandSearch = () => {
    setSearchExpanded(true);
    Animated.timing(searchWidth, { toValue: 240, duration: 220, useNativeDriver: false })
      .start(() => searchInputRef.current?.focus());
  };

  const collapseSearch = () => {
    setSearchText("");
    Animated.timing(searchWidth, { toValue: 0, duration: 180, useNativeDriver: false })
      .start(() => setSearchExpanded(false));
  };

  // ── Data ─────────────────────────────────────────────────────────
  useEffect(() => { setShowPanorama(false); setShowImages(false); setShowVideo(false); }, [selectedId]);

  useEffect(() => { loadPrayers().then(setPrayerRecords).catch(() => {}); }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "basilicas"), orderBy("name"));
        const snap = await getDocs(q);
        const data: Basilica[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          data.push({
            id: doc.id, name: d.name, nameEn: d.nameEn, location: d.location,
            coordinates: d.coordinates, type: d.type, founded: d.founded,
            dedication: d.dedication, style: d.style, significance: d.significance,
            description: d.description, viewerUrl: d.viewerUrl,
            panoramaId: d.panoramaId || null, panoramaHeading: d.panoramaHeading ?? undefined,
            videoUrl: d.videoUrl || null,
          });
        });
        setBasilicas(data);
      } catch {
        setError("無法載入教堂資料");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return basilicas.filter((b) => {
      const matchType = filterType === "all" || b.type === filterType;
      const q = searchText.toLowerCase();
      return matchType && (
        q === "" ||
        b.name.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q) ||
        b.dedication.toLowerCase().includes(q)
      );
    });
  }, [basilicas, filterType, searchText]);

  useEffect(() => { setDisplayCount(10); }, [filterType, searchText]);

  const displayedBasilicas = filtered.slice(0, displayCount);
  const selectedBasilica = selectedId ? basilicas.find((b) => b.id === selectedId) : null;

  const headerH = insets.top + 68;
  const headerTop = insets.top + 10;

  return (
    <View style={styles.root}>
      {/* Full-screen map */}
      <View style={StyleSheet.absoluteFill}>
        <Suspense fallback={
          <View style={[StyleSheet.absoluteFill, styles.mapFallback]}>
            <Text style={styles.mapFallbackText}>🗺️ 地圖載入中...</Text>
          </View>
        }>
          {!loading && (
            <GoogleMapsComponent
              markers={filtered}
              onMarkerPress={(id) => {
                setSelectedId((prev) => (prev === id ? null : id));
                if (!sheetOpen) openSheet();
              }}
              selectedId={selectedId}
              autoFitBounds={searchText.trim() !== "" || filterType !== "all"}
              prayerMarkers={prayerRecords}
            />
          )}
        </Suspense>
      </View>

      {/* Header blur — pilgrimage only */}
      <View
        style={[styles.headerBlur, { height: headerH },
          { backdropFilter: "blur(11px)", WebkitBackdropFilter: "blur(11px)" } as any]}
        pointerEvents="none"
      />

      {/* Search — right, expands left */}
      <View style={[styles.searchRow, { top: headerTop }]}>
        <Animated.View style={{ width: searchWidth, overflow: "hidden", marginRight: 8 }}>
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { outline: "none" } as any]}
            placeholder="教堂名稱、位置、奉獻對象"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={searchText}
            onChangeText={setSearchText}
          />
        </Animated.View>
        <Pressable onPress={searchExpanded ? collapseSearch : expandSearch} style={styles.searchBtn}>
          <MaterialCommunityIcons name="magnify" size={28} color="rgba(255,255,255,0.95)" />
        </Pressable>
      </View>

      {/* ── Bottom sheet ── */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>

        {/* 版面配置層（absolute fill，確保 web 上有明確高度） */}
        <View style={styles.sheetLayout}>

          {/* 玻璃背景層（純視覺，absolute fill，positioned relative to sheetLayout） */}
          <GlassCard style={styles.sheetBgGlass} />

          {/* Drag handle（純視覺，不接受事件） */}
          <View style={styles.handleArea} pointerEvents="none">
            <View style={styles.dragBar} />
            <Text style={styles.handleHint} selectable={false}>
              {selectedBasilica
                ? selectedBasilica.name
                : (sheetOpen ? "" : "向上拉動查看教堂列表")}
            </Text>
          </View>

          {/* 篩選 tabs（展開時顯示，可點擊，不被 gestureOverlay 遮蓋） */}
          {sheetOpen && (
            <View style={styles.filterRow}>
              {(["all", "major", "cathedral", "chapel"] as FilterType[]).map((type) => (
                <Pressable key={type} onPress={() => setFilterType(type)} style={styles.filterBtnWrap}>
                  <GlassCard
                    style={styles.filterBtn}
                    glassColor={filterType === type ? "rgba(102,126,234,0.35)" : undefined}
                  >
                    <Text style={[styles.filterText, filterType === type && styles.filterTextActive]}>
                      {FILTER_LABELS[type]}
                    </Text>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          )}

          {selectedBasilica ? (
            <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailName}>{selectedBasilica.name}</Text>
                  <Text style={styles.detailNameEn}>{selectedBasilica.nameEn}</Text>
                </View>
                <Pressable onPress={() => setSelectedId(null)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </Pressable>
              </View>

              <GlassCard style={styles.detailCard}>
                <Text style={styles.metaText}>📍 {selectedBasilica.location}</Text>
                <Text style={styles.metaText}>
                  ⏰ {selectedBasilica.founded} 年建立　✝️ {selectedBasilica.dedication}
                </Text>
                {selectedBasilica.style ? (
                  <Text style={styles.metaText}>🎨 {selectedBasilica.style}</Text>
                ) : null}
              </GlassCard>

              {selectedBasilica.significance ? (
                <GlassCard style={styles.detailCard}>
                  <Text style={styles.sectionTitle}>宗教意義</Text>
                  <Text style={styles.bodyText}>{selectedBasilica.significance}</Text>
                </GlassCard>
              ) : null}

              {selectedBasilica.description ? (
                <GlassCard style={styles.detailCard}>
                  <Text style={styles.sectionTitle}>介紹</Text>
                  <Text style={styles.bodyText}>{selectedBasilica.description}</Text>
                </GlassCard>
              ) : null}

              <Pressable onPress={() => setShowImages(true)}>
                <GlassCard style={styles.detailActionCard}>
                  <Text style={styles.imageBtnText}>🖼️ 查看圖片</Text>
                </GlassCard>
              </Pressable>

              {selectedBasilica.videoUrl ? (
                <Pressable onPress={() => setShowVideo(true)}>
                  <GlassCard style={styles.detailActionCard}>
                    <Text style={styles.videoBtnText}>🎬 查看影片</Text>
                  </GlassCard>
                </Pressable>
              ) : null}

              {selectedBasilica.panoramaId ? (
                <Pressable onPress={() => setShowPanorama(true)}>
                  <GlassCard style={styles.detailActionCard}>
                    <Text style={styles.panoramaBtnText}>🌐 進入 360° 全景</Text>
                  </GlassCard>
                </Pressable>
              ) : null}

              <Pressable onPress={() => router.push("/pray" as any)}>
                <GlassCard style={styles.detailActionCard}>
                  <Text style={styles.recordBtnText}>🎙 錄音祈禱</Text>
                </GlassCard>
              </Pressable>

              <Pressable onPress={() => { setSelectedId(null); closeSheet(); }} style={styles.backToMapBtn}>
                <GlassCard style={styles.backToMapCard} glassColor="rgba(255,255,255,0.08)">
                  <Text style={styles.backToMapText}>🗺️ 返回地圖</Text>
                </GlassCard>
              </Pressable>

              <View style={{ height: 24 }} />
            </ScrollView>
          ) : (
            <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
              {loading ? (
                <Text style={styles.statusText}>載入教堂資料中...</Text>
              ) : error ? (
                <Text style={[styles.statusText, { color: "rgba(200,60,60,0.75)" }]}>{error}</Text>
              ) : displayedBasilicas.length === 0 ? (
                <Text style={styles.statusText}>未找到符合的教堂</Text>
              ) : (
                <>
                  <Pressable onPress={() => router.push("/pray" as any)} style={styles.listItemWrap}>
                    <GlassCard style={styles.listRecordCard} glassColor="rgba(102,126,234,0.18)">
                      <Text style={styles.recordBtnText}>🎙 錄音祈禱</Text>
                    </GlassCard>
                  </Pressable>
                  {displayedBasilicas.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => setSelectedId(b.id)}
                      style={styles.listItemWrap}
                    >
                      <GlassCard style={styles.listItemCard}>
                        <Text style={styles.listName}>{b.name}</Text>
                        <Text style={styles.listSub}>📍 {b.location}　{b.founded} 年</Text>
                      </GlassCard>
                    </Pressable>
                  ))}
                  {filtered.length > displayCount && (
                    <Pressable onPress={() => setDisplayCount((c) => c + 10)} style={styles.moreBtn}>
                      <Text style={styles.moreBtnText}>查看更多</Text>
                    </Pressable>
                  )}
                  <View style={{ height: 24 }} />
                </>
              )}
            </ScrollView>
          )}
        </View>

        {/* 手勢捕捉層：蓋住 handle 區，讓 filter tabs 在下方可正常點擊 */}
        <View style={styles.gestureOverlay} {...panResponder.panHandlers} />
      </Animated.View>

      {showImages && selectedBasilica && (
        <ChurchImageViewer
          nameEn={selectedBasilica.nameEn}
          basilicaName={selectedBasilica.name}
          onClose={() => setShowImages(false)}
        />
      )}

      {showVideo && selectedBasilica?.videoUrl && (
        <ChurchVideoViewer
          videoUrl={selectedBasilica.videoUrl}
          basilicaName={selectedBasilica.name}
          onClose={() => setShowVideo(false)}
        />
      )}

      {showPanorama && selectedBasilica?.panoramaId && (
        <ChurchPanoramaViewer
          panoramaId={selectedBasilica.panoramaId}
          basilicaName={selectedBasilica.name}
          onClose={() => setShowPanorama(false)}
          heading={selectedBasilica.panoramaHeading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  mapFallback: { justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  mapFallbackText: { color: "rgba(255,255,255,0.6)", fontSize: 16, fontFamily: "NotoSerifTC_400Regular" },

  headerBlur: {
    position: "absolute", top: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.20)",
    zIndex: 450,
  },

  searchRow: {
    position: "absolute", right: 16,
    flexDirection: "row", alignItems: "center",
    zIndex: 500,
  },
  searchInput: {
    width: 240, height: 48,
    fontSize: 15, color: "rgba(255,255,255,0.95)",
    borderBottomWidth: 1.5, borderBottomColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 4, paddingVertical: 0,
    fontFamily: "NotoSerifTC_400Regular",
  },
  searchBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },

  // ── Sheet ──────────────────────────────────────────────────────
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: SHEET_H,
    zIndex: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  // GlassCard 樣式 override：頂部圓角、填滿、零 padding（GlassCard 預設 padding:14 會被覆蓋）
  sheetGlass: {
    flex: 1,
    borderRadius: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 0,
  },
  sheetBgGlass: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 0,
  },
  sheetLayout: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  // 手勢捕捉層，蓋住 handle 高度，讓 content 區的 filter tabs 可點擊
  gestureOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: HANDLE_H,
    zIndex: 10,
  },

  // ── Handle ─────────────────────────────────────────────────────
  handleArea: {
    height: HANDLE_H,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  dragBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
    marginBottom: 12,
  },
  handleHint: {
    fontSize: 15, fontWeight: "700",
    color: "rgba(255,255,255,0.88)",
    fontFamily: "NotoSerifTC_400Regular",
    letterSpacing: 0.5,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 10, paddingVertical: 3 },
  filterBtnWrap: { borderRadius: 10, overflow: "hidden", alignSelf: "flex-start" },
  filterBtn: { padding: 0 },
  filterText: {
    color: "rgba(255,255,255,0.80)", fontSize: 13,
    fontFamily: "NotoSerifTC_400Regular",
    paddingHorizontal: 14, paddingVertical: 5,
  },
  filterTextActive: { color: "rgba(255,255,255,1)", fontWeight: "700" },

  panelScroll: { flex: 1, paddingHorizontal: 10 },

  // ── Detail cards ───────────────────────────────────────────────
  detailCard: { marginBottom: 8 },
  detailActionCard: { marginBottom: 6 },

  // ── Detail ─────────────────────────────────────────────────────
  detailHeader: { flexDirection: "row", alignItems: "flex-start", paddingTop: 12, marginBottom: 8, paddingHorizontal: 4 },
  detailName: { fontSize: 17, fontWeight: "700", color: "rgba(255,255,255,0.95)", fontFamily: "NotoSerifTC_400Regular" },
  detailNameEn: { fontSize: 11, color: "rgba(255,255,255,0.50)", fontStyle: "italic", marginTop: 2 },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8, marginTop: 2 },
  closeBtnText: { fontSize: 16, color: "rgba(255,255,255,0.50)" },
  metaText: { fontSize: 12, color: "rgba(255,255,255,0.80)", marginBottom: 4, fontFamily: "NotoSerifTC_400Regular" },
  sectionTitle: {
    fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.65)",
    marginTop: 0, marginBottom: 4,
    fontFamily: "NotoSerifTC_400Regular", letterSpacing: 0.5,
  },
  bodyText: { fontSize: 12, color: "rgba(255,255,255,0.80)", lineHeight: 18, fontFamily: "NotoSerifTC_400Regular" },
  imageBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)", fontFamily: "NotoSerifTC_400Regular", textAlign: "center" },
  videoBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)", fontFamily: "NotoSerifTC_400Regular", textAlign: "center" },
  panoramaBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)", fontFamily: "NotoSerifTC_400Regular", textAlign: "center" },
  recordBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)", fontFamily: "NotoSerifTC_400Regular", textAlign: "center" },

  // ── List ───────────────────────────────────────────────────────
  listItemWrap: { marginBottom: 8 },
  listItemCard: {},
  listRecordCard: {},
  listName: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)", fontFamily: "NotoSerifTC_400Regular" },
  listSub: { fontSize: 11, color: "rgba(255,255,255,0.60)", marginTop: 3, fontFamily: "NotoSerifTC_400Regular" },
  moreBtn: { paddingVertical: 12, alignItems: "center" },
  moreBtnText: { fontSize: 13, color: "rgba(255,255,255,0.70)", fontFamily: "NotoSerifTC_400Regular" },
  statusText: { textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 14, marginTop: 20, fontFamily: "NotoSerifTC_400Regular" },
  backToMapBtn: { marginTop: 8, marginBottom: 0 },
  backToMapCard: { paddingVertical: 10, paddingHorizontal: 14 },
  backToMapText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.70)", textAlign: "center", fontFamily: "NotoSerifTC_400Regular" },
});
