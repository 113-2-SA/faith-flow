import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { GlassCard } from "./GlassCard";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

export type Scene = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  hotspots: Hotspot[];
};

export type Hotspot = {
  id: string;
  name: string;
  icon: string;
  story: string;
  ref: string;
  text: string;
  comment: string;
  meditation: string;
  title: string;
  prayer: string;
};

export type PanoramaData = {
  basilicaName: string;
  scenes: Scene[];
};

// 聖保羅大教堂示例場景
export const STPAUL_PANORAMA: PanoramaData = {
  basilicaName: "聖保羅大教堂",
  scenes: [
    {
      id: "entrance",
      name: "教堂入口",
      emoji: "🚪",
      description: "聖保羅大教堂的莊嚴入口",
      hotspots: [
        {
          id: "main_door",
          name: "聖保羅紀念門",
          icon: "🚪",
          story: "聖保羅大教堂的正門是進入這座聖殿的入口，也是進入聖保羅信仰之旅的開始。聖保羅（Paul）原名掃羅（Saul），是早期基督教最偉大的傳道者。他曾經是迫害基督徒的人，但在前往大馬士革的途中，他經歷了基督顯聖，從此生命徹底改變。",
          ref: "使徒行傳 9:3-6",
          text: "掃羅行路，將近大馬士革，忽然從天上發光四面照著他。他就仆倒在地，聽見有聲音對他說：「掃羅，掃羅，你為什麼逼迫我？」",
          comment: "聖保羅的轉變是基督教歷史上最重要的時刻之一。",
          meditation: "思考：在我的人生中，有沒有經歷過像保羅一樣的轉變時刻？",
          title: "生命的轉變",
          prayer: "主啊，就像你曾改變聖保羅的生命一樣，請也改變我的心。阿們。"
        },
        {
          id: "columns",
          name: "門廊的柱子",
          icon: "🏛️",
          story: "聖保羅大教堂的門廊由 80 根科林斯式大理石柱子組成。建築象徵：每一根柱子代表一個聖人或信徒。柱子的堅實象徵著信仰的堅定。",
          ref: "彼得前書 2:5",
          text: "你們來到主面前，也就像活石，被建造成為靈宮。",
          comment: "教堂中的物理結構象徵著信徒組成的靈性建築。",
          meditation: "我是這座靈宮中的一塊石頭嗎？",
          title: "靈宮的構成",
          prayer: "主啊，願我成為你靈宮中穩固的一塊石頭。阿們。"
        }
      ]
    },
    {
      id: "altar",
      name: "主祭壇",
      emoji: "✝️",
      description: "進行彌撒和主要宗教活動的空間",
      hotspots: [
        {
          id: "cross",
          name: "主十字架",
          icon: "✝️",
          story: "十字架是基督教最重要的象徵。耶穌在十字架上，用他的生命為全人類贖罪。水平的木樑代表世界的廣闊，垂直的木樑代表人對上帝的渴望。",
          ref: "瑪竇福音 26:26-28",
          text: "他們吃的時候，耶穌拿起麵包，祝福了，擘開，遞給門徒說：「這是我的身體。」",
          comment: "聖聖的聖體聖血是基督教信仰的核心。",
          meditation: "在聖壇前靜默片刻，思考基督的犧牲對你的意義。",
          title: "與基督同在",
          prayer: "耶穌啊，謝謝你為我而犧牲。阿們。"
        },
        {
          id: "candles",
          name: "聖壇蠟燭",
          icon: "🕯️",
          story: "在聖保羅主祭壇上，永遠燃燒著聖壇蠟燭。這些蠟燭代表祈禱和信仰的光芒。",
          ref: "馬太福音 5:14",
          text: "你們是世界的光。你們的光應該照亮一切。",
          comment: "信徒應該像蠟燭一樣發光。",
          meditation: "我如何在我的生活中像蠟燭一樣發光？",
          title: "奉獻的火焰",
          prayer: "主啊，讓我成為一根蠟燭，為你的榮耀而燃燒。阿們。"
        }
      ]
    },
    {
      id: "confessio",
      name: "聖保羅地下室",
      emoji: "⚰️",
      description: "聖保羅陵墓所在地，最聖潔的地點",
      hotspots: [
        {
          id: "tomb",
          name: "聖保羅的陵墓",
          icon: "⚰️",
          story: "聖保羅的陵墓位於聖保羅大教堂的正下方，是這座教堂最神聖的地點。聖保羅於西元 67 年在羅馬城外被斬首殉教。他的遺骨後來被移至現在教堂下方的地下室。",
          ref: "提摩太後書 4:7-8",
          text: "那美好的仗我已經打過了，當跑的路我已經跑盡了，所信的道我已經守住了。",
          comment: "聖保羅在殉教前說出了這些話。",
          meditation: "我對信仰的承諾有多深？",
          title: "信仰的犧牲",
          prayer: "主啊，願我能像聖保羅一樣全心全意地信靠你。阿們。"
        }
      ]
    }
  ]
};

// 淨心堂示例場景
export const JINGXIN_PANORAMA: PanoramaData = {
  basilicaName: "輔仁大學淨心堂",
  scenes: [
    {
      id: "entrance",
      name: "聖殿正門",
      emoji: "🚪",
      description: "淨心堂的莊嚴入口",
      hotspots: [
        {
          id: "main_door",
          name: "聖堂大門",
          icon: "🚪",
          story: "淨心堂位於輔仁大學校園中心，是一座現代化的天主教聖堂。大門採用紅磚建築風格，象徵著信仰的堅實與永恆。這座聖堂為輔仁大學的師生及校園社區提供靈性寄託的場所。",
          ref: "瑪竇福音 7:7-8",
          text: "「你們祈求，就給你們；你們尋找，就找到；你們敲門，就給你們開門。」",
          comment: "進入聖堂的每一步，都是靈魂與上帝相遇的開始。",
          meditation: "當我踏入這座聖堂時，我帶著什麼樣的祈禱？",
          title: "敞開的心門",
          prayer: "親愛的天主，我懷著虔誠的心踏入你的聖殿。阿們。"
        }
      ]
    },
    {
      id: "altar",
      name: "聖壇與祭台",
      emoji: "✝️",
      description: "進行彌撒和聖事的神聖空間",
      hotspots: [
        {
          id: "cross",
          name: "主十字架",
          icon: "✝️",
          story: "聖壇中央的十字架是整座聖堂的靈性中心。紅色的十字架象徵著耶穌基督為人類所流的寶血，以及他無限的愛與犧牲。在淨心堂的聖壇前，信徒們來此祈禱、和好、領聖體聖血。",
          ref: "哥林多前書 1:18",
          text: "十字架的言論，對於喪亡的人，是愚妄；但對於獲救的我們，卻是天主的力量。",
          comment: "十字架看似是死亡與失敗的象徵，卻真正代表了救恩與勝利。",
          meditation: "我如何理解十字架的意義？",
          title: "救恩的象徵",
          prayer: "主耶穌，感謝你為我的罪而犧牲。阿們。"
        }
      ]
    }
  ]
};

type Props = {
  panoramaData: PanoramaData;
  onClose?: () => void;
};

export function BasilicaPanorama({ panoramaData, onClose }: Props) {
  const [selectedSceneId, setSelectedSceneId] = useState(
    panoramaData.scenes[0]?.id || ""
  );
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [reflectionText, setReflectionText] = useState("");
  const [reflections, setReflections] = useState<string[]>([]);

  const selectedScene = panoramaData.scenes.find(
    (s) => s.id === selectedSceneId
  );

  const handleSaveReflection = () => {
    if (reflectionText.trim()) {
      setReflections([...reflections, reflectionText]);
      setReflectionText("");
    }
  };

  const screenWidth = Dimensions.get("window").width;
  const isMobile = screenWidth < 768;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <GlassCard style={styles.headerCard} intensity={90}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerIcon}>⛪</Text>
            <View style={styles.headerText}>
              <ThemedText type="subtitle" style={styles.headerTitle}>
                {panoramaData.basilicaName}
              </ThemedText>
              <ThemedText style={styles.headerScene}>
                {selectedScene?.name}
              </ThemedText>
            </View>
          </View>
          {onClose && (
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          )}
        </View>
      </GlassCard>

      {/* Main Content */}
      <View style={[styles.mainGrid, isMobile && styles.mainGridMobile]}>
        {/* Left: Scene Navigator */}
        <ScrollView style={styles.scenePanel}>
          <ThemedText type="defaultSemiBold" style={styles.panelTitle}>
            📍 場景
          </ThemedText>

          {panoramaData.scenes.map((scene) => (
            <Pressable
              key={scene.id}
              onPress={() => {
                setSelectedSceneId(scene.id);
                setSelectedHotspot(null);
              }}
              style={[
                styles.sceneBtn,
                selectedSceneId === scene.id && styles.sceneBtnActive,
              ]}
            >
              <Text style={styles.sceneBtnEmoji}>{scene.emoji}</Text>
              <ThemedText
                style={[
                  styles.sceneBtnText,
                  selectedSceneId === scene.id &&
                    styles.sceneBtnTextActive,
                ]}
              >
                {scene.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {/* Center: Panorama View */}
        <View style={styles.panoramaPanel}>
          {selectedScene ? (
            <GlassCard style={styles.panoramaCard} intensity={95}>
              <View style={styles.panoramaContent}>
                <Text style={styles.panoramaEmoji}>🏛️</Text>
                <ThemedText
                  type="defaultSemiBold"
                  style={styles.panoramaTitle}
                >
                  {selectedScene.name}
                </ThemedText>
                <ThemedText style={styles.panoramaDesc}>
                  {selectedScene.description}
                </ThemedText>

                {/* Hotspots Display */}
                <View style={styles.hotspotsList}>
                  {selectedScene.hotspots.map((hotspot) => (
                    <Pressable
                      key={hotspot.id}
                      onPress={() => setSelectedHotspot(hotspot)}
                      style={[
                        styles.hotspotBtn,
                        selectedHotspot?.id === hotspot.id &&
                          styles.hotspotBtnActive,
                      ]}
                    >
                      <Text style={styles.hotspotIcon}>{hotspot.icon}</Text>
                      <View style={styles.hotspotContent}>
                        <ThemedText
                          style={[
                            styles.hotspotName,
                            selectedHotspot?.id === hotspot.id &&
                              styles.hotspotNameActive,
                          ]}
                        >
                          {hotspot.name}
                        </ThemedText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            </GlassCard>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <ThemedText style={styles.emptyText}>
                選擇場景查看詳情
              </ThemedText>
            </View>
          )}
        </View>

        {/* Right: Hotspot Details */}
        {selectedHotspot ? (
          <ScrollView style={styles.detailPanel}>
            <GlassCard style={styles.detailCard} intensity={100}>
              {/* Hotspot Header */}
              <View style={styles.detailHeader}>
                <Text style={styles.detailIcon}>{selectedHotspot.icon}</Text>
                <ThemedText
                  type="defaultSemiBold"
                  style={styles.detailTitle}
                >
                  {selectedHotspot.name}
                </ThemedText>
              </View>

              {/* Story */}
              <View style={styles.detailSection}>
                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                  📖 故事
                </ThemedText>
                <ThemedText style={styles.sectionContent}>
                  {selectedHotspot.story}
                </ThemedText>
              </View>

              {/* Scripture */}
              <View style={styles.detailSection}>
                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                  ✝️ 聖經經文
                </ThemedText>
                <GlassCard
                  style={styles.scriptureBox}
                  intensity={80}
                >
                  <ThemedText style={styles.scriptureRef}>
                    {selectedHotspot.ref}
                  </ThemedText>
                  <ThemedText style={styles.scriptureText}>
                    {selectedHotspot.text}
                  </ThemedText>
                  <ThemedText style={styles.scriptureComment}>
                    {selectedHotspot.comment}
                  </ThemedText>
                </GlassCard>
              </View>

              {/* Meditation */}
              <View style={styles.detailSection}>
                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                  🙏 靈修思考
                </ThemedText>
                <GlassCard
                  style={styles.meditationBox}
                  intensity={80}
                >
                  <ThemedText
                    type="defaultSemiBold"
                    style={styles.meditationTitle}
                  >
                    {selectedHotspot.title}
                  </ThemedText>
                  <ThemedText style={styles.meditationContent}>
                    {selectedHotspot.meditation}
                  </ThemedText>
                  <View style={styles.prayerDivider} />
                  <ThemedText style={styles.prayerText}>
                    {selectedHotspot.prayer}
                  </ThemedText>
                </GlassCard>
              </View>

              {/* Personal Reflection */}
              <View style={styles.detailSection}>
                <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                  ✨ 個人靈修反思
                </ThemedText>
                <GlassCard
                  style={styles.reflectionBox}
                  intensity={75}
                >
                  <View style={styles.reflectionInput}>
                    <Text
                      style={styles.reflectionInputPlaceholder}
                      numberOfLines={3}
                    >
                      {reflectionText || "我的靈修思考..."}
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleSaveReflection}
                    style={styles.saveBtn}
                  >
                    <Text style={styles.saveBtnIcon}>💾</Text>
                    <ThemedText style={styles.saveBtnText}>
                      保存靈修
                    </ThemedText>
                  </Pressable>
                </GlassCard>
              </View>

              {/* Reflections Count */}
              <View style={styles.reflectionStats}>
                <ThemedText style={styles.reflectionStat}>
                  💭 已保存 {reflections.length} 條靈修記錄
                </ThemedText>
              </View>
            </GlassCard>
          </ScrollView>
        ) : (
          <View style={styles.detailPanel}>
            <View style={styles.emptyState2}>
              <Text style={styles.emptyIcon}>💡</Text>
              <ThemedText style={styles.emptyText2}>
                點擊場景中的 ✨ 查看詳情
              </ThemedText>
            </View>
          </View>
        )}
      </View>

      {/* Stats Footer */}
      <GlassCard style={styles.footerCard} intensity={85}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {panoramaData.scenes.length}
            </ThemedText>
            <ThemedText style={styles.statLabel}>場景</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {selectedScene?.hotspots.length || 0}
            </ThemedText>
            <ThemedText style={styles.statLabel}>熱點</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{reflections.length}</ThemedText>
            <ThemedText style={styles.statLabel}>反思</ThemedText>
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
    gap: 10,
  },

  // Header
  headerCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerScene: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  closeBtnText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.8)",
  },

  // Main Grid
  mainGrid: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  mainGridMobile: {
    flexDirection: "column",
  },

  // Scene Panel
  scenePanel: {
    flex: 0.9,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  panelTitle: {
    fontSize: 12,
    color: "rgba(102, 126, 234, 0.9)",
    marginBottom: 8,
  },
  sceneBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sceneBtnActive: {
    backgroundColor: "rgba(102, 126, 234, 0.4)",
    borderColor: "rgba(102, 126, 234, 0.8)",
  },
  sceneBtnEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  sceneBtnText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  sceneBtnTextActive: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "600",
  },

  // Panorama Panel
  panoramaPanel: {
    flex: 1.5,
  },
  panoramaCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flex: 1,
  },
  panoramaContent: {
    alignItems: "center",
    gap: 10,
  },
  panoramaEmoji: {
    fontSize: 48,
    marginVertical: 10,
  },
  panoramaTitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.95)",
  },
  panoramaDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 12,
  },
  hotspotsList: {
    width: "100%",
    gap: 8,
    marginTop: 10,
  },
  hotspotBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  hotspotBtnActive: {
    backgroundColor: "rgba(220, 20, 60, 0.4)",
    borderColor: "rgba(220, 20, 60, 0.8)",
  },
  hotspotIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  hotspotContent: {
    flex: 1,
  },
  hotspotName: {
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
  },
  hotspotNameActive: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "600",
  },

  // Detail Panel
  detailPanel: {
    flex: 1.2,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  detailCard: {
    marginHorizontal: 10,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  detailIcon: {
    fontSize: 26,
  },
  detailTitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.95)",
    flex: 1,
  },

  detailSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    color: "rgba(102, 126, 234, 0.9)",
    marginBottom: 6,
  },
  sectionContent: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 16,
  },

  scriptureBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  scriptureRef: {
    fontSize: 11,
    color: "rgba(220, 20, 60, 0.9)",
    fontWeight: "600",
    marginBottom: 4,
  },
  scriptureText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 15,
    marginBottom: 6,
  },
  scriptureComment: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    fontStyle: "italic",
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },

  meditationBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  meditationTitle: {
    fontSize: 12,
    color: "rgba(220, 20, 60, 0.95)",
    marginBottom: 6,
  },
  meditationContent: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 15,
  },
  prayerDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 6,
  },
  prayerText: {
    fontSize: 11,
    color: "rgba(220, 20, 60, 0.85)",
    lineHeight: 15,
    fontStyle: "italic",
  },

  reflectionBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  reflectionInput: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 8,
    minHeight: 60,
  },
  reflectionInputPlaceholder: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 15,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(220, 20, 60, 0.4)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(220, 20, 60, 0.7)",
  },
  saveBtnIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  saveBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },

  reflectionStats: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  reflectionStat: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyState2: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  emptyText2: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },

  // Footer Stats
  footerCard: {
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
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(102, 126, 234, 0.95)",
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 8,
  },
});
