// app/notifications/index.tsx
// A2 通知視窗頁面
// 目前用假資料，B 建好 notifications 表後只需換掉 fetchNotifications()

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { usePreferences } from '../context/preferencesContext';

// ─── 型別定義 ─────────────────────────────────────────────────────────────
type NotificationType = 'amen' | 'comment' | 'citation' | 'system';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: Date;
  read: boolean;
  // 之後 B 接 DB 會有更多欄位（fromUserId, postId, citationId 等）
}

// ─── 假資料（B 建好 DB 後換成 API 呼叫）──────────────────────────────────
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'amen',
    title: '有人對你的日記說了阿們',
    body: '小明 對你的日記「今日反思」說了阿們 🙏',
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
    read: false,
  },
  {
    id: '2',
    type: 'comment',
    title: '有人留言了',
    body: '小華 在你的貼文「聖週默想」留言：「謝謝你的分享！」',
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
    read: false,
  },
  {
    id: '3',
    type: 'citation',
    title: '你的日記被引用',
    body: '小美 在有答大師對話中引用了你的日記內容',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: true,
  },
  {
    id: '4',
    type: 'system',
    title: '系統通知',
    body: '歡迎使用天好運！記得今天寫日記 📖',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    read: true,
  },
];

// ─── 主元件 ───────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { preferences } = usePreferences();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // 之後 B 接 DB 時，把這裡換成 API 呼叫
  const fetchNotifications = async () => {
    // TODO: 換成 fetch(`${API_BASE}/api/notifications`, { headers: { Authorization } })
    return MOCK_NOTIFICATIONS;
  };

  useEffect(() => {
    fetchNotifications().then(setNotifications);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const data = await fetchNotifications();
    setNotifications(data);
    setRefreshing(false);
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // 如果社群通知關閉，過濾掉社群通知
  const filtered = notifications.filter(n => {
    if (!preferences.communityNotifications && ['amen', 'comment', 'citation'].includes(n.type)) {
      return false;
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* 標題列 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          🔔 通知
          {unreadCount > 0 && (
            <Text style={styles.badge}> ({unreadCount})</Text>
          )}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllBtn}>全部已讀</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 通知列表 */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B4513" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🕊️</Text>
            <Text style={styles.emptyText}>目前沒有通知</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.notifItem, !item.read && styles.notifUnread]}
            onPress={() => markRead(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.notifIcon}>{typeIcon(item.type)}</Text>
            <View style={styles.notifContent}>
              <Text style={styles.notifTitle}>{item.title}</Text>
              <Text style={styles.notifBody}>{item.body}</Text>
              <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// ─── 工具函式 ─────────────────────────────────────────────────────────────
function typeIcon(type: NotificationType) {
  switch (type) {
    case 'amen':     return '🙏';
    case 'comment':  return '💬';
    case 'citation': return '📚';
    case 'system':   return '📢';
  }
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return '剛剛';
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

// ─── 樣式 ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  badge: { color: '#8B4513' },
  markAllBtn: { color: '#8B4513', fontSize: 14 },

  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  notifUnread: { backgroundColor: '#FFF8F0' },
  notifIcon: { fontSize: 24, marginRight: 12, marginTop: 2 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  notifBody: { fontSize: 13, color: '#555', lineHeight: 20 },
  notifTime: { fontSize: 12, color: '#AAA', marginTop: 4 },
  unreadDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: '#8B4513',
    marginTop: 6,
    marginLeft: 8,
  },

  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 15 },
});
