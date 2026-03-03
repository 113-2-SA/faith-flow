// app/settings/profile.tsx
import { updateProfile } from "firebase/auth";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { auth } from "../../lib/firebase";

export default function ProfileScreen() {
  const user = auth.currentUser;

  const [name, setName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.photoURL ?? "");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // （可選）若 B 有 GET /me，就在這裡載入 Postgres 的 bio / avatar / name
    // 先留空也沒關係，Week 2 Demo 只要能「改」＋「存」即可
  }, []);

  const onSave = async () => {
    try {
      setSaving(true);
      if (!auth.currentUser) throw new Error("Not signed in");

      // 1) 先更新 Firebase（讓 UI 立刻反映）
      await updateProfile(auth.currentUser, {
        displayName: name,
        photoURL: avatarUrl || undefined,
      });

      // 2)（可選）同步到後端（PostgreSQL）
      // const base = process.env.EXPO_PUBLIC_API_BASE_URL;
      // if (base) {
      //   const token = await auth.currentUser.getIdToken();
      //   await fetch(`${base}/me`, {
      //     method: "PATCH",
      //     headers: {
      //       "Content-Type": "application/json",
      //       Authorization: `Bearer ${token}`,
      //     },
      //     body: JSON.stringify({ name, avatarUrl, bio }),
      //   });
      // }

      Alert.alert("已儲存", "名字/頭像/簡介已更新");
    } catch (e: any) {
      Alert.alert("儲存失敗", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>個人資料</Text>

      <Text style={{ opacity: 0.7 }}>Email：{user?.email ?? "-"}</Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="名字"
        style={input}
      />
      <TextInput
        value={avatarUrl}
        onChangeText={setAvatarUrl}
        placeholder="頭像 URL（選填）"
        style={input}
      />
      <TextInput
        value={bio}
        onChangeText={setBio}
        placeholder="簡介（選填）"
        multiline
        style={[input, { height: 90, textAlignVertical: "top" }]}
      />

      <Pressable
        disabled={saving}
        onPress={onSave}
        style={{
          padding: 14,
          borderRadius: 12,
          backgroundColor: "#111",
          opacity: saving ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>
          {saving ? "儲存中..." : "儲存"}
        </Text>
      </Pressable>
    </View>
  );
}

const input = {
  borderWidth: 1,
  borderColor: "#ddd",
  borderRadius: 12,
  padding: 12,
} as const;
