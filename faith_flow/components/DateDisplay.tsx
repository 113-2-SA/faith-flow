import React from "react";
import { Text, StyleSheet, Pressable } from "react-native";
import { useFonts } from "expo-font";
import { PlaywriteNO_400Regular } from "@expo-google-fonts/playwrite-no";
import { GlassCard } from "./GlassCard";
import { monthNameEn } from "./calendarUtils";

interface DateDisplayProps {
  viewDate: Date;
  expanded: boolean;
  onToggle: () => void;
}

export function DateDisplay({ viewDate, expanded, onToggle }: DateDisplayProps) {
  const [fontsLoaded] = useFonts({ PlaywriteNO_400Regular });

  const year = viewDate.getFullYear();
  const monthTitle = monthNameEn(viewDate);
  const pw = fontsLoaded ? { fontFamily: "PlaywriteNO_400Regular" } : {};

  return (
    <Pressable onPress={onToggle} style={styles.pressable}>
      <GlassCard style={styles.card}>
        <Text selectable={false} style={[styles.year, pw]}>{year}</Text>
        <Text selectable={false} style={[styles.month, pw]}>{monthTitle}</Text>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  card: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  year: {
    color: "rgba(255,255,255,0.60)",
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 2,
  },
  month: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 22,
    textAlign: "center",
  },
});
