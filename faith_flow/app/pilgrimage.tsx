import React, { useCallback } from 'react';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CopilotProvider, CopilotStep, walkthroughable, useCopilot } from 'react-native-copilot';

import { PilgrimageMap } from "@/components/PilgrimageMap";
import { GlassCard } from "../components/GlassCard";
import { VideoBackground } from "../components/VideoBackground";

const WalkthroughableView = walkthroughable(View);
const PILGRIMAGE_TOUR_KEY = 'faith_flow_pilgrimage_tour_v1';

export default function PilgrimageTab() {
  return (
    <CopilotProvider
      animated
      overlay="view"
      stopOnOutsideClick
      backdropColor="transparent"
      labels={{ skip: "略過", previous: "上一步", next: "下一步", finish: "完成" }}
    >
      <PilgrimageContent />
    </CopilotProvider>
  );
}

function PilgrimageContent() {
  const router = useRouter();
  const { start } = useCopilot();

  // 首次進入自動啟動導覽
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(PILGRIMAGE_TOUR_KEY).then((done) => {
        if (!done && !cancelled) {
          setTimeout(() => {
            if (!cancelled) {
              start('pilgrimage_map');
              AsyncStorage.setItem(PILGRIMAGE_TOUR_KEY, 'true');
            }
          }, 1200);
        }
      });
      return () => { cancelled = true; };
    }, [start])
  );

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 透明導覽錨點：依序在畫面各功能區說明 */}
      <CopilotStep
        text="🌍 朝聖之地：探索世界教堂的靈修之旅，認識各地聖殿的歷史與聖經關聯。"
        order={20}
        name="pilgrimage_header"
      >
        <WalkthroughableView collapsable={false} style={styles.anchor} />
      </CopilotStep>

      <CopilotStep
        text="地圖：十字標記代表各地教堂，點擊標記或下方列表可查看詳細介紹。"
        order={21}
        name="pilgrimage_map"
      >
        <WalkthroughableView collapsable={false} style={styles.anchor} />
      </CopilotStep>

      <CopilotStep
        text="搜尋：輸入教堂名稱、位置或奉獻對象，即可快速定位教堂並自動移動地圖。"
        order={22}
        name="pilgrimage_search"
      >
        <WalkthroughableView collapsable={false} style={styles.anchor} />
      </CopilotStep>

      <CopilotStep
        text="篩選：依「聖殿、主教座堂、聖堂」類型分類瀏覽，縮小搜尋範圍。"
        order={23}
        name="pilgrimage_filter"
      >
        <WalkthroughableView collapsable={false} style={styles.anchor} />
      </CopilotStep>

      <CopilotStep
        text="教堂列表：點擊教堂可查看圖片、歷史介紹與 360° 全景互動體驗。"
        order={24}
        name="pilgrimage_list"
      >
        <WalkthroughableView collapsable={false} style={styles.anchor} />
      </CopilotStep>

      <CopilotStep
        text="錄音祈禱：點此麥克風按鈕，用語音記錄你對天主的心聲，AI 轉文字後可存入祈禱日記。"
        order={25}
        name="pilgrimage_record"
      >
        <WalkthroughableView collapsable={false} style={styles.anchor} />
      </CopilotStep>

      {/* 主要內容 */}
      <View style={styles.content}>
        <GlassCard style={styles.mapCard}>
          <PilgrimageMap />
        </GlassCard>
      </View>

      {/* 錄音祈禱 FAB */}
      <TouchableOpacity
        style={styles.recordFab}
        onPress={() => router.push('/pray')}
        activeOpacity={0.8}
      >
        <Text style={styles.recordFabIcon}>🎙</Text>
      </TouchableOpacity>

      {/* 重啟導覽 */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => start('pilgrimage_map')}
      >
        <Text style={styles.helpButtonText}>?</Text>
      </TouchableOpacity>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  anchor: {
    height: 0,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  mapCard: {
    flex: 1,
    minHeight: 520,
  },
  recordFab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(102,126,234,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  recordFabIcon: {
    fontSize: 28,
  },
  helpButton: {
    position: 'absolute',
    right: 24,
    bottom: 96,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '700',
  },
});
