import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { GlassCard } from "../../components/GlassCard";
import { useIsAdmin } from "../../hooks/useIsAdmin";

type WishSite = {
  docId: string;
  name: string;
  latitude: number;
  longitude: number;
  photoUrls: string[];
  submittedBy: string;
  submittedByEmail: string;
  status: string;
  createdAt: { toDate?: () => Date } | null;
};

export default function AdminPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [wishes, setWishes] = useState<WishSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedWish, setSelectedWish] = useState<WishSite | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const fetchWishes = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "wish_holy_sites"),
        where("status", "==", "pending"),
        orderBy("createdAt", "asc")
      );
      const snap = await getDocs(q);
      const data: WishSite[] = [];
      snap.forEach((d) => {
        const raw = d.data();
        data.push({
          docId: d.id,
          name: raw.name ?? "",
          latitude: raw.latitude ?? 0,
          longitude: raw.longitude ?? 0,
          photoUrls: raw.photoUrls ?? [],
          submittedBy: raw.submittedBy ?? "",
          submittedByEmail: raw.submittedByEmail ?? "",
          status: raw.status ?? "pending",
          createdAt: raw.createdAt ?? null,
        });
      });
      setWishes(data);
    } catch (e) {
      console.error(e);
      Alert.alert("載入失敗", "無法取得待審核資料");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchWishes(); }, [fetchWishes]));

  useEffect(() => {
    if (!loading && !isAdmin) {
      Alert.alert("無存取權限", "此頁面僅限管理者使用", [
        { text: "確定", onPress: () => router.replace("/home" as any) },
      ]);
    }
  }, [isAdmin, loading, router]);

  const handleApprove = async (wish: WishSite) => {
    Alert.alert(
      "確認新增聖地",
      `確定要將「${wish.name}」新增到地圖上嗎？\n座標：${wish.latitude}, ${wish.longitude}`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "確認新增",
          onPress: async () => {
            setProcessingId(wish.docId);
            try {
              await addDoc(collection(db, "basilicas"), {
                name: wish.name,
                nameEn: wish.name,
                location: "",
                coordinates: [wish.latitude, wish.longitude],
                type: "chapel",
                founded: new Date().getFullYear(),
                dedication: "",
                style: "",
                significance: "",
                description: "",
                viewerUrl: "",
                panoramaId: null,
                videoUrl: null,
                sourcePhotoUrls: wish.photoUrls,
                approvedAt: new Date().toISOString(),
                approvedBy: auth.currentUser?.uid ?? "",
              });
              await updateDoc(doc(db, "wish_holy_sites", wish.docId), {
                status: "approved",
              });
              setWishes((prev) => prev.filter((w) => w.docId !== wish.docId));
              if (selectedWish?.docId === wish.docId) setSelectedWish(null);
              Alert.alert("新增成功", `「${wish.name}」已加入地圖！`);
            } catch (e) {
              console.error(e);
              Alert.alert("新增失敗", "操作過程發生錯誤，請稍後再試。");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = async (wish: WishSite) => {
    Alert.alert(
      "確認駁回",
      `確定要駁回「${wish.name}」的申請嗎？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "駁回",
          style: "destructive",
          onPress: async () => {
            setProcessingId(wish.docId);
            try {
              await updateDoc(doc(db, "wish_holy_sites", wish.docId), {
                status: "rejected",
              });
              setWishes((prev) => prev.filter((w) => w.docId !== wish.docId));
              if (selectedWish?.docId === wish.docId) setSelectedWish(null);
            } catch (e) {
              console.error(e);
              Alert.alert("操作失敗", "請稍後再試。");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (ts: WishSite["createdAt"]) => {
    if (!ts) return "";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts as any);
      return d.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  if (!isAdmin) return null;

  if (selectedWish) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.detailHeader}>
          <Pressable onPress={() => setSelectedWish(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 返回列表</Text>
          </Pressable>
          <Text style={styles.detailTitle}>許願聖地審核</Text>
        </View>

        <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.infoCard} glassColor="rgba(20,25,45,0.90)" blurTint="dark">
            <Text style={styles.siteName}>{selectedWish.name}</Text>
            <Text style={styles.metaLine}>📍 緯度 {selectedWish.latitude}　經度 {selectedWish.longitude}</Text>
            <Text style={styles.metaLine}>👤 {selectedWish.submittedByEmail || selectedWish.submittedBy}</Text>
            {selectedWish.createdAt && (
              <Text style={styles.metaLine}>🗓 {formatDate(selectedWish.createdAt)}</Text>
            )}
          </GlassCard>

          <Text style={styles.sectionLabel}>聖地照片（{selectedWish.photoUrls.length} 張）</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
            {selectedWish.photoUrls.map((url, i) => (
              <Pressable key={i} onPress={() => setSelectedPhotoIndex(i)}>
                <Image
                  source={{ uri: url }}
                  style={[styles.thumbImg, selectedPhotoIndex === i && styles.thumbImgActive]}
                />
              </Pressable>
            ))}
          </ScrollView>

          {selectedWish.photoUrls[selectedPhotoIndex] && (
            <Image
              source={{ uri: selectedWish.photoUrls[selectedPhotoIndex] }}
              style={styles.mainPhoto}
              resizeMode="cover"
            />
          )}

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionBtn, styles.rejectBtn, processingId === selectedWish.docId && styles.btnDisabled]}
              onPress={() => handleReject(selectedWish)}
              disabled={processingId === selectedWish.docId}
            >
              {processingId === selectedWish.docId
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.actionBtnText}>✕ 駁回</Text>}
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.approveBtn, processingId === selectedWish.docId && styles.btnDisabled]}
              onPress={() => handleApprove(selectedWish)}
              disabled={processingId === selectedWish.docId}
            >
              {processingId === selectedWish.docId
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.actionBtnText}>✓ 新增聖地確認</Text>}
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.pageHeader}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </Pressable>
        <Text style={styles.pageTitle}>管理者頁面</Text>
      </View>

      <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.listSectionTitle}>
          待審核許願聖地　{wishes.length > 0 ? `（${wishes.length} 筆）` : ""}
        </Text>

        {wishes.length === 0 ? (
          <GlassCard style={styles.emptyCard} glassColor="rgba(20,25,45,0.80)" blurTint="dark">
            <Text style={styles.emptyText}>目前沒有待審核的許願聖地 ✨</Text>
          </GlassCard>
        ) : (
          wishes.map((wish) => (
            <Pressable key={wish.docId} onPress={() => { setSelectedWish(wish); setSelectedPhotoIndex(0); }}>
              <GlassCard style={styles.wishCard} glassColor="rgba(20,25,45,0.85)" blurTint="dark">
                <View style={styles.wishCardContent}>
                  {wish.photoUrls[0] ? (
                    <Image source={{ uri: wish.photoUrls[0] }} style={styles.wishCardThumb} />
                  ) : (
                    <View style={[styles.wishCardThumb, styles.wishCardThumbEmpty]}>
                      <Text style={{ fontSize: 24 }}>🏛</Text>
                    </View>
                  )}
                  <View style={styles.wishCardInfo}>
                    <Text style={styles.wishCardName}>{wish.name}</Text>
                    <Text style={styles.wishCardMeta}>
                      📍 {wish.latitude.toFixed(4)}, {wish.longitude.toFixed(4)}
                    </Text>
                    <Text style={styles.wishCardMeta}>
                      🖼 {wish.photoUrls.length} 張照片
                    </Text>
                    <Text style={styles.wishCardDate}>{formatDate(wish.createdAt)}</Text>
                  </View>
                  <Text style={styles.wishCardArrow}>›</Text>
                </View>
              </GlassCard>
            </Pressable>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const WIN_W = Dimensions.get("window").width;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1124" },
  centered: { flex: 1, backgroundColor: "#0d1124", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "rgba(255,255,255,0.6)", marginTop: 12, fontSize: 14 },

  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(13,17,36,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  pageTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    marginRight: 60,
  },
  backBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  backBtnText: { fontSize: 14, color: "rgba(102,126,234,0.95)", fontWeight: "600" },

  listScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  listSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.50)",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },

  emptyCard: { marginTop: 8 },
  emptyText: { fontSize: 14, color: "rgba(255,255,255,0.55)", textAlign: "center", paddingVertical: 8 },

  wishCard: { marginBottom: 10 },
  wishCardContent: { flexDirection: "row", alignItems: "center" },
  wishCardThumb: { width: 64, height: 64, borderRadius: 8, marginRight: 12 },
  wishCardThumbEmpty: { backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  wishCardInfo: { flex: 1 },
  wishCardName: { fontSize: 15, fontWeight: "700", color: "rgba(255,255,255,0.95)", marginBottom: 3 },
  wishCardMeta: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 2 },
  wishCardDate: { fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 },
  wishCardArrow: { fontSize: 22, color: "rgba(255,255,255,0.30)", marginLeft: 8 },

  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(13,17,36,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  detailTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    marginRight: 80,
  },
  detailScroll: { flex: 1, paddingHorizontal: 16 },

  infoCard: { marginTop: 16, marginBottom: 16 },
  siteName: { fontSize: 20, fontWeight: "700", color: "rgba(255,255,255,0.95)", marginBottom: 10 },
  metaLine: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 5 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.50)",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  thumbRow: { flexDirection: "row", marginBottom: 12 },
  thumbImg: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbImgActive: {
    borderColor: "rgba(102,126,234,0.95)",
  },
  mainPhoto: {
    width: WIN_W - 32,
    height: (WIN_W - 32) * 0.65,
    borderRadius: 14,
    marginBottom: 24,
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  approveBtn: { backgroundColor: "rgba(52,168,83,0.90)" },
  rejectBtn: { backgroundColor: "rgba(200,60,60,0.85)" },
  btnDisabled: { opacity: 0.50 },
  actionBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
