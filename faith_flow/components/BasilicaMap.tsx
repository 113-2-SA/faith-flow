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

const GoogleMapsComponent = lazy(() => import("./GoogleMapsComponent"));

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

      <View
        style={[styles.headerBlur, { height: headerH }]}
        pointerEvents="none"
      />

      <View style={[styles.searchRow, { top: headerTop }]}>
        <Animated.View style={{ width: searchWidth, overflow: "hidden", marginRight: 8 }}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
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

      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
        <GlassCard style={styles.sheetGlass}>
          <View style={styles.handleArea} pointerEvents="none">
            <View style={styles.dragBar} />
            <Text style={styles.handleHint} selectable={false}>
              {selectedBasilica
                ? selectedBasilica.name
                : (sheetOpen ? "" : "向上拉動查看教堂列表")}
            </Text>
          </View>

          {sheetOpen && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}
              style={styles.filterScroll}
            >
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
            </ScrollView>
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
        </GlassCard>

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
  mapFallbackText: { color: "rgba(255,255,255,0.6)", fontSize: 16 },
  headerBlur: {
    position: "absolute", top: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.20)", zIndex: 450,
  },
  searchRow: {
    position: "absolute", right: 16,
    flexDirection: "row", alignItems: "center", zIndex: 500,
  },
  searchInput: {
    width: 240, height: 48, fontSize: 15, color: "rgba(255,255,255,0.95)",
    borderBottomWidth: 1.5, borderBottomColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 4, paddingVertical: 0,
  },
  searchBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: SHEET_H, zIndex: 400,
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 8,
  },
  sheetGlass: { flex: 1, borderRadius: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 0 },
  gestureOverlay: { position: "absolute", top: 0, left: 0, right: 0, height: HANDLE_H, zIndex: 10 },
  handleArea: { height: HANDLE_H, alignItems: "center", justifyContent: "center", paddingTop: 10, paddingHorizontal: 16 },
  dragBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)", marginBottom: 12 },
  handleHint: { fontSize: 15, fontWeight: "700", color: "rgba(255,255,255,0.88)", letterSpacing: 0.5 },
  filterContent: { gap: 8, paddingHorizontal: 2 },
  filterBtnWrap: { borderRadius: 10, overflow: "hidden" },
  filterBtn: { padding: 0 },
  filterScroll: { paddingHorizontal: 10, paddingVertical: 3, height: 44 },
  filterText: { color: "rgba(255,255,255,0.80)", fontSize: 13, paddingHorizontal: 14, paddingVertical: 5 },
  filterTextActive: { color: "rgba(255,255,255,1)", fontWeight: "700" },
  panelScroll: { flex: 1, paddingHorizontal: 10 },
  detailCard: { marginBottom: 8 },
  detailActionCard: { marginBottom: 6 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", paddingTop: 12, marginBottom: 8, paddingHorizontal: 4 },
  detailName: { fontSize: 17, fontWeight: "700", color: "rgba(255,255,255,0.95)" },
  detailNameEn: { fontSize: 11, color: "rgba(255,255,255,0.50)", fontStyle: "italic", marginTop: 2 },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8, marginTop: 2 },
  closeBtnText: { fontSize: 16, color: "rgba(255,255,255,0.50)" },
  metaText: { fontSize: 12, color: "rgba(255,255,255,0.80)", marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.65)", marginBottom: 4, letterSpacing: 0.5 },
  bodyText: { fontSize: 12, color: "rgba(255,255,255,0.80)", lineHeight: 18 },
  imageBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)", textAlign: "center" },
  videoBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)", textAlign: "center" },
  panoramaBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)", textAlign: "center" },
  recordBtnText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)", textAlign: "center" },
  listItemWrap: { marginBottom: 8 },
  listItemCard: {},
  listRecordCard: {},
  listName: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.95)" },
  listSub: { fontSize: 11, color: "rgba(255,255,255,0.60)", marginTop: 3 },
  moreBtn: { paddingVertical: 12, alignItems: "center" },
  moreBtnText: { fontSize: 13, color: "rgba(255,255,255,0.70)" },
  statusText: { textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 14, marginTop: 20 },
  backToMapBtn: { marginTop: 8, marginBottom: 0 },
  backToMapCard: { paddingVertical: 10, paddingHorizontal: 14 },
  backToMapText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.70)", textAlign: "center" },
});
