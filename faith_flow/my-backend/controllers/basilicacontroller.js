// ==================== controllers/basilicaController.js ====================
const basilicaService = require("../services/basilicaservice");

/**
 * 取得所有教堂
 * GET /api/basilica
 * GET /api/basilica?limit=50&offset=0
 */
exports.getAllBasilicas = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    console.log('📥 [getAllBasilicas] 請求取得教堂列表');

    const options = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    };

    const basilicas = await basilicaService.getAllBasilicas(options);
    const totalCount = await basilicaService.getBasilicaCount();

    console.log(`✅ [getAllBasilicas] 成功回傳 ${basilicas.length} 個教堂`);

    res.json({
      ok: true,
      data: {
        items: basilicas,
        pagination: {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
          total: totalCount,
          hasMore: parseInt(offset, 10) + basilicas.length < totalCount
        }
      }
    });
  } catch (error) {
    console.error('❌ [getAllBasilicas] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: "取得教堂列表失敗",
      detail: error.message
    });
  }
};

/**
 * 根據 ID 取得教堂
 * GET /api/basilica/:id
 */
exports.getBasilicaById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📥 [getBasilicaById] 請求取得教堂 ID: ${id}`);

    const basilica = await basilicaService.getBasilicaById(id);

    if (!basilica) {
      console.log(`❌ [getBasilicaById] 找不到教堂 ID: ${id}`);
      return res.status(404).json({
        ok: false,
        error: "找不到該教堂"
      });
    }

    console.log(`✅ [getBasilicaById] 成功取得教堂資料`);

    res.json({
      ok: true,
      data: basilica
    });
  } catch (error) {
    console.error('[getBasilicaById] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: "取得教堂資料失敗",
      detail: error.message
    });
  }
};

/**
 * 搜尋附近的教堂
 * GET /api/basilica/nearby?lat=25.0330&lng=121.5654&radius=10&limit=20
 */
exports.getNearbyBasilicas = async (req, res) => {
  try {
    const { lat, lng, radius = 10, limit = 20 } = req.query;

    // 驗證參數
    if (!lat || !lng) {
      return res.status(400).json({
        ok: false,
        error: "缺少必要參數：lat（緯度）和 lng（經度）"
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        ok: false,
        error: "緯度或經度格式不正確"
      });
    }

    console.log(`📥 [getNearbyBasilicas] 搜尋 (${latitude}, ${longitude}) 附近的教堂`);

    const basilicas = await basilicaService.getNearbyBasilicas({
      latitude,
      longitude,
      radius: parseFloat(radius),
      limit: parseInt(limit, 10)
    });

    console.log(`✅ [getNearbyBasilicas] 找到 ${basilicas.length} 個附近的教堂`);

    res.json({
      ok: true,
      data: {
        items: basilicas,
        search: {
          latitude,
          longitude,
          radius: parseFloat(radius),
          unit: 'km'
        }
      }
    });
  } catch (error) {
    console.error('[getNearbyBasilicas] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: "搜尋附近教堂失敗",
      detail: error.message
    });
  }
};

/**
 * 搜尋教堂
 * GET /api/basilica/search?q=聖母&limit=30&offset=0
 */
exports.searchBasilicas = async (req, res) => {
  try {
    const { q: keyword, limit = 30, offset = 0 } = req.query;

    if (!keyword || keyword.trim() === '') {
      return res.status(400).json({
        ok: false,
        error: "請提供搜尋關鍵字"
      });
    }

    console.log(`📥 [searchBasilicas] 搜尋關鍵字: "${keyword}"`);

    const basilicas = await basilicaService.searchBasilicas(keyword, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    console.log(`✅ [searchBasilicas] 找到 ${basilicas.length} 個結果`);

    res.json({
      ok: true,
      data: {
        items: basilicas,
        keyword: keyword,
        pagination: {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10)
        }
      }
    });
  } catch (error) {
    console.error('[searchBasilicas] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: "搜尋教堂失敗",
      detail: error.message
    });
  }
};

/**
 * 根據建築風格篩選教堂
 * GET /api/basilica/style/:archStyle?limit=30&offset=0
 */
exports.getBasilicasByArchStyle = async (req, res) => {
  try {
    const { archStyle } = req.params;
    const { limit = 30, offset = 0 } = req.query;

    console.log(`📥 [getBasilicasByArchStyle] 篩選建築風格: "${archStyle}"`);

    const basilicas = await basilicaService.getBasilicasByArchStyle(archStyle, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    console.log(`✅ [getBasilicasByArchStyle] 找到 ${basilicas.length} 個結果`);

    res.json({
      ok: true,
      data: {
        items: basilicas,
        archStyle: archStyle,
        pagination: {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10)
        }
      }
    });
  } catch (error) {
    console.error('[getBasilicasByArchStyle] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: "篩選教堂失敗",
      detail: error.message
    });
  }
};

/**
 * 取得教堂統計
 * GET /api/basilica/stats
 */
exports.getStats = async (req, res) => {
  try {
    console.log('📥 [getStats] 請求教堂統計資料');

    const totalCount = await basilicaService.getBasilicaCount();

    console.log(`✅ [getStats] 統計完成`);

    res.json({
      ok: true,
      data: {
        total: totalCount
      }
    });
  } catch (error) {
    console.error('[getStats] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: "取得統計資料失敗",
      detail: error.message
    });
  }
};
