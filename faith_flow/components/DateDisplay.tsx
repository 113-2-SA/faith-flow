import React from "react";
import { Text, View, StyleSheet } from "react-native";
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

  const pw = fontsLoaded ? { fontFamily: "PlaywriteNO_400Regular" } : {};

  return (
    <GlassCard style={styles.card}>
      <View style={styles.topRow}>
        <Text selectable={false} style={[styles.year, pw]}>{year}</Text>
        <Text selectable={false} style={[styles.weekday, pw]}>{weekday}</Text>
      </View>
      <Text
        selectable={false}
        style={[styles.date, pw]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {month}/{day}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  year: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 11,
    letterSpacing: 1.5,
  },
  weekday: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    letterSpacing: 1,
  },
  date: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 44,
    lineHeight: 48,
    marginTop: 2,
  },
});
