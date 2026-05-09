import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CopilotStep, useCopilot, walkthroughable } from 'react-native-copilot';
import { GlassCard } from '../../components/GlassCard';
import { VideoBackground } from '../../components/VideoBackground';
import { API_BASE_URL } from '../../lib/api';
import { timeAgo } from '../../utils/dateUtils';
import { useAuth } from '../context/authcontext';

const WalkthroughableView = walkthroughable(View);
const COMMUNITY_TOUR_KEY = 'faith_flow_community_tour_v1';



interface DiaryCard {
  diary_id: number;
  diary_title: string;
  diary_content: string;
  diary_date: string;
}

interface SummaryCard {
  summary_id: number;
  summary_title: string;
  summary_content: string;
  bible_quote: string | null;
  year: number;
  week_number: number;
  start_date?: string;
  end_date?: string;
}

// ✨ 新增LetterCard 型別
interface LetterCard {
  summary_text: string;
  question: string | null;
  image_url: string | null;
  quote: string | null;
  quote_source: string | null;
}

interface OriginalPost {
  community_post_id: number;
  post_text: string;
  post_type?: string;
  created_at: string;
  original_author_name: string | null;
  original_author_avatar: string | null;
  diary_card?: DiaryCard;
  summary_card?: SummaryCard;
}

interface Post {
  community_post_id: number;
  author_user_id: number;
  post_text: string;
  post_type: 'original' | 'diary' | 'letter' | 'shared' | 'normal' | 'summary';
  visibility: 'public' | 'private' | 'friends';
  username: string | null;
  avatar_url: string | null;
  tags: string[];
  created_at: string;
  post_pic?: string | null;
  like_count?: number;
  comment_count?: number;
  is_liked?: boolean;
  is_owner?: boolean;
  original_post?: OriginalPost;
  diary_card?: DiaryCard;
  summary_card?: SummaryCard;
  letter_card?: LetterCard;  // ✨ 新增
}

const POST_TYPE_LABELS: Record<string, string> = {
  normal: '原創分享',
  diary: '日記分享',
  summary: '周回顧分享',
  letter: '信箋',
  shared: '轉發',
};

export default function CommunityFeedScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { start } = useCopilot();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedPostType, setSelectedPostType] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<Post | null>(null);
  const [shareCaption, setShareCaption] = useState('');
  const [sharing, setSharing] = useState(false);
  const [diaryModalCard, setDiaryModalCard] = useState<DiaryCard | null>(null);
  const [summaryModalCard, setSummaryModalCard] = useState<SummaryCard | null>(null);
  const LIMIT = 20;

  // 搜尋相關狀態
  const [searchInput, setSearchInput] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  const [reportMenuPostId, setReportMenuPostId] = useState<number | null>(null);
  const [reportModalPostId, setReportModalPostId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // 首次進入自動啟動導覽
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(COMMUNITY_TOUR_KEY).then((done) => {
        if (!done && !cancelled) {
          setTimeout(() => {
            if (!cancelled) {
              start('community_topbar');
              AsyncStorage.setItem(COMMUNITY_TOUR_KEY, 'true');
            }
          }, 1200);
        }
      });
      return () => { cancelled = true; };
    }, [start])
  );

  const fetchPosts = useCallback(async (reset = false, tag?: string | null, postType?: string | null) => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const currentOffset = reset ? 0 : offset;
      const activeTag = tag !== undefined ? tag : selectedTag;
      const activePostType = postType !== undefined ? postType : selectedPostType;
      const tagParam = activeTag ? `&tag=${encodeURIComponent(activeTag)}` : '';
      const typeParam = activePostType ? `&post_type=${encodeURIComponent(activePostType)}` : '';
      const res = await fetch(
        `${API_BASE_URL}/api/post?visibility=public&limit=${LIMIT}&offset=${currentOffset}${tagParam}${typeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.ok) {
        const newPosts: Post[] = data.data;
        setPosts(reset ? newPosts : (prev) => [...prev, ...newPosts]);
        setHasMore(data.pagination.hasMore);
        setOffset(currentOffset + newPosts.length);
      } else {
        Alert.alert('錯誤', data.error ?? '無法取得貼文');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, offset]);

  useEffect(() => {
    fetchPosts(true);
  }, [currentUser]);

  const onRefresh = () => {
    setRefreshing(true);
    setOffset(0);
    fetchPosts(true, selectedTag, selectedPostType);
  };

  const onTagPress = (tag: string) => {
    const next = selectedTag === tag ? null : tag;
    setSelectedTag(next);
    setOffset(0);
    fetchPosts(true, next, selectedPostType);
  };

  const onPostTypePress = (postType: string) => {
    const next = selectedPostType === postType ? null : postType;
    setSelectedPostType(next);
    setOffset(0);
    fetchPosts(true, selectedTag, next);
  };

  const onLoadMore = () => {
    if (hasMore && !loading) fetchPosts(false);
  };

  // ==================== 搜尋社群貼文 ====================
  const searchPosts = async (keyword: string, tags: string[], sort = sortBy) => {
    if (!currentUser) return;
    setSearchLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      if (tags.length > 0) params.append('tags', tags.join(','));
      params.append('sortBy', sort);
      params.append('page', '1');
      params.append('limit', '20');

      const response = await fetch(
        `${API_BASE_URL}/api/search/community/posts?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.ok) {
        setSearchResults(data.data);
      } else {
        Alert.alert('錯誤', data.error || '搜尋失敗');
      }
    } catch (error) {
      console.error('搜尋貼文錯誤:', error);
      Alert.alert('錯誤', '搜尋失敗，請稍後再試');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchInput.trim()) return;
    setSearchMode(true);
    searchPosts(searchInput.trim(), []);
  };

  const clearSearch = () => {
    setSearchMode(false);
    setSearchInput('');
    setSearchResults([]);
  };

  const deletePost = async (postId: number) => {
    if (!currentUser) return;
    Alert.alert('刪除貼文', '確定要刪除這篇貼文嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除', style: 'destructive', onPress: async () => {
          try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/post/${postId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.ok) {
              setPosts((prev) => prev.filter((p) => p.community_post_id !== postId));
            } else {
              Alert.alert('錯誤', data.error ?? '刪除失敗');
            }
          } catch {
            Alert.alert('錯誤', '網路連線失敗');
          }
        },
      },
    ]);
  };

  const submitReport = async () => {
    if (!reportModalPostId || !reportReason || !currentUser) return;
    setReportSubmitting(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/post/${reportModalPostId}/report`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason }),
      });
      const data = await res.json();
      if (data.ok) {
        setReportModalPostId(null);
        setReportReason('');
        Alert.alert('已送出', '感謝您的檢舉，我們將盡快審查。');
      } else {
        Alert.alert('錯誤', data.error ?? '檢舉失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setReportSubmitting(false);
    }
  };

  const submitShare = async () => {
    if (!shareTarget || !currentUser) return;
    setSharing(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/share/${shareTarget.community_post_id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_caption: shareCaption.trim(), visibility: 'public' }),
      });
      const data = await res.json();
      if (data.ok ?? data.success) {
        setShareTarget(null);
        setShareCaption('');
        fetchPosts(true, selectedTag);
      } else {
        Alert.alert('錯誤', data.error ?? '轉發失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setSharing(false);
    }
  };

  const toggleLike = async (postId: number, isLiked: boolean) => {
    if (!currentUser) return;
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.community_post_id === postId
          ? { ...p, is_liked: !isLiked, like_count: (p.like_count ?? 0) + (isLiked ? -1 : 1) }
          : p
      )
    );
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/like/${postId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.community_post_id === postId
              ? { ...p, is_liked: data.data.isLiked, like_count: data.data.likeCount }
              : p
          )
        );
      } else {
        // Revert on failure
        setPosts((prev) =>
          prev.map((p) =>
            p.community_post_id === postId
              ? { ...p, is_liked: isLiked, like_count: (p.like_count ?? 0) + (isLiked ? 1 : -1) }
              : p
          )
        );
      }
    } catch {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) =>
          p.community_post_id === postId
            ? { ...p, is_liked: isLiked, like_count: (p.like_count ?? 0) + (isLiked ? 1 : -1) }
            : p
        )
      );
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`./community/post/${item.community_post_id}`)}
    >
      <GlassCard style={styles.postCard}>
        {/* Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); router.push(`/user/${item.author_user_id}` as never); }}
          >
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.username ? item.username[0] : '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.postMeta}>
            <View style={styles.authorRow}>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); router.push(`/user/${item.author_user_id}` as never); }}>
                <Text style={styles.authorName}>{item.username ?? '匿名'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    if (item.is_owner) {
                      Alert.alert('操作', '', [
                        { text: '編輯', onPress: () => router.push(`/community/edit/${item.community_post_id}` as never) },
                        { text: '刪除', style: 'destructive', onPress: () => deletePost(item.community_post_id) },
                        { text: '取消', style: 'cancel' },
                      ]);
                    } else {
                      setReportMenuPostId(item.community_post_id);
                    }
                  }}
                  style={styles.postMenuBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.postMenuIcon}>⋯</Text>
                </TouchableOpacity>
              {item.post_type !== 'original' && POST_TYPE_LABELS[item.post_type] && (
                <TouchableOpacity onPress={() => onPostTypePress(item.post_type)}>
                  <Text style={[styles.categoryLabel, selectedPostType === item.post_type && styles.categoryLabelActive]}>
                    {' > '}{POST_TYPE_LABELS[item.post_type]}
                  </Text>
                </TouchableOpacity>
              )}
              {/* Tags inline after username */}
              {item.tags && item.tags.length > 0 && (
                <>
                  {item.tags.map((t, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={(e) => { e.stopPropagation(); onTagPress(t); }}
                    >
                      <Text style={[styles.inlineTag, selectedTag === t && styles.inlineTagActive]}>
                        {' > #'}{t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
            <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>

        {/* Caption (for shared posts) */}
        {item.post_text ? <Text style={styles.postText}>{item.post_text}</Text> : null}

        {/* Post image */}
        {item.post_pic ? (
          <Image source={{ uri: item.post_pic }} style={styles.postImage} resizeMode="contain" />
        ) : null}

        {/* Diary card attachment */}
        {item.diary_card && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={(e) => { e.stopPropagation(); setDiaryModalCard(item.diary_card!); }}
            style={styles.diaryCard}
          >
            <View style={styles.diaryCardHeader}>
              <Text style={styles.diaryCardIcon}>📖</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.diaryCardDate}>{item.diary_card.diary_date}</Text>
                <Text style={styles.diaryCardTitle} numberOfLines={1}>
                  {item.diary_card.diary_title}
                </Text>
              </View>
            </View>
            <Text style={styles.diaryCardPreview} numberOfLines={2}>
              {item.diary_card.diary_content.slice(0, 30)}
              {item.diary_card.diary_content.length > 30 ? '...' : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* Summary card attachment */}
        {item.summary_card && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={(e) => { e.stopPropagation(); setSummaryModalCard(item.summary_card!); }}
            style={styles.summaryCard}
          >
            <View style={styles.diaryCardHeader}>
              <Text style={styles.diaryCardIcon}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.diaryCardDate}>
                  {item.summary_card.year} 年 第 {item.summary_card.week_number} 週回顧
                </Text>
                <Text style={styles.diaryCardTitle} numberOfLines={1}>
                  {item.summary_card.summary_title}
                </Text>
              </View>
            </View>
            <Text style={styles.diaryCardPreview} numberOfLines={2}>
              {item.summary_card.summary_content.slice(0, 60)}
              {item.summary_card.summary_content.length > 60 ? '...' : ''}
            </Text>
            {item.summary_card.bible_quote ? (
              <Text style={styles.summaryCardBible} numberOfLines={1}>
                📖 {item.summary_card.bible_quote}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}

        {/* ✨ Letter card attachment */}
{item.letter_card && (
  <View style={styles.letterCard}>
    <View style={styles.letterCardRow}>
      {item.letter_card.image_url ? (
        <Image
          source={{ uri: item.letter_card.image_url }}
          style={styles.letterCardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.letterCardImagePlaceholder}>
          <Text style={{ fontSize: 20 }}>🖼️</Text>
        </View>
      )}
      <View style={styles.letterCardText}>
        {item.letter_card.question ? (
          <Text style={styles.letterCardQuestion} numberOfLines={2}>
            {item.letter_card.question}
          </Text>
        ) : null}
        <Text style={styles.letterCardPreview} numberOfLines={3}>
          {item.letter_card.summary_text?.slice(0, 80)}
          {(item.letter_card.summary_text?.length ?? 0) > 80 ? '...' : ''}
        </Text>
        {item.letter_card.quote ? (
          <Text style={styles.letterCardQuote} numberOfLines={2}>
            「{item.letter_card.quote}」
          </Text>
        ) : null}
      </View>
    </View>
  </View>
)}

        {/* Embedded original post */}
        {item.post_type === 'shared' && item.original_post && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`./community/post/${item.original_post!.community_post_id}`);
            }}
            style={styles.quotedCard}
          >
            <View style={styles.quotedHeader}>
              {item.original_post.original_author_avatar ? (
                <Image source={{ uri: item.original_post.original_author_avatar }} style={styles.quotedAvatar} />
              ) : (
                <View style={styles.quotedAvatarPlaceholder}>
                  <Text style={styles.quotedAvatarText}>
                    {item.original_post.original_author_name?.[0] ?? '?'}
                  </Text>
                </View>
              )}
              <Text style={styles.quotedAuthor}>
                {item.original_post.original_author_name ?? '匿名'}
              </Text>
              <Text style={styles.quotedTime}> · {timeAgo(item.original_post.created_at)}</Text>
            </View>
            {item.original_post.post_text ? (
              <Text style={styles.quotedText} numberOfLines={3}>
                {item.original_post.post_text}
              </Text>
            ) : null}
            {item.original_post.diary_card && (
              <View style={[styles.quotedCard, { marginBottom: 0, marginTop: 6 }]}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 14 }}>📖</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quotedAuthor} numberOfLines={1}>
                      {item.original_post.diary_card.diary_title}
                    </Text>
                    <Text style={styles.quotedText} numberOfLines={1}>
                      {item.original_post.diary_card.diary_content.slice(0, 30)}
                      {item.original_post.diary_card.diary_content.length > 30 ? '...' : ''}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              toggleLike(item.community_post_id, !!item.is_liked);
            }}
          >
            <Text style={styles.actionIcon}>{item.is_liked ? '🤍' : '🙏'}</Text>
            <Text style={styles.actionText}>{item.like_count ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`./community/post/${item.community_post_id}`);
            }}
          >
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionText}>{item.comment_count ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              setShareTarget(item);
              setShareCaption('');
            }}
          >
            <Text style={styles.actionIcon}>🔄</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  return (
    <VideoBackground source={require('../../assets/backgrounds/main.mp4')}>
      <View style={styles.container}>
        {/* 頂部搜尋區 */}
        <CopilotStep
          text="心靈營火：這是信仰分享的社群空間，你可以搜尋、閱讀他人的祈禱日記與週回顧，互相鼓勵。"
          order={10}
          name="community_topbar"
        >
          <WalkthroughableView collapsable={false}>
            <GlassCard style={styles.searchCard} intensity={85}>
              <Text style={styles.searchLabel}>搜尋貼文</Text>
              <View style={styles.searchInputRow}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchTextInput}
                  placeholder="關鍵字..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={searchInput}
                  onChangeText={setSearchInput}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  underlineColorAndroid="transparent"
                  cursorColor="#ffffff"
                  selectionColor="rgba(255,255,255,0.5)"
                />
                {(searchMode || searchInput.length > 0) ? (
                  <TouchableOpacity style={styles.clearButton} onPress={clearSearch} hitSlop={8}>
                    <Text style={styles.clearButtonText}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </GlassCard>
          </WalkthroughableView>
        </CopilotStep>

        {/* Sort tabs (only in search mode) */}
        {searchMode && (
          <View style={styles.sortRow}>
            {(['newest', 'popular'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.sortBtn, sortBy === s && styles.sortBtnActive]}
                onPress={() => {
                  setSortBy(s);
                  searchPosts(searchInput.trim(), [], s);
                }}
              >
                <Text style={[styles.sortBtnText, sortBy === s && styles.sortBtnTextActive]}>
                  {s === 'newest' ? '最新' : '熱門'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Active post type filter */}
        {!searchMode && selectedPostType && (
          <TouchableOpacity
            style={[styles.filterBar, styles.filterBarType]}
            onPress={() => onPostTypePress(selectedPostType)}
          >
            <Text style={[styles.filterBarText, styles.filterBarTypeText]}>{POST_TYPE_LABELS[selectedPostType]}</Text>
            <Text style={[styles.filterBarClose, styles.filterBarTypeText]}>✕</Text>
          </TouchableOpacity>
        )}

        {/* Active tag filter */}
        {!searchMode && selectedTag && (
          <TouchableOpacity
            style={styles.filterBar}
            onPress={() => onTagPress(selectedTag)}
          >
            <Text style={styles.filterBarText}>#{selectedTag}</Text>
            <Text style={styles.filterBarClose}>✕</Text>
          </TouchableOpacity>
        )}

        {/* 步驟 12：貼文互動提示 */}
        <CopilotStep
          text="貼文互動：🙏 為貼文祈禱按讚、💬 留言回應、🔄 轉發分享，點貼文標題可閱讀完整內容。"
          order={12}
          name="community_actions"
        >
          <View />
        </CopilotStep>

        {(loading && !refreshing) || searchLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
            <Text style={styles.loadingText}>{searchLoading ? '搜尋中...' : '載入中...'}</Text>
          </View>
        ) : (
          <FlatList
            data={searchMode ? searchResults : (selectedTag ? posts.filter(p => p.tags?.includes(selectedTag)) : posts)}
            renderItem={renderPost}
            keyExtractor={(item) => item.community_post_id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="rgba(255,255,255,0.8)"
              />
            }
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <GlassCard style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>{searchMode ? '🔍' : '🕊️'}</Text>
                <Text style={styles.emptyText}>
                  {searchMode ? '找不到相關貼文' : '尚未注入火苗，來分享第一篇吧！'}
                </Text>
              </GlassCard>
            }
            ListFooterComponent={
              hasMore ? (
                <ActivityIndicator
                  style={{ marginVertical: 16 }}
                  color="rgba(255,255,255,0.7)"
                />
              ) : null
            }
          />
        )}

        {/* 步驟 13：發文按鈕 */}
        <CopilotStep
          text="發表貼文：點此分享你的祈禱日記、週回顧或信仰心得，讓火苗溫暖更多人。"
          order={13}
          name="community_fab"
        >
          <WalkthroughableView collapsable={false} style={styles.fabWrapper}>
            <TouchableOpacity
              style={styles.fab}
              onPress={() => router.push('./community/create')}
            >
              <Text style={styles.fabText}>＋</Text>
            </TouchableOpacity>
          </WalkthroughableView>
        </CopilotStep>

        {/* 步驟 14：分享卡片說明 */}
        <CopilotStep
          text="點擊分享文字或卡片可閱讀完整內容，與原作者互動。"
          order={14}
          name="community_share"
        >
          <WalkthroughableView collapsable={false} style={{ height: 0 }} />
        </CopilotStep>

        {/* 重新啟動導覽 */}
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => start('community_topbar')}
        >
          <Text style={styles.helpButtonText}>?</Text>
        </TouchableOpacity>
      </View>

      {/* Diary Full Content Modal */}
      <Modal
        visible={!!diaryModalCard}
        transparent
        animationType="fade"
        onRequestClose={() => setDiaryModalCard(null)}
      >
        <TouchableOpacity
          style={styles.diaryOverlay}
          activeOpacity={1}
          onPress={() => setDiaryModalCard(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.diaryFloatCard} onPress={() => {}}>
            {/* Header */}
            <View style={styles.diaryFloatHeader}>
              <Text style={styles.diaryFloatIcon}>📖</Text>
              <Text style={styles.diaryFloatTitle} numberOfLines={2}>
                {diaryModalCard?.diary_title}
              </Text>
              <TouchableOpacity onPress={() => setDiaryModalCard(null)} style={styles.diaryFloatClose}>
                <Text style={styles.diaryFloatCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.diaryFloatDate}>{diaryModalCard?.diary_date}</Text>
            {/* 分隔線 */}
            <View style={styles.diaryFloatDivider} />
            <ScrollView style={styles.diaryFloatScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.diaryFloatContent}>{diaryModalCard?.diary_content}</Text>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Summary Full Content Modal */}
      <Modal
        visible={!!summaryModalCard}
        transparent
        animationType="fade"
        onRequestClose={() => setSummaryModalCard(null)}
      >
        <TouchableOpacity
          style={styles.diaryOverlay}
          activeOpacity={1}
          onPress={() => setSummaryModalCard(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.diaryFloatCard} onPress={() => {}}>
            <View style={styles.diaryFloatHeader}>
              <Text style={styles.diaryFloatIcon}>✨</Text>
              <Text style={styles.diaryFloatTitle} numberOfLines={2}>
                {summaryModalCard?.summary_title}
              </Text>
              <TouchableOpacity onPress={() => setSummaryModalCard(null)} style={styles.diaryFloatClose}>
                <Text style={styles.diaryFloatCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.diaryFloatDate}>
              {summaryModalCard?.year} 年 第 {summaryModalCard?.week_number} 週
            </Text>
            <View style={styles.diaryFloatDivider} />
            <ScrollView style={styles.diaryFloatScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.diaryFloatContent}>{summaryModalCard?.summary_content}</Text>
              {summaryModalCard?.bible_quote && (
                <Text style={styles.summaryFloatBible}>📖 {summaryModalCard.bible_quote}</Text>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    
    
    
      {/* Share Modal */}
      <Modal
        visible={!!shareTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setShareTarget(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>轉發貼文</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="加入你的想法（可留空）"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={shareCaption}
              onChangeText={setShareCaption}
              multiline
              maxLength={500}
            />

            {/* Preview of original post */}
            {shareTarget && (
              <View style={[styles.quotedCard, { marginBottom: 16 }]}>
                <View style={styles.quotedHeader}>
                  {shareTarget.avatar_url ? (
                    <Image source={{ uri: shareTarget.avatar_url }} style={styles.quotedAvatar} />
                  ) : (
                    <View style={styles.quotedAvatarPlaceholder}>
                      <Text style={styles.quotedAvatarText}>
                        {shareTarget.username?.[0] ?? '?'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.quotedAuthor}>{shareTarget.username ?? '匿名'}</Text>
                  <Text style={styles.quotedTime}> · {timeAgo(shareTarget.created_at)}</Text>
                </View>
                {shareTarget.post_text ? (
                  <Text style={styles.quotedText} numberOfLines={3}>
                    {shareTarget.post_text}
                  </Text>
                ) : null}
                {shareTarget.diary_card && (
                  <View style={[styles.diaryCard, { marginBottom: 0, marginTop: 6 }]}>
                    <View style={styles.diaryCardHeader}>
                      <Text style={styles.diaryCardIcon}>📖</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.diaryCardDate}>{shareTarget.diary_card.diary_date}</Text>
                        <Text style={styles.diaryCardTitle} numberOfLines={1}>
                          {shareTarget.diary_card.diary_title}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.diaryCardPreview} numberOfLines={2}>
                      {shareTarget.diary_card.diary_content.slice(0, 30)}
                      {shareTarget.diary_card.diary_content.length > 30 ? '...' : ''}
                    </Text>
                  </View>
                )}
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShareTarget(null)}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={submitShare}
                disabled={sharing}
              >
                {sharing
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.modalSubmitText}>轉發</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
          
        </KeyboardAvoidingView>
      </Modal>

      {/* 檢舉選單 Modal */}
      <Modal
        visible={reportMenuPostId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setReportMenuPostId(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setReportMenuPostId(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.reportMenuCard}>
            <View style={styles.reportMenuHandle} />
            <TouchableOpacity
              style={styles.reportMenuOption}
              onPress={() => {
                setReportModalPostId(reportMenuPostId);
                setReportMenuPostId(null);
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
        visible={reportModalPostId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setReportModalPostId(null); setReportReason(''); }}
      >
        <View style={styles.diaryOverlay}>
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
            <View style={[styles.modalButtons, { marginTop: 12 }]}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setReportModalPostId(null); setReportReason(''); }}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, (!reportReason || reportSubmitting) && { opacity: 0.5 }]}
                onPress={submitReport}
                disabled={!reportReason || reportSubmitting}
              >
                {reportSubmitting
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.modalSubmitText}>送出檢舉</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderColor: 'rgba(255,255,255,0.01)',
    borderWidth: 1,
  },
  searchLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  clearButtonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  postCard: {
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  postMeta: { flex: 1 },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  categoryLabel: {
    fontSize: 14,
    color: 'rgba(135,206,250,0.9)',
    fontWeight: '500',
  },
  categoryLabelActive: {
    color: 'rgba(255,215,0,0.95)',
    fontWeight: '700',
  },
  inlineTag: {
    fontSize: 14,
    color: 'rgba(173,216,230,0.9)',
    fontWeight: '500',
  },
  inlineTagActive: {
    color: 'rgba(255,215,0,0.95)',
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  tagText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  postText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 300,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 10,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  actionIcon: { fontSize: 18 },
  actionText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  emptyCard: {
    marginTop: 60,
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  tourActionHint: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tourActionText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    letterSpacing: 2,
  },
  fabWrapper: {
    position: 'absolute',
    right: 24,
    bottom: 24,
  },
  helpButton: {
    position: 'absolute',
    right: 24,
    bottom: 92,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '700',
  },
  fab: {
    right: 0,
    bottom: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.90)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    lineHeight: 28,
    color: 'rgba(20,50,90,0.85)',
    fontWeight: '400',
    textAlign: 'center',
    includeFontPadding: false,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    paddingVertical: 0,
  },
  sortRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  sortBtn: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sortBtnActive: {
    backgroundColor: 'rgba(0,122,255,0.5)',
    borderColor: 'rgba(0,122,255,0.7)',
  },
  sortBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  sortBtnTextActive: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  filterBarType: {
    backgroundColor: 'rgba(135,206,250,0.15)',
    borderColor: 'rgba(135,206,250,0.4)',
  },
  filterBarTypeText: {
    color: 'rgba(135,206,250,0.95)',
  },
  filterBarText: {
    fontSize: 14,
    color: 'rgba(255,215,0,0.95)',
    fontWeight: '600',
  },
  filterBarClose: {
    fontSize: 14,
    color: 'rgba(255,215,0,0.7)',
    paddingLeft: 8,
  },
  postMenuBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 6,
  },
  postMenuIcon: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
  },

  // Summary card attachment
  summaryCard: {
    borderWidth: 1,
    borderColor: 'rgba(180,140,255,0.35)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  summaryCardBible: {
    fontSize: 12,
    color: 'rgba(200,170,255,0.85)',
    fontStyle: 'italic',
    marginTop: 4,
  },
  summaryFloatBible: {
    fontSize: 14,
    color: 'rgba(200,170,255,0.9)',
    fontStyle: 'italic',
    marginTop: 16,
    lineHeight: 22,
  },

  // Diary card attachment
  diaryCard: {
    borderWidth: 1,
    borderColor: 'rgba(100,180,255,0.35)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.20)',
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
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  quotedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  quotedAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  quotedAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  quotedAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  quotedAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  quotedTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  quotedText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
  },

  // Diary floating card modal
  diaryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  diaryFloatCard: {
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
  diaryFloatHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  diaryFloatIcon: { fontSize: 20, marginTop: 2 },
  diaryFloatTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 22,
  },
  diaryFloatClose: {
    padding: 4,
    marginTop: -2,
  },
  diaryFloatCloseText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
  },
  diaryFloatDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
    marginLeft: 30,
  },
  diaryFloatDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
  },
  diaryFloatScroll: { flexGrow: 0 },
  diaryFloatContent: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 25,
  },

  // Share modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: 'rgba(30,30,50,0.97)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    marginBottom: 14,
  },
  modalInput: {
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
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalCancelText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,122,255,0.8)',
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },

  // 檢舉相關
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
  reportMenuOptionRed: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  reportMenuOptionIcon: { fontSize: 20 },
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
  reportReasonOptionText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
  },
  reportReasonOptionTextSelected: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  reportReasonCheck: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '700',
  },

  // ✨ Letter card
  letterCard: {
    borderWidth: 1,
    borderColor: 'rgba(80,180,120,0.4)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(0,60,30,0.25)',
  },
  letterCardRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  letterCardImage: {
    width: 70,
    height: 100,
    borderRadius: 8,
    flexShrink: 0,
  },
  letterCardImagePlaceholder: {
    width: 70,
    height: 100,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  letterCardText: {
    flex: 1,
    gap: 5,
  },
  letterCardQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  letterCardPreview: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 17,
  },
  letterCardQuote: {
    fontSize: 12,
    color: 'rgba(180,230,180,0.85)',
    fontStyle: 'italic',
    lineHeight: 17,
  },
});