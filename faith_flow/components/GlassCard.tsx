import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: number; // 0~100
};

export function GlassCard({ children, style, intensity = 30 }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
      {/* 淡白霧（讓玻璃更像） */}
      <View style={styles.frost} />
      {/* 細邊框 */}
      <View style={styles.border} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10, // 改成10，與border一致
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  frost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.01)",
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 10, // 改成10，讓圓角一致
  },
  content: {
    padding: 14,
  },
});