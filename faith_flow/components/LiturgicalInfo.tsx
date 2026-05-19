// components/LiturgicalInfo.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { GlassCard } from "./GlassCard";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from "../lib/api";

export interface LiturgicalData {
  season: string;
  seasonColor?: string;
  feast?: string | null;
  rank?: string;
}

interface LiturgicalInfoProps {
  date: Date;
}

export function LiturgicalInfo({ date }: LiturgicalInfoProps) {
  const { user } = useAuth();
  const [data, setData] = useState<LiturgicalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchLiturgicalData = async () => {
      try {
        const token = await user.getIdToken();
        const dateStr = date.toISOString().split('T')[0];

        const response = await fetch(
          `${API_BASE_URL}/api/liturgical?date=${dateStr}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const json = await response.json();
        
        if (json.ok && json.data) {
          setData(json.data);
        }
      } catch (error) {
        console.error("獲取禮儀年資料失敗:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLiturgicalData();
  }, [user, date]);

  if (loading) {
    return (
      <GlassCard style={styles.card}>
        <Text style={styles.loading}>載入中...</Text>
      </GlassCard>
    );
  }

  if (!data) {
    return null;
  }

  // 根據禮儀顏色設定背景色調
  const getColorAccent = (color?: string) => {
    switch (color) {
      case 'white': return 'rgba(255, 255, 255, 0.15)';
      case 'red': return 'rgba(220, 38, 38, 0.15)';
      case 'green': return 'rgba(34, 197, 94, 0.15)';
      case 'purple': return 'rgba(168, 85, 247, 0.15)';
      default: return 'rgba(255, 255, 255, 0.08)';
    }
  };

  return (
    <GlassCard style={{ ...styles.card}}>
      <View style={styles.header}>
        <Text style={styles.season}>{data.season}</Text>
      </View>
      
      {data.feast && <Text style={styles.feast}>{data.feast}</Text>}
      
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    textAlign: "center",
    fontFamily: "NotoSerifTC_400Regular",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  season: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 1,
    textAlign: "center",
    fontFamily: "NotoSerifTC_400Regular",
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "NotoSerifTC_400Regular",
  },
  feast: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 13,
    marginTop: 3,
    textAlign: "center",
    fontFamily: "NotoSerifTC_400Regular",
  },
});