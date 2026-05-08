import { useState, useEffect, useRef } from "react";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const cache: Record<string, string[]> = {};

export function useChurchPhotos(nameEn: string, count = 9) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!nameEn) return;

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

    async function fetchPhotos() {
      const searchUrl = new URL(COMMONS_API);
      searchUrl.searchParams.set("action", "query");
      searchUrl.searchParams.set("list", "search");
      searchUrl.searchParams.set("srsearch", query);
      searchUrl.searchParams.set("srnamespace", "6");
      searchUrl.searchParams.set("srlimit", String(Math.min(count * 2, 30)));
      searchUrl.searchParams.set("format", "json");
      searchUrl.searchParams.set("origin", "*");

      const searchRes = await fetch(searchUrl.toString(), { signal: controller.signal });
      if (!searchRes.ok) throw new Error(`HTTP ${searchRes.status}`);
      const searchData = await searchRes.json();

      const files: string[] = (searchData?.query?.search ?? [])
        .map((item: { title: string }) => item.title)
        .filter((title: string) => /\.(jpg|jpeg|png|webp)$/i.test(title))
        .slice(0, count);

      if (files.length === 0) {
        setError("找不到對應圖片");
        return;
      }

      const imageInfoUrl = new URL(COMMONS_API);
      imageInfoUrl.searchParams.set("action", "query");
      imageInfoUrl.searchParams.set("titles", files.join("|"));
      imageInfoUrl.searchParams.set("prop", "imageinfo");
      imageInfoUrl.searchParams.set("iiprop", "url");
      imageInfoUrl.searchParams.set("iiurlwidth", "800");
      imageInfoUrl.searchParams.set("format", "json");
      imageInfoUrl.searchParams.set("origin", "*");

      const infoRes = await fetch(imageInfoUrl.toString(), { signal: controller.signal });
      if (!infoRes.ok) throw new Error(`HTTP ${infoRes.status}`);
      const infoData = await infoRes.json();

      const urls: string[] = Object.values(infoData?.query?.pages ?? {})
        .map((page: any) => page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url)
        .filter(Boolean) as string[];

      if (urls.length > 0) {
        cache[query] = urls;
        setPhotoUrls(urls);
      } else {
        setError("找不到對應圖片");
      }
    }

    fetchPhotos()
      .catch((err) => {
        if (err.name !== "AbortError") setError("圖片載入失敗");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [nameEn]);

  return { photoUrls, loading, error };
}
