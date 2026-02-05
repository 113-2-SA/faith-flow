import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* 不需要放任何 Screen 也可以 */}
    </Stack>
  );
}
