import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { CalendarCard } from "../components/CalendarCard";
import { DiaryHandle } from "../components/DiarySheet";
import { VideoBackground } from "../components/VideoBackground";
import { useAuth } from "./context/authcontext";

export default function Home() {
  const { currentUser } = useAuth();

  return (
    <VideoBackground source={require("../assets/backgrounds/main.mp4")}>
      <View style={styles.root}>
        <View style={styles.center}>
          {/* 日曆（頂部留空給 AppShell 漢堡按鈕） */}
          <View style={styles.calendarArea}>
            <CalendarCard />
          </View>

          {/* 登入狀態（確認用） */}
          {currentUser && (
            <Text style={styles.userEmail}>{currentUser.email}</Text>
          )}

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
  userEmail: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },
  calendarArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 64, // 留空給 AppShell 漢堡按鈕
    paddingBottom: 110, // 留空給底部把手
  },
});
