// app/chat/index.tsx
// 有答大師 - 聊天介面（含引用回覆 + 情緒指標 + 對話管理）

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/authcontext';
import { toLocaleDateCST } from '../../utils/dateUtils';

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
  knowledge_blocks?: string[];
  companion_response?: string;
  citations?: Citation[];
  error?: string;
  timestamp: Date;
  quoted_content?: string;
  quoted_type?: 'knowledge' | 'companion';
  quoted_label?: string;
}

interface QuotedContent {
  type: 'knowledge' | 'companion';
  content: string;
  label: string;
}

interface ConversationItem {
  conversation_id: string;
  title: string;
  updated_at: string;
  status: string;
}

function parseMarkdownBlocks(text: string): string[] {
  if (!text) return [];
  const blocks = text.split(/\n\n+/).map(b => b.trim()).filter(b => b.length > 0);
  return blocks.length > 0 ? blocks : [text];
}

function updateEmotionScore(oldScore: number, newScore: number): number {
  return Math.round(oldScore * 0.6 + newScore * 0.4);
}

// ─── 主元件 ───────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());
  const [emotionScore, setEmotionScore] = useState<number | null>(null);
  const [quotedContent, setQuotedContent] = useState<QuotedContent | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAllConvsModal, setShowAllConvsModal] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const getToken = async () => {
    if (!currentUser) throw new Error('請先登入');
    return await currentUser.getIdToken(true);
  };

  const loadConversations = async () => {
    setConvsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/chat/history`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setConversations(data.data);
    } catch (err) {
      console.error('載入對話列表失敗:', err);
    } finally {
      setConvsLoading(false);
    }
  };

  const createNewConversation = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setCurrentConversationId(data.data.conversation_id);
        setMessages([]);
        setEmotionScore(null);
        setShowAllConvsModal(false);
      }
    } catch (err) {
      window.alert('建立新對話失敗');
    }
  };

  const switchConversation = async (convId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/chat/${convId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        const loadedMessages: Message[] = data.data.map((m: any) => ({
          id: m.message_id,
          role: m.role,
          query: m.role === 'user' ? m.content : undefined,
          knowledge_answer: m.role === 'assistant' ? m.content : undefined,
          knowledge_blocks: m.role === 'assistant' ? parseMarkdownBlocks(m.content) : undefined,
          companion_response: m.companion_response || undefined,
          citations: m.citations || [],
          timestamp: new Date(m.created_at),
        }));
        setMessages(loadedMessages);
        setCurrentConversationId(convId);
        setEmotionScore(null);
        setShowAllConvsModal(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      }
    } catch (err) {
      window.alert('載入對話失敗');
    }
  };

  const saveTitle = async (convId: string) => {
    if (!editingTitle.trim()) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/chat/${convId}/title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setConversations(prev =>
          prev.map(c => c.conversation_id === convId ? { ...c, title: editingTitle.trim() } : c)
        );
        setEditingId(null);
        setEditingTitle('');
      }
    } catch (err) {
      window.alert('修改標題失敗');
    }
  };

  const deleteConversation = async (convId: string) => {
    const confirmed = window.confirm('確定要刪除這個對話嗎？');
    if (!confirmed) return;
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/api/chat/${convId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setConversations(prev => prev.filter(c => c.conversation_id !== convId));
      if (currentConversationId === convId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      window.alert('刪除失敗');
    }
  };

  const toggleCitations = useCallback((id: string) => {
    setExpandedCitations(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAnswer = useCallback((id: string) => {
    setExpandedAnswers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleQuote = useCallback((type: 'knowledge' | 'companion', content: string) => {
    setQuotedContent({ type, content, label: type === 'knowledge' ? '📖 知識回答' : '💙 陪伴回應' });
  }, []);

  const cancelQuote = useCallback(() => setQuotedContent(null), []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const currentInput = input.trim();
    const currentQuote = quotedContent;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      query: currentInput,
      timestamp: new Date(),
      quoted_content: currentQuote?.content,
      quoted_type: currentQuote?.type,
      quoted_label: currentQuote?.label,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setQuotedContent(null);
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant',
      knowledge_answer: '', companion_response: undefined, citations: [], timestamp: new Date(),
    }]);

    try {
      if (!currentUser) throw new Error('請先登入');
      const token = await currentUser.getIdToken(true);

      const body: any = {
        message: currentInput,
        emotion_score: emotionScore ?? 50,
        conversationId: currentConversationId,
      };
      if (currentQuote) {
        body.quoted_content = currentQuote.content;
        body.quoted_type = currentQuote.type;
      }

      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('伺服器錯誤');

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const chunk = line.slice(6).trim();
          if (!chunk || chunk === '[DONE]') continue;
          try {
            const parsed = JSON.parse(chunk);
            if (parsed.type === 'start') {
              if (parsed.conversationId) setCurrentConversationId(parsed.conversationId);
            } else if (parsed.type === 'knowledge_chunk') {
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId ? { ...msg, knowledge_answer: (msg.knowledge_answer || '') + parsed.text } : msg
              ));
            } else if (parsed.type === 'companion') {
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId ? { ...msg, companion_response: parsed.text } : msg
              ));
            } else if (parsed.type === 'citations') {
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId ? { ...msg, citations: parsed.data } : msg
              ));
            } else if (parsed.type === 'title') {
              setConversations(prev =>
                prev.map(c => c.conversation_id === currentConversationId
                  ? { ...c, title: parsed.title }
                  : c
                )
              );
            } else if (parsed.type === 'emotion') {
              setEmotionScore(prev => updateEmotionScore(prev ?? 50, parsed.score));
            } else if (parsed.type === 'done') {
              setMessages(prev => prev.map(msg => {
                if (msg.id !== assistantId) return msg;
                return { ...msg, knowledge_blocks: parseMarkdownBlocks(msg.knowledge_answer || '') };
              }));
              setLoading(false);
            } else if (parsed.type === 'error') {
              throw new Error(parsed.message);
            }
          } catch (e) { /* skip */ }
        }
      }
    } catch (err: any) {
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? { ...msg, error: err.message || '有答大師暫時無法回應', knowledge_answer: undefined }
          : msg
      ));
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
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>✝️ 有答大師</Text>
            <Text style={styles.headerSub}>天主教信仰問答</Text>
          </View>
          <View style={styles.headerBtns}>
            {/* 4.2.1 對話回顧 */}
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowHistoryModal(true)}>
              <Text style={styles.headerBtnText}>🕐</Text>
            </TouchableOpacity>
            {/* 4.3.1 所有對話 */}
            <TouchableOpacity style={styles.headerBtn} onPress={() => { setShowAllConvsModal(true); loadConversations(); }}>
              <Text style={styles.headerBtnText}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>

        {emotionScore !== null && (
          <View style={styles.emotionContainer}>
            <Text style={styles.emotionLabel}>情緒指標</Text>
            <View style={styles.emotionBarBg}>
              <View style={[styles.emotionBarHalf, { backgroundColor: '#E74C3C' }]} />
              <View style={[styles.emotionBarHalf, { backgroundColor: '#3498DB' }]} />
              <View style={[styles.emotionIndicator, { left: `${emotionScore}%` as any }]} />
            </View>
            <View style={styles.emotionLabelRow}>
              <Text style={styles.emotionEndLabel}>感性</Text>
              <Text style={styles.emotionEndLabel}>理性</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── 訊息列表 ── */}
      <ScrollView ref={scrollRef} style={styles.messageList} contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🕊️</Text>
            <Text style={styles.emptyText}>有什麼信仰上的問題嗎？{'\n'}我來幫你找答案。</Text>
          </View>
        )}

        {messages.map(msg => (
          <View key={msg.id}>
            {msg.role === 'user' && (
              <View style={styles.userMsgContainer}>
                {msg.quoted_content && (
                  <View style={styles.userQuoteTag}>
                    <Text style={styles.userQuoteLabel}>{msg.quoted_label}</Text>
                    <Text style={styles.userQuoteText} numberOfLines={2}>
                      「{msg.quoted_content.slice(0, 60)}{msg.quoted_content.length > 60 ? '...' : ''}」
                    </Text>
                  </View>
                )}
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{msg.query}</Text>
                </View>
              </View>
            )}

            {msg.role === 'assistant' && (
              <View style={styles.assistantContainer}>
                {msg.error && <View style={styles.errorBubble}><Text style={styles.errorText}>⚠️ {msg.error}</Text></View>}

                {msg.companion_response && (
                  <View style={styles.companionBubble}>
                    <View style={styles.bubbleHeader}>
                      <Text style={styles.companionLabel}>💙 陪伴回應</Text>
                      <TouchableOpacity style={styles.quoteBtn} onPress={() => handleQuote('companion', msg.companion_response!)}>
                        <Text style={styles.quoteBtnText}>引用</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: '#333', fontSize: 14, lineHeight: 22 }}>{msg.companion_response}</Text>
                  </View>
                )}

                {msg.knowledge_blocks && msg.knowledge_blocks.length > 0 ? (
                  <>
                    <View style={styles.knowledgeBubble}>
                      <View style={styles.bubbleHeader}>
                        <Text style={styles.knowledgeLabel}>📖 知識回答</Text>
                        <TouchableOpacity style={styles.quoteBtn} onPress={() => handleQuote('knowledge', msg.knowledge_answer!)}>
                          <Text style={styles.quoteBtnText}>引用</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={{ color: '#333', fontSize: 14, lineHeight: 22 }}>{msg.knowledge_blocks[0]}</Text>
                    </View>
                    {expandedAnswers.has(msg.id) && msg.knowledge_blocks.slice(1).map((block, i) => (
<View key={i} style={styles.knowledgeBubble}><Text style={{ color: '#333', fontSize: 14, lineHeight: 22 }}>{block}</Text></View>                    ))}
                    {msg.knowledge_blocks.length > 1 && (
                      <TouchableOpacity style={styles.expandBtn} onPress={() => toggleAnswer(msg.id)}>
                        <Text style={styles.expandBtnText}>
                          {expandedAnswers.has(msg.id) ? '▲ 收合回答' : `▼ 查看完整回答（還有 ${msg.knowledge_blocks.length - 1} 段）`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : msg.knowledge_answer ? (
                  <View style={styles.knowledgeBubble}>
                    <View style={styles.bubbleHeader}><Text style={styles.knowledgeLabel}>📖 知識回答</Text></View>
<Text style={{ color: '#333', fontSize: 14, lineHeight: 22 }}>{msg.knowledge_answer}</Text>                  </View>
                ) : null}

                {msg.citations && msg.citations.length > 0 && (
                  <TouchableOpacity style={styles.citationToggle} onPress={() => toggleCitations(msg.id)}>
                    <Text style={styles.citationToggleText}>📚 引用來源 ({msg.citations.length}) {expandedCitations.has(msg.id) ? '▲' : '▼'}</Text>
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

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#8B4513" />
            <Text style={styles.loadingText}>有答大師思考中⋯</Text>
          </View>
        )}
      </ScrollView>

      {quotedContent && (
        <View style={styles.quotePreview}>
          <View style={styles.quotePreviewContent}>
            <Text style={styles.quotePreviewLabel}>{quotedContent.label}</Text>
            <Text style={styles.quotePreviewText} numberOfLines={2}>{quotedContent.content}</Text>
          </View>
          <TouchableOpacity onPress={cancelQuote} style={styles.quoteCancelBtn}>
            <Text style={styles.quoteCancelText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input} value={input} onChangeText={setInput}
          placeholder={quotedContent ? '針對引用內容提問...' : '請輸入你的問題...'}
          placeholderTextColor="#999" multiline maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={sendMessage} disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>送出</Text>
        </TouchableOpacity>
      </View>

      {/* ── 對話回顧視窗（4.2）── */}
      <Modal visible={showHistoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🕐 對話回顧</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {messages.length === 0 ? (
                <Text style={styles.modalEmpty}>目前沒有對話紀錄</Text>
              ) : (
                messages.map(msg => (
                  <View key={msg.id} style={styles.historyItem}>
                    {msg.role === 'user' ? (
                      <View style={styles.historyUserRow}>
                        <Text style={styles.historyRoleLabel}>你</Text>
                        <View style={styles.historyUserBubble}>
                          <Text style={styles.historyUserText}>{msg.query}</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.historyAssistantRow}>
                        <Text style={styles.historyRoleLabel}>有答大師</Text>
                        {msg.companion_response && (
                          <View style={styles.historyCompanionBubble}>
                            <Text style={styles.historyCompanionLabel}>💙 陪伴</Text>
                            <Text style={styles.historyText}>{msg.companion_response}</Text>
                            <TouchableOpacity style={styles.historyQuoteBtn}
                              onPress={() => { handleQuote('companion', msg.companion_response!); setShowHistoryModal(false); }}>
                              <Text style={styles.historyQuoteBtnText}>引用此段</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {msg.knowledge_answer && (
                          <View style={styles.historyKnowledgeBubble}>
                            <Text style={styles.historyKnowledgeLabel}>📖 知識</Text>
                            <Text style={styles.historyText} numberOfLines={4}>{msg.knowledge_answer}</Text>
                            <TouchableOpacity style={styles.historyQuoteBtn}
                              onPress={() => { handleQuote('knowledge', msg.knowledge_answer!); setShowHistoryModal(false); }}>
                              <Text style={styles.historyQuoteBtnText}>引用此段</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 所有對話視窗（4.3 + 4.4）── */}
      <Modal visible={showAllConvsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>☰ 所有對話</Text>
              <TouchableOpacity onPress={() => setShowAllConvsModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.newConvBtn} onPress={createNewConversation}>
              <Text style={styles.newConvBtnText}>＋ 建立新對話</Text>
            </TouchableOpacity>
            <ScrollView style={styles.modalBody}>
              {convsLoading ? (
                <ActivityIndicator color="#8B4513" style={{ marginTop: 20 }} />
              ) : conversations.length === 0 ? (
                <Text style={styles.modalEmpty}>沒有歷史對話</Text>
              ) : (
                conversations.map(conv => (
                  <View key={conv.conversation_id} style={styles.convItem}>
                    {editingId === conv.conversation_id ? (
                      <View style={styles.convEditRow}>
                        <TextInput style={styles.convEditInput} value={editingTitle} onChangeText={setEditingTitle} autoFocus />
                        <TouchableOpacity style={styles.convSaveBtn} onPress={() => saveTitle(conv.conversation_id)}>
                          <Text style={styles.convSaveBtnText}>儲存</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingId(null)}>
                          <Text style={styles.convCancelText}>取消</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.convRow}>
                        <TouchableOpacity style={styles.convInfo} onPress={() => switchConversation(conv.conversation_id)}>
                          <Text style={[styles.convTitle, currentConversationId === conv.conversation_id && styles.convTitleActive]}>
                            {currentConversationId === conv.conversation_id ? '▶ ' : ''}{conv.title || '新對話'}
                          </Text>
                          <Text style={styles.convDate}>{toLocaleDateCST(conv.updated_at)}</Text>
                        </TouchableOpacity>
                        <View style={styles.convActions}>
                          <TouchableOpacity style={styles.convActionBtn}
                            onPress={() => { setEditingId(conv.conversation_id); setEditingTitle(conv.title || ''); }}>
                            <Text style={styles.convActionText}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.convActionBtn} onPress={() => deleteConversation(conv.conversation_id)}>
                            <Text style={styles.convActionText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const markdownStyles = {
  body: { color: '#333', fontSize: 14, lineHeight: 22 },
  strong: { fontWeight: 'bold' as const, color: '#333' },
  em: { fontStyle: 'italic' as const },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  paragraph: { marginVertical: 4 },
  heading1: { fontSize: 18, fontWeight: 'bold' as const, color: '#8B4513' },
  heading2: { fontSize: 16, fontWeight: 'bold' as const, color: '#8B4513' },
  heading3: { fontSize: 15, fontWeight: 'bold' as const, color: '#8B4513' },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#8B4513', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#FFD700', fontSize: 13, marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  headerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  headerBtnText: { color: '#fff', fontSize: 18 },

  emotionContainer: { marginTop: 10 },
  emotionLabel: { color: '#FFD700', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  emotionBarBg: { height: 6, borderRadius: 3, overflow: 'visible', flexDirection: 'row', position: 'relative' },
  emotionBarHalf: { flex: 1, height: 6 },
  emotionIndicator: { position: 'absolute', top: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', marginLeft: -6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 },
  emotionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  emotionEndLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },

  messageList: { flex: 1 },
  messageListContent: { padding: 16, paddingBottom: 8 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 24 },

  userMsgContainer: { alignItems: 'flex-end', marginBottom: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#8B4513', borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '80%' },
  userText: { color: '#fff', fontSize: 15 },
  userQuoteTag: { backgroundColor: '#F0E8E0', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#8B4513', paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4, maxWidth: '80%' },
  userQuoteLabel: { color: '#8B4513', fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  userQuoteText: { color: '#555', fontSize: 12, lineHeight: 18, fontStyle: 'italic' },

  assistantContainer: { marginBottom: 16 },
  bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  quoteBtn: { backgroundColor: '#F0E8E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#8B4513' },
  quoteBtnText: { color: '#8B4513', fontSize: 12, fontWeight: '600' },
  companionBubble: { backgroundColor: '#EEF4FF', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#5B8DEF', padding: 12, marginBottom: 8 },
  companionLabel: { color: '#5B8DEF', fontSize: 12, fontWeight: 'bold' },
  knowledgeBubble: { backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#8B4513', padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  knowledgeLabel: { color: '#8B4513', fontSize: 12, fontWeight: 'bold' },
  expandBtn: { backgroundColor: '#FFF8F0', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E8D5C0', alignItems: 'center' },
  expandBtnText: { color: '#8B4513', fontSize: 13, fontWeight: '600' },
  errorBubble: { backgroundColor: '#FFF0F0', borderRadius: 12, padding: 12, marginBottom: 8 },
  errorText: { color: '#CC0000', fontSize: 14 },
  citationToggle: { paddingVertical: 6, paddingHorizontal: 4 },
  citationToggleText: { color: '#8B4513', fontSize: 13 },
  citationList: { backgroundColor: '#FFF8F0', borderRadius: 8, padding: 10, marginTop: 4 },
  citationItem: { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  citationTier: { color: '#8B4513', fontSize: 11, fontWeight: 'bold' },
  citationTitle: { color: '#333', fontSize: 13, fontWeight: '600', marginTop: 2 },
  citationMeta: { color: '#666', fontSize: 12, marginTop: 2 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  loadingText: { color: '#888', fontSize: 13 },

  quotePreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F0', borderTopWidth: 1, borderTopColor: '#E8D5C0', borderLeftWidth: 3, borderLeftColor: '#8B4513', paddingHorizontal: 12, paddingVertical: 8 },
  quotePreviewContent: { flex: 1 },
  quotePreviewLabel: { color: '#8B4513', fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  quotePreviewText: { color: '#555', fontSize: 13, lineHeight: 18 },
  quoteCancelBtn: { padding: 8 },
  quoteCancelText: { color: '#888', fontSize: 16 },

  inputRow: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EEE', gap: 8 },
  input: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, color: '#333' },
  sendBtn: { backgroundColor: '#8B4513', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#CCC' },
  sendBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  modalClose: { fontSize: 20, color: '#888', padding: 4 },
  modalBody: { padding: 16 },
  modalEmpty: { color: '#888', textAlign: 'center', marginTop: 20, fontSize: 14 },

  // 對話回顧
  historyItem: { marginBottom: 12 },
  historyUserRow: { alignItems: 'flex-end' },
  historyAssistantRow: { alignItems: 'flex-start' },
  historyRoleLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  historyUserBubble: { backgroundColor: '#8B4513', borderRadius: 12, padding: 10, maxWidth: '85%' },
  historyUserText: { color: '#fff', fontSize: 13 },
  historyCompanionBubble: { backgroundColor: '#EEF4FF', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#5B8DEF', padding: 10, maxWidth: '85%', marginBottom: 6 },
  historyKnowledgeBubble: { backgroundColor: '#FFF8F0', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#8B4513', padding: 10, maxWidth: '85%' },
  historyCompanionLabel: { color: '#5B8DEF', fontSize: 10, fontWeight: 'bold', marginBottom: 3 },
  historyKnowledgeLabel: { color: '#8B4513', fontSize: 10, fontWeight: 'bold', marginBottom: 3 },
  historyText: { color: '#333', fontSize: 13, lineHeight: 19 },
  historyQuoteBtn: { marginTop: 6, alignSelf: 'flex-end', backgroundColor: '#F0E8E0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#8B4513' },
  historyQuoteBtnText: { color: '#8B4513', fontSize: 11, fontWeight: '600' },

  // 所有對話
  newConvBtn: { margin: 16, backgroundColor: '#8B4513', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  newConvBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  convItem: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingVertical: 10 },
  convRow: { flexDirection: 'row', alignItems: 'center' },
  convInfo: { flex: 1, paddingRight: 8 },
  convTitle: { fontSize: 14, color: '#333', fontWeight: '500' },
  convTitleActive: { color: '#8B4513', fontWeight: 'bold' },
  convDate: { fontSize: 11, color: '#aaa', marginTop: 2 },
  convActions: { flexDirection: 'row', gap: 4 },
  convActionBtn: { padding: 6 },
  convActionText: { fontSize: 16 },
  convEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convEditInput: { flex: 1, borderWidth: 1, borderColor: '#DDD', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13 },
  convSaveBtn: { backgroundColor: '#8B4513', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  convSaveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  convCancelText: { color: '#888', fontSize: 12 },
});