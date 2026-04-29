import React from "react";
import { Stack } from "expo-router";
import { VideoBackground } from "../components/VideoBackground";
import { PilgrimageMap } from "../components/PilgrimageMap";

export default function PilgrimageTab() {
  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <Stack.Screen options={{ headerShown: false }} />
      <PilgrimageMap />
    </VideoBackground>
  );
}
