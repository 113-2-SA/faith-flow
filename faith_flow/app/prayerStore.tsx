import AsyncStorage from "@react-native-async-storage/async-storage";

export type LocationSource = "gps" | "default";
// gps     = 使用者同意定位，記錄真實座標
// default = 使用者拒絕定位，記錄在聖殿附近（加小偏移）

export type PrayerRecord = {
  id: string;
  text: string;
  createdAt: string;       // ISO string
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
};

const STORAGE_KEY = "prayer_records_v1";

// ── 聖殿預設座標（請依實際地址調整）─────────────────────────────
export const BASILICA_COORDS = {
  latitude: 25.0330,
  longitude: 121.5654,
} as const;

// 拒絕定位時在聖殿附近加 ~50 m 隨機偏移，避免所有匿名記錄重疊
function jitter(base: number, range = 0.0005): number {
  return base + (Math.random() - 0.5) * range;
}

export async function loadPrayers(): Promise<PrayerRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PrayerRecord[]) : [];
  } catch {
    return [];
  }
}

export async function savePrayer(
  text: string,
  location?: { latitude: number; longitude: number }
): Promise<PrayerRecord> {
  const record: PrayerRecord = {
    id: Date.now().toString(),
    text: text.trim() || "(無文字記錄)",
    createdAt: new Date().toISOString(),
    latitude:  location?.latitude  ?? jitter(BASILICA_COORDS.latitude),
    longitude: location?.longitude ?? jitter(BASILICA_COORDS.longitude),
    locationSource: location ? "gps" : "default",
  };

  const existing = await loadPrayers();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, record]));
  return record;
}

export async function clearPrayers(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}