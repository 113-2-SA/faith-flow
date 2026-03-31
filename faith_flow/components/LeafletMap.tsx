import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Props = {
  markers: {
    id: string;
    name: string;
    location: string;
    coordinates: [number, number];
  }[];
  onMarkerPress: (id: string) => void;
};

export default function LeafletMap({ markers, onMarkerPress }: Props) {
  return (
    <MapContainer
      center={[41.9029, 12.4534]}
      zoom={4}
      style={{ width: "100%", height: 300, borderRadius: 12 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
      />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.coordinates[0], m.coordinates[1]]}
          eventHandlers={{ click: () => onMarkerPress(m.id) }}
        >
          <Popup>
            <strong>{m.name}</strong><br />{m.location}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}