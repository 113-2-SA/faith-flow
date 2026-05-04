import { useState, useEffect, useRef } from "react";

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_CUSTOM_SEARCH_API_KEY;
const SEARCH_ENGINE_ID = process.env.EXPO_PUBLIC_GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

const cache: Record<string, string[]> = {};

export function useChurchPhotos(nameEn: string, count = 9) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
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
      setPhotoUrls(cache[query]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setPhotoUrls([]);

    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("cx", SEARCH_ENGINE_ID);
    url.searchParams.set("q", query);
    url.searchParams.set("searchType", "image");
    url.searchParams.set("num", String(Math.min(count, 10)));
    url.searchParams.set("imgSize", "large");
    url.searchParams.set("safe", "active");

    fetch(url.toString(), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const links: string[] = (data?.items ?? [])
          .map((item: { link: string }) => item.link)
          .filter(Boolean);
        if (links.length > 0) {
          cache[query] = links;
          setPhotoUrls(links);
        } else {
          setError("找不到對應圖片");
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError("圖片載入失敗");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [nameEn]);

  return { photoUrls, loading, error };
}
