import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { GlassCard } from "./GlassCard";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { MAP_CONFIG } from "../config/mapConfig";
import { db } from "../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

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
};

type FilterType = "all" | "major" | "cathedral" | "chapel";

export function BasilicaMap() {
  const [basilicas, setBasilicas] = useState<Basilica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchText, setSearchText] = useState("");

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

  const selectedBasilica = selectedId
    ? basilicas.find((b) => b.id === selectedId)
    : null;

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>載入教堂資料中...</Text>
        </View>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
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
          provider={PROVIDER_GOOGLE}
          style={styles.map}
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

      {/* Search */}
      <GlassCard style={styles.searchCard} intensity={85} glassColor="transparent">
        <ThemedText style={styles.searchLabel}>搜尋教堂</ThemedText>
        <View style={styles.searchInput}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text
            style={styles.searchPlaceholder}
            onPress={() => {
              // 搜尋框提示
            }}
          >
            {searchText || "教堂名稱、位置、奉獻對象..."}
          </Text>
        </View>
      </GlassCard>

      {/* Selected Basilica Info (顯示於搜尋列下方) */}
      {selectedBasilica ? (
        <GlassCard style={styles.detailCardTop} intensity={90} glassColor="transparent">
          <ScrollView
            style={styles.detailTopScroll}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
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
          </ScrollView>
        </GlassCard>
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

      {/* Content Grid */}
      <View style={styles.contentGrid}>
        {/* Left: Basilica List */}
        <ScrollView style={styles.listSection} nestedScrollEnabled={true}>
          {filtered.map((basilica) => (
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
                glassColor="transparent"
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
        </ScrollView>

        {/* Right: Basilica Details */}
        {selectedBasilica ? (
          <ScrollView
            style={styles.detailSection}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.detailScrollContent}
          >
            <GlassCard style={styles.detailCard} intensity={100} glassColor="transparent">
              {/* Header */}
              <View style={styles.detailHeader}>
                <Text style={styles.detailIcon}>⛪</Text>
                <View style={styles.detailHeaderText}>
                  <ThemedText type="title" style={styles.detailName}>
                    {selectedBasilica.name}
                  </ThemedText>
                  <ThemedText style={styles.detailNameEn}>
                    {selectedBasilica.nameEn}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.detailDivider} />

              {/* 教堂詳細區塊（套玻璃卡，套在外層 GlassCard 時同層轉透明） */}
              <GlassCard style={styles.detailInnerCard} transparent>
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
                  <ThemedText style={styles.detailLabel}>✝️ 奉獻給</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {selectedBasilica.dedication}
                  </ThemedText>
                </View>

                <View style={styles.detailInfoRow}>
                  <ThemedText style={styles.detailLabel}>🎨 建築風格</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {selectedBasilica.style}
                  </ThemedText>
                </View>
              </GlassCard>

              {/* Description */}
              <View style={styles.detailSection2}>
                <ThemedText type="defaultSemiBold" style={styles.detailSectionTitle}>
                  宗教意義
                </ThemedText>
                <ThemedText style={styles.detailDescription}>
                  {selectedBasilica.significance}
                </ThemedText>
              </View>

              {/* Full Description */}
              <View style={styles.detailSection2}>
                <ThemedText type="defaultSemiBold" style={styles.detailSectionTitle}>
                  介紹
                </ThemedText>
                <ThemedText style={styles.detailDescription}>
                  {selectedBasilica.description}
                </ThemedText>
              </View>

              {/* Action Button */}
              <Pressable
                onPress={() => {
                  // TODO: 導航到360環景查看器
                  console.log("進入 360 環景:", selectedBasilica.viewerUrl);
                }}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonIcon}>🌐</Text>
                <ThemedText style={styles.actionButtonText}>
                  進入 360 環景
                </ThemedText>
              </Pressable>
            </GlassCard>
          </ScrollView>
        ) : (
          <View style={styles.detailSection}>
            <GlassCard style={styles.detailCard} intensity={70} glassColor="transparent">
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🗺️</Text>
                <ThemedText type="subtitle" style={styles.emptyTitle}>
                  選擇教堂
                </ThemedText>
                <ThemedText style={styles.emptyText}>
                  點擊左側教堂列表
                </ThemedText>
                <ThemedText style={styles.emptyText}>
                  查看詳細信息
                </ThemedText>
              </View>
            </GlassCard>
          </View>
        )}
      </View>

      {/* Stats Footer */}
      <GlassCard style={styles.footerCard} intensity={80} glassColor="transparent">
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
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>11+</ThemedText>
            <ThemedText style={styles.statLabel}>個國家</ThemedText>
          </View>
        </View>
      </GlassCard>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  searchPlaceholder: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    flex: 1,
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
  contentGrid: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    minHeight: 200,
  },
  listSection: {
    flex: 1,
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
  detailSection: {
    flex: 1.2,
  },
  detailScrollContent: {
    flexGrow: 1,
  },
  detailCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,

    borderColor: "rgba(255,255,255,0.01)",
    borderWidth: 1,
  },
  detailInnerCard: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  detailCardTop: {
    maxHeight: 280,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  detailTopScroll: {
    flexGrow: 0,
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
    color: "#000",
  },
  detailNameEn: {
    fontSize: 12,
    color: "rgba(0,0,0,0.7)",
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
    color: "rgba(0,0,0,0.8)",
    fontWeight: "600",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: "rgba(0,0,0,0.9)",
  },
  detailSection2: {
    marginTop: 14,
  },
  detailSectionTitle: {
    fontSize: 13,
    color: "rgba(0,0,0,0.85)",
    marginBottom: 6,
  },
  detailDescription: {
    fontSize: 12,
    color: "rgba(0,0,0,0.8)",
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.8)",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "rgba(255,0,0,0.8)",
  },
  customMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(102,126,234,0.9)',
    alignItems: 'center',
    // 加上陰影讓地圖標記更立體
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  crossVertical: {
    position: 'absolute',
    width: 4,
    height: 20,
    backgroundColor: '#ffffff',
    borderRadius: 2,
    top: 6,
  },
  crossHorizontal: {
    position: 'absolute',
    width: 14,
    height: 4,
    backgroundColor: '#ffffff',
    borderRadius: 2,
    top: 11, // 稍微偏上，呈現十字架而非加號
  },
});
