<<<<<<< Updated upstream
import React from 'react';
import { Stack } from 'expo-router';
import { BasilicaMap } from "@/components/BasilicaMap";
import { GlassCard } from "../components/GlassCard";
import { VideoBackground } from "../components/VideoBackground";
import { ScrollView, View, Text } from 'react-native';
=======
import React from "react";
import { Stack } from "expo-router";
import { VideoBackground } from "../components/VideoBackground";
import { PilgrimageMap } from "../components/PilgrimageMap";
>>>>>>> Stashed changes

export default function PilgrimageTab() {
  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <Stack.Screen options={{ headerShown: false }} />
<<<<<<< Updated upstream

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
        <GlassCard style={{ flex: 1, minHeight: 520 }}>
          <Text style={{
            fontSize: 22,
            fontWeight: '700',
            color: 'rgba(255,255,255,0.95)',
            marginBottom: 14,
          }}>
            朝聖之地
          </Text>

          <View style={{ flex: 1, minHeight: 400, borderRadius: 14, overflow: 'hidden' }}>
            <BasilicaMap />
          </View>
        </GlassCard>
      </ScrollView>
=======
      <PilgrimageMap />
>>>>>>> Stashed changes
    </VideoBackground>
  );
}
