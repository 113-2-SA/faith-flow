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

export async function savePrayer(text: string, coords?: { latitude: number; longitude: number }): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const token = await user.getIdToken();
    const payload: any = {
      text,
      title: text.length > 50 ? text.substring(0, 50) + "..." : text,
    };

    if (coords) {
      payload.latitude = coords.latitude;
      payload.longitude = coords.longitude;
      payload.locationSource = "gps";
    } else {
      payload.locationSource = "default";
    }

    const res = await fetch(`${API_BASE_URL}/api/diary/prayer-locations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.message || "Failed to save prayer");
    }
  } catch (error) {
    console.error("Error saving prayer:", error);
    throw error;
  }
}
