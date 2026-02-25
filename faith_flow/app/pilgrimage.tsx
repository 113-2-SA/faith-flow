import { Stack } from 'expo-router';
import { BasilicaMap } from "@/components/BasilicaMap"
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PilgrimageTab() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <BasilicaMap />
    </SafeAreaView>
  );
}