import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { GlassCard } from "./GlassCard";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { MAP_CONFIG } from "../config/mapConfig";

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

const BASILICAS: Basilica[] = [
  {
    id: "stpeter_vatican",
    name: "聖彼得大教堂",
    nameEn: "St. Peter's Basilica",
    location: "梵諦岡",
    coordinates: [41.9029, 12.4534],
    type: "major",
    founded: 1626,
    dedication: "聖彼得",
    style: "文藝復興、巴洛克",
    significance: "天主教會的精神中心，教宗主持彌撒的地點",
    description: "世界上最大的教堂，容納 60,000 人，是基督教的象徵。聖彼得被埋葬在教堂下方。",
    viewerUrl: "stpeter"
  },
  {
    id: "stpaul_vatican",
    name: "聖保羅大教堂",
    nameEn: "St. Paul's Basilica",
    location: "梵諦岡、羅馬",
    coordinates: [41.8584, 12.4767],
    type: "major",
    founded: 386,
    dedication: "聖保羅",
    style: "早期基督教、文藝復興、巴洛克",
    significance: "紀念聖保羅殉教的聖地，四大聖殿之一",
    description: "容納 3,000 人，以金色馬賽克和聖保羅遺骨聞名。",
    viewerUrl: "stpaul"
  },
  {
    id: "santa_maria_maggiore",
    name: "聖母瑪利亞大殿",
    nameEn: "Basilica of St. Mary Major",
    location: "羅馬",
    coordinates: [41.8986, 12.4982],
    type: "major",
    founded: 432,
    dedication: "聖母瑪利亞",
    style: "早期基督教、文藝復興",
    significance: "紀念聖母瑪利亞的四大聖殿之一",
    description: "擁有最古老的馬賽克天花板，象徵聖母的榮耀。",
    viewerUrl: "santa_maria"
  },
  {
    id: "san_giovanni",
    name: "聖若望聖殿",
    nameEn: "Basilica of St. John Lateran",
    location: "羅馬",
    coordinates: [41.8832, 12.5033],
    type: "major",
    founded: 324,
    dedication: "聖若望洗者",
    style: "早期基督教、巴洛克",
    significance: "教宗的主座聖殿，四大聖殿之一",
    description: "羅馬最古老的教堂，見證了 1700 年的信仰歷史。",
    viewerUrl: "san_giovanni"
  },
  {
    id: "basilica_assisi",
    name: "聖方濟各大殿",
    nameEn: "Basilica of St. Francis of Assisi",
    location: "亞西西",
    coordinates: [43.0730, 12.5987],
    type: "major",
    founded: 1253,
    dedication: "聖方濟各",
    style: "哥德式、文藝復興",
    significance: "聖方濟各的聖骨地，朝聖的重要地點",
    description: "包含美麗的濕壁畫，講述聖方濟各的生平故事。",
    viewerUrl: "assisi"
  },
  {
    id: "santiago_compostela",
    name: "聖地亞哥聖殿",
    nameEn: "Cathedral of Santiago de Compostela",
    location: "西班牙",
    coordinates: [42.5806, -8.5457],
    type: "cathedral",
    founded: 1211,
    dedication: "聖地亞哥（聖雅各）",
    style: "羅馬式、巴洛克",
    significance: "朝聖之路的終點，重要的朝聖地點",
    description: "擁有聖雅各的遺骨，吸引無數朝聖者。",
    viewerUrl: "santiago"
  },
  {
    id: "reims_cathedral",
    name: "蘭斯聖母聖殿",
    nameEn: "Reims Cathedral",
    location: "法國",
    coordinates: [49.2514, 4.0361],
    type: "cathedral",
    founded: 1211,
    dedication: "聖母瑪利亞",
    style: "法國哥德式",
    significance: "法國國王加冕的聖地，聖靈的傳承地",
    description: "傳統上，法國國王在此舉行加冕典禮。",
    viewerUrl: "reims"
  },
  {
    id: "chartres_cathedral",
    name: "沙特爾聖母聖殿",
    nameEn: "Chartres Cathedral",
    location: "法國",
    coordinates: [48.4408, 1.4901],
    type: "cathedral",
    founded: 1220,
    dedication: "聖母瑪利亞",
    style: "法國哥德式",
    significance: "聖母的聖衣之地，朝聖中心",
    description: "以美麗的彩繪玻璃窗和高尖塔聞名。",
    viewerUrl: "chartres"
  },
  {
    id: "notre_dame_paris",
    name: "巴黎聖母院",
    nameEn: "Notre-Dame de Paris",
    location: "法國",
    coordinates: [48.8530, 2.3499],
    type: "cathedral",
    founded: 1345,
    dedication: "聖母瑪利亞",
    style: "法國哥德式",
    significance: "法國文化象徵，聖母信仰中心",
    description: "以其宏偉的建築和豐富的宗教藝術聞名。",
    viewerUrl: "notre_dame"
  },
  {
    id: "cologne_cathedral",
    name: "科隆大教堂",
    nameEn: "Cologne Cathedral",
    location: "德國",
    coordinates: [50.9406, 6.9585],
    type: "cathedral",
    founded: 1322,
    dedication: "聖母瑪利亞及聖王",
    style: "德國哥德式",
    significance: "聖三王遺骨之地，中世紀信仰中心",
    description: "世界遺產，以雙尖塔和精美工藝聞名。",
    viewerUrl: "cologne"
  },
  {
    id: "jingxin_chapel_fujen",
    name: "輔仁大學淨心堂",
    nameEn: "Jingxin Chapel, Fujen University",
    location: "台灣、新北市、新莊",
    coordinates: [25.0324, 121.4286],
    type: "chapel",
    founded: 1961,
    dedication: "聖母與聖若望",
    style: "現代教堂建築",
    significance: "台灣天主教高等教育的精神中心，輔仁大學的信仰象徵",
    description: "輔仁大學淨心堂是台灣重要的教堂，座落在輔仁大學校園內。作為天主教大學的精神中心，淨心堂承載著信仰教育的使命，每日為師生提供靈修空間。",
    viewerUrl: "jingxin"
  },
  {
    id: "holy_sepulchre",
    name: "聖墓教堂",
    nameEn: "Church of the Holy Sepulchre",
    location: "耶路撒冷",
    coordinates: [31.7780, 35.2296],
    type: "chapel",
    founded: 335,
    dedication: "耶穌基督的復活",
    style: "拜占庭式、哥德式",
    significance: "基督復活的傳統地點，是基督教最重要的朝聖地之一。",
    description: "聖墓教堂內包含耶穌被釘十字架、埋葬與復活的場所，吸引來自世界各地的朝聖者。",
    viewerUrl: "holy_sepulchre"
  },
  {
    id: "church_of_the_nativity",
    name: "聖誕教堂",
    nameEn: "Church of the Nativity",
    location: "伯利恆",
    coordinates: [31.7054, 35.2024],
    type: "chapel",
    founded: 339,
    dedication: "耶穌的誕生",
    style: "羅馬式、拜占庭式",
    significance: "傳統上被視為耶穌誕生地，是歷史最悠久的教堂之一。",
    description: "教堂建於聖赫羅德時期，保有早期基督教建築遺跡，並為四大聖地之一。",
    viewerUrl: "nativity"
  },
  {
    id: "annunciation_church",
    name: "聖母領報堂",
    nameEn: "Basilica of the Annunciation",
    location: "拿撒勒",
    coordinates: [32.7040, 35.2954],
    type: "chapel",
    founded: 1969,
    dedication: "聖母領報",
    style: "現代主義",
    significance: "傳統上認為是天使向聖母宣報耶穌降生的地點，是敬禮聖母的重要朝聖地。",
    description: "教堂內保存了早期基督教和十字軍時期的遺跡，並於 20 世紀重建成多層設計的聖殿。",
    viewerUrl: "annunciation"
  },
  {
    id: "multiplication_church",
    name: "五餅二魚堂",
    nameEn: "Church of the Multiplication",
    location: "塔布加，加利利海",
    coordinates: [32.8771, 35.5694],
    type: "chapel",
    founded: 350,
    dedication: "耶穌行五餅二魚奇蹟",
    style: "拜占庭式",
    significance: "傳說耶穌在此用五餅二魚餵飽了五千人，是信仰力量的象徵。",
    description: "教堂內保存著傳統上相信是耶穌祝禱的五餅二魚石盤遺跡，吸引眾多朝聖者到訪。",
    viewerUrl: "multiplication"
  },
  {
    id: "st_peter_gallicantu",
    name: "雞鳴堂",
    nameEn: "St. Peter in Gallicantu",
    location: "耶路撒冷",
    coordinates: [31.7765, 35.2303],
    type: "chapel",
    founded: 1931,
    dedication: "聖伯多祿的三次不認主",
    style: "拜占庭復興式",
    significance: "傳統上認為彼得在此三次不認主後悔，提醒信徒悔改與信德堅定。",
    description: "教堂建於耶穌被囚禁的古羅馬宮殿遺址上，並保留了古代地下洞穴和鷹嘴石遺跡。",
    viewerUrl: "gallicantu"
  }
];

type FilterType = "all" | "major" | "cathedral" | "chapel";

const CROSS_MARKER_IMAGE = {
  uri: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='64' viewBox='0 0 64 64'><circle cx='32' cy='32' r='30' fill='rgba(102,126,234,0.9)'/><line x1='32' y1='12' x2='32' y2='52' stroke='%23ffffff' stroke-width='10' stroke-linecap='round'/><line x1='20' y1='28' x2='44' y2='28' stroke='%23ffffff' stroke-width='10' stroke-linecap='round'/></svg>"
};

export function BasilicaMap() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchText, setSearchText] = useState("");

  const filtered = useMemo(() => {
    return BASILICAS.filter((b) => {
      const matchType = filterType === "all" || b.type === filterType;
      const matchSearch =
        searchText === "" ||
        b.name.toLowerCase().includes(searchText.toLowerCase()) ||
        b.location.toLowerCase().includes(searchText.toLowerCase()) ||
        b.dedication.toLowerCase().includes(searchText.toLowerCase());
      return matchType && matchSearch;
    });
  }, [filterType, searchText]);

  const selectedBasilica = selectedId
    ? BASILICAS.find((b) => b.id === selectedId)
    : null;

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
              image={CROSS_MARKER_IMAGE}
              onPress={() => setSelectedId(basilica.id)}
            />
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
            <ThemedText style={styles.statValue}>{BASILICAS.length}</ThemedText>
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
    height: 'auto',
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
});
