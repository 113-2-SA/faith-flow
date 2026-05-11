import { useState, useEffect, useRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  Image,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  StatusBar,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/authcontext';
import { API_BASE_URL } from '../../../lib/api';
import { VideoBackground } from '../../../components/VideoBackground';
import { GlassCard } from '../../../components/GlassCard';
import { PostCard, CommentCard, PostData, CommentData, PostDiaryCard, PostSummaryCard } from '../../../components/PostCard';
import { HEADER_CONTENT_HEIGHT } from '../../../components/AppShell';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Tag { tag_name: string; }

// Local Post type retains Tag[] for the raw API response; converted to string[]
// when passed to PostCard which expects PostData (tags: string[]).
interface Post extends Omit<PostData, 'tags'> {
  tags: Tag[];
}

type Comment = CommentData;


// ─── Main Component ───────────────────────────────────────────────────────────

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; username: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageModalUri, setImageModalUri] = useState<string | null>(null);
  const [diaryModalCard, setDiaryModalCard] = useState<PostDiaryCard | null>(null);
  const [summaryModalCard, setSummaryModalCard] = useState<PostSummaryCard | null>(null);
  const inputRef = useRef<TextInput>(null);
  const [reportMenuVisible, setReportMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: number } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [sharing, setSharing] = useState(false);

  const postId = parseInt(id ?? '0');

  // ─── Fetch ────────────────────────────────────────────────────────────────

  async function fetchPost() {
    if (!currentUser) return;
    const token = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/post/${postId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.ok) setPost(data.data);
  }

  async function fetchComments() {
    if (!currentUser) return;
    const token = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/comments/post/${postId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.ok) {
      setComments(data.data ?? []);
      setCommentError(null);
    } else {
      console.error('[fetchComments] 錯誤:', data.error, res.status);
      setCommentError(data.error ?? '無法載入留言');
    }
  }

  useEffect(() => {
    if (!postId) return;
    Promise.all([fetchPost(), fetchComments()]).finally(() => setLoading(false));
  }, [postId, currentUser]);

  // ─── Like Post ────────────────────────────────────────────────────────────

  async function toggleLike() {
    if (!currentUser || !post) return;
    const prev = { is_liked: post.is_liked, like_count: post.like_count ?? 0 };
    setPost((p) => p ? {
      ...p,
      is_liked: !p.is_liked,
      like_count: (p.like_count ?? 0) + (p.is_liked ? -1 : 1),
    } : p);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/like/${postId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setPost((p) => p ? { ...p, is_liked: data.data.isLiked, like_count: data.data.likeCount } : p);
      } else {
        setPost((p) => p ? { ...p, ...prev } : p);
      }
    } catch {
      setPost((p) => p ? { ...p, ...prev } : p);
    }
  }

  // ─── Submit Comment ───────────────────────────────────────────────────────

  async function submitComment() {
    const text = commentText.trim();
    if (!text || !currentUser) return;
    setSubmitting(true);
    try {
      const token = await currentUser.getIdToken();

      if (editingCommentId) {
        const res = await fetch(`${API_BASE_URL}/api/comments/${editingCommentId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment_content: text }),
        });
        const data = await res.json();
        if (data.ok) {
          setCommentText('');
          setEditingCommentId(null);
          await fetchComments();
        } else {
          Alert.alert('錯誤', data.error ?? '編輯失敗');
        }
      } else {
        const body: Record<string, unknown> = { post_id: postId, comment_content: text };
        if (replyTo) body.parent_comment_id = replyTo.id;
        const res = await fetch(`${API_BASE_URL}/api/comments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.ok) {
          setCommentText('');
          setReplyTo(null);
          await fetchComments();
          setPost((p) => p ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p);
        } else {
          Alert.alert('錯誤', data.error ?? '留言失敗');
        }
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePost() {
    if (!currentUser || !post) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/post/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        router.replace('/community');
      } else {
        Alert.alert('錯誤', data.error ?? '刪除失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    }
  }

  function openReport(type: 'post' | 'comment', id: number) {
    setReportTarget({ type, id });
    setReportMenuVisible(true);
  }

  async function submitReport() {
    if (!reportReason || !currentUser || !reportTarget) return;
    setReportSubmitting(true);
    try {
      const token = await currentUser.getIdToken();
      const url = reportTarget.type === 'post'
        ? `${API_BASE_URL}/api/post/${reportTarget.id}/report`
        : `${API_BASE_URL}/api/comments/${reportTarget.id}/report`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason }),
      });
      const data = await res.json();
      if (data.ok) {
        setReportModalVisible(false);
        setReportReason('');
        setReportTarget(null);
        Alert.alert('已送出', '感謝您的檢舉，我們將盡快審查。');
      } else {
        Alert.alert('錯誤', data.error ?? '檢舉失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setReportSubmitting(false);
    }
  }

  function startEditComment(comment: Comment) {
    setEditingCommentId(comment.comment_id);
    setCommentText(comment.comment_content);
    setReplyTo(null);
    inputRef.current?.focus();
  }

  async function deleteComment(commentId: number) {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setComments(prev => prev
          .filter(c => c.comment_id !== commentId)
          .map(c => ({ ...c, replies: c.replies?.filter(r => r.comment_id !== commentId) }))
        );
        setPost(p => p ? { ...p, comment_count: Math.max(0, (p.comment_count ?? 0) - 1) } : p);
      } else {
        Alert.alert('錯誤', data.error ?? '刪除失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    }
  }

  async function submitShare() {
    if (!post || !currentUser) return;
    setSharing(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/share/${postId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_caption: shareCaption.trim(), visibility: 'public' }),
      });
      const data = await res.json();
      if (data.ok ?? data.success) {
        setShareModalVisible(false);
        setShareCaption('');
        Alert.alert('成功', '已轉發貼文');
      } else {
        Alert.alert('錯誤', data.error ?? '轉發失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setSharing(false);
    }
  }

  function startReply(comment: Comment) {
    setReplyTo({ id: comment.comment_id, username: comment.username ?? '匿名' });
    inputRef.current?.focus();
  }

  async function toggleCommentLike(commentId: number, isLiked: boolean) {
    if (!currentUser) return;
    const update = (c: Comment) =>
      c.comment_id === commentId
        ? { ...c, is_liked: !isLiked, like_count: (c.like_count ?? 0) + (isLiked ? -1 : 1) }
        : { ...c, replies: c.replies?.map(r => r.comment_id === commentId ? { ...r, is_liked: !isLiked, like_count: (r.like_count ?? 0) + (isLiked ? -1 : 1) } : r) };
    setComments(prev => prev.map(update));
    try {
      const token = await currentUser.getIdToken();
      await fetch(`${API_BASE_URL}/api/clike/${commentId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      const revert = (c: Comment) =>
        c.comment_id === commentId
          ? { ...c, is_liked: isLiked, like_count: (c.like_count ?? 0) + (isLiked ? 1 : -1) }
          : { ...c, replies: c.replies?.map(r => r.comment_id === commentId ? { ...r, is_liked: isLiked, like_count: (r.like_count ?? 0) + (isLiked ? 1 : -1) } : r) };
      setComments(prev => prev.map(revert));
    }
  }

  const listData = comments;

  if (loading) {
    return (
      <VideoBackground source={require('../../../assets/backgrounds/main.mp4')}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
        </View>
      </VideoBackground>
    );
  }

  return (
    <VideoBackground source={require('../../../assets/backgrounds/main.mp4')}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* 浮動返回按鈕（漢堡區塊，右側） */}
        <View style={styles.backFloatRow}>
          <Pressable
            style={styles.backFloatBtn}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/community' as never)}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="arrow-left" size={26} color="rgba(255,255,255,0.95)" />
          </Pressable>
        </View>

        <FlatList
          data={listData}
          keyExtractor={(item) => `comment-${item.comment_id}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            post ? (
              <PostCard
                post={{ ...post, tags: post.tags?.map(t => t.tag_name) ?? [] }}
                onLike={toggleLike}
                onComment={() => inputRef.current?.focus()}
                onShare={() => setShareModalVisible(true)}
                onEdit={() => router.push(`/community/edit/${postId}` as never)}
                onDelete={deletePost}
                onReport={!post.is_owner ? () => openReport('post', postId) : undefined}
                onAvatarPress={() => router.push(`/user/${post.author_user_id}` as never)}
                onDiaryCardPress={setDiaryModalCard}
                onSummaryCardPress={setSummaryModalCard}
                onImagePress={setImageModalUri}
                onOriginalPostPress={(id) => router.push(`/community/post/${id}` as never)}
                style={{ marginBottom: 8 }}
              />
            ) : null
          }
          ListEmptyComponent={
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {commentError ? `載入留言失敗：${commentError}` : '還沒有留言，來說第一句吧！'}
              </Text>
            </GlassCard>
          }
          renderItem={({ item }) => (
            <>
              <CommentCard
                comment={item}
                onLike={() => toggleCommentLike(item.comment_id, item.is_liked ?? false)}
                onReply={() => startReply(item)}
                onEdit={item.is_owner ? () => startEditComment(item) : undefined}
                onDelete={item.is_owner ? () => deleteComment(item.comment_id) : undefined}
                onReport={!item.is_owner ? () => openReport('comment', item.comment_id) : undefined}
              />
              {(item.replies ?? []).map(r => (
                <CommentCard
                  key={r.comment_id}
                  comment={r}
                  isReply
                  onLike={() => toggleCommentLike(r.comment_id, r.is_liked ?? false)}
                  onEdit={r.is_owner ? () => startEditComment(r) : undefined}
                  onDelete={r.is_owner ? () => deleteComment(r.comment_id) : undefined}
                  onReport={!r.is_owner ? () => openReport('comment', r.comment_id) : undefined}
                />
              ))}
            </>
          )}
        />

        {/* Comment input */}
        <GlassCard style={styles.inputBar} glassColor="rgba(0,0,0,0.48)">
          {editingCommentId && (
            <View style={styles.replyHint}>
              <Text style={styles.replyHintText}>正在編輯留言</Text>
              <TouchableOpacity onPress={() => { setEditingCommentId(null); setCommentText(''); }}>
                <Text style={styles.replyHintClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          {!editingCommentId && replyTo && (
            <View style={styles.replyHint}>
              <Text style={styles.replyHintText}>回覆 {replyTo.username}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Text style={styles.replyHintClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={replyTo ? `回覆 ${replyTo.username}...` : '說點什麼...'}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
              onPress={submitComment}
              disabled={!commentText.trim() || submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.sendIcon}>↑</Text>
              }
            </TouchableOpacity>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>
      {/* 日記完整內容 Modal — 置中懸浮視窗 */}
      <Modal
        visible={!!diaryModalCard}
        transparent
        animationType="fade"
        onRequestClose={() => setDiaryModalCard(null)}
      >
        <TouchableOpacity
          style={styles.diaryModalOverlay}
          activeOpacity={1}
          onPress={() => setDiaryModalCard(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.diaryModalSheet} onPress={() => {}}>
            <View style={styles.diaryModalHeader}>
              <Text style={styles.diaryModalIcon}>📖</Text>
              <Text style={styles.diaryModalTitle} numberOfLines={2}>
                {diaryModalCard?.diary_title}
              </Text>
              <TouchableOpacity onPress={() => setDiaryModalCard(null)} style={styles.diaryModalClose}>
                <Text style={styles.diaryModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.diaryModalDate}>{diaryModalCard?.diary_date}</Text>
            <View style={styles.diaryModalDivider} />
            <ScrollView style={styles.diaryModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.diaryModalContent}>{diaryModalCard?.diary_content}</Text>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 周回顧完整內容 Modal */}
      <Modal
        visible={!!summaryModalCard}
        transparent
        animationType="fade"
        onRequestClose={() => setSummaryModalCard(null)}
      >
        <TouchableOpacity
          style={styles.diaryModalOverlay}
          activeOpacity={1}
          onPress={() => setSummaryModalCard(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.diaryModalSheet} onPress={() => {}}>
            <View style={styles.diaryModalHeader}>
              <Text style={styles.diaryModalIcon}>✨</Text>
              <Text style={styles.diaryModalTitle} numberOfLines={2}>
                {summaryModalCard?.summary_title}
              </Text>
              <TouchableOpacity onPress={() => setSummaryModalCard(null)} style={styles.diaryModalClose}>
                <Text style={styles.diaryModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.diaryModalDate}>
              {summaryModalCard?.year} 年 第 {summaryModalCard?.week_number} 週
            </Text>
            <View style={styles.diaryModalDivider} />
            <ScrollView style={styles.diaryModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.diaryModalContent}>{summaryModalCard?.summary_content}</Text>
              {summaryModalCard?.bible_quote && (
                <Text style={styles.summaryModalBible}>📖 {summaryModalCard.bible_quote}</Text>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 全螢幕圖片預覽 Modal */}
      <Modal
        visible={!!imageModalUri}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalUri(null)}
        statusBarTranslucent
      >
        <Pressable style={styles.imageModalOverlay} onPress={() => setImageModalUri(null)}>
          <StatusBar hidden />
          <Image
            source={{ uri: imageModalUri ?? '' }}
            style={styles.imageModalImg}
            resizeMode="contain"
          />
          <TouchableOpacity style={styles.imageModalClose} onPress={() => setImageModalUri(null)}>
            <Text style={styles.imageModalCloseText}>✕</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {/* 轉發 Modal */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.shareModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.shareModalCard}>
            <Text style={styles.shareModalTitle}>轉發貼文</Text>
            <TextInput
              style={styles.shareModalInput}
              placeholder="加入你的想法（可留空）"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={shareCaption}
              onChangeText={setShareCaption}
              multiline
              maxLength={500}
              {...Platform.select({ web: { style: [styles.shareModalInput, { outlineStyle: 'none' } as any] } })}
            />
            <View style={styles.shareModalButtons}>
              <TouchableOpacity
                style={styles.shareCancelBtn}
                onPress={() => { setShareModalVisible(false); setShareCaption(''); }}
              >
                <Text style={styles.shareCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareSubmitBtn}
                onPress={submitShare}
                disabled={sharing}
              >
                {sharing
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.shareSubmitText}>轉發</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 檢舉選單 Modal */}
      <Modal
        visible={reportMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setReportMenuVisible(false); setReportTarget(null); }}
      >
        <TouchableOpacity
          style={styles.reportMenuOverlay}
          activeOpacity={1}
          onPress={() => { setReportMenuVisible(false); setReportTarget(null); }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.reportMenuCard}>
            <View style={styles.reportMenuHandle} />
            <TouchableOpacity
              style={styles.reportMenuOption}
              onPress={() => {
                setReportMenuVisible(false);
                setReportModalVisible(true);
              }}
            >
              <Text style={styles.reportMenuOptionRed}>檢舉</Text>
              <Text style={styles.reportMenuOptionIcon}>⚠️</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 檢舉原因 Modal */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setReportModalVisible(false); setReportReason(''); setReportTarget(null); }}
      >
        <View style={styles.reportReasonOverlay}>
          <View style={styles.reportReasonCard}>
            <Text style={styles.reportReasonTitle}>請選擇檢舉原因</Text>
            {['我不喜歡', '騷擾', '不符合天主教教義', '不符現實', '其他'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.reportReasonOption, reportReason === r && styles.reportReasonOptionSelected]}
                onPress={() => setReportReason(r)}
              >
                <Text style={[styles.reportReasonOptionText, reportReason === r && styles.reportReasonOptionTextSelected]}>
                  {r}
                </Text>
                {reportReason === r && <Text style={styles.reportReasonCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
            <View style={styles.reportReasonButtons}>
              <TouchableOpacity
                style={styles.reportCancelBtn}
                onPress={() => { setReportModalVisible(false); setReportReason(''); setReportTarget(null); }}
              >
                <Text style={styles.reportCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportSubmitBtn, (!reportReason || reportSubmitting) && { opacity: 0.5 }]}
                onPress={submitReport}
                disabled={!reportReason || reportSubmitting}
              >
                {reportSubmitting
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.reportSubmitText}>送出檢舉</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </VideoBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  backFloatRow: {
    position: 'absolute',
    top: -(HEADER_CONTENT_HEIGHT - 10),
    right: 16,
    zIndex: 500,
  },
  backFloatBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },

  listContent: { padding: 12, paddingBottom: 16 },

  imageModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageModalImg: { width: '100%', height: '100%' },
  imageModalClose: {
    position: 'absolute', top: 48, right: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  imageModalCloseText: { fontSize: 18, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  emptyCard: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },

  summaryModalBible: {
    fontSize: 14, color: 'rgba(200,170,255,0.9)',
    fontStyle: 'italic', marginTop: 16, lineHeight: 22,
  },

  // Diary Modal — 置中懸浮視窗
  diaryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  diaryModalSheet: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: 'rgba(18,18,38,0.97)',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  diaryModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  diaryModalIcon: { fontSize: 20, marginTop: 2 },
  diaryModalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 22,
  },
  diaryModalClose: {
    padding: 4,
    marginTop: -2,
  },
  diaryModalCloseText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
  },
  diaryModalDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
    marginLeft: 30,
  },
  diaryModalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
  },
  diaryModalScroll: { flexGrow: 0 },
  diaryModalContent: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 25,
  },

  // Share modal
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  shareModalCard: {
    backgroundColor: 'rgba(30,30,50,0.97)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shareModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    marginBottom: 14,
  },
  shareModalInput: {
    minHeight: 70,
    maxHeight: 140,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    padding: 10,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  shareModalButtons: { flexDirection: 'row', gap: 10 },
  shareCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shareCancelText: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  shareSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,122,255,0.8)',
    alignItems: 'center',
  },
  shareSubmitText: { fontSize: 15, fontWeight: '700', color: 'white' },

  // 檢舉相關
  reportMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  reportMenuCard: {
    backgroundColor: 'rgba(30,30,50,0.97)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  reportMenuHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  reportMenuOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  reportMenuOptionRed: { fontSize: 16, color: '#FF3B30', fontWeight: '500' },
  reportMenuOptionIcon: { fontSize: 20 },
  reportReasonOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reportReasonCard: {
    width: '100%',
    backgroundColor: 'rgba(18,18,38,0.97)',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  reportReasonTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    marginBottom: 16,
  },
  reportReasonOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  reportReasonOptionSelected: {
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderColor: 'rgba(255,59,48,0.4)',
  },
  reportReasonOptionText: { fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  reportReasonOptionTextSelected: { color: '#FF3B30', fontWeight: '600' },
  reportReasonCheck: { fontSize: 16, color: '#FF3B30', fontWeight: '700' },
  reportReasonButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  reportCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  reportCancelText: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  reportSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(220,50,50,0.8)',
    alignItems: 'center',
  },
  reportSubmitText: { fontSize: 15, fontWeight: '700', color: 'white' },

  // Input bar
  inputBar: { margin: 12, marginTop: 0 },
  replyHint: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)',
    marginBottom: 6,
  },
  replyHintText: { fontSize: 12, color: 'rgba(135,206,250,0.9)' },
  replyHintClose: { fontSize: 14, color: 'rgba(255,255,255,0.5)', paddingHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minHeight: 36, maxHeight: 100,
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    ...Platform.select({ web: { outlineStyle: 'none' as any } }),
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },
  sendIcon: { fontSize: 18, color: 'white', fontWeight: '600' },
});
