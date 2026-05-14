import { API_BASE_URL } from './api';
import { auth } from './firebase';

async function getAuthToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export interface PastEntry {
  diary_id: number;
  diary_date: string;
  diary_title: string;
  emotion_label: string;
  emotion_score: number;
}

export interface NudgeData {
  nudge_id: number;
  cluster_id: number;
  theme: string;
  emotion_trend: string;
  ai_insight: string;
  should_ask_question: boolean;
  question: string | null;
  overall_emotion_score: number; // 0~1，決定光點亮暗
  past_entries: PastEntry[];
}

/** 取得待顯示的光點回顧（null = 目前沒有） */
export async function getPendingNudge(): Promise<NudgeData | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE_URL}/api/nudge/pending`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.ok ? json.data : null;
}

/** 標記 nudge 已顯示（動畫開始時呼叫） */
export async function markNudgeShown(nudgeId: number): Promise<void> {
  const token = await getAuthToken();
  if (!token) return;
  await fetch(`${API_BASE_URL}/api/nudge/${nudgeId}/shown`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** 記錄使用者行動 */
export async function recordNudgeAction(
  nudgeId: number,
  action: 'dismissed' | 'conversation_started'
): Promise<void> {
  const token = await getAuthToken();
  if (!token) return;
  await fetch(`${API_BASE_URL}/api/nudge/${nudgeId}/action`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });
}

/** 提交評分反饋（1😞 2😐 3😊） */
export async function submitNudgeFeedback(
  nudgeId: number,
  rating: 1 | 2 | 3
): Promise<void> {
  const token = await getAuthToken();
  if (!token) return;
  await fetch(`${API_BASE_URL}/api/nudge/${nudgeId}/feedback`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rating }),
  });
}
