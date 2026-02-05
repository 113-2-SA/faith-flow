import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { buildMonthGrid, addMonths, monthNameEn } from "./calendarUtils";
import { GlassCard } from "./GlassCard";


const WEEK = ["Sun", "Mon", "Tue", "WED", "THU", "FRI", "SAT"];

export function CalendarCard() {
  const [viewDate, setViewDate] = useState(() => new Date());

  const year = viewDate.getFullYear();
  const monthTitle = monthNameEn(viewDate);
  const cells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

return (
  <GlassCard style={styles.card} intensity={100}>
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
          return (
            <Pressable
              key={`${c.date.toISOString()}-${idx}`}
              disabled
              style={[
                styles.cell,
                c.isToday && styles.cellToday,
              ]}
            >
              <Text
                style={[
                  styles.cellText,
                  !c.inMonth && styles.cellTextDim,
                  c.isToday && styles.cellTextToday,
                ]}
              >
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  // 這裡先做「卡片內容」的排版
  // 你之後要玻璃擬態，就把這個外層包進 GlassCard 即可
  card: {
    flex: 1,
  },

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
});
