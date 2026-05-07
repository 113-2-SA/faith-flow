import React from "react";
import { Text, StyleSheet } from "react-native";
import { useFonts } from "expo-font";
import { PlaywriteNO_400Regular } from "@expo-google-fonts/playwrite-no";
import { GlassCard } from "./GlassCard";

interface DateDisplayProps {
  date: Date;
}

export function DateDisplay({ date }: DateDisplayProps) {
  const [fontsLoaded] = useFonts({ PlaywriteNO_400Regular });

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const weekday = weekdays[date.getDay()];

  const playwrite = fontsLoaded ? { fontFamily: "PlaywriteNO_400Regular" } : {};

  return (
    <GlassCard style={styles.card}>
      <Text selectable={false} style={[styles.year, playwrite]}>{year}</Text>
      <Text
        selectable={false}
        style={[styles.date, playwrite]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {month}/{day}
      </Text>
      <Text selectable={false} style={[styles.weekday, playwrite]}>{weekday}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
  },
  year: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    letterSpacing: 2,
  },
  date: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 60,
    lineHeight: 64,
    marginTop: 2,
  },
  weekday: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    letterSpacing: 1.5,
    marginTop: 4,
  },
});
