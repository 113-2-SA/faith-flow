import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View, Text, StyleSheet, Pressable, Platform, UIManager } from "react-native";
import { buildMonthGrid } from "./calendarUtils";
import { GlassCard } from "./GlassCard";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from "../lib/api";
import { useFonts } from "expo-font";
import { CrimsonText_400Regular, CrimsonText_600SemiBold } from "@expo-google-fonts/crimson-text";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WEEK = ["Sun", "Mon", "Tue", "WED", "THU", "FRI", "SAT"];
const ANIM_MS = 300;

type Props = {
  viewDate: Date;
  expanded: boolean;
  onToggleExpanded: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDatePress?: (date: string) => void;
};

export function CalendarCard({ viewDate, expanded, onToggleExpanded, onPrev, onNext, onDatePress }: Props) {
  const [fontsLoaded] = useFonts({ CrimsonText_400Regular, CrimsonText_600SemiBold });
  const { user } = useAuth();
  const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set());

  // 量測實際高度後再決定動畫目標值
  const [collapsedH, setCollapsedH] = useState(0);
  const [expandedH, setExpandedH] = useState(0);
  const gridH = useRef(new Animated.Value(0)).current;
  const gridMT = useRef(new Animated.Value(0)).current; // marginTop 負值往上偏移，顯示今日所在行
  const initializedRef = useRef(false);

  const year = viewDate.getFullYear();

  // ─── 量測 ────────────────────────────────────────────────────────────────
  // 永遠 render 完整月曆（42 cells），用 height + marginTop 控制顯示範圍
  const cells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  // 今天在月曆的第幾行（0-based）
  const todayRowIdx = useMemo(() => {
    const today = new Date();
    const ts = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const idx = cells.findIndex((c) => {
      const y = c.date.getFullYear();
      const m = String(c.date.getMonth() + 1).padStart(2, "0");
      const d = String(c.date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}` === ts;
    });
    return idx >= 0 ? Math.floor(idx / 7) : 0;
  }, [cells]);

  // grid 永遠 render 42 cells（6 行），一次量測就能得到兩個高度
  const onGridLayout = (e: any) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    setExpandedH(h);
    setCollapsedH(Math.round(h / 6));
  };

  // ─── 動畫 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (collapsedH === 0 || expandedH === 0) return;

    // 首次量測完成：直接設定初始值，不做動畫
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (!expanded) {
        gridH.setValue(collapsedH);
        gridMT.setValue(-todayRowIdx * collapsedH);
      } else {
        gridH.setValue(expandedH);
        gridMT.setValue(0);
      }
      return;
    }

    if (expanded) {
      Animated.parallel([
        Animated.timing(gridH, {
          toValue: expandedH,
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(gridMT, {
          toValue: 0,
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(gridH, {
          toValue: collapsedH,
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(gridMT, {
          toValue: -todayRowIdx * collapsedH,
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [expanded, collapsedH, expandedH, todayRowIdx]);

  // ─── API ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const month = viewDate.getMonth() + 1;
    user.getIdToken().then((token) => {
      fetch(`${API_BASE_URL}/api/diary?year=${year}&month=${month}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            const dates = new Set<string>(
              data.data.items.map((d: { diary_date: string }) => {
                const dt = new Date(d.diary_date);
                const y = dt.getFullYear();
                const m = String(dt.getMonth() + 1).padStart(2, "0");
                const day = String(dt.getDate()).padStart(2, "0");
                return `${y}-${m}-${day}`;
              })
            );
            setDiaryDates(dates);
          }
        })
        .catch(() => {});
    });
  }, [year, viewDate.getMonth(), user]);

  const handleDateClick = (date: Date, inMonth: boolean) => {
    if (!inMonth) return;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    onDatePress?.(`${y}-${m}-${d}`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.wrapper}>
      <GlassCard style={styles.card}>
        {/* Week labels */}
        <View style={styles.weekRow}>
          {WEEK.map((w) => (
            <Text key={w} selectable={false}
              style={[styles.weekText, fontsLoaded && { fontFamily: "CrimsonText_600SemiBold" }]}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.divider} />

        {/* 動畫容器：height 控制可見高度，overflow hidden 裁切 */}
        <Animated.View style={{ height: (collapsedH > 0 && expandedH > 0) ? gridH : undefined, overflow: "hidden" }}>
          {/* grid 偏移：讓今日所在行對齊可見窗口 */}
          <Animated.View style={[styles.grid, { marginTop: gridMT }]} onLayout={onGridLayout}>
            {cells.map((c, idx) => {
              const day = c.date.getDate();
              const dateString = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hasDiary = c.inMonth && diaryDates.has(dateString);

              return (
                <Pressable
                  key={`${c.date.toISOString()}-${idx}`}
                  disabled={!c.inMonth}
                  onPress={() => handleDateClick(c.date, c.inMonth)}
                  style={[styles.cell, c.isToday && styles.cellToday]}
                >
                  <Text selectable={false}
                    style={[
                      styles.cellText,
                      fontsLoaded && { fontFamily: "CrimsonText_400Regular" },
                      !c.inMonth && styles.cellTextDim,
                      c.isToday && styles.cellTextToday,
                    ]}>
                    {day}
                  </Text>
                  {hasDiary && <View style={styles.dot} />}
                </Pressable>
              );
            })}
          </Animated.View>
        </Animated.View>
      </GlassCard>

      {/* 浮動月份切換按鈕（展開時才顯示） */}
      {expanded && (
        <>
          <View style={[styles.floatWrapper, styles.floatWrapperLeft]}>
            <Pressable onPress={onPrev} style={styles.floatBtn} hitSlop={10}>
              <Text selectable={false} style={styles.floatArrow}>{"〈"}</Text>
            </Pressable>
          </View>
          <View style={[styles.floatWrapper, styles.floatWrapperRight]}>
            <Pressable onPress={onNext} style={styles.floatBtn} hitSlop={10}>
              <Text selectable={false} style={styles.floatArrow}>{"〉"}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  card: {
    overflow: "hidden",
  },
  weekRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  weekText: {
    width: "14.285%",
    textAlign: "center",
    color: "rgba(255,255,255,0.60)",
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
    marginTop: 8,
    marginBottom: 8,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 2,
  },
  cell: {
    width: "14.285%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    marginBottom: 4,
  },
  cellText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
  },
  cellTextDim: { color: "rgba(255,255,255,0.30)" },
  cellToday: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  cellTextToday: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "700",
  },
  dot: {
    position: "absolute",
    bottom: 7,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.85)",
  },

  floatWrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  floatWrapperLeft: { left: -20 },
  floatWrapperRight: { right: -20 },
  floatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  floatArrow: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 26,
    lineHeight: 30,
    textAlign: "center",
  },
});
