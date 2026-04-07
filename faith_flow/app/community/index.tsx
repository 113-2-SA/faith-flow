import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/authcontext';
import { API_BASE_URL } from '../../lib/api';
import { VideoBackground } from '../../components/VideoBackground';
import { GlassCard } from '../../components/GlassCard';



interface OriginalPost {
  community_post_id: number;
  post_text: string;
  created_at: string;
  original_author_name: string | null;
  original_author_avatar: string | null;
}

interface Post {
  community_post_id: number;
  author_user_id: number;
  post_text: string;
  post_type: 'original' | 'diary' | 'letter' | 'shared';
  visibility: 'public' | 'private' | 'friends';
  username: string | null;
  avatar_url: string | null;
  tags: string[];
  created_at: string;
  like_count?: number;
  comment_count?: number;
  is_liked?: boolean;
  is_owner?: boolean;
  original_post?: OriginalPost;
}

const POST_TYPE_LABELS: Record<string, string> = {
  normal: '原創分享',
  diary: '日記分享',
  letter: '信箋',
  shared: '轉發',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes}分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString('zh-TW');
}

export default function CommunityFeedScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<Post | null>(null);
  const [shareCaption, setShareCaption] = useState('');
  const [sharing, setSharing] = useState(false);
  const LIMIT = 20;

  // 搜尋相關狀態
  const [searchInput, setSearchInput] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');

  const fetchPosts = useCallback(async (reset = false, tag?: string | null) => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const currentOffset = reset ? 0 : offset;
      const activeTag = tag !== undefined ? tag : selectedTag;
      const tagParam = activeTag ? `&tag=${encodeURIComponent(activeTag)}` : '';
      const res = await fetch(
        `${API_BASE_URL}/api/post?visibility=public&limit=${LIMIT}&offset=${currentOffset}${tagParam}`,
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
    fetchPosts(true, selectedTag);
  };

  const onTagPress = (tag: string) => {
    const next = selectedTag === tag ? null : tag;
    setSelectedTag(next);
    setOffset(0);
    fetchPosts(true, next);
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
              {item.is_owner && (
                <TouchableOpacity
                  onPress={() => Alert.alert('操作', '', [
                    { text: '編輯', onPress: () => router.push(`/community/edit/${item.community_post_id}` as never) },
                    { text: '刪除', style: 'destructive', onPress: () => deletePost(item.community_post_id) },
                    { text: '取消', style: 'cancel' },
                  ])}
                  style={styles.postMenuBtn}
                >
                  <Text style={styles.postMenuIcon}>⋯</Text>
                </TouchableOpacity>
              )}
              {item.post_type !== 'original' && (
                <Text style={styles.categoryLabel}>
                  {' > '}{POST_TYPE_LABELS[item.post_type]}
                </Text>
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
            <Text style={styles.quotedText} numberOfLines={4}>
              {item.original_post.post_text}
            </Text>
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
        {/* Top bar */}
        <GlassCard style={styles.topBar}>
          <Text style={styles.topBarTitle}>心靈營火</Text>
        </GlassCard>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜尋貼文..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchMode ? (
            <TouchableOpacity style={styles.searchBtn} onPress={clearSearch}>
              <Text style={styles.searchBtnText}>✕</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Text style={styles.searchBtnText}>🔍</Text>
            </TouchableOpacity>
          )}
        </View>

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

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/community/create')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>

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
                <Text style={styles.quotedText} numberOfLines={4}>
                  {shareTarget.post_text}
                </Text>
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
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    margin: 16,
    marginBottom: 0,
    paddingVertical: 12,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
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
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,122,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '300',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
  },
  searchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  searchBtnText: {
    fontSize: 16,
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

  // Quoted / embedded original post
  quotedCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
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
});