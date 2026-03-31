import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SideDrawer } from "./SideDrawer";

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

  const value = useMemo(
    () => ({ openDrawer, closeDrawer, toggleDrawer }),
    [openDrawer, closeDrawer, toggleDrawer]
  );

  return (
    <AppShellContext.Provider value={value}>
      <View style={styles.container}>
        {children}

        {/* 固定在左上角的漢堡按鈕（所有頁面位置一致） */}
        <SafeAreaView style={styles.hamburgerArea} edges={["top"]} pointerEvents="box-none">
          <Pressable onPress={openDrawer} style={styles.hamburgerButton}>
            <View style={styles.bar} />
            <View style={styles.bar} />
            <View style={styles.bar} />
          </Pressable>
        </SafeAreaView>

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
    paddingLeft: 16,
    paddingTop: 10,
  },
  hamburgerButton: {
    width: 52,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    gap: 5,
  },
  bar: {
    width: 22,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
});

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within an AppShellProvider");
  }
  return ctx;
}
