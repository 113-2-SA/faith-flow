import React, { useRef, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { MAP_CONFIG } from "../config/mapConfig";

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
}: GoogleMapsComponentProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!window.google || !selectedId || !mapRef.current) return;
    const selected = markers.find((m) => m.id === selectedId);
    if (selected) {
      mapRef.current.panTo({ lat: selected.coordinates[0], lng: selected.coordinates[1] });
      mapRef.current.setZoom(14);
      // Offset marker to 25% from top (pan viewport down by 25% of map height)
      setTimeout(() => {
        if (!mapRef.current) return;
        const h = mapRef.current.getDiv().clientHeight;
        mapRef.current.panBy(0, Math.round(h * 0.25));
      }, 350);
    }
  }, [selectedId, markers]);

  useEffect(() => {
    if (!window.google || !autoFitBounds || !mapRef.current || markers.length === 0) return;
    if (markers.length === 1) {
      mapRef.current.panTo({ lat: markers[0].coordinates[0], lng: markers[0].coordinates[1] });
      mapRef.current.setZoom(12);
    } else {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.coordinates[0], lng: m.coordinates[1] }));
      mapRef.current.fitBounds(bounds);
    }
  }, [markers, autoFitBounds]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LoadScript googleMapsApiKey={MAP_CONFIG.apiKey}>
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
                  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                  fillColor: "#ffffff",
                  fillOpacity: 0.95,
                  strokeColor: "rgba(100,120,240,0.8)",
                  strokeWeight: 1.5,
                  scale: selectedId === basilica.id ? 2 : 1.4,
                }}
              />
            </React.Fragment>
          ))}
        </GoogleMap>
      </LoadScript>
    </View>
  );
}
