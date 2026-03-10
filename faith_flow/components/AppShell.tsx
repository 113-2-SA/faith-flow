import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

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
        <SafeAreaView style={styles.hamburgerArea} edges={["top"]}>
          <Pressable onPress={openDrawer} style={styles.hamburgerButton}>
            <Text style={styles.hamburgerText}>☰</Text>
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
    right: 0,
    zIndex: 1001,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  hamburgerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  hamburgerText: {
    color: "white",
    fontSize: 24,
    lineHeight: 24,
  },
});

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within an AppShellProvider");
  }
  return ctx;
}
