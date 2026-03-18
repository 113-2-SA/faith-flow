import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/authcontext';
import { API_BASE_URL } from '../../lib/api';
import { VideoBackground } from '../../components/VideoBackground';
import { GlassCard } from '../../components/GlassCard';

interface UserProfile {
  userID: number;
  user_name: string;
  user_pic: string | null;
  profile: string | null;
  join_time: string;
}

interface Post {
  community_post_id: number;
  post_text: string;
  post_type: string;
  visibility: 'public' | 'private' | 'friends';
  created_at: string;
  like_count?: number;
  comment_count?: number;
}

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

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMe, setIsMe] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPic, setEditPic] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !currentUser) return;
    fetchAll();
  }, [id, currentUser]);

  async function fetchAll() {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();

      // 先並行取得「目標使用者」和「目前登入者」的資料
      const [userRes, meRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/user/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const userData = await userRes.json();
      const meData = await meRes.json();

      if (userData.ok) {
        setUser(userData.data);
        setEditName(userData.data.user_name ?? '');
        setEditPic(userData.data.user_pic ?? '');
        setEditBio(userData.data.profile ?? '');
      } else {
        Alert.alert('錯誤', userData.error ?? '無法取得使用者資料');
      }

      // 判斷是否本人，決定是否顯示所有貼文
      const mine = meData.ok && String(meData.data.userID) === String(id);
      setIsMe(mine);

      // 本人：用 /my 端點（回傳所有 visibility）；他人：只看 public
      const postsUrl = mine
        ? `${API_BASE_URL}/api/post/my?limit=50&offset=0`
        : `${API_BASE_URL}/api/post?user_id=${id}&visibility=public&limit=50&offset=0`;
      const postsRes = await fetch(postsUrl, { headers: { Authorization: `Bearer ${token}` } });
      const postsData = await postsRes.json();
      if (postsData.ok) setPosts(postsData.data);
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!currentUser) return;
    setSaving(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: editName.trim(),
          usePic: editPic.trim() || null,
          profile: editBio.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setUser((prev) => prev ? {
          ...prev,
          user_name: editName.trim(),
          user_pic: editPic.trim() || null,
          profile: editBio.trim(),
        } : prev);
        setEditing(false);
      } else {
        Alert.alert('錯誤', data.error ?? '儲存失敗');
      }
    } catch {
      Alert.alert('錯誤', '網路連線失敗');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <VideoBackground source={require('../../assets/backgrounds/main.mp4')}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
        </View>
      </VideoBackground>
    );
  }

  return (
    <VideoBackground source={require('../../assets/backgrounds/main.mp4')}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container}>
          {/* Header */}
          <GlassCard style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>個人檔案</Text>
            {isMe && !editing ? (
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editBtnText}>編輯</Text>
              </TouchableOpacity>
            ) : isMe && editing ? (
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(false)}>
                <Text style={styles.editBtnText}>取消</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backBtn} />
            )}
          </GlassCard>

          {/* Profile Card */}
          <GlassCard style={styles.profileCard}>
            {/* Avatar */}
            <View style={styles.avatarWrapper}>
              {(editing ? editPic : user?.user_pic) ? (
                <Image
                  source={{ uri: editing ? editPic : user!.user_pic! }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {(editing ? editName : user?.user_name)?.[0] ?? '?'}
                  </Text>
                </View>
              )}
            </View>

            {editing ? (
              /* Edit Form */
              <View style={styles.editForm}>
                <Text style={styles.fieldLabel}>使用者名稱</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="使用者名稱"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  maxLength={30}
                />
                <Text style={styles.fieldLabel}>頭像網址（URL）</Text>
                <TextInput
                  style={styles.input}
                  value={editPic}
                  onChangeText={setEditPic}
                  placeholder="https://..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <Text style={styles.fieldLabel}>自我介紹</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="介紹一下自己..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  multiline
                  maxLength={200}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={saveProfile}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={styles.saveBtnText}>儲存</Text>
                  }
                </TouchableOpacity>
              </View>
            ) : (
              /* View Mode */
              <>
                <Text style={styles.username}>{user?.user_name ?? '匿名'}</Text>
                {user?.join_time && (
                  <Text style={styles.joinTime}>
                    加入時間：{new Date(user.join_time).toLocaleDateString('zh-TW')}
                  </Text>
                )}
                {user?.profile ? (
                  <Text style={styles.bio}>{user.profile}</Text>
                ) : (
                  isMe && <Text style={styles.bioEmpty}>點擊「編輯」新增自我介紹</Text>
                )}
              </>
            )}
          </GlassCard>

          {/* Posts Section */}
          {!editing && (
            <GlassCard style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>貼文</Text>
              {posts.length === 0 ? (
                <Text style={styles.emptyText}>{isMe ? '尚無貼文' : '尚無公開貼文'}</Text>
              ) : (
                posts.map((post) => (
                  <TouchableOpacity
                    key={post.community_post_id}
                    style={styles.postItem}
                    onPress={() => router.push(`/community/post/${post.community_post_id}` as never)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.postText} numberOfLines={2}>
                      {post.post_text}
                    </Text>
                    <View style={styles.postFooter}>
                      <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
                      <View style={styles.postFooterRight}>
                        {isMe && (
                          <Text style={[
                            styles.visibilityBadge,
                            post.visibility === 'public' && styles.visibilityPublic,
                            post.visibility === 'friends' && styles.visibilityFriends,
                            post.visibility === 'private' && styles.visibilityPrivate,
                          ]}>
                            {post.visibility === 'public' ? '公開' : post.visibility === 'friends' ? '朋友' : '私人'}
                          </Text>
                        )}
                        <Text style={styles.postStats}>
                          🙏 {post.like_count ?? 0}  💬 {post.comment_count ?? 0}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </GlassCard>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 10,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backIcon: { fontSize: 28, color: 'rgba(255,255,255,0.9)', lineHeight: 32 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
  editBtn: { width: 40, alignItems: 'center' },
  editBtnText: {
    fontSize: 14,
    color: 'rgba(135,206,250,0.95)',
    fontWeight: '600',
  },

  profileCard: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 16,
  },
  avatarWrapper: { marginBottom: 14 },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 4,
    textAlign: 'center',
  },
  joinTime: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 10,
    textAlign: 'center',
  },
  bio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  bioEmpty: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Edit form
  editForm: { width: '100%', paddingHorizontal: 16 },
  fieldLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
  },
  inputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: 'rgba(0,122,255,0.7)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  saveBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.15)' },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },

  sectionCard: { paddingBottom: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingVertical: 16,
  },
  postItem: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  postText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 6,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postTime: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  postStats: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  visibilityBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  visibilityPublic: {
    backgroundColor: 'rgba(52,199,89,0.25)',
    color: 'rgba(52,199,89,0.95)',
  },
  visibilityFriends: {
    backgroundColor: 'rgba(90,200,250,0.25)',
    color: 'rgba(90,200,250,0.95)',
  },
  visibilityPrivate: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.5)',
  },
});
