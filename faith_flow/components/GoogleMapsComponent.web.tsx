import React, { useRef, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import { MAP_CONFIG, GLASS_RELIGIOUS_MAP_STYLE } from "../config/mapConfig";

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
}

export default function GoogleMapsComponent({
  markers,
  onMarkerPress,
  selectedId,
  autoFitBounds,
}: GoogleMapsComponentProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    // 當選中的marker變化時，使地圖居中
    if (selectedId && mapRef.current) {
      const selected = markers.find((m) => m.id === selectedId);
      if (selected) {
        mapRef.current.panTo({
          lat: selected.coordinates[0],
          lng: selected.coordinates[1],
        });
        mapRef.current.setZoom(10);
      }
    }
  }, [selectedId, markers]);

  useEffect(() => {
    // 當使用者輸入搜尋條件或篩選時，自動調整地圖邊界以包含所有符合的標記
    if (autoFitBounds && mapRef.current && markers.length > 0) {
      if (markers.length === 1) {
        mapRef.current.panTo({
          lat: markers[0].coordinates[0],
          lng: markers[0].coordinates[1],
        });
        mapRef.current.setZoom(10);
      } else {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach((m) => bounds.extend({ lat: m.coordinates[0], lng: m.coordinates[1] }));
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [markers, autoFitBounds]);

  return (
    <LoadScript googleMapsApiKey={MAP_CONFIG.apiKey}>
      <GoogleMap
        mapContainerStyle={styles.mapContainer}
        center={MAP_CONFIG.defaultCenter}
        zoom={MAP_CONFIG.defaultZoom}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          styles: GLASS_RELIGIOUS_MAP_STYLE as any,
        }}
      >
        {markers.map((basilica) => (
          <React.Fragment key={basilica.id}>
            <Marker
              position={{
                lat: basilica.coordinates[0],
                lng: basilica.coordinates[1],
              }}
              title={basilica.name}
              onClick={() => onMarkerPress(basilica.id)}
              icon={{
                path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
                fillColor: "#666fee",
                fillOpacity: 0.9,
                strokeColor: "#fff",
                strokeWeight: 2,
                scale: 1.5,
              }}
            />
            {selectedId === basilica.id && (
              <InfoWindow
                position={{
                  lat: basilica.coordinates[0],
                  lng: basilica.coordinates[1],
                }}
                onCloseClick={() => onMarkerPress("")}
              >
                <View style={styles.infoWindow}>
                  <View style={styles.infoTitle}>{basilica.name}</View>
                  <View style={styles.infoSubtitle}>{basilica.nameEn}</View>
                  <View style={styles.infoText}>📍 {basilica.location}</View>
                  <View style={styles.infoText}>⏰ {basilica.founded} 年</View>
                </View>
              </InfoWindow>
            )}
          </React.Fragment>
        ))}
      </GoogleMap>
    </LoadScript>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    width: "90%",
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
  },
  infoWindow: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    maxWidth: 280,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#333",
  },
  infoSubtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
    fontStyle: "italic",
  },
  infoText: {
    fontSize: 12,
    color: "#555",
    marginBottom: 2,
  },
});
