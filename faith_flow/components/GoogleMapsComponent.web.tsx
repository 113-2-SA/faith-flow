import React, { useRef, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { StyleSheet } from "react-native";
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import { MAP_CONFIG, GLASS_RELIGIOUS_MAP_STYLE } from "../config/mapConfig";
import type { PrayerRecord } from "../lib/prayerStore";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Basilica = {
  id: string;
  name: string;
  nameEn: string;
  location: string;
  coordinates: [number, number];
  type: "major" | "cathedral" | "chapel";
  founded: number;
  dedication: string;
  style: string;
  significance: string;
  description: string;
  viewerUrl: string;
};

type PrayerGroup = {
  lat: number;
  lng: number;
  prayers: PrayerRecord[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const GOLD_LIGHT = "#f5d680";
const SILVER     = "#b0b8c8";
const THRESHOLD  = 0.0003; // ~30 m

function groupPrayers(prayers: PrayerRecord[]): PrayerGroup[] {
  const used = new Set<number>();
  const groups: PrayerGroup[] = [];
  for (let i = 0; i < prayers.length; i++) {
    if (used.has(i)) continue;
    const group: PrayerRecord[] = [prayers[i]];
    used.add(i);
    for (let j = i + 1; j < prayers.length; j++) {
      if (used.has(j)) continue;
      const dlat = prayers[i].latitude  - prayers[j].latitude;
      const dlng = prayers[i].longitude - prayers[j].longitude;
      if (Math.sqrt(dlat * dlat + dlng * dlng) < THRESHOLD) {
        group.push(prayers[j]);
        used.add(j);
      }
    }
    groups.push({ lat: prayers[i].latitude, lng: prayers[i].longitude, prayers: group });
  }
  return groups;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} `
    + `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function makePrayerCrossSvg(isGps: boolean): string {
  const c = isGps ? GOLD_LIGHT : SILVER;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">`
    + `<rect x="10.5" y="3" width="5" height="28" rx="2" fill="${c}"/>`
    + `<rect x="3" y="9" width="20" height="5" rx="2" fill="${c}"/>`
    + `</svg>`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface GoogleMapsComponentProps {
  markers: Basilica[];
  onMarkerPress: (id: string) => void;
  selectedId: string | null;
  autoFitBounds?: boolean;
  prayers?: PrayerRecord[];
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GoogleMapsComponent({
  markers,
  onMarkerPress,
  selectedId,
  autoFitBounds,
  prayers,
}: GoogleMapsComponentProps) {
  const mapRef           = useRef<google.maps.Map | null>(null);
  const prayerMarkersRef = useRef<google.maps.Marker[]>([]);
  const [mapReady, setMapReady]           = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<PrayerGroup | null>(null);
  const [selectedPrayer, setSelectedPrayer] = useState<PrayerRecord | null>(null);

  // ── 選中教堂時置中 ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const sel = markers.find((m) => m.id === selectedId);
    if (sel) {
      mapRef.current.panTo({ lat: sel.coordinates[0], lng: sel.coordinates[1] });
      mapRef.current.setZoom(10);
    }
  }, [selectedId, markers]);

  // ── 搜尋/篩選自動 fitBounds ─────────────────────────────────────
  useEffect(() => {
    if (!autoFitBounds || !mapRef.current || markers.length === 0) return;
    if (markers.length === 1) {
      mapRef.current.panTo({ lat: markers[0].coordinates[0], lng: markers[0].coordinates[1] });
      mapRef.current.setZoom(10);
    } else {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.coordinates[0], lng: m.coordinates[1] }));
      mapRef.current.fitBounds(bounds);
    }
  }, [markers, autoFitBounds]);

  // ── 祈禱標記（分組，點擊用 React state 管理 overlay）──────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    prayerMarkersRef.current.forEach((m) => m.setMap(null));
    prayerMarkersRef.current = [];
    setSelectedGroup(null);

    if (!prayers?.length) return;

    const groups = groupPrayers(prayers);
    groups.forEach((group) => {
      const isGps = group.prayers[0].locationSource === "gps";
      const marker = new google.maps.Marker({
        position: { lat: group.lat, lng: group.lng },
        map: mapRef.current!,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(makePrayerCrossSvg(isGps)),
          scaledSize: new google.maps.Size(26, 34),
          anchor:     new google.maps.Point(13, 34),
        },
        label: group.prayers.length > 1
          ? { text: String(group.prayers.length), color: "#fff", fontSize: "10px", fontWeight: "700" }
          : undefined,
        zIndex: 5,
      });

      marker.addListener("click", () => setSelectedGroup(group));
      prayerMarkersRef.current.push(marker);
    });
  }, [prayers, mapReady]);

  // ── 現在位置 ─────────────────────────────────────────────────────
  const goToCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        mapRef.current?.setZoom(17);
      },
      () => alert("無法取得目前位置，請確認瀏覽器定位權限。")
    );
  };

  return (
    <>
    <div style={{ position: "relative", width: "90%", alignSelf: "center" }}>
      {/* ── 現在位置按鈕 ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={goToCurrentLocation}
        style={{
          position: "absolute", bottom: 16, right: 12, zIndex: 10,
          padding: "8px 14px", borderRadius: 20, border: "none",
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          fontWeight: 600, fontSize: 13, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5,
        }}
      >
        📍 現在位置
      </button>

      {/* ── 祈禱列表 overlay（點擊標記後出現）─────────────────── */}
      {selectedGroup && (
        <div style={{
          position: "absolute", top: 10, right: 10, zIndex: 20,
          background: "white", borderRadius: 14,
          boxShadow: "0 4px 24px rgba(0,0,0,0.22)",
          width: 260, maxHeight: 300, display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px 8px", borderBottom: "1px solid #f0f0f0",
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#333" }}>
              {selectedGroup.prayers.length > 1
                ? `此位置 ${selectedGroup.prayers.length} 筆祈禱`
                : "祈禱紀錄"}
            </span>
            <button
              onClick={() => setSelectedGroup(null)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 16, color: "#999", lineHeight: 1, padding: "0 2px",
              }}
            >✕</button>
          </div>

          {/* list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {selectedGroup.prayers.map((p, i) => (
              <div
                key={p.id}
                onClick={() => setSelectedPrayer(p)}
                style={{
                  padding: "10px 14px",
                  borderBottom: i < selectedGroup.prayers.length - 1 ? "1px solid #f5f5f5" : "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#faf8f2"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
              >
                <div style={{ fontSize: 11, color: "#c8922a", fontWeight: 700, marginBottom: 3 }}>
                  {formatTime(p.createdAt)}
                  {p.locationSource === "default" && (
                    <span style={{ color: "#aaa", fontWeight: 400, marginLeft: 6 }}>匿名</span>
                  )}
                </div>
                <div style={{
                  fontSize: 13, color: "#444", lineHeight: 1.45,
                  display: "-webkit-box", WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical", overflow: "hidden",
                } as React.CSSProperties}>
                  {p.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <LoadScript googleMapsApiKey={MAP_CONFIG.apiKey}>
        <GoogleMap
          mapContainerStyle={styles.mapContainer}
          center={MAP_CONFIG.defaultCenter}
          zoom={MAP_CONFIG.defaultZoom}
          onLoad={(map) => { mapRef.current = map; setMapReady(true); }}
          options={{ styles: GLASS_RELIGIOUS_MAP_STYLE as any }}
        >
          {/* 教堂標記 */}
          {markers.map((basilica) => (
            <React.Fragment key={basilica.id}>
              <Marker
                position={{ lat: basilica.coordinates[0], lng: basilica.coordinates[1] }}
                title={basilica.name}
                onClick={() => onMarkerPress(basilica.id)}
                icon={{
                  path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
                  fillColor: "#666fee", fillOpacity: 0.9,
                  strokeColor: "#fff", strokeWeight: 2, scale: 1.5,
                }}
              />
              {selectedId === basilica.id && (
                <InfoWindow
                  position={{ lat: basilica.coordinates[0], lng: basilica.coordinates[1] }}
                  onCloseClick={() => onMarkerPress("")}
                >
                  <div style={{ fontFamily: "system-ui,sans-serif", padding: 4, minWidth: 160 }}>
                    <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>{basilica.name}</div>
                    <div style={{ fontSize: 12, color: "#666", fontStyle: "italic", marginBottom: 6 }}>{basilica.nameEn}</div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>📍 {basilica.location}</div>
                    <div style={{ fontSize: 12, color: "#555" }}>⏰ {basilica.founded} 年</div>
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          ))}
        </GoogleMap>
      </LoadScript>

    </div>

      {/* ── 完整祈禱紀錄 Modal（Portal 掛到 body，不受任何 stacking context 影響）── */}
      {selectedPrayer && ReactDOM.createPortal(
        <div
          onClick={() => setSelectedPrayer(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 18,
              padding: "24px 28px", width: "90%", maxWidth: 480,
              maxHeight: "80vh", overflowY: "auto",
              boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setSelectedPrayer(null)}
              style={{
                position: "absolute", top: 16, right: 18,
                background: "none", border: "none", cursor: "pointer",
                fontSize: 20, color: "#bbb", lineHeight: 1,
              }}
            >✕</button>

            <div style={{ fontSize: 12, color: "#c8922a", fontWeight: 700, marginBottom: 4 }}>
              {formatTime(selectedPrayer.createdAt)}
              {selectedPrayer.locationSource === "default" && (
                <span style={{ color: "#bbb", fontWeight: 400, marginLeft: 8 }}>匿名</span>
              )}
            </div>

            <div style={{ height: 1, background: "#f0f0f0", marginBottom: 16 }} />

            <div style={{
              fontSize: 15, color: "#333", lineHeight: 1.75,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {selectedPrayer.text}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
  } as any,
});
