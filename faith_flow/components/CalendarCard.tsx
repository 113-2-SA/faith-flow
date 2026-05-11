import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View, Text, StyleSheet, Pressable, Platform, UIManager, useWindowDimensions } from "react-native";
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
const CELL_MB = 4; // cell 的 marginBottom

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
  const { width: screenWidth } = useWindowDimensions();

  // 量測 grid 容器的實際寬度
  const [containerW, setContainerW] = useState(0);
  const onContainerLayout = (e: any) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContainerW(w);
  };

  // cellSize：明確像素值，確保正方形（Yoga 引擎在 flexWrap + % width + aspectRatio 組合下無法正確推導高度）
  const cellSize = containerW > 0 ? Math.floor(containerW / 7) : 0;
  // rowH = 單格高度 + marginBottom
  const rowH = cellSize > 0 ? cellSize + CELL_MB : 0;

  const gridH  = useRef(new Animated.Value(0)).current;
  const gridMT = useRef(new Animated.Value(0)).current;
  const prevRowH = useRef(0);
  const initializedRef = useRef(false);

  const year = viewDate.getFullYear();

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

  // ─── 動畫 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (rowH === 0) return;

    const targetH  = expanded ? rowH * 6 : rowH;
    const targetMT = expanded ? 0 : -todayRowIdx * rowH;
    const sizeChanged = prevRowH.current !== rowH;
    prevRowH.current = rowH;

    // 首次量測或螢幕尺寸改變：直接跳到正確位置，不做動畫
    if (!initializedRef.current || sizeChanged) {
      initializedRef.current = true;
      gridH.setValue(targetH);
      gridMT.setValue(targetMT);
      return;
    }

    // 正常展開／收合：有動畫
    Animated.parallel([
      Animated.timing(gridH,  { toValue: targetH,  duration: ANIM_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(gridMT, { toValue: targetMT, duration: ANIM_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [expanded, rowH, todayRowIdx]);

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

        {/* 動畫容器：量測容器寬度，height 控制可見範圍 */}
        <Animated.View style={{ height: gridH, overflow: "hidden" }} onLayout={onContainerLayout}>
          {/* grid 偏移：讓今日所在行對齊可見窗口 */}
          <Animated.View style={[styles.grid, { marginTop: gridMT }]}>
            {cells.map((c, idx) => {
              const day = c.date.getDate();
              const dateString = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hasDiary = c.inMonth && diaryDates.has(dateString);

              return (
                <Pressable
                  key={`${c.date.toISOString()}-${idx}`}
                  disabled={!c.inMonth}
                  onPress={() => handleDateClick(c.date, c.inMonth)}
                  style={[
                    styles.cell,
                    // 明確設定 width/height 為相同像素值，確保正方形
                    cellSize > 0 && { width: cellSize, height: cellSize },
                    c.isToday && styles.cellToday,
                  ]}
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
                  {hasDiary && <View style={[styles.dot, cellSize > 0 && { bottom: Math.round(cellSize * 0.18) }]} />}
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
  },
  cell: {
    // width/height 由 cellSize 在 render 時明確注入（像素值）
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    marginBottom: CELL_MB,
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
