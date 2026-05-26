import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export type TourStep = { title: string; body: string };

type Props = {
  steps: TourStep[];
  storageKey: string;
  canSkip?: boolean;
};

export function PageTour({ steps, storageKey, canSkip = true }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((done) => {
      if (!done) setTimeout(() => setVisible(true), 800);
    });
  }, [storageKey]);

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  }, [step, visible, opacity]);

  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(storageKey, 'true');
  }, [storageKey]);

  const goNext = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      if (step + 1 >= steps.length) {
        dismiss();
      } else {
        setStep((s) => s + 1);
      }
    });
  }, [step, steps.length, opacity, dismiss]);

  if (!visible) return null;

  const current = steps[step];
  const isLast = step + 1 >= steps.length;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={goNext}>
        <Animated.View style={[styles.card, { opacity }]}>
          <Text style={styles.stepLabel}>{step + 1} / {steps.length}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
          <View style={styles.actions}>
            {canSkip && (
              <Pressable onPress={dismiss} style={styles.skip}>
                <Text style={styles.skipText}>略過</Text>
              </Pressable>
            )}
            <Pressable onPress={goNext} style={[styles.next, !canSkip && styles.nextAlone]}>
              <Text style={styles.nextText}>{isLast ? '完成' : '下一步'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  stepLabel: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.35)',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.85)',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.65)',
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.35)',
  },
  next: {
    backgroundColor: 'rgba(102,126,234,0.90)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  nextAlone: {
    marginLeft: 'auto' as any,
  },
  nextText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
