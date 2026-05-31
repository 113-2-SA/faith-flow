import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassCard } from '../../components/GlassCard';
import { VideoBackground } from '../../components/VideoBackground';
import { API_BASE_URL } from '../../lib/api';
import { useAuth } from '../context/authcontext';
import { HEADER_CONTENT_HEIGHT } from '../../components/AppShell';
import { timeAgo } from '../../utils/dateUtils';

interface ReportEntry {
  report_id: string;
  reason: string;
  reporter_name: string;
  created_at: string;
}

interface ReportItem {
  post_id: string | null;
  comment_id: string | null;
  content_text: string;
  content_type: string;
  content_created_at: string;
  author_name: string;
  report_count: number;
  reports: ReportEntry[];
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  normal: '原創分享',
  diary: '日記分享',
  summary: '週回顧分享',
  letter: '信箋',
  shared: '轉發',
  comment: '留言',
};

export default function AdminReportsScreen() {
  const router = useRouter();
  const { currentUser, isAdmin } = useAuth();

  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [currentUser])
  );

  function itemKey(item: ReportItem) {
    return item.post_id ? `post-${item.post_id}` : `comment-${item.comment_id}`;
  }

  async function fetchReports() {
    if (!currentUser) return;
    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/post/reports/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setItems(data.data ?? []);
      else Alert.alert('錯誤', data.error ?? '無法取得檢舉列表');
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setLoading(false);
    }
  }

  async function resolveItem(item: ReportItem) {
    if (!currentUser) return;
    const key = itemKey(item);
    setResolvingKey(key);
    try {
      const token = await currentUser.getIdToken();
      const url = item.post_id
        ? `${API_BASE_URL}/api/post/${item.post_id}/reports/resolve`
        : `${API_BASE_URL}/api/post/comment/${item.comment_id}/reports/resolve`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setItems(prev => prev.filter(i => itemKey(i) !== key));
      } else {
        Alert.alert('錯誤', data.error ?? '操作失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setResolvingKey(null);
    }
  }

  // 管理員刪除：呼叫 /:id/admin 端點（後端負責解決檢舉 + 刪除內容）
  async function execDelete(item: ReportItem) {
    if (!currentUser) return;
    const isComment = !!item.comment_id;
    const key = itemKey(item);
    setConfirmingKey(null);
    setDeletingKey(key);
    try {
      const token = await currentUser.getIdToken();
      const url = isComment
        ? `${API_BASE_URL}/api/comments/${item.comment_id}/admin`
        : `${API_BASE_URL}/api/post/${item.post_id}/admin`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setItems(prev => prev.filter(i => itemKey(i) !== key));
      } else {
        Alert.alert('刪除失敗', data.error ?? '請確認管理員權限');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setDeletingKey(null);
    }
  }

  const renderItem = ({ item }: { item: ReportItem }) => {
    const key = itemKey(item);
    const isExpanded = expanded === key;
    const isResolving = resolvingKey === key;
    const isDeleting = deletingKey === key;
    const isConfirming = confirmingKey === key;
    const isComment = !!item.comment_id;
    const typeLabel = CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type;

    return (
      <GlassCard style={styles.card}>
        {/* 內容預覽 */}
        <TouchableOpacity
          onPress={() => {
            if (!isComment && item.post_id) {
              router.push(`/community/post/${item.post_id}` as never);
            }
          }}
          activeOpacity={isComment ? 1 : 0.7}
        >
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons
              name={isComment ? 'comment-text-outline' : 'file-document-outline'}
              size={14}
              color="rgba(255,255,255,0.45)"
            />
            <Text style={styles.typeLabel}>{typeLabel}</Text>
            <Text style={styles.authorName}> · {item.author_name}</Text>
            <Text style={styles.postTime}> · {timeAgo(item.content_created_at)}</Text>
          </View>
          {!!item.content_text && (
            <Text style={styles.postText} numberOfLines={2}>{item.content_text}</Text>
          )}
        </TouchableOpacity>

        {/* 檢舉摘要列（點開展開） */}
        <TouchableOpacity
          style={styles.reportSummaryRow}
          onPress={() => setExpanded(isExpanded ? null : key)}
          activeOpacity={0.7}
        >
          <View style={styles.reportBadge}>
            <Text style={styles.reportBadgeText}>🚩 {item.report_count} 筆檢舉</Text>
          </View>
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="rgba(255,255,255,0.5)"
          />
        </TouchableOpacity>

        {/* 展開的檢舉詳情 */}
        {isExpanded && (
          <View style={styles.reportList}>
            {item.reports.map((r) => (
              <View key={r.report_id} style={styles.reportRow}>
                <Text style={styles.reporterName}>{r.reporter_name}</Text>
                <Text style={styles.reportReason}>{r.reason}</Text>
                <Text style={styles.reportTime}>{timeAgo(r.created_at)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 操作區：一般模式 or 刪除確認模式 */}
        {isConfirming ? (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>
              確定要刪除這則{isComment ? '留言' : '貼文'}？
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.cancelConfirmBtn}
                onPress={() => setConfirmingKey(null)}
              >
                <Text style={styles.cancelConfirmText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() => execDelete(item)}
              >
                <Text style={styles.confirmDeleteText}>確定刪除</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.resolveBtn, isResolving && { opacity: 0.5 }]}
              onPress={() => resolveItem(item)}
              disabled={isResolving || isDeleting}
            >
              {isResolving
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.resolveBtnText}>標記已解決</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, isDeleting && { opacity: 0.5 }]}
              onPress={() => setConfirmingKey(key)}
              disabled={isDeleting || isResolving}
            >
              {isDeleting
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.deleteBtnText}>刪除{isComment ? '留言' : '貼文'}</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </GlassCard>
    );
  };

  if (!isAdmin) {
    return (
      <VideoBackground source={require('../../assets/backgrounds/main.mp4')}>
        <View style={styles.center}>
          <Text style={styles.noPermText}>無管理員權限</Text>
        </View>
      </VideoBackground>
    );
  }

  return (
    <VideoBackground source={require('../../assets/backgrounds/main.mp4')}>
      <View style={styles.container}>
        <View style={styles.backRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="rgba(255,255,255,0.95)" />
          </Pressable>
          <Text style={styles.pageTitle}>🚩 檢舉管理</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
            <Text style={styles.loadingText}>載入中...</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => itemKey(item)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onRefresh={fetchReports}
            refreshing={loading}
            ListEmptyComponent={
              <GlassCard style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyText}>目前沒有待處理的檢舉</Text>
              </GlassCard>
            }
          />
        )}
      </View>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noPermText: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  loadingText: { marginTop: 12, fontSize: 16, color: 'rgba(255,255,255,0.9)' },

  backRow: {
    position: 'absolute',
    top: -(HEADER_CONTENT_HEIGHT - 12),
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    zIndex: 500,
  },
  backBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,200,100,0.95)',
    marginLeft: 4,
  },

  listContent: { padding: 16, paddingBottom: 40 },

  card: { marginBottom: 14 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  typeLabel: {
    fontSize: 12,
    color: 'rgba(135,206,250,0.85)',
    fontWeight: '600',
    marginLeft: 4,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  postTime: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  postText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 10,
  },

  reportSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
    marginBottom: 4,
  },
  reportBadge: {
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  reportBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B6B',
  },

  reportList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 4,
    marginBottom: 8,
  },
  reportRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 3,
  },
  reporterName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  reportReason: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  reportTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
    marginTop: 4,
  },
  resolveBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(50,180,100,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveBtnText: { fontSize: 13, fontWeight: '700', color: 'white' },
  deleteBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(220,50,50,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 13, fontWeight: '700', color: 'white' },

  confirmRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,100,100,0.3)',
    paddingTop: 10,
    marginTop: 4,
    gap: 8,
  },
  confirmText: {
    fontSize: 13,
    color: 'rgba(255,180,180,0.95)',
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelConfirmBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  cancelConfirmText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(220,50,50,0.85)',
    alignItems: 'center',
  },
  confirmDeleteText: { fontSize: 13, fontWeight: '700', color: 'white' },

  emptyCard: { marginTop: 60, alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
});
