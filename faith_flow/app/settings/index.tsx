// app/settings/index.tsx
import { useFocusEffect } from "@react-navigation/native";
import { Link, router } from "expo-router";
import { signOut } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Switch, Text, View } from "react-native";

import { auth } from "../../lib/firebase";
import { loadPrefs, Preferences, savePrefs } from "../../lib/prefs";

export default function SettingsScreen() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);

  // 顯示名字/頭像（從 Firebase Auth 讀）
  const [name, setName] = useState<string>("");
  const [photoURL, setPhotoURL] = useState<string>("");

  useEffect(() => {
    loadPrefs().then(setPrefs);
  }, []);

  // 每次回到 settings 都刷新一次 user（避免改名後回來不更新）
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        const u = auth.currentUser;
        if (!u) return;

        await u.reload().catch(() => {});
        if (cancelled) return;

        setName(u.displayName ?? "");
        setPhotoURL(u.photoURL ?? "");
      })();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (!prefs) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const setOne = async (key: keyof Preferences, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await savePrefs(next);

    // 後端（PostgreSQL）同步先交給 B，這週先完成本機儲存即可
    // await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/me/preferences`, { ... })
  };

  const onLogout = async () => {
    try {
      await signOut(auth);
      // 直接導回登入頁，避免任何 layout/狀態更新延遲造成卡住
      router.replace("/auth/login");
    } catch (e) {
      console.error("signOut failed:", e);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>設定</Text>

      {/* 顯示使用者 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {photoURL ? (
          <Image
            source={{ uri: photoURL }}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
        ) : null}
        <Text style={{ opacity: 0.85 }}>
          你好，{name || "（尚未設定名字）"}
        </Text>
      </View>

      <Link href="/settings/profile">→ 個人資料（改名字/頭像）</Link>

      <Row
        title="社群通知"
        value={prefs.notifications}
        onValueChange={(v) => setOne("notifications", v)}
      />
      <Row
        title="日記通知"
        value={prefs.diary}
        onValueChange={(v) => setOne("diary", v)}
      />
      <Row
        title="抽卡通知"
        value={prefs.cardDraw}
        onValueChange={(v) => setOne("cardDraw", v)}
      />

      {/* 登出 */}
      <Pressable
        onPress={onLogout}
        style={{
          marginTop: 12,
          padding: 14,
          borderRadius: 12,
          backgroundColor: "#b00020",
        }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>登出</Text>
      </Pressable>
    </View>
  );
}

function Row(props: {
  title: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
      }}
    >
      <Text style={{ fontSize: 16 }}>{props.title}</Text>
      <Switch value={props.value} onValueChange={props.onValueChange} />
    </View>
  );
}
