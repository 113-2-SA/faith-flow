import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

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
          "rgba(185, 212, 228, 0.48)",
          "rgba(185, 212, 228, 0.34)",
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
