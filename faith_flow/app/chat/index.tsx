// app/chat/index.tsx
// 有答大師 - 聊天介面（功能測試版，之後同學可以直接換 UI）

import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../context/authcontext';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// ─── 型別定義 ─────────────────────────────────────────────────────────────
interface Citation {
  tier: string;
  title: string;
  author: string;
  year: string;
  reference: string;
  cited_text: string;
  url: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  query?: string;
  knowledge_answer?: string;
  companion_response?: string;
  citations?: Citation[];
  error?: string;
  timestamp: Date;
}

// ─── 主元件 ───────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  const toggleCitations = useCallback((id: string) => {
    setExpandedCitations(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      query: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // 取得 Firebase token
      if (!currentUser) throw new Error('請先登入');
      const token = await currentUser.getIdToken(true);

      const res = await fetch(`${API_BASE}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: input.trim() }),
      });

      const data = await res.json();

      if (!data.ok) throw new Error(data.error || '伺服器錯誤');

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        knowledge_answer: data.data.knowledge_answer,
        companion_response: data.data.companion_response,
        citations: data.data.citations,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        error: err.message || '有答大師暫時無法回應，請稍後再試',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* 標題 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✝️ 有答大師</Text>
        <Text style={styles.headerSub}>天主教信仰問答</Text>
      </View>

      {/* 訊息列表 */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🕊️</Text>
            <Text style={styles.emptyText}>有什麼信仰上的問題嗎？{'\n'}我來幫你找答案。</Text>
          </View>
        )}

        {messages.map(msg => (
          <View key={msg.id}>
            {/* 使用者訊息 */}
            {msg.role === 'user' && (
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{msg.query}</Text>
              </View>
            )}

            {/* 助理訊息 */}
            {msg.role === 'assistant' && (
              <View style={styles.assistantContainer}>

                {/* 錯誤 */}
                {msg.error && (
                  <View style={styles.errorBubble}>
                    <Text style={styles.errorText}>⚠️ {msg.error}</Text>
                  </View>
                )}

                {/* 情感陪伴 */}
                {msg.companion_response && (
                  <View style={styles.companionBubble}>
                    <Text style={styles.companionLabel}>💙 陪伴回應</Text>
                    <Text style={styles.companionText}>{msg.companion_response}</Text>
                  </View>
                )}

                {/* 知識回答 */}
                {msg.knowledge_answer && (
                  <View style={styles.knowledgeBubble}>
                    <Text style={styles.knowledgeLabel}>📖 知識回答</Text>
                    <Text style={styles.knowledgeText}>{msg.knowledge_answer}</Text>
                  </View>
                )}

                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <TouchableOpacity
                    style={styles.citationToggle}
                    onPress={() => toggleCitations(msg.id)}
                  >
                    <Text style={styles.citationToggleText}>
                      📚 引用來源 ({msg.citations.length}) {expandedCitations.has(msg.id) ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                )}

                {expandedCitations.has(msg.id) && msg.citations && (
                  <View style={styles.citationList}>
                    {msg.citations.map((c, i) => (
                      <View key={i} style={styles.citationItem}>
                        <Text style={styles.citationTier}>【Tier {c.tier}】</Text>
                        <Text style={styles.citationTitle}>{c.title}</Text>
                        {c.author ? <Text style={styles.citationMeta}>作者：{c.author}</Text> : null}
                        {c.year ? <Text style={styles.citationMeta}>年份：{c.year}</Text> : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ))}

        {/* 載入中 */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#8B4513" />
            <Text style={styles.loadingText}>有答大師思考中⋯（約 30 秒）</Text>
          </View>
        )}
      </ScrollView>

      {/* 輸入區 */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="請輸入你的問題..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>送出</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── 樣式 ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },

  header: {
    backgroundColor: '#8B4513',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#FFD700', fontSize: 13, marginTop: 2 },

  messageList: { flex: 1 },
  messageListContent: { padding: 16, paddingBottom: 8 },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 24 },

  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#8B4513',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    maxWidth: '80%',
  },
  userText: { color: '#fff', fontSize: 15 },

  assistantContainer: { marginBottom: 16 },

  companionBubble: {
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#5B8DEF',
    padding: 12,
    marginBottom: 8,
  },
  companionLabel: { color: '#5B8DEF', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  companionText: { color: '#333', fontSize: 14, lineHeight: 22 },

  knowledgeBubble: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B4513',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  knowledgeLabel: { color: '#8B4513', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  knowledgeText: { color: '#333', fontSize: 14, lineHeight: 22 },

  errorBubble: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { color: '#CC0000', fontSize: 14 },

  citationToggle: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  citationToggleText: { color: '#8B4513', fontSize: 13 },

  citationList: {
    backgroundColor: '#FFF8F0',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  citationItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  citationTier: { color: '#8B4513', fontSize: 11, fontWeight: 'bold' },
  citationTitle: { color: '#333', fontSize: 13, fontWeight: '600', marginTop: 2 },
  citationMeta: { color: '#666', fontSize: 12, marginTop: 2 },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  loadingText: { color: '#888', fontSize: 13 },

  inputRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#333',
  },
  sendBtn: {
    backgroundColor: '#8B4513',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CCC' },
  sendBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});