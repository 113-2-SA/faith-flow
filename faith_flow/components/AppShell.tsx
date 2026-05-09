import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { CopilotStep, walkthroughable } from "react-native-copilot";

import { SideDrawer } from "./SideDrawer";

/** Safe-area 以下、內容區以上所預留的高度（背景不受影響） */
export const HEADER_CONTENT_HEIGHT = 68;

type AppShellContextValue = {
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((prev) => !prev), []);

  // 功能鍵滑出動畫：開啟時往左移出，關閉時移回
  const menuX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(menuX, {
      toValue: open ? -90 : 0,
      duration: open ? 200 : 220,
      useNativeDriver: true,
    }).start();
  }, [open, menuX]);

  const value = useMemo(
    () => ({ openDrawer, closeDrawer, toggleDrawer }),
    [openDrawer, closeDrawer, toggleDrawer]
  );

  return (
    <AppShellContext.Provider value={value}>
      <View style={styles.container}>
        {children}

        {/* 漢堡按鈕：貼齊左緣，開抽屜時滑出隱藏 */}
        <Animated.View
          style={[styles.hamburgerArea, { transform: [{ translateX: menuX }] }]}
          pointerEvents="box-none"
        >
          <SafeAreaView edges={["top"]} pointerEvents="box-none">
            <Pressable onPress={openDrawer} style={styles.hamburgerButton} hitSlop={8}>
              <MaterialCommunityIcons name="menu" size={28} color="rgba(0,0,0,0.65)" />
            </Pressable>
          </SafeAreaView>
        </Animated.View>

        <SideDrawer open={open} onClose={closeDrawer} />
      </View>
    </AppShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hamburgerArea: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 1001,
    paddingTop: 10,
  },
  hamburgerButton: {
    width: 62,
    height: 48,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingLeft: 14,
    paddingRight: 17,
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 3,
  },
  bar: {
    width: 22,
    height: 2,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  barSpacer: {
    height: 6,
  },
});

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within an AppShellProvider");
  }
  return ctx;
}
