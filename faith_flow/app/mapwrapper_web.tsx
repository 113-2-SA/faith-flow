import React, { useEffect } from "react";
import { PrayerRecord } from "../prayerStore";

type Props = {
  prayers: PrayerRecord[];
  center: { latitude: number; longitude: number };
};

const GOLD_LIGHT = "#f5d680";
const SILVER     = "#b0b8c8";

// 動態 inject leaflet CSS（避免 SSR 問題）
function useLeafletCSS() {
  useEffect(() => {
    if (document.getElementById("leaflet-css")) return;
    const link = document.createElement("link");
    link.id   = "leaflet-css";
    link.rel  = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }, []);
}

export default function MapWrapper({ prayers, center }: Props) {
  useLeafletCSS();

  // react-leaflet 在 SSR/Expo Web 需要 dynamic import，用 lazy 處理
  const [Comps, setComps] = React.useState<any>(null);

  useEffect(() => {
    Promise.all([
      import("react-leaflet"),
      import("leaflet"),
    ]).then(([rl, L]) => {
      // 修正 leaflet 預設 icon 路徑問題
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setComps({ rl, L });
    });
  }, []);

  if (!Comps) {
    return (
      <div style={{
        height: 400, borderRadius: 14, background: "rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "rgba(255,255,255,0.5)", fontSize: 14,
      }}>
        載入地圖中…
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = Comps.rl;
  const L = Comps.L;

  // 自訂十字架 icon
  function makeCrossIcon(isGps: boolean) {
    const color = isGps ? GOLD_LIGHT : SILVER;
    const bg    = isGps ? "rgba(0,0,0,0.5)" : "rgba(60,60,80,0.45)";
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
        <rect x="0" y="0" width="26" height="34" rx="4" fill="${bg}"/>
        <!-- vertical arm -->
        <rect x="10.5" y="3" width="5" height="28" rx="2" fill="${color}"/>
        <!-- horizontal arm -->
        <rect x="3" y="9" width="20" height="5" rx="2" fill="${color}"/>
      </svg>`;
    return L.divIcon({
      html: svg,
      className: "",
      iconSize:   [26, 34],
      iconAnchor: [13, 34],
      popupAnchor:[0, -36],
    });
  }

  return (
    <div style={{ height: 400, borderRadius: 14, overflow: "hidden" }}>
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {prayers.map((p: PrayerRecord) => {
          const date = new Date(p.createdAt);
          const timeStr = `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()} `
            + `${date.getHours().toString().padStart(2,"0")}:${date.getMinutes().toString().padStart(2,"0")}`;
          return (
            <Marker
              key={p.id}
              position={[p.latitude, p.longitude]}
              icon={makeCrossIcon(p.locationSource === "gps")}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontSize: 11, color: "#c8922a", fontWeight: 700, marginBottom: 4 }}>
                    {timeStr}
                  </div>
                  {p.locationSource === "default" && (
                    <div style={{ fontSize: 10, color: "#aaa", marginBottom: 4 }}>匿名・聖殿附近</div>
                  )}
                  <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>{p.text}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}