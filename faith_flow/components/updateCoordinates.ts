import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { GOOGLE_MAPS_API_KEY } from "../config/mapConfig";

/**
 * 手動修正特定教堂的座標字典 (如果 Google Maps 找錯的話)
 */
const MANUAL_OVERRIDES: Record<string, [number, number]> = {
  "聖誕教堂": [31.704470, 35.206386], // 手動指定聖誕教堂的精確位置
};

/**
 * 抓取 Firebase 中所有教堂資料，透過 Google Maps Geocoding API 查詢座標，
 * 並更新 Firebase 裡的 coordinates 欄位。
 */
export async function updateAllBasilicaCoordinates() {
  console.log("開始更新教堂座標資料...");
  try {
    const basilicasRef = collection(db, "basilicas");
    const snapshot = await getDocs(basilicasRef);

    let successCount = 0;
    let failCount = 0;

    for (const basilicaDoc of snapshot.docs) {
      const data = basilicaDoc.data();
      // 將教堂名稱與位置組合，提高 Google Maps 搜尋的準確度
      const addressQuery = `${data.name}, ${data.location}`;

      let location: { lat: number, lng: number } | null = null;
      let placeId: string | null = null;
      let errorStatus = "";

      // 先判斷是否有手動修正的座標
      if (MANUAL_OVERRIDES[data.name]) {
        const [lat, lng] = MANUAL_OVERRIDES[data.name];
        location = { lat, lng };
        console.log(`⚠️ [${data.name}] 偵測到手動修正座標，跳過 Places API 搜尋。`);
      } else {
        // 1. 改用 Places API (Find Place) 來尋找「實際地標位置」
        const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(addressQuery)}&inputtype=textquery&fields=geometry,place_id,name&key=${GOOGLE_MAPS_API_KEY}`;
        const placeResponse = await fetch(findPlaceUrl);
        const placeResult = await placeResponse.json();

        if (placeResult.status === "OK" && placeResult.candidates.length > 0) {
          const candidate = placeResult.candidates[0];
          location = candidate.geometry.location;
          placeId = candidate.place_id;
        } else {
          errorStatus = placeResult.status;
        }
      }

      if (location) {
        const newCoordinates = [location.lat, location.lng];

        // 2. 使用 Street View Metadata API 檢查該精準座標 10 公尺內是否有街景服務
        const svMetadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${location.lat},${location.lng}&radius=10&key=${GOOGLE_MAPS_API_KEY}`;
        const svResponse = await fetch(svMetadataUrl);
        const svResult = await svResponse.json();

        const hasStreetView = svResult.status === "OK";
        const panoId = hasStreetView ? svResult.pano_id : null;

        const updateData: any = {
          coordinates: newCoordinates,
          hasStreetView: hasStreetView,
          panoId: panoId
        };
        if (placeId) updateData.placeId = placeId;

        // 更新 Firebase 的文檔
        const docRef = doc(db, "basilicas", basilicaDoc.id);
        await updateDoc(docRef, updateData);

        console.log(`✅ 成功更新 [${data.name}]: [${newCoordinates[0]}, ${newCoordinates[1]}] (街景: ${hasStreetView ? '有' : '無'})`);
        successCount++;
      } else {
        console.warn(`❌ 找不到地標 [${data.name}] (Status: ${errorStatus})`);
        failCount++;
      }

      // 為了避免觸發 Google Maps API 的 Rate Limit (請求頻率限制)，每次請求後稍微暫停 300 毫秒
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log(`更新完成！成功: ${successCount} 筆，失敗: ${failCount} 筆。`);
    alert(`座標更新完成！\n成功: ${successCount}\n失敗: ${failCount}`);
  } catch (error) {
    console.error("更新座標時發生錯誤:", error);
    alert("更新失敗，請查看控制台的錯誤訊息。");
  }
}