/**
 * 地圖配置文件
 * 存儲Google Maps API Key和其他配置
 */

export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export const MAP_CONFIG = {
  apiKey: GOOGLE_MAPS_API_KEY,
  defaultCenter: {
    lat: 41.9029,
    lng: 12.4534,
  },
  defaultZoom: 4,
  libraries: ["places", "marker"] as const,
};
