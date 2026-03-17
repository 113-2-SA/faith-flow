// app/settings/index.tsx
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth } from "../../lib/firebase";
import { loadPrefs, Preferences, savePrefs } from "../../lib/prefs";
import { GlassCard } from "../../components/GlassCard";
import { VideoBackground } from "../../components/VideoBackground";
import { API_BASE_URL } from "../../lib/api";

export default function SettingsScreen() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);

  // 個人資料
  const [userName, setUserName] = useState("");
  const [userPic, setUserPic] = useState("");
  const [userBio, setUserBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrefs().then(setPrefs);
  }, []);

  // 每次回到設定頁時，從後端載入最新個人資料
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        const u = auth.currentUser;
        if (!u) return;

        try {
          const token = await u.getIdToken();
          const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!cancelled && data.ok) {
            setUserName(data.data.user_name ?? "");
            setUserPic(data.data.user_pic ?? "");
            setUserBio(data.data.profile ?? "");

          }
        } catch {
          // ignore
        }
      })();

      return () => { cancelled = true; };
    }, [])
  );

  const saveProfile = async () => {
    const u = auth.currentUser;
    if (!u) return;
    setSaving(true);
    try {
      const token = await u.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userName: userName.trim(),
          usePic: userPic.trim() || null,
          profile: userBio.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert("已儲存", "個人資料已更新");
      } else {
        Alert.alert("錯誤", data.error ?? "儲存失敗");
      }
    } catch {
      Alert.alert("錯誤", "網路連線失敗");
    } finally {
      setSaving(false);
    }
  };

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
  };

  const onLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/auth/login");
    } catch (e) {
      console.error("signOut failed:", e);
    }
  };

  return (
    <VideoBackground source={require("../../assets/backgrounds/main.mp4")}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <GlassCard style={styles.card}>
            <Text style={styles.title}>設定</Text>

            {/* ── 個人資料區 ── */}
            <Text style={styles.sectionLabel}>個人資料</Text>

            {/* 頭像預覽 */}
            <View style={styles.avatarRow}>
              {userPic ? (
                <Image source={{ uri: userPic }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {userName?.[0] ?? "?"}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.fieldLabel}>使用者名稱</Text>
            <TextInput
              style={styles.input}
              value={userName}
              onChangeText={setUserName}
              placeholder="輸入名稱"
              placeholderTextColor="rgba(255,255,255,0.35)"
              maxLength={30}
            />

            <Text style={styles.fieldLabel}>頭像網址（URL）</Text>
            <TextInput
              style={styles.input}
              value={userPic}
              onChangeText={setUserPic}
              placeholder="https://..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.fieldLabel}>自我介紹</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={userBio}
              onChangeText={setUserBio}
              placeholder="介紹一下自己..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              maxLength={200}
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.saveBtnText}>儲存個人資料</Text>
              }
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* ── 通知設定 ── */}
            <Text style={styles.sectionLabel}>通知設定</Text>
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

            <View style={styles.divider} />

            {/* 登出 */}
            <Pressable onPress={onLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>登出</Text>
            </Pressable>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </VideoBackground>
  );
}

function Row(props: {
  title: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{props.title}</Text>
      <Switch value={props.value} onValueChange={props.onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  card: { padding: 20 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  avatarRow: {
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
  },
  fieldLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "rgba(255,255,255,0.95)",
  },
  inputMulti: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: "rgba(0,122,255,0.7)",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  saveBtnDisabled: { backgroundColor: "rgba(255,255,255,0.15)" },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rowText: { fontSize: 15, color: "rgba(255,255,255,0.9)" },
  logoutBtn: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  logoutText: { color: "white", textAlign: "center", fontSize: 15 },
});
