import React, { useRef, useState } from "react";
import { GoogleMap, LoadScript, InfoWindow } from "@react-google-maps/api";
import { PrayerRecord } from "../lib/prayerStore";

type Props = {
  prayers: PrayerRecord[];
  center: { latitude: number; longitude: number };
};

const GOLD_LIGHT = "#f5d680";
const SILVER     = "#b0b8c8";
const API_KEY    = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const THRESHOLD  = 0.0003; // ~30m，視為同一位置

type Group = {
  lat: number;
  lng: number;
  prayers: PrayerRecord[];
};

// 將距離小於 THRESHOLD 的祈禱歸為同一組，位置取第一筆的座標
function groupPrayers(prayers: PrayerRecord[]): Group[] {
  const used = new Set<number>();
  const groups: Group[] = [];

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

function makeCrossSvg(isGps: boolean): string {
  const color = isGps ? GOLD_LIGHT : SILVER;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">` +
    `<rect x="10.5" y="3" width="5" height="28" rx="2" fill="${color}"/>` +
    `<rect x="3" y="9" width="20" height="5" rx="2" fill="${color}"/>` +
    `</svg>`
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ` +
    `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function MapWrapper({ prayers, center }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const validPrayers = prayers.filter((p) => p.latitude != null && p.longitude != null);
  const groups = groupPrayers(validPrayers);

  const onMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;

    groups.forEach((group) => {
      // 圖示顏色以組內第一筆的 locationSource 為準
      const isGps = group.prayers[0].locationSource === "gps";
      const marker = new google.maps.Marker({
        position: { lat: group.lat, lng: group.lng },
        map,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(makeCrossSvg(isGps)),
          scaledSize: new google.maps.Size(26, 34),
          anchor: new google.maps.Point(13, 34),
        },
        // 有多筆時加數字標籤
        label: group.prayers.length > 1
          ? { text: String(group.prayers.length), color: "#fff", fontSize: "10px", fontWeight: "700" }
          : undefined,
      });
      marker.addListener("click", () => setSelectedGroup(group));
    });
  };

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
    <div style={{ position: "relative", height: 400, borderRadius: 14, overflow: "hidden" }}>
      {/* 現在位置按鈕 */}
      <button
        type="button"
        onClick={goToCurrentLocation}
        style={{
          position: "absolute",
          bottom: 16,
          right: 12,
          zIndex: 10,
          padding: "8px 14px",
          borderRadius: 20,
          border: "none",
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        📍 現在位置
      </button>

      <LoadScript googleMapsApiKey={API_KEY}>
        <GoogleMap
          mapContainerStyle={{ height: "100%", width: "100%" }}
          center={{ lat: center.latitude, lng: center.longitude }}
          zoom={15}
          onLoad={onMapLoad}
        >
          {selectedGroup && (
            <InfoWindow
              position={{ lat: selectedGroup.lat, lng: selectedGroup.lng }}
              onCloseClick={() => setSelectedGroup(null)}
            >
              <div style={{ minWidth: 180, maxHeight: 260, overflowY: "auto", fontFamily: "system-ui, sans-serif" }}>
                {selectedGroup.prayers.length > 1 && (
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
                    此位置共 {selectedGroup.prayers.length} 筆祈禱
                  </div>
                )}
                {selectedGroup.prayers.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      paddingBottom: 10,
                      marginBottom: 10,
                      borderBottom: i < selectedGroup.prayers.length - 1 ? "1px solid #eee" : "none",
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#c8922a", fontWeight: 700, marginBottom: 3 }}>
                      {formatTime(p.createdAt)}
                      {p.locationSource === "default" && (
                        <span style={{ color: "#aaa", fontWeight: 400, marginLeft: 6 }}>匿名</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>{p.text}</div>
                  </div>
                ))}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  );
}
