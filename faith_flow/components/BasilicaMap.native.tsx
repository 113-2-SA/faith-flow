import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator, TextInput } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { GlassCard } from "./GlassCard";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { MAP_CONFIG } from "../config/mapConfig";
import { db } from "../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useChurchPhoto } from "../hooks/useChurchPhoto";
import { ChurchPanoramaViewer } from "./ChurchPanoramaViewer";
import { useRouter } from "expo-router";

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
    <Image
      source={{ uri: photoUrl }}
      style={photoStyles.image}
      resizeMode="cover"
    />
  );
}

const photoStyles = StyleSheet.create({
  container: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    marginBottom: 12,
  },
  hint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
  image: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginBottom: 12,
  },
});

export type Basilica = {
  id: string;
  name: string;
  nameEn: string;
  location: string;
  coordinates: [number, number]; // [lat, lng]
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

export function BasilicaMap() {
  const router = useRouter();
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

  // 切換教堂時關閉全景
  useEffect(() => {
    setShowPanorama(false);
  }, [selectedId]);

  useEffect(() => {
    const fetchBasilicas = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, "basilicas"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        const basilicasData: Basilica[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          basilicasData.push({
            id: doc.id,
            name: data.name,
            nameEn: data.nameEn,
            location: data.location,
            coordinates: data.coordinates,
            type: data.type,
            founded: data.founded,
            dedication: data.dedication,
            style: data.style,
            significance: data.significance,
            description: data.description,
            viewerUrl: data.viewerUrl,
            panoramaId: data.panoramaId || null,
            panoramaHeading: data.panoramaHeading ?? undefined,
            videoUrl: data.videoUrl || null,
          });
        });
        setBasilicas(basilicasData);
      } catch (err) {
        console.error("Error fetching basilicas:", err);
        setError("Failed to load basilicas data");
      } finally {
        setLoading(false);
      }
    };

    fetchBasilicas();
  }, []);

  const filtered = useMemo(() => {
    return basilicas.filter((b) => {
      const matchType = filterType === "all" || b.type === filterType;
      const matchSearch =
        searchText === "" ||
        b.name.toLowerCase().includes(searchText.toLowerCase()) ||
        b.location.toLowerCase().includes(searchText.toLowerCase()) ||
        b.dedication.toLowerCase().includes(searchText.toLowerCase());
      return matchType && matchSearch;
    });
  }, [basilicas, filterType, searchText]);

  // 當篩選條件改變時，重置顯示數量為 3
  useEffect(() => {
    setDisplayCount(3);
  }, [filterType, searchText]);

  const displayedBasilicas = filtered.slice(0, displayCount);

  const selectedBasilica = selectedId
    ? basilicas.find((b) => b.id === selectedId)
    : null;

  // 當選中教堂時，地圖自動置中，並且畫面自動滾動到教堂介紹區塊
  useEffect(() => {
    if (selectedId) {
      const selected = basilicas.find((b) => b.id === selectedId);
      if (selected && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: selected.coordinates[0],
          longitude: selected.coordinates[1],
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      }

      if (detailY > 0) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: detailY - 10,
            animated: true,
          });
        }, 100);
      }
    }
  }, [selectedId, detailY, basilicas]);

  // 當搜尋或篩選結果改變時，自動調整地圖範圍
  useEffect(() => {
    if (!mapRef.current || filtered.length === 0) return;

    // 只有在使用者有輸入搜尋文字或切換篩選條件時，才自動移動地圖
    if (searchText.trim() !== "" || filterType !== "all") {
      if (filtered.length === 1) {
        mapRef.current.animateToRegion({
          latitude: filtered[0].coordinates[0],
          longitude: filtered[0].coordinates[1],
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      } else {
        const coords = filtered.map((b) => ({
          latitude: b.coordinates[0],
          longitude: b.coordinates[1],
        }));
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  }, [filtered, searchText, filterType]);

  if (loading) {
    return (
      <ThemedView style={styles.scrollRoot}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>載入教堂資料中...</Text>
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.scrollRoot}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.scrollRoot}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <ThemedText type="title" style={styles.headerTitle}>
            🌍 朝聖之地
          </ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            探索世界教堂的靈修之旅
          </ThemedText>
        </View>

      {/* Map View - Centered */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          mapType="hybrid"
          showsCompass={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          showsScale={false}
          zoomControlEnabled={false}
          initialRegion={{
            latitude: MAP_CONFIG.defaultCenter.lat,
            longitude: MAP_CONFIG.defaultCenter.lng,
            latitudeDelta: 50,
            longitudeDelta: 50,
          }}
        >
          {filtered.map((basilica) => (
            <Marker
              key={basilica.id}
              coordinate={{
                latitude: basilica.coordinates[0],
                longitude: basilica.coordinates[1],
              }}
              title={basilica.name}
              description={basilica.location}
              onPress={() => setSelectedId(basilica.id)}
            >
              <View style={styles.customMarker}>
                <View style={styles.crossVertical} />
                <View style={styles.crossHorizontal} />
              </View>
            </Marker>
          ))}
        </MapView>
      </View>

      {/* Map Legend */}
      <View style={styles.mapLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotChurch]} />
          <Text style={styles.legendLabel}>教堂</Text>
        </View>
      </View>

      {/* Search */}
      <GlassCard style={styles.searchCard} intensity={85}>
        <ThemedText style={styles.searchLabel}>搜尋教堂</ThemedText>
        <View style={styles.searchInput}>
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
            <Pressable onPress={() => setSearchText("")} style={styles.clearButton} hitSlop={8}>
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          )}
        </View>
      </GlassCard>

      {/* Selected Basilica Info (顯示於搜尋列下方) */}
      {selectedBasilica ? (
        <View onLayout={(e) => setDetailY(e.nativeEvent.layout.y)}>
        <GlassCard style={styles.detailCardTop} intensity={90}>
          <ScrollView
            style={styles.detailTopScroll}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <ChurchPhoto nameEn={selectedBasilica.nameEn} nameCh={selectedBasilica.name} />

            <ThemedText type="title" style={styles.detailName}>
              {selectedBasilica.name}
            </ThemedText>
            <ThemedText style={styles.detailNameEn}>
              {selectedBasilica.nameEn}
            </ThemedText>

            <View style={styles.detailDivider} />

            <View style={styles.detailInfoRow}>
              <ThemedText style={styles.detailLabel}>📍 位置</ThemedText>
              <ThemedText style={styles.detailValue}>
                {selectedBasilica.location}
              </ThemedText>
            </View>

            <View style={styles.detailInfoRow}>
              <ThemedText style={styles.detailLabel}>⏰ 建立</ThemedText>
              <ThemedText style={styles.detailValue}>
                {selectedBasilica.founded} 年
              </ThemedText>
            </View>

            <View style={styles.detailInfoRow}>
              <ThemedText style={styles.detailLabel}>✝️ 奉獻</ThemedText>
              <ThemedText style={styles.detailValue}>
                {selectedBasilica.dedication}
              </ThemedText>
            </View>

            <View style={styles.detailInfoRow}>
              <ThemedText style={styles.detailLabel}>🎨 風格</ThemedText>
              <ThemedText style={styles.detailValue}>
                {selectedBasilica.style}
              </ThemedText>
            </View>

            <View style={styles.detailSection2}>
              <ThemedText type="defaultSemiBold" style={styles.detailSectionTitle}>
                聖經關聯
              </ThemedText>
              <ThemedText style={styles.detailDescription}>
                {selectedBasilica.significance}
              </ThemedText>
            </View>

            <View style={styles.detailSection2}>
              <ThemedText type="defaultSemiBold" style={styles.detailSectionTitle}>
                介紹
              </ThemedText>
              <ThemedText style={styles.detailDescription}>
                {selectedBasilica.description}
              </ThemedText>
            </View>

            {/* 360° 全景按鈕 */}
            {selectedBasilica.panoramaId ? (
              <Pressable
                onPress={() => {
                  setShowPanorama(true);
                  scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                }}
                style={({ pressed }) => [
                  styles.panoramaBtn,
                  pressed && styles.panoramaBtnPressed,
                ]}
              >
                <View style={styles.panoramaBtnInner}>
                  <Text style={styles.panoramaBtnIcon}>🌐</Text>
                  <View>
                    <ThemedText style={styles.panoramaBtnLabel}>
                      進入 360° 全景
                    </ThemedText>
                    <ThemedText style={styles.panoramaBtnSub}>
                      互動式環景體驗
                    </ThemedText>
                  </View>
                  <Text style={styles.panoramaBtnArrow}>›</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.noPanoramaHint}>
                <ThemedText style={styles.noPanoramaText}>
                  此教堂暫無全景資料
                </ThemedText>
              </View>
            )}

            <Pressable
              onPress={() => router.push("/pray")}
              style={({ pressed }) => [styles.recordBtn, pressed && styles.recordBtnPressed]}
            >
              <View style={styles.recordBtnInner}>
                <Text style={styles.recordBtnIcon}>🎙</Text>
                <View>
                  <ThemedText style={styles.recordBtnLabel}>錄音祈禱</ThemedText>
                  <ThemedText style={styles.recordBtnSub}>語音記錄靈修心聲</ThemedText>
                </View>
                <Text style={styles.recordBtnArrow}>›</Text>
              </View>
            </Pressable>
          </ScrollView>
        </GlassCard>
        </View>
      ) : null}

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {(["all", "major", "cathedral", "chapel"] as FilterType[]).map(
          (type) => (
            <Pressable
              key={type}
              onPress={() => setFilterType(type)}
              style={[
                styles.filterBtn,
                filterType === type && styles.filterBtnActive,
              ]}
            >
              <ThemedText
                style={[
                  styles.filterText,
                  filterType === type && styles.filterTextActive,
                ]}
              >
                {type === "all"
                  ? "全部"
                  : type === "major"
                    ? "聖殿"
                    : type === "cathedral"
                      ? "主教座堂"
                      : "聖堂"}
              </ThemedText>
            </Pressable>
          )
        )}
      </ScrollView>

      {/* Basilica List */}
      <View style={styles.listSection}>
        {displayedBasilicas.length > 0 ? (
          <>
            {displayedBasilicas.map((basilica) => (
              <Pressable
                key={basilica.id}
                onPress={() => setSelectedId(basilica.id)}
                style={[
                  styles.listItem,
                  selectedId === basilica.id && styles.listItemActive,
                ]}
              >
                <GlassCard
                  intensity={selectedId === basilica.id ? 100 : 70}
                  style={styles.listItemCard}
                >
                  <View style={styles.listItemIcon}>
                    <Text style={styles.listIcon}>⛪</Text>
                  </View>
                  <View style={styles.listItemContent}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={styles.listItemName}
                    >
                      {basilica.name}
                    </ThemedText>
                    <ThemedText style={styles.listItemLocation}>
                      📍 {basilica.location}
                    </ThemedText>
                    <ThemedText style={styles.listItemYear}>
                      ⏰ {basilica.founded} 年建立
                    </ThemedText>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
            {filtered.length > displayCount && (
              <Pressable
                onPress={() => setDisplayCount((prev) => prev + 3)}
                style={styles.viewMoreBtn}
              >
                <ThemedText style={styles.viewMoreBtnText}>查看更多</ThemedText>
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              未找到教堂
            </ThemedText>
            <ThemedText style={styles.emptyText}>
              試試其他搜尋或篩選條件
            </ThemedText>
          </View>
        )}
      </View>

      {/* Stats Footer */}
      <GlassCard style={styles.footerCard} intensity={80}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{basilicas.length}</ThemedText>
            <ThemedText style={styles.statLabel}>教堂</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{filtered.length}</ThemedText>
            <ThemedText style={styles.statLabel}>篩選結果</ThemedText>
          </View>
        </View>
      </GlassCard>
      </ScrollView>

      {/* 360° 全景檢視器改放置於 ScrollView 外以防佈局干擾 */}
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

const styles = StyleSheet.create({
  scrollRoot: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 32,
  },
  headerSection: {
    marginTop: 8,
    marginBottom: 16,
    // 留出足夠空間讓漢堡選單按鈕（約 44px + hitSlop + margin ≈ 64px）不會遮住標題
    paddingLeft: 72,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  mapContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  map: {
    width: '90%',
    height: 300,
    borderRadius: 12,
  },
  searchCard: {
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,

    borderColor: "rgba(255,255,255,0.01)",
    borderWidth: 1,
  },
  searchLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 6,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
    color: "rgba(255,255,255,0.95)",
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  clearButtonText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  filterScroll: {
    marginBottom: 12,
    marginHorizontal: -12,
  },
  filterContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  filterBtnActive: {
    backgroundColor: "rgba(102, 126, 234, 0.6)",
    borderColor: "rgba(102, 126, 234, 1)",
  },
  filterText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  filterTextActive: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "600",
  },
  listSection: {
    marginBottom: 12,
  },
  listItem: {
    marginBottom: 10,
  },
  listItemActive: {},
  listItemCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderColor: "rgba(255,255,255,0.01)",
    borderWidth: 1,
  },
  listItemIcon: {
    alignItems: "center",
    marginBottom: 6,
  },
  listIcon: {
    fontSize: 28,
  },
  listItemContent: {
    gap: 4,
  },
  listItemName: {
    fontSize: 14,
    color: "rgba(255,255,255,0.95)",
  },
  listItemLocation: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  listItemYear: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
  viewMoreBtn: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  viewMoreBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.8)",
  },
  detailSection: {
    marginBottom: 12,
  },
  detailCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderColor: "rgba(255,255,255,0.01)",
    borderWidth: 1,
  },
  detailCardTop: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderColor: "rgba(255,255,255,0.01)",
    borderWidth: 1,
    maxHeight: 400,
  },
  detailTopScroll: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 10,
  },
  detailIcon: {
    fontSize: 32,
    marginTop: 2,
  },
  detailHeaderText: {
    flex: 1,
  },
  detailName: {
    fontSize: 22,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
  },
  detailNameEn: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontStyle: "italic",
    marginTop: 2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginVertical: 12,
  },
  detailInfoRow: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },
  detailSection2: {
    marginTop: 14,
  },
  detailSectionTitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 6,
  },
  detailDescription: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(102, 126, 234, 0.5)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(102, 126, 234, 0.8)",
  },
  actionButtonIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.95)",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  footerCard: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "rgba(102, 126, 234, 0.95)",
  },
  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 8,
  },
  errorText: {
    fontSize: 16,
    color: "rgba(255,0,0,0.8)",
  },
  customMarker: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 5,
  },
  crossVertical: {
    position: 'absolute',
    width: 5,
    height: 26,
    backgroundColor: '#1a73e8',
    borderRadius: 2,
    top: 3,
  },
  crossHorizontal: {
    position: 'absolute',
    width: 18,
    height: 5,
    backgroundColor: '#1a73e8',
    borderRadius: 2,
    top: 10,
  },
  noPanoramaHint: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  noPanoramaText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  recordBtn: {
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.6)",
    backgroundColor: "rgba(102,126,234,0.18)",
  },
  recordBtnPressed: {
    backgroundColor: "rgba(102,126,234,0.38)",
    borderColor: "rgba(102,126,234,1)",
  },
  recordBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  recordBtnIcon: {
    fontSize: 28,
  },
  recordBtnLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
  },
  recordBtnSub: {
    fontSize: 11,
    color: "rgba(102,126,234,0.9)",
    marginTop: 2,
  },
  recordBtnArrow: {
    fontSize: 24,
    color: "rgba(102,126,234,0.8)",
    marginLeft: "auto",
  },
  panoramaBtn: {
    marginTop: 16,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.6)",
    backgroundColor: "rgba(102,126,234,0.18)",
  },
  panoramaBtnPressed: {
    backgroundColor: "rgba(102,126,234,0.38)",
    borderColor: "rgba(102,126,234,1)",
  },
  panoramaBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  panoramaBtnIcon: {
    fontSize: 28,
  },
  panoramaBtnLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
  },
  panoramaBtnSub: {
    fontSize: 11,
    color: "rgba(102,126,234,0.9)",
    marginTop: 2,
  },
  panoramaBtnArrow: {
    fontSize: 24,
    color: "rgba(102,126,234,0.8)",
    marginLeft: "auto",
  },
  prayerMarker: {
    width: 26,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderRadius: 4,
  },
  prayerMarkerGps: {
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  prayerMarkerAnon: {
    backgroundColor: "rgba(60,60,80,0.45)",
  },
  prayerCrossV: {
    position: "absolute",
    width: 5,
    height: 28,
    borderRadius: 2,
  },
  prayerCrossH: {
    position: "absolute",
    top: 6,
    width: 20,
    height: 5,
    borderRadius: 2,
  },
  prayerCrossGold: {
    backgroundColor: "#f5d680",
    shadowColor: "#c8922a",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  prayerCrossSilver: {
    backgroundColor: "#b0b8c8",
  },
  mapLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendDotChurch: {
    backgroundColor: "rgba(102,126,234,0.9)",
  },
  legendDotGps: {
    backgroundColor: "#f5d680",
  },
  legendDotAnon: {
    backgroundColor: "#b0b8c8",
  },
  legendLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
});
