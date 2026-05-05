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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChurchPanoramaViewer } from "./ChurchPanoramaViewer";
import { db } from "../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

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
};

type FilterType = "all" | "major" | "cathedral" | "chapel";
const FILTER_LABELS: Record<FilterType, string> = {
  all: "全部",
  major: "聖殿",
  cathedral: "主教座堂",
  chapel: "聖堂",
};

// Glass gradient — matches DEFAULT_GLASS: #B3CADA → #75859B → #415367, CSS 60° (lower-left to upper-right)
const GLASS_COLORS = ["#B3CADA", "#75859B", "#415367"] as const;
const GLASS_START = { x: 0.067, y: 0.75 };
const GLASS_END   = { x: 0.933, y: 0.25 };
const GLASS_BORDER = "rgba(194,212,255,0.5)";

const WIN_H = Dimensions.get("window").height;
const SHEET_H = Math.round(Math.min(460, WIN_H * 0.60));
const HANDLE_H = 80;
const COLLAPSED_Y = SHEET_H - HANDLE_H;

export function BasilicaMap() {
  const insets = useSafeAreaInsets();

  const [basilicas, setBasilicas] = useState<Basilica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchText, setSearchText] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [displayCount, setDisplayCount] = useState(10);
  const [showPanorama, setShowPanorama] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const searchWidth = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(COLLAPSED_Y)).current;
  const currentSheetY = useRef(COLLAPSED_Y);
  const searchInputRef = useRef<TextInput>(null);

  // ── Sheet ────────────────────────────────────────────────────────
  const openSheet = () => {
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
    currentSheetY.current = 0;
    setSheetOpen(true);
  };

  const closeSheet = () => {
    Animated.spring(sheetY, { toValue: COLLAPSED_Y, useNativeDriver: false, bounciness: 4 }).start();
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
        if (g.vy < -0.5 || projected < COLLAPSED_Y * 0.45) {
          openSheet();
        } else {
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
  useEffect(() => { setShowPanorama(false); }, [selectedId]);

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
          <Text style={styles.searchIcon} selectable={false}>search</Text>
        </Pressable>
      </View>

      {/* ── Bottom sheet ── */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>

        {/* Glass gradient background */}
        <LinearGradient
          colors={GLASS_COLORS}
          start={GLASS_START}
          end={GLASS_END}
          style={[StyleSheet.absoluteFill, styles.sheetGradient]}
        />
        {/* Glass border */}
        <View style={[StyleSheet.absoluteFill, styles.sheetBorder, { borderColor: GLASS_BORDER }]} />

        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.dragBar} />
          {sheetOpen ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}
            >
              {(["all", "major", "cathedral", "chapel"] as FilterType[]).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setFilterType(type)}
                  style={[styles.filterBtn, filterType === type && styles.filterBtnActive]}
                >
                  <Text style={[styles.filterText, filterType === type && styles.filterTextActive]}>
                    {FILTER_LABELS[type]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.handleHint} selectable={false}>向上拉動查看教堂列表</Text>
          )}
        </View>

        {/* White content area */}
        <View style={styles.contentArea}>
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

              <Text style={styles.metaText}>📍 {selectedBasilica.location}</Text>
              <Text style={styles.metaText}>
                ⏰ {selectedBasilica.founded} 年建立　✝️ {selectedBasilica.dedication}
              </Text>
              {selectedBasilica.style ? (
                <Text style={styles.metaText}>🎨 {selectedBasilica.style}</Text>
              ) : null}

              {selectedBasilica.significance ? (
                <>
                  <Text style={styles.sectionTitle}>宗教意義</Text>
                  <Text style={styles.bodyText}>{selectedBasilica.significance}</Text>
                </>
              ) : null}

              {selectedBasilica.description ? (
                <>
                  <Text style={styles.sectionTitle}>介紹</Text>
                  <Text style={styles.bodyText}>{selectedBasilica.description}</Text>
                </>
              ) : null}

              {selectedBasilica.panoramaId ? (
                <Pressable onPress={() => setShowPanorama(true)} style={styles.panoramaBtn}>
                  <Text style={styles.panoramaBtnText}>🌐 進入 360° 全景</Text>
                </Pressable>
              ) : null}

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
                  {displayedBasilicas.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => setSelectedId(b.id)}
                      style={styles.listItem}
                    >
                      <Text style={styles.listName}>{b.name}</Text>
                      <Text style={styles.listSub}>📍 {b.location}　{b.founded} 年</Text>
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
      </Animated.View>

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
  searchIcon: { fontFamily: "Material Symbols Outlined", fontSize: 28, color: "rgba(255,255,255,0.95)", lineHeight: 28 },

  // ── Sheet ──────────────────────────────────────────────────────
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: SHEET_H,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetGradient: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetBorder: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
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
  filterContent: { gap: 8, paddingHorizontal: 2 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  filterBtnActive: {
    backgroundColor: "rgba(255,255,255,0.35)",
    borderColor: "rgba(255,255,255,0.70)",
  },
  filterText: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "NotoSerifTC_400Regular" },
  filterTextActive: { color: "#fff", fontWeight: "700" },

  // ── White content area ─────────────────────────────────────────
  contentArea: {
    flex: 1,
    backgroundColor: "#ffffff",
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 14,
    overflow: "hidden",
  },
  panelScroll: { flex: 1, paddingHorizontal: 14 },

  // ── Detail ─────────────────────────────────────────────────────
  detailHeader: { flexDirection: "row", alignItems: "flex-start", paddingTop: 12, marginBottom: 8 },
  detailName: { fontSize: 17, fontWeight: "700", color: "rgba(0,0,0,0.85)", fontFamily: "NotoSerifTC_400Regular" },
  detailNameEn: { fontSize: 11, color: "rgba(0,0,0,0.40)", fontStyle: "italic", marginTop: 2 },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8, marginTop: 2 },
  closeBtnText: { fontSize: 16, color: "rgba(0,0,0,0.28)" },
  metaText: { fontSize: 12, color: "rgba(0,0,0,0.55)", marginBottom: 4, fontFamily: "NotoSerifTC_400Regular" },
  sectionTitle: {
    fontSize: 11, fontWeight: "600", color: "rgba(0,0,0,0.65)",
    marginTop: 10, marginBottom: 4,
    fontFamily: "NotoSerifTC_400Regular", letterSpacing: 0.5,
  },
  bodyText: { fontSize: 12, color: "rgba(0,0,0,0.60)", lineHeight: 18, fontFamily: "NotoSerifTC_400Regular" },
  panoramaBtn: {
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: "rgba(65,83,103,0.10)",
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(65,83,103,0.25)", alignItems: "center",
  },
  panoramaBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(65,83,103,0.90)", fontFamily: "NotoSerifTC_400Regular" },

  // ── List ───────────────────────────────────────────────────────
  listItem: { paddingVertical: 12, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.07)" },
  listName: { fontSize: 14, fontWeight: "600", color: "rgba(0,0,0,0.85)", fontFamily: "NotoSerifTC_400Regular" },
  listSub: { fontSize: 11, color: "rgba(0,0,0,0.42)", marginTop: 3, fontFamily: "NotoSerifTC_400Regular" },
  moreBtn: { paddingVertical: 12, alignItems: "center" },
  moreBtnText: { fontSize: 13, color: "rgba(65,83,103,0.85)", fontFamily: "NotoSerifTC_400Regular" },
  statusText: { textAlign: "center", color: "rgba(0,0,0,0.35)", fontSize: 14, marginTop: 20, fontFamily: "NotoSerifTC_400Regular" },
});
