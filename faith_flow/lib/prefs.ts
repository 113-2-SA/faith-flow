// lib/prefs.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Preferences = {
  notifications: boolean;
  diary: boolean;
  cardDraw: boolean;
};

const KEY = "faithflow:prefs:v1";

const DEFAULTS: Preferences = {
  notifications: true,
  diary: true,
  cardDraw: true,
};

export async function loadPrefs(): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULTS;
  }
}

export async function savePrefs(prefs: Preferences) {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}
