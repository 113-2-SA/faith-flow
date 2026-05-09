import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { HEADER_CONTENT_HEIGHT } from "./AppShell";

type Props = {
  source: any;
  children?: React.ReactNode;
};

export function VideoBackground({ source, children }: Props) {
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
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
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
