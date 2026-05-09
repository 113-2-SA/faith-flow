import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassCard } from './GlassCard';
import { timeAgo } from '../utils/dateUtils';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface PostDiaryCard {
  diary_id: number;
  diary_title: string;
  diary_content: string;
  diary_date: string;
}

export interface PostSummaryCard {
  summary_id: number;
  summary_title: string;
  summary_content: string;
  bible_quote: string | null;
  year: number;
  week_number: number;
  start_date?: string;
  end_date?: string;
}

export interface PostLetterCard {
  summary_text: string;
  question: string | null;
  image_url: string | null;
  quote: string | null;
  quote_source: string | null;
}

export interface PostOriginalPost {
  community_post_id: number;
  post_text: string;
  post_type?: string;
  created_at: string;
  original_author_name: string | null;
  original_author_avatar: string | null;
  diary_card?: PostDiaryCard;
  summary_card?: PostSummaryCard;
}

export interface PostData {
  community_post_id: number;
  author_user_id: number;
  post_text: string;
  post_type: string;
  visibility: string;
  username: string | null;
  avatar_url: string | null;
  tags: string[];
  created_at: string;
  post_pic?: string | null;
  like_count?: number;
  comment_count?: number;
  is_liked?: boolean;
  is_owner?: boolean;
  original_post?: PostOriginalPost;
  diary_card?: PostDiaryCard;
  summary_card?: PostSummaryCard;
  letter_card?: PostLetterCard;
}

export interface CommentData {
  comment_id: number;
  post_id: number;
  user_id: number;
  parent_comment_id: number | null;
  comment_content: string;
  username: string | null;
  avatar_url?: string | null;
  created_at: string;
  like_count?: number;
  is_liked?: boolean;
  reply_count?: number;
  replies?: CommentData[];
}

export const POST_TYPE_LABELS: Record<string, string> = {
  normal: '原創分享',
  diary: '日記分享',
  summary: '周回顧分享',
  letter: '信箋',
  shared: '轉發',
};

// ─── PostCard ─────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: PostData;
  selectedPostType?: string | null;
  /** Wrap entire card in a TouchableOpacity (feed list) */
  onPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Called when non-owner taps "檢舉" in the ⋯ contextual menu */
  onReport?: () => void;
  onTagPress?: (tag: string) => void;
  onPostTypePress?: (postType: string) => void;
  onAvatarPress?: () => void;
  onDiaryCardPress?: (card: PostDiaryCard) => void;
  onSummaryCardPress?: (card: PostSummaryCard) => void;
  onImagePress?: (uri: string) => void;
  onOriginalPostPress?: (postId: number) => void;
  style?: object;
}

export function PostCard({
  post,
  selectedPostType,
  onPress,
  onLike,
  onComment,
  onShare,
  onEdit,
  onDelete,
  onReport,
  onTagPress,
  onPostTypePress,
  onAvatarPress,
  onDiaryCardPress,
  onSummaryCardPress,
  onImagePress,
  onOriginalPostPress,
  style,
}: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = post.is_owner ? (!!onEdit || !!onDelete) : !!onReport;

  const card = (
    <GlassCard style={[styles.postCard, style]}>

      {/* ── Header ── */}
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={onAvatarPress}>
          {post.avatar_url ? (
            <Image source={{ uri: post.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{post.username?.[0] ?? '?'}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.postMeta}>
          {/* author row: name · category #tags ⋯ */}
          <View style={styles.authorRow}>
            <TouchableOpacity onPress={onAvatarPress}>
              <Text style={styles.authorName}>{post.username ?? '匿名'}</Text>
            </TouchableOpacity>

            {/* Category label — immediately after name */}
            {post.post_type !== 'original' && POST_TYPE_LABELS[post.post_type] && (
              <TouchableOpacity onPress={() => onPostTypePress?.(post.post_type)}>
                <Text style={[
                  styles.categoryLabel,
                  selectedPostType === post.post_type && styles.categoryLabelActive,
                ]}>
                  {' · '}{POST_TYPE_LABELS[post.post_type]}
                </Text>
              </TouchableOpacity>
            )}

            {/* Inline tags */}
            {post.tags?.map((t, i) => (
              <TouchableOpacity key={i} onPress={() => onTagPress?.(t)}>
                <Text style={styles.inlineTag}>{' #'}{t}</Text>
              </TouchableOpacity>
            ))}

            {/* ⋯ menu — pushed to right, toggles contextual popup */}
            {hasMenu && (
              <TouchableOpacity
                style={styles.postMenuBtn}
                onPress={() => setMenuOpen(v => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.postMenuIcon}>…</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.timeText}>{timeAgo(post.created_at)}</Text>
        </View>
      </View>

      {/* ── Post text ── */}
      {!!post.post_text && <Text style={styles.postText}>{post.post_text}</Text>}

      {/* ── Post image ── */}
      {!!post.post_pic && (
        <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress?.(post.post_pic!)}>
          <Image source={{ uri: post.post_pic }} style={styles.postImage} resizeMode="contain" />
        </TouchableOpacity>
      )}

      {/* ── Diary card attachment ── */}
      {post.diary_card && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onDiaryCardPress?.(post.diary_card!)}
          style={styles.attachCard}
        >
          <View style={styles.attachRow}>
            <Text style={styles.attachIcon}>📖</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.attachDate}>{post.diary_card.diary_date}</Text>
              <Text style={styles.attachTitle} numberOfLines={1}>{post.diary_card.diary_title}</Text>
            </View>
          </View>
          <Text style={styles.attachPreview} numberOfLines={2}>
            {post.diary_card.diary_content.slice(0, 60)}
            {post.diary_card.diary_content.length > 60 ? '...' : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Summary card attachment ── */}
      {post.summary_card && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onSummaryCardPress?.(post.summary_card!)}
          style={[styles.attachCard, styles.summaryCard]}
        >
          <View style={styles.attachRow}>
            <Text style={styles.attachIcon}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.attachDate}>
                {post.summary_card.year} 年 第 {post.summary_card.week_number} 週回顧
              </Text>
              <Text style={styles.attachTitle} numberOfLines={1}>{post.summary_card.summary_title}</Text>
            </View>
          </View>
          <Text style={styles.attachPreview} numberOfLines={2}>
            {post.summary_card.summary_content.slice(0, 60)}
            {post.summary_card.summary_content.length > 60 ? '...' : ''}
          </Text>
          {post.summary_card.bible_quote && (
            <Text style={styles.summaryBible} numberOfLines={1}>
              📖 {post.summary_card.bible_quote}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* ── Letter card ── */}
      {post.letter_card && (
        <View style={styles.letterCard}>
          <View style={styles.letterRow}>
            {post.letter_card.image_url ? (
              <Image source={{ uri: post.letter_card.image_url }} style={styles.letterImg} resizeMode="cover" />
            ) : (
              <View style={styles.letterImgPlaceholder}>
                <Text style={{ fontSize: 20 }}>🖼️</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 5 }}>
              {post.letter_card.question && (
                <Text style={styles.letterQuestion} numberOfLines={2}>{post.letter_card.question}</Text>
              )}
              <Text style={styles.letterPreview} numberOfLines={3}>
                {post.letter_card.summary_text?.slice(0, 80)}
                {(post.letter_card.summary_text?.length ?? 0) > 80 ? '...' : ''}
              </Text>
              {post.letter_card.quote && (
                <Text style={styles.letterQuote} numberOfLines={2}>
                  「{post.letter_card.quote}」
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ── Quoted original post (for shared type) ── */}
      {post.post_type === 'shared' && post.original_post && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onOriginalPostPress?.(post.original_post!.community_post_id)}
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
            <Text style={styles.quotedAuthor}>{post.original_post.original_author_name ?? '匿名'}</Text>
            <Text style={styles.quotedTime}> · {timeAgo(post.original_post.created_at)}</Text>
          </View>
          {post.original_post.post_text ? (
            <Text style={styles.quotedText} numberOfLines={3}>{post.original_post.post_text}</Text>
          ) : null}
          {post.original_post.diary_card && (
            <View style={[styles.quotedCard, { marginBottom: 0, marginTop: 6 }]}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 14 }}>📖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quotedAuthor} numberOfLines={1}>
                    {post.original_post.diary_card.diary_title}
                  </Text>
                  <Text style={styles.quotedText} numberOfLines={1}>
                    {post.original_post.diary_card.diary_content.slice(0, 30)}
                    {post.original_post.diary_card.diary_content.length > 30 ? '...' : ''}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* ── Actions: like / comment / share only — edit & delete moved to ⋯ menu ── */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <MaterialCommunityIcons
            name={post.is_liked ? 'heart' : 'hands-pray'}
            size={20}
            color={post.is_liked ? '#FF6B6B' : 'rgba(255,255,255,0.55)'}
          />
          <Text style={styles.actionText}>{post.like_count ?? 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onComment}>
          <MaterialCommunityIcons name="comment-outline" size={20} color="rgba(255,255,255,0.85)" />
          <Text style={styles.actionText}>{post.comment_count ?? 0}</Text>
        </TouchableOpacity>

        {!post.is_owner && onShare && (
          <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
            <MaterialCommunityIcons name="repeat" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}
      </View>

    </GlassCard>
  );

  // Contextual menu popup — rendered outside GlassCard so it isn't clipped
  const menuEl = menuOpen && hasMenu ? (
    <View style={styles.contextMenu}>
      {post.is_owner ? (
        <>
          {onEdit && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMenuOpen(false); onEdit(); }}
            >
              <MaterialCommunityIcons name="pencil" size={17} color="rgba(0,0,0,0.65)" />
              <Text style={styles.menuItemText}>編輯</Text>
            </TouchableOpacity>
          )}
          {onEdit && onDelete && <View style={styles.menuDivider} />}
          {onDelete && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMenuOpen(false); onDelete(); }}
            >
              <MaterialCommunityIcons name="delete-outline" size={17} color="#FF3B30" />
              <Text style={[styles.menuItemText, styles.menuItemRed]}>刪除</Text>
            </TouchableOpacity>
          )}
        </>
      ) : onReport ? (
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => { setMenuOpen(false); onReport(); }}
        >
          <MaterialCommunityIcons name="alert-outline" size={17} color="#FF3B30" />
          <Text style={[styles.menuItemText, styles.menuItemRed]}>檢舉</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

  const inner = onPress ? (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>{card}</TouchableOpacity>
  ) : card;

  return (
    <View style={styles.cardWrapper}>
      {inner}
      {menuEl}
    </View>
  );
}

// ─── CommentCard ──────────────────────────────────────────────────────────────

interface CommentCardProps {
  comment: CommentData;
  isReply?: boolean;
  onLike?: () => void;
  onReply?: () => void;
}

export function CommentCard({ comment, isReply = false, onLike, onReply }: CommentCardProps) {
  const liked = comment.is_liked ?? false;
  return (
    <GlassCard style={[styles.commentCard, isReply && styles.replyCard]}>
      <View style={styles.postHeader}>
        {comment.avatar_url ? (
          <Image source={{ uri: comment.avatar_url }} style={styles.commentAvatarImg} />
        ) : (
          <View style={styles.commentAvatar}>
            <Text style={styles.commentAvatarText}>{comment.username?.[0] ?? '?'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName}>{comment.username ?? '匿名'}</Text>
          <Text style={styles.timeText}>{timeAgo(comment.created_at)}</Text>
        </View>
      </View>

      <Text style={styles.postText}>{comment.comment_content}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <MaterialCommunityIcons
            name={liked ? 'heart' : 'hands-pray'}
            size={20}
            color={liked ? '#FF6B6B' : 'rgba(255,255,255,0.55)'}
          />
          <Text style={styles.actionText}>{comment.like_count ?? 0}</Text>
        </TouchableOpacity>
        {!isReply && onReply && (
          <TouchableOpacity style={styles.actionBtn} onPress={onReply}>
            <MaterialCommunityIcons name="comment-outline" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}
      </View>
    </GlassCard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Wrapper — relative positioning so contextual menu sits outside GlassCard
  cardWrapper: { position: 'relative' },

  // Post card shell
  postCard: { marginBottom: 16 },

  // Header
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarImage: {
    width: 40, height: 40, borderRadius: 20, marginRight: 10,
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
  postMeta: { flex: 1 },
  authorRow: {
    flexDirection: 'row', alignItems: 'center',
    flexWrap: 'wrap', marginBottom: 2,
  },
  authorName: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.95)' },
  categoryLabel: { fontSize: 14, color: 'rgba(135,206,250,0.9)', fontWeight: '500' },
  categoryLabelActive: { color: 'rgba(255,215,0,0.95)', fontWeight: '700' },
  inlineTag: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '400' },
  timeText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  postMenuBtn: { marginLeft: 'auto', paddingHorizontal: 6 },
  postMenuIcon: { fontSize: 18, color: 'rgba(255,255,255,0.6)' },

  // Body
  postText: { fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 22, marginBottom: 12 },
  postImage: {
    width: '100%', aspectRatio: 4 / 3, maxHeight: 300,
    borderRadius: 10, marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },

  // Attachment cards (diary / summary)
  attachCard: {
    borderWidth: 1, borderColor: 'rgba(100,180,255,0.35)',
    borderRadius: 10, padding: 10, marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  summaryCard: { borderColor: 'rgba(180,140,255,0.35)' },
  attachRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  attachIcon: { fontSize: 16 },
  attachDate: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  attachTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  attachPreview: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 18 },
  summaryBible: { fontSize: 12, color: 'rgba(200,170,255,0.85)', fontStyle: 'italic', marginTop: 4 },

  // Letter card
  letterCard: {
    borderWidth: 1, borderColor: 'rgba(80,180,120,0.4)',
    borderRadius: 10, padding: 10, marginBottom: 12,
    backgroundColor: 'rgba(0,60,30,0.25)',
  },
  letterRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  letterImg: { width: 70, height: 100, borderRadius: 8, flexShrink: 0 },
  letterImgPlaceholder: {
    width: 70, height: 100, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  letterQuestion: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)', lineHeight: 18 },
  letterPreview: { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 17 },
  letterQuote: { fontSize: 12, color: 'rgba(180,230,180,0.85)', fontStyle: 'italic', lineHeight: 17 },

  // Quoted / embedded original post
  quotedCard: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10, padding: 10, marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  quotedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  quotedAvatar: { width: 20, height: 20, borderRadius: 10, marginRight: 6 },
  quotedAvatarPlaceholder: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center', marginRight: 6,
  },
  quotedAvatarText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  quotedAuthor: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  quotedTime: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  quotedText: { fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 20 },

  // Actions bar
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 10, gap: 8,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 4, paddingVertical: 4,
  },
  actionText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  // Contextual popup menu (rendered outside GlassCard)
  contextMenu: {
    position: 'absolute',
    top: 44,
    right: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 10,
    minWidth: 110,
    overflow: 'hidden',
    zIndex: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    color: 'rgba(0,0,0,0.85)',
    fontWeight: '500',
  },
  menuItemRed: { color: '#FF3B30' },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  // Comment cards
  commentCard: { marginBottom: 10 },
  replyCard: { marginLeft: 24, marginBottom: 6 },
  commentAvatarImg: {
    width: 32, height: 32, borderRadius: 16, marginRight: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  commentAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  commentAvatarText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
});
