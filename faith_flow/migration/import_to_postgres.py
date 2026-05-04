#!/usr/bin/env python3
"""
將 Firestore JSON 資料匯入現有的 PostgreSQL 資料表
針對你的 places 表結構設計
"""

import json
import psycopg2
from datetime import datetime
from typing import List, Dict

# ========== 設定區 ==========
POSTGRES_CONFIG = {
    'host': 'localhost',
    'database': 'faithflow',  # ⚠️ 改成你的資料庫名稱
    'user': 'postgres',            # ⚠️ 改成你的使用者名稱
    'password': 'Iris2501Faith_Flow',   # ⚠️ 改成你的密碼
    'port': 5432
}

# JSON 檔案路徑
PLACES_JSON_FILE = 'basilicas_export.json'  # ⚠️ 改成你的檔案名稱

# ========== 資料庫連線 ==========
def get_db_connection():
    """建立 PostgreSQL 連線"""
    try:
        conn = psycopg2.connect(**POSTGRES_CONFIG)
        print("✅ 資料庫連線成功")
        return conn
    except Exception as e:
        print(f"❌ 資料庫連線失敗: {e}")
        print("\n💡 請確認：")
        print("  1. PostgreSQL 服務已啟動")
        print("  2. 資料庫名稱、使用者、密碼正確")
        print("  3. 防火牆允許連線")
        raise

# ========== 解析日期時間 ==========
def parse_timestamp(timestamp_str):
    """解析 ISO 8601 格式的時間戳記"""
    if not timestamp_str or timestamp_str == 'null':
        return None
    try:
        # "2026-03-31T02:35:04.070Z"
        return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
    except Exception as e:
        print(f"⚠️  日期解析失敗: {timestamp_str} - {e}")
        return None

def parse_founded_year(founded):
    """解析 founded 欄位，轉換為日期格式"""
    if not founded:
        return None
    try:
        # 如果是數字（年份），轉換為日期
        if isinstance(founded, (int, float)):
            year = int(founded)
            # 假設是 1 月 1 日
            return datetime(year, 1, 1).date()
        # 如果已經是字串日期格式
        elif isinstance(founded, str):
            return datetime.fromisoformat(founded).date()
    except Exception as e:
        print(f"⚠️  founded 解析失敗: {founded} - {e}")
    return None

# ========== 讀取 JSON 資料 ==========
def load_json_data(filename):
    """讀取 JSON 檔案"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ 已讀取 {len(data)} 筆資料\n")
        return data
    except FileNotFoundError:
        print(f"❌ 找不到檔案: {filename}")
        print(f"💡 請確認檔案在同一個目錄下")
        raise
    except json.JSONDecodeError as e:
        print(f"❌ JSON 格式錯誤: {e}")
        raise

# ========== 匯入 Places 資料 ==========
def import_places(conn, places_data: List[Dict]):
    """匯入地點資料到 places 表"""
    
    with conn.cursor() as cur:
        inserted = 0
        updated = 0
        skipped = 0
        
        print(f"📥 開始匯入 {len(places_data)} 筆地點資料...\n")
        
        for idx, place in enumerate(places_data, 1):
            try:
                # 解析座標 [latitude, longitude]
                coordinates = place.get('coordinates', [])
                if len(coordinates) != 2:
                    print(f"⚠️  [{idx}] 跳過：{place.get('name')} - 座標格式錯誤")
                    skipped += 1
                    continue
                
                latitude = float(coordinates[0])
                longitude = float(coordinates[1])
                
                # JSON 欄位 → PostgreSQL 欄位對應
                data = {
                    'firestore_id': place.get('id'),           # id → place_id (會自動生成)
                    'pname': place.get('name'),                # name → pname
                    'name_en': place.get('nameEn'),            # nameEn → name_en
                    'latitude': latitude,
                    'longitude': longitude,
                    'location': place.get('location'),
                    'description': place.get('description'),
                    'dedication': place.get('dedication'),
                    'founded': parse_founded_year(place.get('founded')),  # 數字 → 日期
                    'significance': place.get('significance'),
                    'arch_style': place.get('style'),          # style → arch_style
                    'ptype': place.get('type'),                # type → ptype
                    'panorama_id': place.get('panoramaId'),
                    'panorama_status': place.get('panoramaStatus'),
                    'panorama_updated_at': parse_timestamp(place.get('panoramaUpdatedAt')),
                    'street_view_url': place.get('streetViewUrl'),
                    'viewer_url': place.get('viewerUrl')
                }
                
                # 檢查必要欄位
                if not data['pname']:
                    print(f"⚠️  [{idx}] 跳過：缺少 name 欄位")
                    skipped += 1
                    continue
                
                # 使用 Firestore ID 來判斷是否重複
                # 先檢查是否已存在
                cur.execute("""
                    SELECT place_id FROM places 
                    WHERE latitude = %s AND longitude = %s
                """, (latitude, longitude))
                
                existing = cur.fetchone()
                
                if existing:
                    # 更新現有資料
                    cur.execute("""
                        UPDATE places SET
                            pname = %(pname)s,
                            name_en = %(name_en)s,
                            location = %(location)s,
                            description = %(description)s,
                            dedication = %(dedication)s,
                            founded = %(founded)s,
                            significance = %(significance)s,
                            arch_style = %(arch_style)s,
                            ptype = %(ptype)s,
                            panorama_id = %(panorama_id)s,
                            panorama_status = %(panorama_status)s,
                            panorama_updated_at = %(panorama_updated_at)s,
                            street_view_url = %(street_view_url)s,
                            viewer_url = %(viewer_url)s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE place_id = %s
                    """, {**data, 'place_id': existing[0]})
                    
                    updated += 1
                    print(f"🔄 [{idx}] 更新: {data['pname']}")
                    
                else:
                    # 插入新資料
                    cur.execute("""
                        INSERT INTO places (
                            pname, name_en, latitude, longitude, location,
                            description, dedication, founded, significance,
                            arch_style, ptype, panorama_id, panorama_status,
                            panorama_updated_at, street_view_url, viewer_url
                        ) VALUES (
                            %(pname)s, %(name_en)s, %(latitude)s, %(longitude)s,
                            %(location)s, %(description)s, %(dedication)s,
                            %(founded)s, %(significance)s, %(arch_style)s,
                            %(ptype)s, %(panorama_id)s, %(panorama_status)s,
                            %(panorama_updated_at)s, %(street_view_url)s,
                            %(viewer_url)s
                        )
                    """, data)
                    
                    inserted += 1
                    print(f"✅ [{idx}] 新增: {data['pname']}")
                
                # 每 10 筆提交一次
                if (inserted + updated) % 10 == 0:
                    conn.commit()
                    
            except Exception as e:
                print(f"❌ [{idx}] 錯誤處理 {place.get('name', 'Unknown')}: {e}")
                skipped += 1
                continue
        
        # 最終提交
        conn.commit()
        
        print(f"\n" + "="*60)
        print(f"📊 匯入完成統計:")
        print(f"  ✅ 新增: {inserted} 筆")
        print(f"  🔄 更新: {updated} 筆")
        print(f"  ⏭️  跳過: {skipped} 筆")
        print(f"  📈 成功: {inserted + updated} 筆")
        print(f"  📉 失敗: {skipped} 筆")
        print("="*60)

# ========== 驗證資料 ==========
def verify_import(conn):
    """驗證匯入結果"""
    with conn.cursor() as cur:
        print("\n🔍 驗證匯入結果...\n")
        
        # 總筆數
        cur.execute("SELECT COUNT(*) FROM places")
        total = cur.fetchone()[0]
        print(f"📊 資料表總筆數: {total}")
        
        # 按類型統計
        cur.execute("""
            SELECT ptype, COUNT(*) 
            FROM places 
            WHERE ptype IS NOT NULL
            GROUP BY ptype 
            ORDER BY COUNT(*) DESC
        """)
        print(f"\n📋 按類型統計:")
        for row in cur.fetchall():
            print(f"  {row[0]}: {row[1]} 筆")
        
        # 顯示最新 5 筆
        cur.execute("""
            SELECT place_id, pname, location, ptype
            FROM places
            ORDER BY created_at DESC
            LIMIT 5
        """)
        print(f"\n📝 最新 5 筆資料:")
        for row in cur.fetchall():
            print(f"  [{row[0]}] {row[1]} - {row[2]} ({row[3]})")

# ========== 主程式 ==========
def main():
    print("🚀 開始資料匯入...\n")
    
    try:
        # 1. 讀取 JSON 資料
        places_data = load_json_data(PLACES_JSON_FILE)
        
        # 顯示第一筆資料範例
        if places_data:
            print("📋 第一筆資料範例:")
            print(json.dumps(places_data[0], ensure_ascii=False, indent=2))
            print("\n" + "="*60 + "\n")
        
        # 2. 連接資料庫
        conn = get_db_connection()
        
        # 3. 匯入資料
        import_places(conn, places_data)
        
        # 4. 驗證結果
        verify_import(conn)
        
        # 5. 關閉連線
        conn.close()
        
        print("\n🎉 所有作業完成！")
        
    except Exception as e:
        print(f"\n❌ 執行失敗: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
