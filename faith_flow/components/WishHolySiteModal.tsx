import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db, storage } from "../lib/firebase";
import { GlassCard } from "./GlassCard";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function WishHolySiteModal({ visible, onClose }: Props) {
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setLatitude("");
    setLongitude("");
    setPhotos([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("需要相片存取權限", "請在設定中允許存取相片庫。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...newUris].slice(0, 10));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhoto = async (uri: string, path: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("請填寫聖地名稱");
      return;
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert("請輸入有效的緯度（-90 到 90）");
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      Alert.alert("請輸入有效的經度（-180 到 180）");
      return;
    }
    if (photos.length < 3) {
      Alert.alert("請至少上傳 3 張聖地照片");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("請先登入");
      return;
    }

    setSubmitting(true);
    try {
      const uid = user.uid;
      const timestamp = Date.now();
      const photoUrls: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        const path = `wish_holy_sites/${uid}/${timestamp}_${i}`;
        const url = await uploadPhoto(photos[i], path);
        photoUrls.push(url);
      }

      await addDoc(collection(db, "wish_holy_sites"), {
        name: name.trim(),
        latitude: lat,
        longitude: lng,
        photoUrls,
        submittedBy: uid,
        submittedByEmail: user.email ?? "",
        status: "pending",
        createdAt: serverTimestamp(),
      });

      Alert.alert("送出成功", "您的許願聖地已送出審查，感謝您的貢獻！", [
        { text: "確定", onPress: handleClose },
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert("送出失敗", "上傳過程發生錯誤，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <GlassCard style={styles.card} glassColor="rgba(10,15,30,0.92)" blurTint="dark">
          <View style={styles.header}>
            <Text style={styles.title}>✨ 許願新增聖地</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn} disabled={submitting}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
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
                  style={[styles.input, styles.coordInput, Platform.OS === "web" ? ({ outline: "none" } as any) : null]}
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
                  style={[styles.input, styles.coordInput, Platform.OS === "web" ? ({ outline: "none" } as any) : null]}
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
              聖地照片 *{" "}
              <Text style={styles.labelNote}>（至少 3 張，最多 10 張）</Text>
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.thumbImg} />
                  {!submitting && (
                    <Pressable style={styles.removePhoto} onPress={() => removePhoto(i)}>
                      <Text style={styles.removePhotoText}>✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              {photos.length < 10 && (
                <Pressable style={styles.addPhotoBtn} onPress={pickPhoto} disabled={submitting}>
                  <Text style={styles.addPhotoBtnIcon}>+</Text>
                  <Text style={styles.addPhotoBtnText}>新增照片</Text>
                </Pressable>
              )}
            </ScrollView>

            <Text style={styles.photoCount}>
              已選 {photos.length} 張{photos.length < 3 ? `（還需 ${3 - photos.length} 張）` : ""}
            </Text>

            <Pressable
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>儲存並送出審查</Text>
              )}
            </Pressable>

            <View style={{ height: 24 }} />
          </ScrollView>
        </GlassCard>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  card: {
    borderRadius: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "90%",
    paddingBottom: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.50)",
  },
  form: {
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.70)",
    marginBottom: 6,
    marginTop: 14,
  },
  labelNote: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.40)",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  coordRow: {
    flexDirection: "row",
    gap: 10,
  },
  coordField: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 4,
  },
  coordInput: {
    marginBottom: 0,
  },
  photoRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  photoThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
    marginRight: 8,
    overflow: "hidden",
    position: "relative",
  },
  thumbImg: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
  removePhoto: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.60)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
  },
  addPhotoBtn: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  addPhotoBtnIcon: {
    fontSize: 24,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 28,
  },
  addPhotoBtnText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
  },
  photoCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 18,
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: "rgba(102,126,234,0.90)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
