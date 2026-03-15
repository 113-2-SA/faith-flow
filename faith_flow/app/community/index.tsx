import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
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
  const LIMIT = 20;

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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.username ? item.username[0] : '?'}
            </Text>
          </View>
          <View style={styles.postMeta}>
            <View style={styles.authorRow}>
              <Text style={styles.authorName}>{item.username ?? '匿名'}</Text>
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

        {/* Content */}
        <Text style={styles.postText}>{item.post_text}</Text>

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
            onPress={(e) => e.stopPropagation()}
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
          <Text style={styles.topBarTitle}>社群動態</Text>
        </GlassCard>

        {/* Active tag filter */}
        {selectedTag && (
          <TouchableOpacity
            style={styles.filterBar}
            onPress={() => onTagPress(selectedTag)}
          >
            <Text style={styles.filterBarText}>#{selectedTag}</Text>
            <Text style={styles.filterBarClose}>✕</Text>
          </TouchableOpacity>
        )}

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
            <Text style={styles.loadingText}>載入中...</Text>
          </View>
        ) : (
          <FlatList
            data={selectedTag ? posts.filter(p => p.tags?.includes(selectedTag)) : posts}
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
                <Text style={styles.emptyIcon}>🕊️</Text>
                <Text style={styles.emptyText}>還沒有貼文，來分享第一篇吧！</Text>
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
});