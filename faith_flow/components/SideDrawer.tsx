import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

type Item = { label: string; href: string };

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SideDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const screenW = Dimensions.get("window").width;
  const drawerW = Math.min(320, Math.round(screenW * 0.78));

  const items = [
  { label: "集英冊", href: "/anthology" },
  { label: "活水泉源", href: "/living-water" },
  { label: "有管大師", href: "/mentor" },
  { label: "心靈營火", href: "/campfire" },
  { label: "朝聖之地", href: "/pilgrimage" },
  { label: "思高聖經", href: "/bible" },
  { label: "首頁", href: "/" },
  { label: "說明", href: "/about" },
  { label: "帳號設定", href: "/settings" },
];
  const x = useRef(new Animated.Value(-drawerW)).current;
  const overlay = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(x, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlay, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(x, {
          toValue: -drawerW,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(overlay, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [open, drawerW, overlay, x]);

  // open=false 時直接不渲染，避免擋觸控
  if (!open) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Overlay（點空白處關閉） */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "rgba(0,0,0,0.45)",
              opacity: overlay,
            },
          ]}
        />
      </Pressable>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: drawerW,
            transform: [{ translateX: x }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>MENU</Text>
        </View>

        <View style={styles.list}>
          {items.map((it) => (
            <Pressable
              key={it.href}
              style={styles.item}
              onPress={() => {
                onClose();
                router.push(it.href as any);
              }}
            >
              <Text style={styles.itemText}>{it.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(20, 24, 28, 0.92)",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.12)",
    paddingTop: 56,
    paddingHorizontal: 14,
  },
  header: {
    paddingHorizontal: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  title: { color: "rgba(255,255,255,0.85)", letterSpacing: 2 },
  list: { marginTop: 14 },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  itemText: { color: "rgba(255,255,255,0.92)", fontSize: 16 },
  footer: { marginTop: "auto", paddingBottom: 20 },
  closeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  closeText: { color: "rgba(255,255,255,0.9)", textAlign: "center" },
});
