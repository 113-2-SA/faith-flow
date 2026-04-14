import { API_BASE_URL } from '../../lib/api';
import { auth } from '../../lib/firebase';

// 獲取 Firebase Token
async function getAuthToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch (error) {
    console.error('獲取 token 失敗:', error);
    return null;
  }
}

interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
}

// 獲取周回顧列表
export async function getWeeklySummaries({
  limit = 10,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
}): Promise<ApiResponse> {
  try {
    const token = await getAuthToken();
    if (!token) return { ok: false, error: '未登入' };

    const res = await fetch(
      `${API_BASE_URL}/api/weekly-summary?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return await res.json();
  } catch (error) {
    console.error('獲取周回顧列表失敗:', error);
    return { ok: false, error: '網路錯誤' };
  }
}

// 獲取特定周回顧
export async function getWeeklySummary(
  year: number,
  weekNumber: number
): Promise<ApiResponse> {
  try {
    const token = await getAuthToken();
    if (!token) return { ok: false, error: '未登入' };

    const res = await fetch(
      `${API_BASE_URL}/api/weekly-summary/${year}/${weekNumber}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return await res.json();
  } catch (error) {
    console.error('獲取周回顧失敗:', error);
    return { ok: false, error: '網路錯誤' };
  }
}

// 生成新的周回顧
export async function generateWeeklySummary(
  year: number,
  weekNumber: number
): Promise<ApiResponse> {
  try {
    const token = await getAuthToken();
    if (!token) return { ok: false, error: '未登入' };

    const res = await fetch(`${API_BASE_URL}/api/weekly-summary/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ year, weekNumber }),
    });
    return await res.json();
  } catch (error) {
    console.error('生成周回顧失敗:', error);
    return { ok: false, error: '生成失敗' };
  }
}

// 取得語音播放 URL（帶 token，供 expo-av 直接播放）
export async function getAudioUrl(year: number, weekNumber: number): Promise<string | null> {
  try {
    const token = await getAuthToken();
    if (!token) return null;
    return `${API_BASE_URL}/api/weekly-summary/${year}/${weekNumber}/audio?token=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}

// 為特定周生成語音
export async function generateAudioForWeek(year: number, weekNumber: number): Promise<ApiResponse> {
  try {
    const token = await getAuthToken();
    if (!token) return { ok: false, error: '未登入' };

    const res = await fetch(`${API_BASE_URL}/api/weekly-summary/${year}/${weekNumber}/audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
  } catch (error) {
    console.error('語音生成失敗:', error);
    return { ok: false, error: '語音生成失敗' };
  }
}

// 刪除周回顧
export async function deleteWeeklySummary(
  year: number,
  weekNumber: number
): Promise<ApiResponse> {
  try {
    const token = await getAuthToken();
    if (!token) return { ok: false, error: '未登入' };

    const res = await fetch(
      `${API_BASE_URL}/api/weekly-summary/${year}/${weekNumber}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return await res.json();
  } catch (error) {
    console.error('刪除周回顧失敗:', error);
    return { ok: false, error: '刪除失敗' };
  }
}
