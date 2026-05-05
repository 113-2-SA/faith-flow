import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from "../lib/api";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.92;
const HANDLE_HEIGHT = 72;
const COLLAPSED_OFFSET = PANEL_HEIGHT - HANDLE_HEIGHT;

interface DiaryEntry {
  diary_id: number;
  diary_date: string;
  diary_title: string;
  diary_content: string;
  bible_quote: string | null;
  tags: string[] | null;
}

type Mode = "list" | "create";

type Props = {
  open: boolean;
  date: string;            // YYYY-MM-DD，由外部傳入
  openInCreateMode: boolean; // true = 直接進新增，false = 先看列表
  onDragOpen: () => void;  // 拖曳開啟時通知 home 重設日期 & 模式
  onClose: () => void;
};

export function DiaryHandle({ open, date, openInCreateMode, onDragOpen, onClose }: Props) {
  const { user } = useAuth();

  // ── 動畫 ────────────────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(COLLAPSED_OFFSET)).current;
  const currentOffset = useRef(COLLAPSED_OFFSET);
  const expandedRef = useRef(false);

  const animateOpen = () => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    currentOffset.current = 0;
    expandedRef.current = true;
  };

  const animateClose = () => {
    Animated.spring(translateY, { toValue: COLLAPSED_OFFSET, useNativeDriver: true, bounciness: 4 }).start();
    currentOffset.current = COLLAPSED_OFFSET;
    expandedRef.current = false;
  };

  // 外部 open prop 改變時同步動畫
  useEffect(() => {
    if (open && !expandedRef.current) {
      animateOpen();
      // 根據 openInCreateMode 決定模式
      if (openInCreateMode) {
        setDiaryTitle("");
        setDiaryContent("");
        setMode("create");
      } else {
        setMode("list");
        fetchDiaries();
      }
    } else if (!open && expandedRef.current) {
      animateClose();
    }
  }, [open]);

  // 日期切換時重新撈（面板已開啟的情況）
  useEffect(() => {
    if (open && !openInCreateMode) {
      setMode("list");
      fetchDiaries();
    }
  }, [date]);

  // ── 日期格式化 ───────────────────────────────────────────────────
  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;

  const formatDate = (d: string) => {
    const [, m, day] = d.split("-");
    return `${parseInt(m)}月${parseInt(day)}日`;
  };

  // ── 列表資料 ─────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("list");
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const fetchDiaries = async () => {
    if (!user) return;
    setLoadingList(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/diary?date=${date}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setDiaries(data.data.items ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoadingList(false);
    }
  };

  // ── 新增表單 ─────────────────────────────────────────────────────
  const [diary_title, setDiaryTitle] = useState("");
  const [diary_content, setDiaryContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user || !diary_title.trim()) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/diary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          diary_date: date,
          diary_title: diary_title.trim(),
          diary_content: diary_content.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDiaryTitle("");
        setDiaryContent("");
        await fetchDiaries();
        setMode("list");
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  // ── 拖曳 ─────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        translateY.stopAnimation((val) => { currentOffset.current = val; });
      },
      onPanResponderMove: (_, g) => {
        const next = currentOffset.current + g.dy;
        translateY.setValue(Math.max(0, Math.min(COLLAPSED_OFFSET, next)));
      },
      onPanResponderRelease: (_, g) => {
        const projected = currentOffset.current + g.dy;
        const fastUp = g.vy < -0.5;
        const fastDown = g.vy > 0.5;
        if (fastUp || projected < COLLAPSED_OFFSET * 0.5) {
          animateOpen();
          onDragOpen(); // home.tsx 重設為「今天 + 新增模式」
        } else if (fastDown || projected >= COLLAPSED_OFFSET * 0.5) {
          animateClose();
          onClose();
        }
      },
    })
  ).current;

  // 關閉（動畫 + 通知 home）
  const handleClose = () => {
    animateClose();
    onClose();
  };

  // ── 渲染 ─────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.panel, { transform: [{ translateY }] }]}>

      {/* ── 視覺把手區（純顯示，不處理事件） ── */}
      <View style={styles.handleArea} pointerEvents="none">
        <View style={styles.dragBar} />
        {open ? (
          <View style={styles.handleRow}>
            <View>
              <Text selectable={false} style={styles.handleDate}>
                {formatDate(date)}
              </Text>
              <Text selectable={false} style={styles.handleHint}>
                {mode === "create" ? "記錄今日日記" : `${diaries.length} 篇日記`}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.handleRowCollapsed}>
            <Text selectable={false} style={styles.handleHintBold}>
              向上拉動記錄今日日記
            </Text>
          </View>
        )}
      </View>

      {/* ── 主體內容 ── */}
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {mode === "list" ? (
          <>
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={open}
              showsVerticalScrollIndicator={false}
            >
              {loadingList ? (
                <ActivityIndicator size="large" color="rgba(0,0,0,0.3)" style={{ marginTop: 40 }} />
              ) : diaries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text selectable={false} style={styles.emptyIcon}>📝</Text>
                  <Text selectable={false} style={styles.emptyText}>
                    {formatDate(date)} 還沒有日記
                  </Text>
                </View>
              ) : (
                diaries.map((item) => (
                  <View key={item.diary_id} style={styles.diaryCard}>
                    <Text selectable={false} style={styles.diaryTitle}>{item.diary_title}</Text>
                    {!!item.diary_content && (
                      <Text selectable={false} style={styles.diaryPreview} numberOfLines={2}>
                        {item.diary_content}
                      </Text>
                    )}
                    {!!item.bible_quote && (
                      <Text selectable={false} style={styles.bibleQuote} numberOfLines={1}>
                        📖 {item.bible_quote}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.addButton} onPress={() => setMode("create")} disabled={!open}>
              <Text selectable={false} style={styles.addButtonText}>＋ 新增日記</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={styles.backRow} onPress={() => setMode("list")}>
              <Text selectable={false} style={styles.backText}>‹ 返回</Text>
            </Pressable>
            <TextInput
              style={styles.titleInput}
              placeholder="日記標題"
              placeholderTextColor="rgba(0,0,0,0.28)"
              value={diary_title}
              onChangeText={setDiaryTitle}
              maxLength={80}
              returnKeyType="next"
              editable={open}
            />
            <View style={styles.divider} />
            <ScrollView
              style={styles.contentScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              scrollEnabled={open}
            >
              <TextInput
                style={styles.contentInput}
                placeholder="這天經歷了哪些受到幫助的時刻？"
                placeholderTextColor="rgba(0,0,0,0.28)"
                value={diary_content}
                onChangeText={setDiaryContent}
                multiline
                textAlignVertical="top"
                editable={open}
              />
            </ScrollView>
            <View style={styles.submitRow}>
              <Pressable
                onPress={handleSubmit}
                disabled={saving || !diary_title.trim()}
                style={[styles.submitBtn, (saving || !diary_title.trim()) && styles.submitBtnDisabled]}
              >
                <Text selectable={false} style={styles.submitBtnText}>{saving ? "…" : "✓"}</Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      {/* ── 拖曳捕捉層（handle 區域，zIndex 低於關閉按鈕） ── */}
      <View style={styles.gestureOverlay} {...panResponder.panHandlers} />

      {/* ── 關閉按鈕（最高層，保證可點擊） ── */}
      {open && (
        <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={16}>
          <Text selectable={false} style={styles.closeBtnText}>✕</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_HEIGHT,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 12,
  },

  // 透明拖曳層，蓋住 handle 區
  gestureOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HANDLE_HEIGHT,
    zIndex: 10,
  },
  // 關閉按鈕，zIndex 高於拖曳層
  closeBtn: {
    position: "absolute",
    top: 18,
    right: 20,
    zIndex: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 14,
    color: "rgba(0,0,0,0.5)",
  },

  handleArea: {
    height: HANDLE_HEIGHT,
    alignItems: "center",
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.13)",
    marginBottom: 10,
  },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  handleRowCollapsed: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  handleDate: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(0,0,0,0.78)",
    lineHeight: 20,
    fontFamily: "NotoSerifTC_400Regular",
  },
  handleHintBold: {
    fontSize: 15,
    fontWeight: "700",
    color: "rgba(0,0,0,0.70)",
    fontFamily: "NotoSerifTC_400Regular",
  },
  handleHint: {
    fontSize: 12,
    color: "rgba(0,0,0,0.40)",
    marginTop: 1,
    fontFamily: "NotoSerifTC_400Regular",
  },

  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  // 列表
  listScroll: { flex: 1 },
  listContent: { paddingBottom: 16 },
  emptyState: { marginTop: 48, alignItems: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: "rgba(0,0,0,0.45)", fontFamily: "NotoSerifTC_400Regular" },
  diaryCard: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  diaryTitle: { fontSize: 16, fontWeight: "700", color: "rgba(0,0,0,0.82)", marginBottom: 6, fontFamily: "NotoSerifTC_400Regular" },
  diaryPreview: { fontSize: 14, color: "rgba(0,0,0,0.52)", lineHeight: 20, marginBottom: 4, fontFamily: "NotoSerifTC_400Regular" },
  bibleQuote: { fontSize: 12, color: "rgba(70,130,180,0.85)", fontStyle: "italic", marginTop: 4, fontFamily: "NotoSerifTC_400Regular" },
  addButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
  },
  addButtonText: { fontSize: 15, fontWeight: "600", color: "rgba(0,0,0,0.6)", fontFamily: "NotoSerifTC_400Regular" },

  // 新增表單
  backRow: { paddingVertical: 8, marginBottom: 4 },
  backText: { fontSize: 15, color: "rgba(0,0,0,0.45)", fontWeight: "500", fontFamily: "NotoSerifTC_400Regular" },
  titleInput: { fontSize: 26, fontWeight: "700", color: "rgba(0,0,0,0.85)", paddingVertical: 8, fontFamily: "NotoSerifTC_400Regular" },
  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.08)", marginVertical: 10 },
  contentScroll: { flex: 1 },
  contentInput: { fontSize: 16, color: "rgba(0,0,0,0.78)", lineHeight: 26, minHeight: 200, fontFamily: "NotoSerifTC_400Regular" },
  submitRow: { alignItems: "flex-end", paddingTop: 12 },
  submitBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(30,30,30,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.35 },
  submitBtnText: { color: "white", fontSize: 22, fontWeight: "700" },
});
