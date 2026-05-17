import React, { useRef, useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
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
  locationToPan?: { lat: number; lng: number } | null;
}

const MAP_CONTAINER_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

const MAP_OPTIONS = {
  mapTypeId: "hybrid",
  disableDefaultUI: true,
  gestureHandling: "greedy",
  styles: [
    { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
    { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  ],
};

export default function GoogleMapsComponent({
  markers,
  onMarkerPress,
  selectedId,
  autoFitBounds,
  prayerMarkers = [],
  locationToPan,
}: GoogleMapsComponentProps) {
  // useJsApiLoader is a singleton — won't re-inject the script on remount
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: MAP_CONFIG.apiKey,
    libraries: MAP_CONFIG.libraries as any,
  });

  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!isLoaded || !selectedId || !mapRef.current) return;
    const selected = markers.find((m) => m.id === selectedId);
    if (selected) {
      mapRef.current.panTo({ lat: selected.coordinates[0], lng: selected.coordinates[1] });
      mapRef.current.setZoom(14);
      setTimeout(() => {
        if (!mapRef.current) return;
        const h = mapRef.current.getDiv().clientHeight;
        mapRef.current.panBy(0, Math.round(h * 0.25));
      }, 350);
    }
  }, [selectedId, markers, isLoaded]);

  useEffect(() => {
    if (locationToPan && mapRef.current) {
      mapRef.current.panTo(locationToPan);
      mapRef.current.setZoom(16);
    }
  }, [locationToPan]);

  useEffect(() => {
    if (!isLoaded || !autoFitBounds || !mapRef.current || markers.length === 0) return;
    if (markers.length === 1) {
      mapRef.current.panTo({ lat: markers[0].coordinates[0], lng: markers[0].coordinates[1] });
      mapRef.current.setZoom(12);
    } else {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.coordinates[0], lng: m.coordinates[1] }));
      mapRef.current.fitBounds(bounds);
    }
  }, [markers, autoFitBounds, isLoaded]);

  if (loadError) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.fallback]}>
        <Text style={styles.fallbackText}>⚠️ 地圖載入失敗，請重新整理頁面</Text>
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.fallback]}>
        <Text style={styles.fallbackText}>🗺️ 地圖載入中...</Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={MAP_CONFIG.defaultCenter}
        zoom={MAP_CONFIG.defaultZoom}
        onLoad={(map) => { mapRef.current = map; }}
        options={MAP_OPTIONS}
      >
        {markers.map((basilica) => (
          <React.Fragment key={basilica.id}>
            <Marker
              position={{ lat: basilica.coordinates[0], lng: basilica.coordinates[1] }}
              title={basilica.name}
              onClick={() => onMarkerPress(basilica.id)}
              icon={{
                // pin 尖端在路徑原點 (0,0)，無需設定 anchor
                path: "M0 -20C-3.87 -20-7 -16.87-7 -13c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                fillColor: "#ffffff",
                fillOpacity: 0.95,
                strokeColor: "rgba(100,120,240,0.8)",
                strokeWeight: 1.5,
                scale: selectedId === basilica.id ? 2 : 1.4,
              }}
            />
          </React.Fragment>
        ))}
        {prayerMarkers.filter((p) => p.latitude != null && p.longitude != null && !isNaN(p.latitude) && !isNaN(p.longitude)).map((p) => (
          <Marker
            key={`prayer-${p.id}`}
            position={{ lat: p.latitude, lng: p.longitude }}
            title={p.title || "祈禱記錄"}
            icon={{
              path: "M 6,0 L 10,0 L 10,6 L 16,6 L 16,10 L 10,10 L 10,16 L 6,16 L 6,10 L 0,10 L 0,6 L 6,6 Z",
              fillColor: "#f5d060",
              fillOpacity: 0.95,
              strokeColor: "rgba(255,255,255,0.85)",
              strokeWeight: 1,
              scale: 1.3,
              anchor: new window.google.maps.Point(8, 8),
            }}
          />
        ))}
      </GoogleMap>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  fallbackText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 15,
    fontFamily: "NotoSerifTC_400Regular",
  },
});
