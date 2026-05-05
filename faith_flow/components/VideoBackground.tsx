import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { HEADER_CONTENT_HEIGHT } from "./AppShell";

type Props = {
  source: any;
  children?: React.ReactNode;
};

export function VideoBackground({ source, children }: Props) {
  const ref = useRef<Video>(null);

  useEffect(() => {
    ref.current?.playAsync?.();
  }, []);

  return (
    <View style={styles.root}>
      <Video
        pointerEvents="none"
        ref={ref}
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted
        shouldPlay
        useNativeControls={false}
      />

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
