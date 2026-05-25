import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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
  summary: string;
  question: string | null;
  image_url: string | null;
  quote: string | null;
  quote_source: string | null;
  day_no?: number | null;
  week_start?: string | null;
  theme?: string | null;
  is_completed?: boolean;
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
  letter_card?: PostLetterCard;
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
  is_owner?: boolean;
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

// ─── Shared menu hook helpers ─────────────────────────────────────────────────

function useMenuState() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuBtnRef = useRef<TouchableOpacity>(null);
  const menuAnim = useRef(new Animated.Value(0)).current;

  function openMenu() {
    menuBtnRef.current?.measureInWindow((x, y, w, h) => {
      menuAnim.setValue(0);
      setMenuPos({ top: y + h + 6, right: Dimensions.get('window').width - (x + w) });
      setMenuOpen(true);
      Animated.timing(menuAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }

  function closeMenu(andThen?: () => void) {
    Animated.timing(menuAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      setMenuOpen(false);
      setMenuPos(null);
      andThen?.();
    });
  }

  return { menuOpen, menuPos, menuBtnRef, menuAnim, openMenu, closeMenu };
}

function useLikeAnim() {
  const likeScale = useRef(new Animated.Value(1)).current;
  const likeGlow = useRef(new Animated.Value(0)).current;

  function triggerLikeAnim() {
    likeScale.setValue(1);
    likeGlow.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(likeScale, { toValue: 1.45, useNativeDriver: true, speed: 50, bounciness: 12 }),
        Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 5 }),
      ]),
      Animated.sequence([
        Animated.timing(likeGlow, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(likeGlow, { toValue: 0, duration: 350, useNativeDriver: false }),
      ]),
    ]).start();
  }

  return { likeScale, likeGlow, triggerLikeAnim };
}

// ─── Shared ContextMenuModal ──────────────────────────────────────────────────

interface ContextMenuProps {
  visible: boolean;
  pos: { top: number; right: number } | null;
  anim: Animated.Value;
  onClose: () => void;
  isOwner: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  closeMenu: (cb?: () => void) => void;
}

function ContextMenuModal({
  visible, pos, anim, isOwner,
  onEdit, onDelete, onReport, closeMenu,
}: ContextMenuProps) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!visible) setConfirming(false);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMenu()} />
        </BlurView>
      </Animated.View>
      {pos && (
        <Animated.View style={[
          styles.contextMenu,
          {
            top: pos.top,
            right: pos.right,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}>
          {confirming ? (
            <>
              <View style={styles.menuConfirmHeader}>
                <Text style={styles.menuConfirmText}>確定要刪除嗎？</Text>
              </View>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={() => closeMenu(onDelete)}>
                <MaterialCommunityIcons name="delete-outline" size={17} color="#FF3B30" />
                <Text style={[styles.menuItemText, styles.menuItemRed]}>確定刪除</Text>
              </TouchableOpacity>
            </>
          ) : isOwner ? (
            <>
              {onEdit && (
                <TouchableOpacity style={styles.menuItem} onPress={() => closeMenu(onEdit)}>
                  <MaterialCommunityIcons name="pencil" size={17} color="rgba(0,0,0,0.65)" />
                  <Text style={styles.menuItemText}>編輯</Text>
                </TouchableOpacity>
              )}
              {onEdit && onDelete && <View style={styles.menuDivider} />}
              {onDelete && (
                <TouchableOpacity style={styles.menuItem} onPress={() => setConfirming(true)}>
                  <MaterialCommunityIcons name="delete-outline" size={17} color="#FF3B30" />
                  <Text style={[styles.menuItemText, styles.menuItemRed]}>刪除</Text>
                </TouchableOpacity>
              )}
            </>
          ) : onReport ? (
            <TouchableOpacity style={styles.menuItem} onPress={() => closeMenu(onReport)}>
              <MaterialCommunityIcons name="alert-outline" size={17} color="#FF3B30" />
              <Text style={[styles.menuItemText, styles.menuItemRed]}>檢舉</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      )}
    </Modal>
  );
}

// ─── LikeButton ───────────────────────────────────────────────────────────────

interface LikeButtonProps {
  isLiked: boolean;
  likeCount?: number;
  likeScale: Animated.Value;
  likeGlow: Animated.Value;
  onPress: () => void;
}

function LikeButton({ isLiked, likeCount, likeScale, likeGlow, onPress }: LikeButtonProps) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <View style={styles.likeIconWrap}>
        <Animated.View style={[
          styles.likeGlowRing,
          {
            opacity: likeGlow,
            transform: [{ scale: likeGlow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.8] }) }],
          },
        ]} />
        <Animated.View style={{ transform: [{ scale: likeScale }] }}>
          <MaterialCommunityIcons
            name={isLiked ? 'heart' : 'hands-pray'}
            size={20}
            color={isLiked ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)'}
          />
        </Animated.View>
      </View>
      {likeCount !== undefined && (
        <Text style={styles.actionText}>{likeCount}</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: PostData;
  onPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onTagPress?: (tag: string) => void;
  onPostTypePress?: (postType: string) => void;
  onAvatarPress?: () => void;
  onDiaryCardPress?: (card: PostDiaryCard) => void;
  onSummaryCardPress?: (card: PostSummaryCard) => void;
  onLetterCardPress?: (card: PostLetterCard) => void;
  onImagePress?: (uri: string) => void;
  onOriginalPostPress?: (postId: number) => void;
  style?: object;
}

export function PostCard({
  post,
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
  onLetterCardPress,
  onImagePress,
  onOriginalPostPress,
  style,
}: PostCardProps) {
  const { menuOpen, menuPos, menuBtnRef, menuAnim, openMenu, closeMenu } = useMenuState();
  const { likeScale, likeGlow, triggerLikeAnim } = useLikeAnim();

  const hasMenu = post.is_owner ? (!!onEdit || !!onDelete) : !!onReport;

  function handleLike() {
    if (!post.is_liked) triggerLikeAnim();
    onLike?.();
  }

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
          <View style={styles.authorRow}>
            <TouchableOpacity onPress={onAvatarPress}>
              <Text style={styles.authorName}>{post.username ?? '匿名'}</Text>
            </TouchableOpacity>

            {post.post_type !== 'original' && POST_TYPE_LABELS[post.post_type] && (
              <TouchableOpacity onPress={() => onPostTypePress?.(post.post_type)}>
                <Text style={styles.categoryLabel}>
                  {' · '}{POST_TYPE_LABELS[post.post_type]}
                </Text>
              </TouchableOpacity>
            )}

            {post.tags?.map((t, i) => (
              <TouchableOpacity key={i} onPress={() => onTagPress?.(t)}>
                <Text style={styles.inlineTag}>{' #'}{t}</Text>
              </TouchableOpacity>
            ))}

            {hasMenu && (
              <TouchableOpacity
                ref={menuBtnRef}
                style={styles.postMenuBtn}
                onPress={openMenu}
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
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onLetterCardPress?.(post.letter_card!)}
          style={styles.letterCard}
        >
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
                {post.letter_card.summary?.slice(0, 80)}
                {(post.letter_card.summary?.length ?? 0) > 80 ? '...' : ''}
              </Text>
              {post.letter_card.quote && (
                <Text style={styles.letterQuote} numberOfLines={2}>
                  「{post.letter_card.quote}」
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
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
          {post.original_post.letter_card && (
            <View style={[styles.letterCard, { marginTop: 6 }]}>
              <View style={styles.letterRow}>
                {post.original_post.letter_card.image_url ? (
                  <Image source={{ uri: post.original_post.letter_card.image_url }} style={styles.letterImg} resizeMode="cover" />
                ) : (
                  <View style={styles.letterImgPlaceholder}>
                    <Text style={{ fontSize: 18 }}>🖼️</Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  {post.original_post.letter_card.question ? (
                    <Text style={styles.letterQuestion} numberOfLines={2}>
                      {post.original_post.letter_card.question}
                    </Text>
                  ) : null}
                  {post.original_post.letter_card.summary ? (
                    <Text style={styles.letterPreview} numberOfLines={2}>
                      {post.original_post.letter_card.summary.slice(0, 50)}
                      {post.original_post.letter_card.summary.length > 50 ? '...' : ''}
                    </Text>
                  ) : null}
                  {post.original_post.letter_card.quote ? (
                    <Text style={styles.letterQuote} numberOfLines={1}>
                      「{post.original_post.letter_card.quote}」
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* ── Actions ── */}
      <View style={styles.actions}>
        <LikeButton
          isLiked={post.is_liked ?? false}
          likeCount={post.like_count ?? 0}
          likeScale={likeScale}
          likeGlow={likeGlow}
          onPress={handleLike}
        />

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

  const inner = onPress ? (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>{card}</TouchableOpacity>
  ) : card;

  return (
    <View style={styles.cardWrapper}>
      {inner}
      {hasMenu && (
        <ContextMenuModal
          visible={menuOpen}
          pos={menuPos}
          anim={menuAnim}
          onClose={() => closeMenu()}
          isOwner={!!post.is_owner}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
          closeMenu={closeMenu}
        />
      )}
    </View>
  );
}

// ─── CommentCard ──────────────────────────────────────────────────────────────

interface CommentCardProps {
  comment: CommentData;
  isReply?: boolean;
  onLike?: () => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}

export function CommentCard({
  comment,
  isReply = false,
  onLike,
  onReply,
  onEdit,
  onDelete,
  onReport,
}: CommentCardProps) {
  const liked = comment.is_liked ?? false;
  const { menuOpen, menuPos, menuBtnRef, menuAnim, openMenu, closeMenu } = useMenuState();
  const { likeScale, likeGlow, triggerLikeAnim } = useLikeAnim();

  const hasMenu = comment.is_owner ? (!!onEdit || !!onDelete) : !!onReport;

  function handleLike() {
    if (!liked) triggerLikeAnim();
    onLike?.();
  }

  return (
    <View style={styles.cardWrapper}>
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
            <View style={styles.authorRow}>
              <Text style={styles.authorName}>{comment.username ?? '匿名'}</Text>
              {hasMenu && (
                <TouchableOpacity
                  ref={menuBtnRef}
                  style={styles.postMenuBtn}
                  onPress={openMenu}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.postMenuIcon}>…</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.timeText}>{timeAgo(comment.created_at)}</Text>
          </View>
        </View>

        <Text style={styles.postText}>{comment.comment_content}</Text>

        <View style={styles.actions}>
          <LikeButton
            isLiked={liked}
            likeCount={comment.like_count ?? 0}
            likeScale={likeScale}
            likeGlow={likeGlow}
            onPress={handleLike}
          />
          {!isReply && onReply && (
            <TouchableOpacity style={styles.actionBtn} onPress={onReply}>
              <MaterialCommunityIcons name="comment-outline" size={20} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>

      {hasMenu && (
        <ContextMenuModal
          visible={menuOpen}
          pos={menuPos}
          anim={menuAnim}
          onClose={() => closeMenu()}
          isOwner={!!comment.is_owner}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
          closeMenu={closeMenu}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardWrapper: { position: 'relative' },

  postCard: { marginBottom: 16 },

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
  categoryLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '400' },
  inlineTag: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '400' },
  timeText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  postMenuBtn: { marginLeft: 'auto', paddingHorizontal: 6 },
  postMenuIcon: { fontSize: 18, color: 'rgba(255,255,255,0.6)' },

  postText: { fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 22, marginBottom: 12 },
  postImage: {
    width: '100%', aspectRatio: 4 / 3, maxHeight: 300,
    borderRadius: 10, marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },

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

  likeIconWrap: {
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  likeGlowRing: {
    position: 'absolute',
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },

  contextMenu: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 12,
    minWidth: 120,
    overflow: 'hidden',
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
  menuConfirmHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  menuConfirmText: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.5)',
    fontWeight: '500',
  },

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
