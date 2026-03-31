import { useState, useEffect, useRef } from "react";

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_CUSTOM_SEARCH_API_KEY;
const SEARCH_ENGINE_ID = process.env.EXPO_PUBLIC_GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

// Simple in-memory cache: query → imageUrl
const cache: Record<string, string> = {};

/**
 * Fetches the first image result from Google Custom Search API
 * for the given church name.
 *
 * @param nameEn  English name (primary search term)
 * @param nameCh  Chinese name (fallback hint)
 */
export function useChurchPhoto(nameEn: string, nameCh?: string) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!nameEn) return;
    if (!API_KEY || !SEARCH_ENGINE_ID) {
      setError("Google Custom Search 未設定 API 金鑰");
      return;
    }

    const query = `${nameEn} church`;
    if (cache[query]) {
      setPhotoUrl(cache[query]);
      return;
    }

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setPhotoUrl(null);

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("cx", SEARCH_ENGINE_ID);
    url.searchParams.set("q", query);
    url.searchParams.set("searchType", "image");
    url.searchParams.set("num", "1");
    url.searchParams.set("imgSize", "large");
    url.searchParams.set("safe", "active");

    fetch(url.toString(), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const link: string | undefined = data?.items?.[0]?.link;
        if (link) {
          cache[query] = link;
          setPhotoUrl(link);
        } else {
          setError("找不到對應圖片");
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("圖片載入失敗");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [nameEn]);

  return { photoUrl, loading, error };
}
