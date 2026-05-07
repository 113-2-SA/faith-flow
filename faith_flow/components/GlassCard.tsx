import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useGlassTheme } from "../context/GlassThemeContext";

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  transparent?: boolean;
  glassColor?: string;
};

// angle (degrees) → expo-linear-gradient start/end
function angleToPoints(deg: number) {
  const rad = (deg * Math.PI) / 180;
  const x = Math.cos(rad);
  const y = Math.sin(rad);
  return {
    start: { x: (1 - x) / 2, y: (1 + y) / 2 } as { x: number; y: number },
    end:   { x: (1 + x) / 2, y: (1 - y) / 2 } as { x: number; y: number },
  };
}

export function GlassCard({ children, style, intensity, transparent = false, glassColor }: Props) {
  const { theme } = useGlassTheme();

  const effectiveBlur = intensity ?? theme.blur;
  const isTransparent = transparent || glassColor === "transparent";
  const borderColor = `rgba(${theme.borderR ?? 194},${theme.borderG ?? 212},${theme.borderB ?? 255},${theme.borderOpacity})`;
  const showBlur = effectiveBlur > 0;

  const color1 = `rgba(${theme.r},${theme.g},${theme.b},${theme.opacity})`;
  const color2 = `rgba(${theme.r2},${theme.g2},${theme.b2},${theme.opacity2})`;
  const color3 = `rgba(${theme.r3 ?? 65},${theme.g3 ?? 83},${theme.b3 ?? 103},${theme.opacity3 ?? 1})`;
  const { start, end } = angleToPoints(theme.angle ?? 225);

  return (
    <View style={[styles.wrap, isTransparent ? styles.wrapTransparent : null, style]}>
      {showBlur && (
        <BlurView intensity={effectiveBlur} tint="light" style={StyleSheet.absoluteFill} />
      )}

      {!isTransparent && !glassColor && (
        <LinearGradient
          colors={[color1, color2, color3]}
          start={start}
          end={end}
          style={StyleSheet.absoluteFill}
        />
      )}

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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
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
