import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";  // ⭐ 新增
import { buildMonthGrid, addMonths, monthNameEn } from "./calendarUtils";
import { GlassCard } from "./GlassCard";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from "../lib/api";

const WEEK = ["Sun", "Mon", "Tue", "WED", "THU", "FRI", "SAT"];

export function CalendarCard() {
  const router = useRouter();  // ⭐ 新增
  const { user } = useAuth();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);  // ⭐ 新增
  const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set());

  const year = viewDate.getFullYear();
  const monthTitle = monthNameEn(viewDate);

  // 每次月份切換時撈該月有日記的日期
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
                // pg 可能把 DATE 序列化成 UTC 時間戳（如 2025-03-14T16:00:00.000Z）
                // 直接取本地時間的年月日，確保與月曆格子的 dateString 一致
                const dt = new Date(d.diary_date);
                const y = dt.getFullYear();
                const m = String(dt.getMonth() + 1).padStart(2, '0');
                const day = String(dt.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
              })
            );
            setDiaryDates(dates);
          }
        })
        .catch(() => {});
    });
  }, [year, viewDate.getMonth(), user]);
  const cells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  // ⭐ 處理日期點擊
  const handleDateClick = (date: Date, inMonth: boolean) => {
    // 只處理本月的日期
    if (!inMonth) return;

    // 格式化日期為 YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    console.log('📅 點擊日期:', dateString);
    setSelectedDate(dateString);
    
    // ⭐ 導航到日記列表頁面
    router.push({
      pathname: '../diary/list',
      params: { date: dateString }
    });
  };

  return (
    <GlassCard style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => setViewDate((d) => addMonths(d, -1))}
          hitSlop={12}
          style={styles.arrowBtn}
        >
          <Text style={styles.arrow}>‹</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.year}>{year}</Text>
          <Text style={styles.month}>{monthTitle}</Text>
        </View>

        <Pressable
          onPress={() => setViewDate((d) => addMonths(d, +1))}
          hitSlop={12}
          style={styles.arrowBtn}
        >
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>

      {/* Week row */}
      <View style={styles.weekRow}>
        {WEEK.map((w) => (
          <Text key={w} style={styles.weekText}>
            {w}
          </Text>
        ))}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Grid */}
      <View style={styles.grid}>
        {cells.map((c, idx) => {
          const day = c.date.getDate();
          
          // ⭐ 檢查是否為選中的日期
          const dateString = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selectedDate === dateString;
          
          const hasDiary = c.inMonth && diaryDates.has(dateString);

          return (
            <Pressable
              key={`${c.date.toISOString()}-${idx}`}
              disabled={!c.inMonth}  // ⭐ 改為只禁用非本月的日期
              onPress={() => handleDateClick(c.date, c.inMonth)}  // ⭐ 加上點擊事件
              style={[
                styles.cell,
                c.isToday && styles.cellToday,
                isSelected && styles.cellSelected,  // ⭐ 選中的樣式
              ]}
            >
              <Text
                style={[
                  styles.cellText,
                  !c.inMonth && styles.cellTextDim,
                  c.isToday && styles.cellTextToday,
                  isSelected && styles.cellTextSelected,  // ⭐ 選中的文字樣式
                ]}
              >
                {day}
              </Text>
              {hasDiary && <View style={styles.dot} />}
            </Pressable>
          );
        })}
      </View>

      {/* ⭐ 底部提示（選中日期時顯示）*/}
      {selectedDate && (
        <View style={styles.footer}>
          <Text style={styles.footerDate}>{selectedDate}</Text>
          <Text style={styles.footerText}>向上拉動瀏覽今日日記</Text>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {},

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 28,
    lineHeight: 28,
  },
  headerCenter: { alignItems: "center" },
  year: { color: "rgba(255,255,255,0.82)", fontSize: 14, letterSpacing: 3 },
  month: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 40,
    fontStyle: "italic",
    fontWeight: "600",
    marginTop: 2,
  },

  weekRow: {
    marginTop: 14,
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
    marginTop: 10,
    marginBottom: 10,
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
    marginBottom: 6,
    paddingBottom: 2,
  },
  cellText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
  },
  cellTextDim: {
    color: "rgba(255,255,255,0.30)",
  },

  cellToday: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  cellTextToday: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "700",
  },

  // ⭐ 新增：選中日期的樣式
  cellSelected: {
    backgroundColor: "rgba(91, 168, 250, 0.28)",  // 藍色半透明背景
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
  },
  cellTextSelected: {
    color: "rgba(255,255,255,1)",
    fontWeight: "700",
  },

  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(135, 206, 250, 0.9)",
    marginTop: 2,
  },

  // ⭐ 新增：底部提示區域
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
  },
  footerDate: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  footerText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
  },
});