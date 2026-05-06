import { useState, useEffect, useRef } from 'react';
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
import { timeAgo } from '../../../utils/dateUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Tag {
  tag_name: string;
}

interface DiaryCard {
  diary_id: number;
  diary_title: string;
  diary_content: string;
  diary_date: string;
}

interface OriginalPost {
  community_post_id: number;
  post_text: string;
  post_type?: string;
  created_at: string;
  original_author_name: string | null;
  original_author_avatar: string | null;
  diary_card?: DiaryCard;
}

interface Post {
  community_post_id: number;
  author_user_id: number;
  post_text: string;
  post_type: string;
  visibility: string;
  username: string | null;
  avatar_url: string | null;
  tags: Tag[];
  created_at: string;
  post_pic?: string | null;
  like_count?: number;
  comment_count?: number;
  is_liked?: boolean;
  is_owner?: boolean;
  original_post?: OriginalPost;
  diary_card?: DiaryCard;
}

interface Comment {
  comment_id: number;
  post_id: number;
  user_id: number;
  parent_comment_id: number | null;
  comment_content: string;
  username: string | null;
  created_at: string;
  like_count?: number;
  is_liked?: boolean;
  reply_count?: number;
  replies?: Comment[];
}

const POST_TYPE_LABELS: Record<string, string> = {
  normal: '原創分享',
  diary: '日記分享',
  letter: '信箋',
  shared: '轉發',
};


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
  const [diaryModalCard, setDiaryModalCard] = useState<DiaryCard | null>(null);
  const inputRef = useRef<TextInput>(null);

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
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePost() {
    if (!currentUser || !post) return;

    const doDelete = async () => {
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
    };

    if (Platform.OS === 'web') {
      if (window.confirm('確定要刪除這篇貼文嗎？')) await doDelete();
      return;
    }

    Alert.alert('刪除貼文', '確定要刪除這篇貼文嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: doDelete },
    ]);
  }

  function startReply(comment: Comment) {
    setReplyTo({ id: comment.comment_id, username: comment.username ?? '匿名' });
    inputRef.current?.focus();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  function renderComment(comment: Comment, isReply = false) {
    return (
      <View key={comment.comment_id} style={isReply ? styles.replyItem : styles.commentItem}>
        <View style={[styles.commentAvatar, isReply && styles.replyAvatar]}>
          <Text style={styles.commentAvatarText}>
            {comment.username ? comment.username[0] : '?'}
          </Text>
        </View>
        <View style={styles.commentBody}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUsername}>{comment.username ?? '匿名'}</Text>
            <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
          </View>
          <Text style={styles.commentContent}>{comment.comment_content}</Text>
          {!isReply && (
            <TouchableOpacity onPress={() => startReply(comment)} style={styles.replyBtn}>
              <Text style={styles.replyBtnText}>回覆</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const listData = comments.flatMap((c) => [
    { ...c, _type: 'comment' as const },
    ...(c.replies ?? []).map((r) => ({ ...r, _type: 'reply' as const })),
  ]);

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
        {/* Header */}
        <GlassCard style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>貼文</Text>
          {post?.is_owner ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() =>
                Alert.alert('操作', '', [
                  {
                    text: '編輯',
                    onPress: () =>
                      router.push(`/community/edit/${postId}` as never),
                  },
                  {
                    text: '刪除', style: 'destructive', onPress: () => {
                      setTimeout(() => deletePost(), 300);
                    },
                  },
                  { text: '取消', style: 'cancel' },
                ])
              }
            >
              <Text style={styles.menuIcon}>⋯</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
        </GlassCard>

        <FlatList
          data={listData}
          keyExtractor={(item) => `${item._type}-${item.comment_id}`}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            post ? (
              <GlassCard style={styles.postCard}>
                {/* Author row */}
                <View style={styles.postHeader}>
                  <TouchableOpacity onPress={() => router.push(`/user/${post.author_user_id}` as never)}>
                    {post.avatar_url ? (
                      <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {post.username ? post.username[0] : '?'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <View style={styles.authorRow}>
                      <TouchableOpacity onPress={() => router.push(`/user/${post.author_user_id}` as never)}>
                        <Text style={styles.authorName}>{post.username ?? '匿名'}</Text>
                      </TouchableOpacity>
                      {post.post_type !== 'original' && (
                        <Text style={styles.categoryLabel}>
                          {' › '}{POST_TYPE_LABELS[post.post_type] ?? post.post_type}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.timeText}>{timeAgo(post.created_at)}</Text>
                  </View>
                </View>

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {post.tags.map((t, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{t.tag_name}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Content */}
                {post.post_text ? <Text style={styles.postText}>{post.post_text}</Text> : null}

                {/* Post image — 點擊可全螢幕預覽 */}
                {post.post_pic ? (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setImageModalUri(post.post_pic!)}>
                    <Image source={{ uri: post.post_pic }} style={styles.postImage} resizeMode="contain" />
                  </TouchableOpacity>
                ) : null}

                {/* Diary card attachment */}
                {post.diary_card && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setDiaryModalCard(post.diary_card!)}
                    style={styles.diaryCard}
                  >
                    <View style={styles.diaryCardHeader}>
                      <Text style={styles.diaryCardIcon}>📖</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.diaryCardDate}>{post.diary_card.diary_date}</Text>
                        <Text style={styles.diaryCardTitle} numberOfLines={1}>
                          {post.diary_card.diary_title}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.diaryCardPreview} numberOfLines={2}>
                      {post.diary_card.diary_content.slice(0, 30)}
                      {post.diary_card.diary_content.length > 30 ? '...' : ''}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Embedded original post for shared type */}
                {post.post_type === 'shared' && post.original_post && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push(`/community/post/${post.original_post!.community_post_id}` as never)}
                    style={styles.quotedCard}
                  >
                    <View style={styles.quotedHeader}>
                      {post.original_post.original_author_avatar ? (
                        <Image source={{ uri: post.original_post.original_author_avatar }} style={styles.quotedAvatar} />
                      ) : (
                        <View style={styles.quotedAvatarPlaceholder}>
                          <Text style={styles.quotedAvatarText}>
                            {post.original_post.original_author_name?.[0] ?? '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.quotedAuthor}>
                        {post.original_post.original_author_name ?? '匿名'}
                      </Text>
                      <Text style={styles.quotedTime}> · {timeAgo(post.original_post.created_at)}</Text>
                    </View>
                    {post.original_post.post_text ? (
                      <Text style={styles.quotedText} numberOfLines={3}>
                        {post.original_post.post_text}
                      </Text>
                    ) : null}
                    {post.original_post.diary_card && (
                      <View style={[styles.diaryCard, { marginBottom: 0, marginTop: 6 }]}>
                        <View style={styles.diaryCardHeader}>
                          <Text style={styles.diaryCardIcon}>📖</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.diaryCardTitle} numberOfLines={1}>
                              {post.original_post.diary_card.diary_title}
                            </Text>
                            <Text style={styles.diaryCardPreview} numberOfLines={1}>
                              {post.original_post.diary_card.diary_content.slice(0, 30)}
                              {post.original_post.diary_card.diary_content.length > 30 ? '...' : ''}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
                    <Text style={styles.actionIcon}>{post.is_liked ? '🙏' : '🤍'}</Text>
                    <Text style={styles.actionText}>{post.like_count ?? 0}</Text>
                  </TouchableOpacity>
                  <View style={styles.actionBtn}>
                    <Text style={styles.actionIcon}>💬</Text>
                    <Text style={styles.actionText}>{post.comment_count ?? 0}</Text>
                  </View>
                  {post.is_owner && (
                    <>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => router.push(`/community/edit/${postId}` as never)}
                      >
                        <Text style={styles.actionIcon}>✏️</Text>
                        <Text style={styles.actionText}>編輯</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={deletePost}>
                        <Text style={[styles.actionIcon, { color: 'rgba(255,80,80,0.9)' }]}>🗑️</Text>
                        <Text style={[styles.actionText, { color: 'rgba(255,80,80,0.9)' }]}>刪除</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </GlassCard>
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
            <>{renderComment(item, item._type === 'reply')}</>
          )}
        />

        {/* Comment input */}
        <GlassCard style={styles.inputBar}>
          {replyTo && (
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
    </VideoBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 12,
    marginBottom: 0,
    paddingVertical: 10,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backIcon: { fontSize: 28, color: 'rgba(255,255,255,0.9)', lineHeight: 32 },
  menuIcon: { fontSize: 22, color: 'rgba(255,255,255,0.9)', lineHeight: 32 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },

  listContent: { padding: 12, paddingBottom: 16 },

  postCard: { marginBottom: 16 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarImage: {
    width: 40, height: 40, borderRadius: 20,
    marginRight: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.95)' },
  authorRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
  authorName: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.95)' },
  categoryLabel: { fontSize: 13, color: 'rgba(135,206,250,0.9)', marginLeft: 4 },
  timeText: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 6 },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 3, paddingHorizontal: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  tagText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  postText: {
    fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 23, marginBottom: 14,
  },
  postImage: {
    width: '100%',
    aspectRatio: 1 / 1,
    borderRadius: 10,
    marginBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImg: {
    width: '100%',
    height: '100%',
  },
  imageModalClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 10, gap: 8,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 5, paddingVertical: 4,
  },
  actionIcon: { fontSize: 18 },
  actionText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  // Comments
  commentItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  replyItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    marginLeft: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  replyAvatar: { width: 26, height: 26, borderRadius: 13 },
  commentAvatarText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  commentUsername: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginRight: 6 },
  commentTime: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  commentContent: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  replyBtn: { marginTop: 4 },
  replyBtnText: { fontSize: 12, color: 'rgba(135,206,250,0.8)' },

  emptyCard: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },

  // Diary card attachment
  diaryCard: {
    borderWidth: 1,
    borderColor: 'rgba(100,180,255,0.35)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    backgroundColor: 'rgba(0,80,180,0.12)',
  },
  diaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  diaryCardIcon: { fontSize: 16 },
  diaryCardDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  diaryCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  diaryCardPreview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 18,
  },

  // Quoted / embedded original post
  quotedCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  quotedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  quotedAvatar: {
    width: 20, height: 20, borderRadius: 10, marginRight: 6,
  },
  quotedAvatarPlaceholder: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 6,
  },
  quotedAvatarText: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.9)',
  },
  quotedAuthor: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)',
  },
  quotedTime: {
    fontSize: 12, color: 'rgba(255,255,255,0.45)',
  },
  quotedText: {
    fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 20,
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
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 36, maxHeight: 100,
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,122,255,0.7)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.15)' },
  sendIcon: { fontSize: 18, color: 'white', fontWeight: '600' },
});
