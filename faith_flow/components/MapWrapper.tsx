import React from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { PrayerRecord } from "../lib/prayerStore";

type Props = {
  prayers: PrayerRecord[];
  center: { latitude: number; longitude: number };
};

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const GOLD_LIGHT = "#f5d680";
const SILVER = "#b0b8c8";
const THRESHOLD = 0.0003;

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makeHtml(
  prayers: PrayerRecord[],
  center: { latitude: number; longitude: number }
): string {
  const validPrayers = prayers.filter(
    (p) => p.latitude != null && p.longitude != null
  );
  const prayersJson = JSON.stringify(validPrayers);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    #map { height: 100%; width: 100%; }
    #locate-btn {
      position: absolute; bottom: 16px; right: 12px; z-index: 10;
      padding: 8px 14px; border-radius: 20px; border: none;
      background: rgba(255,255,255,0.92);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-weight: 600; font-size: 13px; cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <button id="locate-btn" onclick="gotoCurrentLocation()">📍 現在位置</button>
  <script>
    const PRAYERS = ${prayersJson};
    const CENTER  = { lat: ${center.latitude}, lng: ${center.longitude} };
    const THRESHOLD = ${THRESHOLD};

    function groupPrayers(prayers) {
      const used = new Set(), groups = [];
      for (let i = 0; i < prayers.length; i++) {
        if (used.has(i)) continue;
        const group = [prayers[i]];
        used.add(i);
        for (let j = i + 1; j < prayers.length; j++) {
          if (used.has(j)) continue;
          const dlat = prayers[i].latitude  - prayers[j].latitude;
          const dlng = prayers[i].longitude - prayers[j].longitude;
          if (Math.sqrt(dlat*dlat + dlng*dlng) < THRESHOLD) { group.push(prayers[j]); used.add(j); }
        }
        groups.push({ lat: prayers[i].latitude, lng: prayers[i].longitude, prayers: group });
      }
      return groups;
    }

    function makeCrossSvg(isGps) {
      const color = isGps ? "${GOLD_LIGHT}" : "${SILVER}";
      return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">' +
        '<rect x="10.5" y="3" width="5" height="28" rx="2" fill="' + color + '"/>' +
        '<rect x="3" y="9" width="20" height="5" rx="2" fill="' + color + '"/>' +
        '</svg>'
      );
    }

    function formatTime(iso) {
      const d = new Date(iso);
      return d.getFullYear() + "/" + (d.getMonth()+1) + "/" + d.getDate() + " " +
        d.getHours().toString().padStart(2,"0") + ":" + d.getMinutes().toString().padStart(2,"0");
    }

    function escHtml(s) {
      return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    let map, infoWindow;

    function gotoCurrentLocation() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => { map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); map.setZoom(17); },
        ()    => alert("無法取得位置，請確認定位權限。")
      );
    }

    function initMap() {
      map = new google.maps.Map(document.getElementById("map"), { center: CENTER, zoom: 15 });
      const groups = groupPrayers(PRAYERS);

      groups.forEach((group) => {
        const isGps = group.prayers[0].locationSource === "gps";
        const marker = new google.maps.Marker({
          position: { lat: group.lat, lng: group.lng },
          map,
          icon: {
            url: makeCrossSvg(isGps),
            scaledSize: new google.maps.Size(26, 34),
            anchor: new google.maps.Point(13, 34),
          },
          label: group.prayers.length > 1
            ? { text: String(group.prayers.length), color: "#fff", fontSize: "10px", fontWeight: "700" }
            : undefined,
        });

        marker.addListener("click", () => {
          if (infoWindow) infoWindow.close();
          const content =
            '<div style="min-width:180px;max-height:260px;overflow-y:auto;font-family:system-ui,sans-serif">' +
            (group.prayers.length > 1 ? '<div style="font-size:11px;color:#888;margin-bottom:8px">此位置共 ' + group.prayers.length + ' 筆祈禱</div>' : "") +
            group.prayers.map((p, i) =>
              '<div style="padding-bottom:10px;margin-bottom:10px;border-bottom:' + (i < group.prayers.length-1 ? "1px solid #eee" : "none") + '">' +
              '<div style="font-size:11px;color:#c8922a;font-weight:700;margin-bottom:3px">' + formatTime(p.createdAt) +
              (p.locationSource === "default" ? '<span style="color:#aaa;font-weight:400;margin-left:6px">匿名</span>' : "") + "</div>" +
              '<div style="font-size:13px;color:#333;line-height:1.5">' + escHtml(p.text) + "</div>" +
              "</div>"
            ).join("") +
            "</div>";
          infoWindow = new google.maps.InfoWindow({ content });
          infoWindow.open(map, marker);
        });
      });
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=initMap" async defer></script>
</body>
</html>`;
}

export default function MapWrapper({ prayers, center }: Props) {
  return (
    <View style={{ height: 400, borderRadius: 14, overflow: "hidden" }}>
      <WebView
        source={{ html: makeHtml(prayers, center) }}
        style={{ flex: 1 }}
        geolocationEnabled
        javaScriptEnabled
        originWhitelist={["*"]}
      />
    </View>
  );
}
