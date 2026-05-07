import { auth } from "../lib/firebase";
import { API_BASE_URL } from "../lib/api";

export type PrayerRecord = {
  id: string;
  diary_id: number;
  latitude: number;
  longitude: number;
  locationSource: "gps" | "default";
  createdAt: string;
  text: string;
  title?: string;
};

export async function loadPrayers(): Promise<PrayerRecord[]> {
  try {
    const user = auth.currentUser;
    if (!user) return [];

    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/diary/prayer-locations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.ok) return [];

    return data.data.map((item: any) => ({
      id: String(item.id),
      diary_id: item.diary_id,
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude),
      locationSource: "gps" as const,
      createdAt: item.created_at,
      text: item.text,
      title: item.title,
    }));
  } catch {
    return [];
  }
}

export async function clearPrayers(): Promise<void> {}
