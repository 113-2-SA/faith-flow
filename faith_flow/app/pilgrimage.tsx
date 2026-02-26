import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { BasilicaMap } from "@/components/BasilicaMap"
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { SideDrawer } from "../components/SideDrawer";

export default function PilgrimageTab() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* 漢堡：永遠置頂 */}
      <View style={{ position: 'absolute', left: 16, zIndex: 999, top: insets.top + 8, elevation: 999 }}>
        <Pressable
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}
          onPress={() => setDrawerOpen(true)}
          hitSlop={12}
        >
          <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 20 }}>≡</Text>
        </Pressable>
      </View>

      <BasilicaMap />

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}