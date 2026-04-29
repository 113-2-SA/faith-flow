// context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { API_BASE_URL } from '../../lib/api';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  syncUserToBackend: (user: User) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ⭐ 同步使用者到 PostgreSQL
  const syncUserToBackend = async (user: User): Promise<boolean> => {
    try {
      console.log('🔄 [AuthContext] 開始同步使用者到資料庫...');
      
      // ✅ 取得 Firebase ID Token（JWT），true = 強制刷新
      const firebaseIdToken = await user.getIdToken(true);
      
      console.log('1. ✅ Firebase ID Token:', firebaseIdToken ? '有' : '沒有');
      if (!firebaseIdToken) throw new Error('Missing Firebase ID token');

      // 呼叫後端 API
      const response = await fetch(`${API_BASE_URL}/api/auth/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firebaseIdToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('2. 📡 sync status =', response.status);

      const data = await response.json();
      console.log('3. 📦 sync response =', data);

      if (data.ok) {
        console.log('✅ [AuthContext] PostgreSQL 同步成功:', data.user);
        return true;
      } else {
        console.error('❌ [AuthContext] PostgreSQL 同步失敗:', data.error);
        return false;
      }
    } catch (error) {
      console.error('❌ [AuthContext] 同步錯誤:', error);
      return false;
    }
  };

  // ⭐ 登出
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null);
      console.log('✅ [AuthContext] 登出成功');
    } catch (error) {
      console.error('❌ [AuthContext] 登出失敗:', error);
      throw error;
    }
  };

  // ⭐⭐⭐ 監聽 Firebase 認證狀態（這是關鍵！）⭐⭐⭐
  useEffect(() => {
    console.log('🔄 [AuthContext] 開始監聽認證狀態...');
    
    // Firebase 的 onAuthStateChanged 會：
    // 1. App 啟動時自動檢查是否有登入
    // 2. 使用者登入時觸發
    // 3. 使用者登出時觸發
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('📢 [AuthContext] 認證狀態變更:', user ? `已登入 (${user.uid})` : '未登入');
      
      setCurrentUser(user);
      
      // ⭐ 如果有使用者，自動同步到 PostgreSQL
      if (user) {
        console.log('🔄 偵測到使用者，開始自動同步...');
        await syncUserToBackend(user);
      }
      
      setLoading(false);
    });

    // 清理監聽器
    return () => {
      console.log('🛑 [AuthContext] 停止監聽認證狀態');
      unsubscribe();
    };
  }, []);

  const value = {
    currentUser,
    loading,
    signOut,
    syncUserToBackend
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// expo-router 要求 app/ 目錄下的檔案有 default export
export default function AuthContextRoute() { return null; }