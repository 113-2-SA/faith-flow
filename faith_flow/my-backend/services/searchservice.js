// services/searchService.js
const pool = require('../config/database');

class SearchService {
  
  // 搜尋日記
  async searchDiary({ userId, keyword, tags, startDate, endDate, page, limit }) {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT d.*, 
             ARRAY_AGG(dt.tag_name) FILTER (WHERE dt.tag_name IS NOT NULL) as tags
      FROM diaries d
      LEFT JOIN diary_tags dt ON d.diary_id = dt.diary_id
      WHERE d."user_id" = $1
    `;
    
    const params = [userId];
    let paramIndex = 2;

    // 關鍵字搜尋 (PostgreSQL 用 ILIKE 不分大小寫)
    if (keyword) {
      query += ` AND (d.title ILIKE $${paramIndex} OR d.content ILIKE $${paramIndex + 1})`;
      params.push(`%${keyword}%`, `%${keyword}%`);
      paramIndex += 2;
    }

    // 標籤篩選
    if (tags && tags.length > 0) {
      query += ` AND dt.tag_name = ANY($${paramIndex})`;
      params.push(tags);
      paramIndex++;
    }

    // 日期範圍
    if (startDate) {
      query += ` AND d.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      query += ` AND d.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` GROUP BY d.diary_id ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // 執行查詢
    const result = await pool.query(query, params);

    // 取得總數
    let countQuery = `
      SELECT COUNT(DISTINCT d.diary_id) as total 
      FROM diaries d 
      LEFT JOIN diary_tags dt ON d.diary_id = dt.diary_id 
      WHERE d."user_id" = $1
    `;
    const countParams = [userId];
    let countParamIndex = 2;

    if (keyword) {
      countQuery += ` AND (d.title ILIKE $${countParamIndex} OR d.content ILIKE $${countParamIndex + 1})`;
      countParams.push(`%${keyword}%`, `%${keyword}%`);
      countParamIndex += 2;
    }
    if (tags && tags.length > 0) {
      countQuery += ` AND dt.tag_name = ANY($${countParamIndex})`;
      countParams.push(tags);
    }
    if (startDate) {
      countQuery += ` AND d.created_at >= $${countParamIndex}`;
      countParams.push(startDate);
      countParamIndex++;
    }
    if (endDate) {
      countQuery += ` AND d.created_at <= $${countParamIndex}`;
      countParams.push(endDate);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return { 
      diaries: result.rows, 
      total 
    };
  }

  // 搜尋社群貼文
  async searchPosts({ keyword, tags, authorId, sortBy, page, limit }) {
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*,
             u."user_name" as username, u."user_pic" as avatar_url,
             COUNT(DISTINCT pl.user_id) as like_count,
             COUNT(DISTINCT pc.comment_id) as comment_count,
             COUNT(DISTINCT ps.shared_by_user_id) as share_count,
             (COUNT(DISTINCT pl.user_id) + COUNT(DISTINCT pc.comment_id) + COUNT(DISTINCT ps.shared_by_user_id)) as popularity
      FROM community_posts p
      JOIN "user" u ON p.author_user_id = u."userID"
      LEFT JOIN community_post_likes pl ON p.community_post_id = pl.post_id
      LEFT JOIN community_comments pc ON p.community_post_id = pc.post_id AND pc.deleted_at IS NULL
      LEFT JOIN community_post_shares ps ON p.community_post_id = ps.original_post_id AND ps.deleted_at IS NULL
      WHERE p.visibility = 'public' AND p.deleted_at IS NULL
    `;

    const params = [];
    let paramIndex = 1;

    // 關鍵字搜尋：同時比對 貼文內容 / 作者名稱 / 標籤
    if (keyword) {
      query += `
        AND (
          p.post_text ILIKE $${paramIndex}
          OR u."user_name" ILIKE $${paramIndex}
          OR EXISTS (
            SELECT 1 FROM unnest(p.tags) AS t
            WHERE t ILIKE $${paramIndex}
          )
        )`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    // 標籤篩選（精確符合，從前端傳來的 tags 陣列）
    if (tags && tags.length > 0) {
      query += ` AND p.tags && $${paramIndex}`;
      params.push(tags);
      paramIndex++;
    }

    // 作者篩選
    if (authorId) {
      query += ` AND p.author_user_id = $${paramIndex}`;
      params.push(authorId);
      paramIndex++;
    }

    query += ` GROUP BY p.community_post_id, u."user_name", u."user_pic"`;

    // 排序
    switch (sortBy) {
      case 'newest':
        query += ` ORDER BY p.created_at DESC`;
        break;
      case 'popular':
        query += ` ORDER BY popularity DESC, p.created_at DESC`;
        break;
      case 'relevance':
      default:
        query += ` ORDER BY p.created_at DESC`;
        break;
    }

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // 取得總數（需要 JOIN user 才能搜尋 username）
    let countQuery = `
      SELECT COUNT(DISTINCT p.community_post_id) as total
      FROM community_posts p
      JOIN "user" u ON p.author_user_id = u."userID"
      WHERE p.visibility = 'public' AND p.deleted_at IS NULL
    `;
    const countParams = [];
    let countParamIndex = 1;

    if (keyword) {
      countQuery += `
        AND (
          p.post_text ILIKE $${countParamIndex}
          OR u."user_name" ILIKE $${countParamIndex}
          OR EXISTS (
            SELECT 1 FROM unnest(p.tags) AS t
            WHERE t ILIKE $${countParamIndex}
          )
        )`;
      countParams.push(`%${keyword}%`);
      countParamIndex++;
    }
    if (tags && tags.length > 0) {
      countQuery += ` AND p.tags && $${countParamIndex}`;
      countParams.push(tags);
      countParamIndex++;
    }
    if (authorId) {
      countQuery += ` AND p.author_user_id = $${countParamIndex}`;
      countParams.push(authorId);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return {
      posts: result.rows,
      total
    };
  }

  // 搜尋訊息
  async searchMessages({ userId, keyword, chatId, startDate, endDate, page, limit }) {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT m.*, 
             c.chat_name,
             u.username as sender_name
      FROM messages m
      JOIN chats c ON m.chat_id = c.chat_id
      JOIN chat_participants cp ON c.chat_id = cp.chat_id
      JOIN "user" u ON m.sender_id = u."userID"
      WHERE cp."user_id" = $1
    `;
    
    const params = [userId];
    let paramIndex = 2;

    // 關鍵字搜尋
    if (keyword) {
      query += ` AND m.content ILIKE $${paramIndex}`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    // 特定對話
    if (chatId) {
      query += ` AND m.chat_id = $${paramIndex}`;
      params.push(chatId);
      paramIndex++;
    }

    // 日期範圍
    if (startDate) {
      query += ` AND m.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      query += ` AND m.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // 取得總數
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM messages m
      JOIN chat_participants cp ON m.chat_id = cp.chat_id
      WHERE cp."user_id" = $1
    `;
    const countParams = [userId];
    let countParamIndex = 2;

    if (keyword) {
      countQuery += ` AND m.content ILIKE $${countParamIndex}`;
      countParams.push(`%${keyword}%`);
      countParamIndex++;
    }
    if (chatId) {
      countQuery += ` AND m.chat_id = $${countParamIndex}`;
      countParams.push(chatId);
      countParamIndex++;
    }
    if (startDate) {
      countQuery += ` AND m.created_at >= $${countParamIndex}`;
      countParams.push(startDate);
      countParamIndex++;
    }
    if (endDate) {
      countQuery += ` AND m.created_at <= $${countParamIndex}`;
      countParams.push(endDate);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return { 
      messages: result.rows, 
      total 
    };
  }
}

module.exports = new SearchService();