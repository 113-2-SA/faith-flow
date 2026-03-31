import React from "react";
import { StyleSheet, View } from "react-native";

import { CalendarCard } from "../components/CalendarCard";
import { DiaryHandle } from "../components/DiarySheet";
import { VideoBackground } from "../components/VideoBackground";

export default function Home() {
  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <View style={styles.root}>
        <View style={styles.center}>
          {/* 日曆（頂部留空給 AppShell 漢堡按鈕） */}
          <View style={styles.calendarArea}>
            <CalendarCard />
          </View>

          {/* 底部拖曳日記把手 */}
          <DiaryHandle />
        </View>
      </View>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
  },
  center: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
  },
  calendarArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 64, // 留空給 AppShell 漢堡按鈕
    paddingBottom: 110, // 留空給底部把手
  },
});
