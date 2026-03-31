import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── 共用日記 Modal ─────────────────────────────────────────────────────────
export function DiaryModal({
  visible,
  date,
  onClose,
}: {
  visible: boolean;
  date: string | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (visible) {
      setTitle("");
      setContent("");
    }
  }, [visible, date]);

  const handleSubmit = () => {
    console.log("📝 儲存日記", { date, title, content });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>

          <Text style={styles.modalDate}>{date?.replace(/-/g, "/")}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <TextInput
              style={styles.modalTitleInput}
              placeholder="日記標題"
              placeholderTextColor="rgba(0,0,0,0.25)"
              value={title}
              onChangeText={setTitle}
            />
            <View style={styles.modalDivider} />
            <TextInput
              style={styles.modalContentInput}
              placeholder="這天經歷了哪些受到幫助的時刻？"
              placeholderTextColor="rgba(0,0,0,0.25)"
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>

          <Pressable style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitBtnText}>✓</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── 底部拖曳把手 ───────────────────────────────────────────────────────────
export function DiaryHandle() {
  const [modalVisible, setModalVisible] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const today = todayString();

  // 記錄拖曳起始 Y，用來計算位移
  const startY = useRef(0);
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      // 立即接管觸控（不需長按）
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,

      onPanResponderGrant: (e) => {
        startY.current = e.nativeEvent.pageY;
        isDragging.current = true;
      },

      onPanResponderMove: (_, g) => {
        // 只允許往上拖（dy < 0）
        if (g.dy < 0) {
          translateY.setValue(g.dy);
        }
      },

      onPanResponderRelease: (_, g) => {
        isDragging.current = false;
        // 上拖超過螢幕高度 25% 就開啟日記
        if (g.dy < -(SCREEN_HEIGHT * 0.25)) {
          Animated.timing(translateY, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }).start(() => setModalVisible(true));
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },

      onPanResponderTerminate: () => {
        isDragging.current = false;
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <>
      <Animated.View
        style={[styles.handle, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.dragBar} />
        <Text style={styles.handleDate}>{today.replace(/-/g, "/")}</Text>
        <Text style={styles.handleHint}>向上拉動撰寫今日日記</Text>
      </Animated.View>

      <DiaryModal
        visible={modalVisible}
        date={today}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    height: "90%",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    right: 20,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: 18,
    color: "rgba(0,0,0,0.45)",
  },
  modalDate: {
    fontSize: 15,
    color: "rgba(0,0,0,0.45)",
    textAlign: "center",
    marginBottom: 20,
    letterSpacing: 1,
  },
  modalTitleInput: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111",
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 4,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginBottom: 16,
  },
  modalContentInput: {
    fontSize: 16,
    color: "#222",
    lineHeight: 26,
    minHeight: 200,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  submitBtn: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
  },

  // ── Drag Handle ────────────────────────────────────────────────────────────
  handle: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.18)",
    marginBottom: 14,
  },
  handleDate: {
    fontSize: 20,
    fontWeight: "600",
    color: "#222",
    marginBottom: 4,
  },
  handleHint: {
    fontSize: 13,
    color: "rgba(0,0,0,0.45)",
  },
});
