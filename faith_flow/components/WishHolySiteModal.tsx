import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

type Props = {
  onClose: () => void;
};

export function WishHolySiteModal({ onClose }: Props) {
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setLatitude("");
    setLongitude("");
    setReason("");
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert("請填寫聖地名稱"); return; }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert("請輸入有效的緯度（-90 到 90）"); return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      Alert.alert("請輸入有效的經度（-180 到 180）"); return;
    }
    if (!reason.trim() || reason.trim().length < 10) {
      Alert.alert("請填寫加入理由", "至少請說明 10 個字以上的原因。"); return;
    }

    const user = auth.currentUser;
    if (!user) { Alert.alert("請先登入"); return; }

    setSubmitting(true);
    try {
      await Promise.race([
        addDoc(collection(db, "wish_holy_sites"), {
          name: name.trim(),
          latitude: lat,
          longitude: lng,
          reason: reason.trim(),
          submittedBy: user.uid,
          submittedByEmail: user.email ?? "",
          status: "pending",
          createdAt: serverTimestamp(),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(Object.assign(new Error("連線逾時，請稍後再試。"), { code: "timeout" })),
            12000
          )
        ),
      ]);

      // 先關閉 Modal（unmount），再彈通知
      onClose();
      Alert.alert("送出成功", "您的許願聖地已送出審查，感謝您的貢獻！");
    } catch (e: any) {
      console.error("[WishModal] 送出失敗:", e);
      const code: string = e?.code ?? "";
      let msg = e?.message ?? "請確認網路連線後再試。";
      if (code.includes("permission-denied")) {
        msg = "Firestore 規則尚未允許寫入，請聯絡管理員設定規則。";
      }
      Alert.alert("送出失敗", msg);
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={true} animationType="slide" transparent statusBarTranslucent>
      {/* 半透明背景遮罩 */}
      <View style={styles.backdrop} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* 卡片容器：使用純 View 避免 GlassCard overflow:hidden 裁切點擊區域 */}
        <View style={styles.card}>
          {/* 標題列 */}
          <View style={styles.header}>
            <Text style={styles.title}>✨ 許願新增聖地</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn} disabled={submitting}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* 表單內容 */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
          >
            <Text style={styles.label}>聖地名稱 *</Text>
            <TextInput
              style={[styles.input, Platform.OS === "web" ? ({ outline: "none" } as any) : null]}
              placeholder="請輸入聖地或教堂名稱"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={name}
              onChangeText={setName}
              editable={!submitting}
            />

            <Text style={styles.label}>聖地位置座標 *</Text>
            <View style={styles.coordRow}>
              <View style={styles.coordField}>
                <Text style={styles.coordLabel}>緯度（Latitude）</Text>
                <TextInput
                  style={[styles.input, Platform.OS === "web" ? ({ outline: "none" } as any) : null]}
                  placeholder="例：25.0478"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={latitude}
                  onChangeText={setLatitude}
                  keyboardType="numeric"
                  editable={!submitting}
                />
              </View>
              <View style={styles.coordField}>
                <Text style={styles.coordLabel}>經度（Longitude）</Text>
                <TextInput
                  style={[styles.input, Platform.OS === "web" ? ({ outline: "none" } as any) : null]}
                  placeholder="例：121.5319"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={longitude}
                  onChangeText={setLongitude}
                  keyboardType="numeric"
                  editable={!submitting}
                />
              </View>
            </View>

            <Text style={styles.label}>
              加入理由 *{"  "}
              <Text style={styles.labelNote}>（至少 10 字）</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.reasonInput,
                Platform.OS === "web" ? ({ outline: "none", resize: "none" } as any) : null,
              ]}
              placeholder="請說明此聖地的宗教或歷史意義，以及為何應加入地圖..."
              placeholderTextColor="rgba(255,255,255,0.30)"
              value={reason}
              onChangeText={setReason}
              multiline
              textAlignVertical="top"
              maxLength={500}
              editable={!submitting}
            />
            <Text style={styles.charCount}>{reason.length} / 500</Text>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                submitting && styles.submitBtnDisabled,
                pressed && !submitting && styles.submitBtnPressed,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <View style={styles.submitLoading}>
                  <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>送出中...</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>儲存並送出審查</Text>
              )}
            </Pressable>

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "rgba(14,20,42,0.97)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "90%",
    // 故意不加 overflow:hidden，避免裁切 ScrollView 內容的點擊區域
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
  },
  closeBtn: { padding: 6 },
  closeBtnText: { fontSize: 18, color: "rgba(255,255,255,0.50)" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.70)",
    marginBottom: 6,
    marginTop: 16,
  },
  labelNote: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.40)",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  coordRow: { flexDirection: "row", gap: 10 },
  coordField: { flex: 1 },
  coordLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 4,
  },
  reasonInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    textAlign: "right",
    marginTop: 4,
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: "rgba(102,126,234,0.90)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnPressed: {
    backgroundColor: "rgba(82,106,214,1)",
  },
  submitBtnDisabled: { opacity: 0.50 },
  submitLoading: { flexDirection: "row", alignItems: "center" },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
