import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: number; // 0~100
  transparent?: boolean;
  glassColor?: string;
};

export function GlassCard({ children, style, intensity = 30, transparent = false, glassColor }: Props) {
  const isTransparent = transparent || glassColor === "transparent";
  const frostedColor = isTransparent ? "transparent" : glassColor ?? "rgba(255,255,255,0.01)";
  const showBlur = intensity > 0;

  return (
    <View
      style={[
        styles.wrap,
        isTransparent ? styles.wrapTransparent : null,
        style,
      ]}
    >
      {showBlur && <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />}
      {/* 淡白霧（讓玻璃更像） */}
      <View style={[styles.frost, { backgroundColor: frostedColor }]} />
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
    backgroundColor: "transparent",
  },

  wrapTransparent: {
    backgroundColor: "transparent",
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