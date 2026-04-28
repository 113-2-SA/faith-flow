import React from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { PrayerRecord } from "../app/prayerStore";

type Props = {
  prayers: PrayerRecord[];
  center: { latitude: number; longitude: number };
};

export default function MapWrapper({ prayers, center }: Props) {
  return (
    <View style={{ height: 400, borderRadius: 14, overflow: "hidden" }}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        showsUserLocation
        showsCompass
      >
        {prayers.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.markerOuter,
                p.locationSource === "gps" ? styles.markerGps : styles.markerAnon,
              ]}
            >
              <View
                style={[
                  styles.crossV,
                  p.locationSource === "gps" ? styles.crossGoldV : styles.crossSilverV,
                ]}
              />
              <View
                style={[
                  styles.crossH,
                  p.locationSource === "gps" ? styles.crossGoldH : styles.crossSilverH,
                ]}
              />
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const GOLD       = "#c8922a";
const GOLD_LIGHT = "#f5d680";
const SILVER     = "#b0b8c8";

const styles = StyleSheet.create({
  markerOuter: {
    width: 26, height: 34, alignItems: "center", justifyContent: "center",
    position: "relative", borderRadius: 4,
  },
  markerGps:  { backgroundColor: "rgba(0,0,0,0.5)" },
  markerAnon: { backgroundColor: "rgba(60,60,80,0.45)" },
  crossV: { position: "absolute", width: 5, height: 28, borderRadius: 2 },
  crossH: { position: "absolute", top: 6, width: 20, height: 5, borderRadius: 2 },
  crossGoldV:   { backgroundColor: GOLD_LIGHT, shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 4, elevation: 4 },
  crossGoldH:   { backgroundColor: GOLD_LIGHT, shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 4, elevation: 4 },
  crossSilverV: { backgroundColor: SILVER },
  crossSilverH: { backgroundColor: SILVER },
});
