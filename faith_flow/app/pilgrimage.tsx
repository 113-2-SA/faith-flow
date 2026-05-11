import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BasilicaMap } from "@/components/BasilicaMap";

const TOUR_KEY = 'pilgrimage_tour_done_v1';

const STEPS = [
  { title: "🌍 朝聖之地", body: "探索世界教堂的靈修之旅，認識各地聖殿的歷史與聖經關聯。" },
  { title: "🗺️ 地圖", body: "十字標記代表各地教堂，點擊標記或下方列表可查看詳細介紹。" },
  { title: "🔍 搜尋", body: "輸入教堂名稱、位置或奉獻對象，即可快速定位教堂。" },
  { title: "🏷️ 篩選", body: "依「聖殿、主教座堂、聖堂」類型分類瀏覽，縮小搜尋範圍。" },
  { title: "📋 教堂列表", body: "點擊教堂可查看圖片、歷史介紹與 360° 全景互動體驗。" },
  { title: "🎙️ 錄音祈禱", body: "選取教堂後，在詳細頁面點擊「錄音祈禱」，用語音記錄你對天主的心聲。" },
];

function PilgrimageTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [step, opacity]);

  const goNext = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      if (step + 1 >= STEPS.length) {
        onDone();
      } else {
        setStep((s) => s + 1);
      }
    });
  }, [step, onDone, opacity]);

  const current = STEPS[step];

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <Pressable style={styles.tourOverlay} onPress={goNext}>
        <Animated.View style={[styles.tourCard, { opacity }]}>
          <Text style={styles.tourStep}>{step + 1} / {STEPS.length}</Text>
          <Text style={styles.tourTitle}>{current.title}</Text>
          <Text style={styles.tourBody}>{current.body}</Text>
          <View style={styles.tourActions}>
            <Pressable onPress={onDone} style={styles.tourSkip}>
              <Text style={styles.tourSkipText}>略過</Text>
            </Pressable>
            <Pressable onPress={goNext} style={styles.tourNext}>
              <Text style={styles.tourNextText}>
                {step + 1 >= STEPS.length ? "完成" : "下一步"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default function PilgrimageTab() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TOUR_KEY).then((done) => {
      if (!done) setTimeout(() => setShowTour(true), 800);
    });
  }, []);

  const endTour = useCallback(() => {
    setShowTour(false);
    AsyncStorage.setItem(TOUR_KEY, 'true');
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <BasilicaMap />
      {showTour && <PilgrimageTour onDone={endTour} />}
    </View>
  );
}

const styles = StyleSheet.create({
  tourOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  tourCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  tourStep: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.35)',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  tourTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.85)',
    marginBottom: 10,
  },
  tourBody: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.65)',
    lineHeight: 22,
    marginBottom: 24,
  },
  tourActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tourSkip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tourSkipText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.35)',
  },
  tourNext: {
    backgroundColor: 'rgba(102,126,234,0.90)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  tourNextText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
