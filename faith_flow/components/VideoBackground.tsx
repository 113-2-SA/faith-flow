import React from "react";
import { StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  source: any;
  children?: React.ReactNode;
};

export function VideoBackground({ source, children }: Props) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(63, 124, 160, 0.48)",
          "rgba(48, 109, 145, 0.34)",
        ]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  safe: { flex: 1 },
});
