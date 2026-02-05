import React, { useState } from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoBackground } from "../components/VideoBackground";
import { CalendarCard } from "../components/CalendarCard";
import { SideDrawer } from "../components/SideDrawer";

export default function Page() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const insets = useSafeAreaInsets();
<View
  style={{
    position: "absolute",
    top: 120,
    left: 20,
    zIndex: 9999,
    backgroundColor: "red",
    padding: 12,
    borderRadius: 12,
  }}
>
  <Text style={{ color: "white", fontSize: 24 }}>I AM INDEX</Text>
</View>

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      {/* 漢堡：永遠置頂 */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable
          style={styles.hamburger}
          onPress={() => setDrawerOpen(true)}
          hitSlop={12}
        >
          <Text style={styles.hamburgerText}>≡</Text>
        </Pressable>
      </View>

      <View style={styles.container}>
        {/* 預留空間避免內容被 topBar 壓到 */}
        <View style={{ height: 56 }} />

        <View style={styles.topSection} />

        <View style={styles.calendarSection}>
          <CalendarCard />
        </View>
      </View>

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  topBar: {
    position: "absolute",
    left: 16,
    zIndex: 999,
    elevation: 999, // Android 也保險
  },
  hamburger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  hamburgerText: { color: "rgba(255,255,255,0.95)", fontSize: 20 },

  topSection: {},

  calendarSection: {
    flex: 1,
    marginTop: 12,
    minHeight: 360,
  },
});
