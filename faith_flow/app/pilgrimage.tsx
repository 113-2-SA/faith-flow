import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { BasilicaMap } from "@/components/BasilicaMap";

export default function PilgrimageTab() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <BasilicaMap />
    </View>
  );
}