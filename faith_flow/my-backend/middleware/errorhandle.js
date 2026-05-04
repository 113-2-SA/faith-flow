/**
 * 全域錯誤處理中介層
 */
function errorHandler(err, req, res, next) {
    console.error('❌ Error:', err);

    // 資料庫錯誤
    if (err.code === '23505') { // unique violation
        return res.status(409).json({
            success: false,
            error: '資料重複'
        });
    }

    if (err.code === '23503') { // foreign key violation
        return res.status(400).json({
            success: false,
            error: '關聯資料不存在'
        });
    }

    // 一般錯誤
    res.status(err.status || 500).json({
        success: false,
        error: err.message || '伺服器錯誤',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

module.exports = errorHandler;