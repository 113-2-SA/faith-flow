import React, { useRef, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { MAP_CONFIG } from "../config/mapConfig";
import { PrayerRecord } from "../lib/prayerStore";

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

interface GoogleMapsComponentProps {
  markers: Basilica[];
  onMarkerPress: (id: string) => void;
  selectedId: string | null;
  autoFitBounds?: boolean;
  prayerMarkers?: PrayerRecord[];
}

const API_KEY = MAP_CONFIG.apiKey;

function makeHtml(markers: Basilica[], prayerMarkers: PrayerRecord[]): string {
  const center = MAP_CONFIG.defaultCenter;
  const zoom = MAP_CONFIG.defaultZoom;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    #map { height: 100%; width: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const MARKERS = ${JSON.stringify(markers)};
    const PRAYERS = ${JSON.stringify(prayerMarkers)};
    const markerRefs = {};

    function churchIcon(scale) {
      return {
        path: "M0 -20C-3.87 -20-7 -16.87-7 -13c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: "#ffffff", fillOpacity: 0.95,
        strokeColor: "rgba(100,120,240,0.8)", strokeWeight: 1.5, scale,
      };
    }

    function panToSelected(lat, lng, id) {
      map.panTo({ lat, lng });
      map.setZoom(14);
      Object.entries(markerRefs).forEach(([mid, m]) =>
        m.setIcon(churchIcon(mid === id ? 2 : 1.4))
      );
      setTimeout(() => {
        const h = map.getDiv().clientHeight;
        map.panBy(0, Math.round(h * 0.25));
      }, 350);
    }

    function fitBounds(coords) {
      if (!coords || coords.length === 0) return;
      if (coords.length === 1) { map.panTo(coords[0]); map.setZoom(12); return; }
      const bounds = new google.maps.LatLngBounds();
      coords.forEach(c => bounds.extend(c));
      map.fitBounds(bounds);
    }

    let map;
    function initMap() {
      map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: ${center.lat}, lng: ${center.lng} },
        zoom: ${zoom},
        mapTypeId: "hybrid",
        disableDefaultUI: true,
        gestureHandling: "greedy",
        styles: [
          { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        ],
      });

      MARKERS.forEach(b => {
        const marker = new google.maps.Marker({
          position: { lat: b.coordinates[0], lng: b.coordinates[1] },
          map, title: b.name, icon: churchIcon(1.4),
        });
        markerRefs[b.id] = marker;
        marker.addListener("click", () =>
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "markerPress", id: b.id }))
        );
      });

      PRAYERS.forEach(p => {
        if (p.latitude == null || p.longitude == null) return;
        new google.maps.Marker({
          position: { lat: p.latitude, lng: p.longitude },
          map,
          icon: {
            path: "M 6,0 L 10,0 L 10,6 L 16,6 L 16,10 L 10,10 L 10,16 L 6,16 L 6,10 L 0,10 L 0,6 L 6,6 Z",
            fillColor: "#f5d060", fillOpacity: 0.95,
            strokeColor: "rgba(255,255,255,0.85)", strokeWeight: 1, scale: 1.3,
            anchor: new google.maps.Point(8, 8),
          },
        });
      });
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=initMap" async defer></script>
</body>
</html>`;
}

export default function GoogleMapsComponent({
  markers,
  onMarkerPress,
  selectedId,
  autoFitBounds,
  prayerMarkers = [],
}: GoogleMapsComponentProps) {
  const webViewRef = useRef<WebView>(null);
  const prevSelectedId = useRef<string | null>(null);

  useEffect(() => {
    if (selectedId && selectedId !== prevSelectedId.current) {
      const sel = markers.find(m => m.id === selectedId);
      if (sel) {
        webViewRef.current?.injectJavaScript(
          `panToSelected(${sel.coordinates[0]}, ${sel.coordinates[1]}, "${selectedId}"); true;`
        );
      }
    }
    prevSelectedId.current = selectedId;
  }, [selectedId, markers]);

  useEffect(() => {
    if (autoFitBounds && markers.length > 0) {
      const coords = JSON.stringify(markers.map(m => ({ lat: m.coordinates[0], lng: m.coordinates[1] })));
      webViewRef.current?.injectJavaScript(`fitBounds(${coords}); true;`);
    }
  }, [markers, autoFitBounds]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={webViewRef}
        source={{ html: makeHtml(markers, prayerMarkers) }}
        style={{ flex: 1 }}
        javaScriptEnabled
        originWhitelist={["*"]}
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.type === "markerPress") onMarkerPress(data.id);
          } catch {}
        }}
      />
    </View>
  );
}
