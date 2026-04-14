import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Share,
  ImageBackground,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getWeeklySummary, deleteWeeklySummary, generateAudioForWeek, getAudioUrl } from '../api/weeklysummaryapi';
import { VideoBackground } from '@/components/VideoBackground';
import { Audio } from 'expo-av';

interface WeeklySummary {
  summaryID: number;
  userID: number;
  year: number;
  week_number: number;
  summary_title: string;
  summary_content: string;
  bible_quote: string | null;
  diary_count: number;
  start_date: string;
  end_date: string;
  generated_at: string;
  is_auto_generated: boolean;
  audio_url: string | null;
}

export default function WeeklySummaryDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const year = params.year ? parseInt(params.year as string) : null;
  const weekNumber = params.weekNumber ? parseInt(params.weekNumber as string) : null;

  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [fillingAudio, setFillingAudio] = useState(false);

  useEffect(() => {
    if (year && weekNumber) {
      loadSummary();
    } else {
      setLoading(false);
    }
  }, [year, weekNumber]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handleFillAudio = async () => {
    if (!year || !weekNumber) return;
    try {
      setFillingAudio(true);
      const response = await generateAudioForWeek(year, weekNumber);
      if (response.ok) {
        Alert.alert('完成', '語音已生成', [
          { text: '確定', onPress: loadSummary },
        ]);
      } else {
        Alert.alert('錯誤', response.error || '語音生成失敗');
      }
    } catch (error) {
      Alert.alert('錯誤', '語音生成失敗');
    } finally {
      setFillingAudio(false);
    }
  };

  const hasAudio = summary?.audio_url === 'db';

  const handlePlayAudio = async () => {
    if (!hasAudio || !year || !weekNumber) return;

    if (isPlaying && sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      return;
    }

    try {
      setAudioLoading(true);
      const audioUri = await getAudioUrl(year, weekNumber);
      if (!audioUri) throw new Error('無法取得播放網址');
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          setSound(null);
        }
      });
    } catch (error) {
      console.error('播放失敗:', error);
      Alert.alert('錯誤', '無法播放語音');
    } finally {
      setAudioLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      if (!year || !weekNumber) return;
      const response = await getWeeklySummary(year, weekNumber);
      if (response.ok) {
        setSummary(response.data);
      } else {
        Alert.alert('錯誤', response.error || '載入失敗');
      }
    } catch (error) {
      console.error('載入失敗:', error);
      Alert.alert('錯誤', '無法載入周回顧');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!summary) return;

    const message = `
${summary.summary_title}

${summary.year} 年第 ${summary.week_number} 週回顧

${summary.summary_content}

${summary.bible_quote ? `📖 ${summary.bible_quote}` : ''}
    `.trim();

    try {
      await Share.share({ message });
    } catch (error) {
      console.error('分享失敗:', error);
    }
  };

  const handleDelete = () => {
    if (!year || !weekNumber) return;
    Alert.alert('確認刪除', '確定要刪除這篇周回顧嗎？此操作無法復原。', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await deleteWeeklySummary(year, weekNumber);
            if (response.ok) {
              Alert.alert('成功', '已刪除周回顧', [
                { text: '確定', onPress: () => router.back() },
              ]);
            } else {
              Alert.alert('錯誤', response.error || '刪除失敗');
            }
          } catch (error) {
            console.error('刪除失敗:', error);
            Alert.alert('錯誤', '刪除失敗');
          }
        },
      },
    ]);
  };

  // 🆕 切換到上一周
  const goToPreviousWeek = () => {
    if (!year || !weekNumber) return;
    
    let prevYear = year;
    let prevWeek = weekNumber - 1;
    
    if (prevWeek < 1) {
      prevYear = year - 1;
      prevWeek = 52; // 假設一年 52 週
    }
    
    router.push(`/diary/summarydetail?year=${prevYear}&weekNumber=${prevWeek}`);
  };

  // 🆕 切換到下一周
  const goToNextWeek = () => {
    if (!year || !weekNumber) return;
    
    let nextYear = year;
    let nextWeek = weekNumber + 1;
    
    if (nextWeek > 52) {
      nextYear = year + 1;
      nextWeek = 1;
    }
    
    router.push(`/diary/summarydetail?year=${nextYear}&weekNumber=${nextWeek}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (loading) {
    return (
      <VideoBackground
        source={require('../../assets/backgrounds/main.mp4')}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      </VideoBackground>
    );
  }

  if (!year || !weekNumber || !summary) {
    return (
      <VideoBackground
        source={require('../../assets/backgrounds/main.mp4')}
      >
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>😕</Text>
          <Text style={styles.errorText}>找不到這週的回顧</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/diary/weeklysummary')}>
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </VideoBackground>
    );
  }

  return (
    <VideoBackground
      source={require('../../assets/backgrounds/main.mp4')}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 周次選擇器 */}
        <View style={styles.weekSelector}>
        <TouchableOpacity style={styles.weekNavButton} onPress={goToPreviousWeek}>
            <Text style={styles.weekNavText}>← 上一週</Text>
        </TouchableOpacity>
        
        <BlurView intensity={80} style={styles.weekBadge}>
            <Text style={styles.weekBadgeText}>
            {summary.year} 年 第 {summary.week_number} 週
            </Text>
        </BlurView>
        
        <TouchableOpacity style={styles.weekNavButton} onPress={goToNextWeek}>
            <Text style={styles.weekNavText}>下一週 →</Text>
        </TouchableOpacity>
        </View>

        {/* 標題卡片 */}
        <BlurView intensity={80} tint="light" style={styles.glassCard}>
          <Text style={styles.summaryTitle}>{summary.summary_title}</Text>
        </BlurView>

        {/* 日期與資訊 */}
        <BlurView intensity={80} tint="light" style={styles.glassCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📅 日期</Text>
            <Text style={styles.infoValue}>
              {formatDate(summary.start_date)} - {formatDate(summary.end_date)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📝 日記</Text>
            <Text style={styles.infoValue}>{summary.diary_count} 篇</Text>
          </View>
        </BlurView>

        {/* 回顧內容 */}
        <BlurView intensity={80} tint="light" style={[styles.glassCard, styles.contentCard]}>
          <Text style={styles.sectionTitle}>回顧內容</Text>
          <Text style={styles.summaryContent}>{summary.summary_content}</Text>
        </BlurView>

        {/* 聖經金句 */}
        {summary.bible_quote && (
          <BlurView intensity={80} tint="light" style={[styles.glassCard, styles.bibleCard]}>
            <View style={styles.bibleHeader}>
              <Text style={styles.bibleIcon}>📖</Text>
              <Text style={styles.sectionTitle}>本週金句</Text>
            </View>
            <Text style={styles.bibleQuote}>{summary.bible_quote}</Text>
          </BlurView>
        )}

        {/* 生成／重新生成語音 */}
        <TouchableOpacity onPress={handleFillAudio} disabled={fillingAudio} style={[styles.glassCard, styles.audioButton]}>
          {fillingAudio ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.audioButtonText}>
              {hasAudio ? '🔄 重新生成語音' : '🎙 生成語音'}
            </Text>
          )}
        </TouchableOpacity>

        {/* 語音播放 */}
        <TouchableOpacity
          onPress={handlePlayAudio}
          disabled={audioLoading || !hasAudio}
          style={[styles.glassCard, styles.audioButton, !hasAudio && styles.audioButtonDisabled]}
        >
          {audioLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.audioButtonText, !hasAudio && styles.audioButtonTextDisabled]}>
              {isPlaying ? '⏹ 停止語音' : '▶ 播放語音回顧'}
            </Text>
          )}
        </TouchableOpacity>

        {/* 操作按鈕 */}
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={handleShare}>
            <BlurView intensity={60} tint="light" style={styles.actionButton}>
              <Text style={styles.actionButtonText}>📤 分享</Text>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDelete}>
            <BlurView intensity={60} tint="light" style={[styles.actionButton, styles.deleteButton]}>
              <Text style={styles.actionButtonText}>🗑️ 刪除</Text>
            </BlurView>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </VideoBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 24,
    fontWeight: '500',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // 🆕 周次選擇器樣式
  weekSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
  },
  weekNavButton: {
    padding: 12,
  },
  weekNavText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  weekBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  weekBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // 毛玻璃卡片
  glassCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  // 標題
  summaryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 32,
    marginBottom: 8,
  },
  autoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(100, 200, 255, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  autoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // 資訊行
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // 內容區
  contentCard: {
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryContent: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.95)',
  },

  // 聖經金句
  bibleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  bibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bibleIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  bibleQuote: {
    fontSize: 15,
    lineHeight: 24,
    color: '#FFFFFF',
    fontStyle: 'italic',
  },

  // 操作按鈕
  actionButtons: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 100, 100, 0.3)',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  bottomSpacer: {
    height: 40,
  },
  audioButton: {
    marginHorizontal: 0,
    marginVertical: 0,
    alignItems: 'center',
    paddingVertical: 16,
  },
  audioButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  audioButtonDisabled: {
    opacity: 0.4,
  },
  audioButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});