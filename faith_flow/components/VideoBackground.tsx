import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { HEADER_CONTENT_HEIGHT } from "./AppShell";

type Props = {
  source: any;
  children?: React.ReactNode;
  overlay?: boolean;
};

export function VideoBackground({ source, children, overlay = true }: Props) {
  const player = useVideoPlayer(Platform.OS !== "web" ? source : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={styles.root}>
      {Platform.OS === "web" ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          src={source}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            objectFit: "cover",
            pointerEvents: "none",
            zIndex: -1,
          } as React.CSSProperties}
        />
      ) : (
        <VideoView
          pointerEvents="none"
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      )}

      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(63, 124, 160, 0.48)",
          "rgba(48, 109, 145, 0.34)",
        ]}
        style={StyleSheet.absoluteFill}
      />

      {overlay && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]}
        />
      )}

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={{ flex: 1, paddingTop: HEADER_CONTENT_HEIGHT }}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  safe: { flex: 1 },
});
