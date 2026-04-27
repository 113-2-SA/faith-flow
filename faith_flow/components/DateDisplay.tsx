// components/DateDisplay.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { GlassCard } from "./GlassCard";

interface DateDisplayProps {
  date: Date;
}

export function DateDisplay({ date }: DateDisplayProps) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const weekday = weekdays[date.getDay()];

  return (
    <GlassCard style={styles.card}>
      <Text style={styles.year}>{year}</Text>
      <View style={styles.dateRow}>
        <Text style={styles.date}>{month}/{day}</Text>
        <Text style={styles.weekday}>{weekday}</Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flex: 1,
  },
  year: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: "500",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 2,
  },
  date: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 72,
    fontWeight: "300",
    fontStyle: "italic",
    lineHeight: 72,
  },
  weekday: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginLeft: 8,
    marginBottom: 8,
  },
});