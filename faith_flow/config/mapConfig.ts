/**
 * 地圖配置文件
 * 存儲Google Maps API Key和其他配置
 */

export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// 玻璃與宗教風格地圖主題
export const GLASS_RELIGIOUS_MAP_STYLE = [
  // 整體幾何元素 - 玻璃白色背景
  {
    elementType: "geometry",
    stylers: [{ color: "#f0f4f8" }],
  },
  // 水體 - 淺藍玻璃色
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#d0e8f2" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#5b8fb5" }],
  },
  // 路線 - 清淡灰色
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d9d9d9" }],
  },
  // 高速公路
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#f5f5f5" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#999999" }, { weight: 1 }],
  },
  // 宗教地點 - 金色與紫紅色突顯
  {
    featureType: "poi.place_of_worship",
    elementType: "geometry.fill",
    stylers: [{ color: "#e8c4a0" }],
  },
  {
    featureType: "poi.place_of_worship",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8b4513" }],
  },
  // 其他poi - 輕淡
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#999999" }],
  },
  // 行政邊界 - 細線
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#c9c9c9" }, { weight: 1 }],
  },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#999999" }, { weight: 2 }],
  },
  // 自然景觀 - 淺綠玻璃感
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#e8f0e6" }],
  },
  // 文字標籤 - 淡雅
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f5f5f5" }],
  },
];

export const MAP_CONFIG = {
  apiKey: GOOGLE_MAPS_API_KEY,
  defaultCenter: {
    lat: 41.9029,
    lng: 12.4534,
  },
  defaultZoom: 4,
  libraries: ["places", "marker"] as const,
};
