import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";

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
        <SideDrawer open={open} onClose={closeDrawer} />
      </View>
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within an AppShellProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
