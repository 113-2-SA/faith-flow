import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useGlassTheme } from "../context/GlassThemeContext";

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;   // overrides theme if provided
  transparent?: boolean;
  glassColor?: string;  // overrides gradient with a solid colour if provided
};

// Convert angle (degrees) to expo-linear-gradient start/end points
function angleToPoints(deg: number): {
  start: [number, number];
  end: [number, number];
} {
  const rad = (deg * Math.PI) / 180;
  const x = Math.cos(rad);
  const y = Math.sin(rad);
  // Map from [-1,1] to [0,1]
  return {
    start: [(1 - x) / 2, (1 + y) / 2],
    end:   [(1 + x) / 2, (1 - y) / 2],
  };
}

export function GlassCard({ children, style, intensity, transparent = false, glassColor }: Props) {
  const { theme } = useGlassTheme();

  const effectiveBlur = intensity ?? theme.blur;
  const isTransparent = transparent || glassColor === "transparent";
  const borderColor = `rgba(255,255,255,${theme.borderOpacity})`;
  const showBlur = effectiveBlur > 0;

  const color1 = `rgba(${theme.r ?? 255},${theme.g ?? 255},${theme.b ?? 255},${theme.opacity ?? 0.01})`;
  const color2 = `rgba(${theme.r2 ?? 200},${theme.g2 ?? 200},${theme.b2 ?? 255},${theme.opacity2 ?? 0.08})`;
  const { start, end } = angleToPoints(theme.angle ?? 135);

  return (
    <View style={[styles.wrap, isTransparent ? styles.wrapTransparent : null, style]}>
      {showBlur && (
        <BlurView intensity={effectiveBlur} tint="light" style={StyleSheet.absoluteFill} />
      )}

      {/* 漸層背景 */}
      {!isTransparent && !glassColor && (
        <LinearGradient
          colors={[color1, color2]}
          start={start}
          end={end}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* 單色覆蓋（明確傳入 glassColor 時） */}
      {!isTransparent && glassColor && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glassColor }]} />
      )}

      <View style={[styles.border, { borderColor }]} />
      <View style={[styles.content, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  wrapTransparent: {
    backgroundColor: "transparent",
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: 10,
  },
  content: {
    padding: 14,
  },
});
