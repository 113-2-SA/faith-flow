// services/postService.js
const pool = require('../config/database');
const cloudflareService = require('./cloudflareservice');


class PostService {
    // 新增貼文（支援圖片上傳）
    async createPost(postData, imageFile = null) {
        let uploadedImageUrl = null;
        let didCommit = false;

        console.log('📷 [postService.createPost] imageFile:', imageFile ? `有圖片 (${imageFile.originalname}, ${imageFile.size} bytes)` : '無圖片');

        // 【第一步】先上傳 R2，完全不佔用 DB 連線池
        if (imageFile) {
            console.log('📤 開始上傳圖片到 Cloudflare R2...');
            uploadedImageUrl = await cloudflareService.uploadImage(
                imageFile.buffer,
                imageFile.originalname,
                imageFile.mimetype
            );
            console.log('✅ R2 上傳完成:', uploadedImageUrl);
        }

        // 【第二步】上傳完才拿 DB 連線
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const postQuery = `
               INSERT INTO community_posts
                (author_user_id, post_text, post_type, visibility, letter_id, diary_id, summary_id, tags, post_pic)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const postResult = await client.query(postQuery, [
                postData.author_user_id,
                postData.post_text,
                postData.post_type,
                postData.visibility || 'public',
                postData.letter_id || null,
                postData.diary_id || null,
                postData.summary_id || null,
                postData.tags || null,
                uploadedImageUrl
            ]);

            const post = postResult.rows[0];
            await client.query('COMMIT');
            didCommit = true;

            // 【第三步】COMMIT 完立刻還回連線
            client.release();

            // 【第四步】用 pool.query 拿新連線查詢
            return await this.getPostById(post.community_post_id);

        } catch (error) {
            if (!didCommit) {
                await client.query('ROLLBACK');
                // ROLLBACK 代表貼文沒寫進 DB，才需要清 R2
                if (uploadedImageUrl) {
                    console.log('🗑️ DB 寫入失敗，清理 R2 圖片...');
                    await cloudflareService.deleteImage(uploadedImageUrl).catch(console.error);
                }
            }
            client.release();
            throw error;
        }
    }

    // 輕量存在確認
    async postExists(postId) {
        const result = await pool.query(
            `SELECT 1 FROM community_posts WHERE community_post_id = $1 AND deleted_at IS NULL`,
            [postId]
        );
        return result.rowCount > 0;
    }

    // ⭐ 獲取單一貼文（含標籤、作者資訊、點讚和轉發狀態、圖片、日記卡片）
    async getPostById(postId, userId = null) {
    const query = `
        SELECT
            p.*,
            u."user_name" as username,
            u."user_pic" as avatar_url,
            d.diary_id      as diary_card_id,
            d.diary_title   as diary_card_title,
            d.diary_content as diary_card_content,
            d.diary_date    as diary_card_date,
            ws."summary_id"      as summary_card_id,
            ws."summary_title"   as summary_card_title,
            ws."summary_content" as summary_card_content,
            ws."bible_quote"     as summary_card_bible_quote,
            ws."year"            as summary_card_year,
            ws."week_number"     as summary_card_week_number,
            ws."start_date"      as summary_card_start_date,
            ws."end_date"        as summary_card_end_date,
            l.summary_text  as letter_card_summary,
            aq.question_text as letter_card_question,
            aq.image_url    as letter_card_image_url,
            ud.letter_quote as letter_card_quote,
            ud.letter_quote_source as letter_card_quote_source
        FROM community_posts p
        LEFT JOIN "user" u ON p.author_user_id = u."userID"
        LEFT JOIN diary d ON p.post_type = 'diary' AND p.diary_id = d.diary_id
        LEFT JOIN "weekly_summary" ws ON p.post_type = 'summary' AND p.summary_id = ws."summary_id"
        LEFT JOIN letters l ON p.post_type = 'letter' AND p.letter_id = l.letter_id
        LEFT JOIN user_draws ud ON ud.summary = l.summary_text AND ud.is_completed = true
        LEFT JOIN weekly_cards wc ON wc.weekly_cards_id = ud.weekly_card_id
        LEFT JOIN ai_questions aq ON aq.ai_question_id = wc.ai_question_id
        WHERE p.community_post_id = $1 AND p.deleted_at IS NULL
    `;

        const result = await pool.query(query, [postId]);

        if (result.rows.length === 0) {
            return null;
        }

        const post = result.rows[0];

        // 整理日記卡片
        if (post.diary_card_id) {
            post.diary_card = {
                diary_id:      post.diary_card_id,
                diary_title:   post.diary_card_title,
                diary_content: post.diary_card_content,
                diary_date:    post.diary_card_date,
            };
        }
        delete post.diary_card_id;
        delete post.diary_card_title;
        delete post.diary_card_content;
        delete post.diary_card_date;

        // 整理周回顧卡片
        if (post.summary_card_id) {
            post.summary_card = {
                summary_id:      post.summary_card_id,
                summary_title:   post.summary_card_title,
                summary_content: post.summary_card_content,
                bible_quote:     post.summary_card_bible_quote,
                year:            post.summary_card_year,
                week_number:     post.summary_card_week_number,
                start_date:      post.summary_card_start_date,
                end_date:        post.summary_card_end_date,
            };
        }
        delete post.summary_card_id;
        delete post.summary_card_title;
        delete post.summary_card_content;
        delete post.summary_card_bible_quote;
        delete post.summary_card_year;
        delete post.summary_card_week_number;
        delete post.summary_card_start_date;
        delete post.summary_card_end_date;

        // ✨ 整理信箋卡片
        if (post.letter_card_summary) {
            post.letter_card = {
                summary_text: post.letter_card_summary,
                question:     post.letter_card_question,
                image_url:    post.letter_card_image_url,
                quote:        post.letter_card_quote,
                quote_source: post.letter_card_quote_source,
            };
        }
        delete post.letter_card_summary;
        delete post.letter_card_question;
        delete post.letter_card_image_url;
        delete post.letter_card_quote;
        delete post.letter_card_quote_source;

        // ⭐ 如果提供了 userId，檢查點讚和轉發狀態
        if (userId) {
            post.is_owner = Number(post.author_user_id) === Number(userId);

            const statusQuery = `
                SELECT
                    EXISTS(
                        SELECT 1 FROM community_post_likes
                        WHERE post_id = $1 AND user_id = $2
                    ) as is_liked,
                    EXISTS(
                        SELECT 1 FROM community_post_shares
                        WHERE original_post_id = $1
                        AND shared_by_user_id = $2
                        AND deleted_at IS NULL
                    ) as has_shared
            `;

            const statusResult = await pool.query(statusQuery, [postId, userId]);
            post.is_liked = statusResult.rows[0].is_liked;
            post.has_shared = statusResult.rows[0].has_shared;
        }

        // ⭐ 如果是轉發的貼文，獲取原始貼文資訊（含日記卡片）
        if (post.post_type === 'shared') {
            const originalPostQuery = `
                SELECT
                    p.community_post_id,
                    p.post_text,
                    p.post_type,
                    p.created_at,
                    u."user_name"   as original_author_name,
                    u."user_pic"    as original_author_avatar,
                    d.diary_id      as diary_card_id,
                    d.diary_title   as diary_card_title,
                    d.diary_content as diary_card_content,
                    d.diary_date    as diary_card_date,
                    l.summary_text  as letter_card_summary,
                    aq.question_text as letter_card_question,
                    aq.image_url    as letter_card_image_url,
                    ud.letter_quote as letter_card_quote,
                    ud.letter_quote_source as letter_card_quote_source
                FROM community_post_shares s
                JOIN community_posts p ON s.original_post_id = p.community_post_id
                LEFT JOIN "user" u ON p.author_user_id = u."userID"
                LEFT JOIN diary d ON p.post_type = 'diary' AND p.diary_id = d.diary_id
                LEFT JOIN letters l ON p.post_type = 'letter' AND p.letter_id = l.letter_id
                LEFT JOIN user_draws ud ON ud.summary = l.summary_text AND ud.is_completed = true
                LEFT JOIN weekly_cards wc ON wc.weekly_cards_id = ud.weekly_card_id
                LEFT JOIN ai_questions aq ON aq.ai_question_id = wc.ai_question_id
                WHERE s.shared_post_id = $1
                AND s.deleted_at IS NULL
                AND p.deleted_at IS NULL
            `;

            const originalResult = await pool.query(originalPostQuery, [postId]);
            if (originalResult.rows[0]) {
                const orig = originalResult.rows[0];
                post.original_post = {
                    community_post_id:    orig.community_post_id,
                    post_text:            orig.post_text,
                    post_type:            orig.post_type,
                    created_at:           orig.created_at,
                    original_author_name: orig.original_author_name,
                    original_author_avatar: orig.original_author_avatar,
                    ...(orig.diary_card_id ? {
                        diary_card: {
                            diary_id:      orig.diary_card_id,
                            diary_title:   orig.diary_card_title,
                            diary_content: orig.diary_card_content,
                            diary_date:    orig.diary_card_date,
                        }
                    } : {}),
                    ...(orig.letter_card_summary ? {
                        letter_card: {
                            summary_text: orig.letter_card_summary,
                            question:     orig.letter_card_question,
                            image_url:    orig.letter_card_image_url,
                            quote:        orig.letter_card_quote,
                            quote_source: orig.letter_card_quote_source,
                        }
                    } : {})
                };
            } else {
                post.original_post = null;
            }
        }

        return post;
    }

    // ⭐ 獲取貼文列表（分頁）- 優化版本，一次查詢完成
    async getPosts(filters, userId = null) {
        const { 
            user_id,
            post_type,
            tag,
            visibility,
            limit = 20, 
            offset = 0 
        } = filters;

        let conditions = ['p.deleted_at IS NULL'];
        let params = [];
        let paramIndex = 1;

        if (user_id) {
            conditions.push(`p.author_user_id = $${paramIndex}`);
            params.push(user_id);
            paramIndex++;
        }

        if (post_type) {
            conditions.push(`p.post_type = $${paramIndex}`);
            params.push(post_type);
            paramIndex++;
        }

        if (visibility) {
            conditions.push(`p.visibility = $${paramIndex}`);
            params.push(visibility);
            paramIndex++;
        }

        if (tag) {
            conditions.push(`$${paramIndex} = ANY(p.tags)`);
            params.push(tag);
            paramIndex++;
        }

        // ⭐ 如果有提供 userId，加入點讚和轉發狀態
        const userStatusFields = userId ? `
            , (p.author_user_id = $${paramIndex}) as is_owner
            , EXISTS(
                SELECT 1 FROM community_post_likes
                WHERE post_id = p.community_post_id AND user_id = $${paramIndex}
            ) as is_liked
            , EXISTS(
                SELECT 1 FROM community_post_shares
                WHERE original_post_id = p.community_post_id
                AND shared_by_user_id = $${paramIndex}
                AND deleted_at IS NULL
            ) as has_shared
        ` : '';

        if (userId) {
            params.push(userId);
            paramIndex++;
        }

        params.push(limit, offset);

        const query = `
            SELECT
                p.*,
                u."user_name" as username,
                u."user_pic" as avatar_url
                ${userStatusFields}
                , d.diary_id      as diary_card_id
                , d.diary_title   as diary_card_title
                , d.diary_content as diary_card_content
                , d.diary_date    as diary_card_date
                , ws."summary_id"      as summary_card_id
                , ws."summary_title"   as summary_card_title
                , ws."summary_content" as summary_card_content
                , ws."bible_quote"     as summary_card_bible_quote
                , ws."year"            as summary_card_year
                , ws."week_number"     as summary_card_week_number
                , ws."start_date"      as summary_card_start_date
                , ws."end_date"        as summary_card_end_date
                , ltr.summary_text     as letter_card_summary
                , laq.question_text    as letter_card_question
                , laq.image_url        as letter_card_image_url
                , ud_ltr.letter_quote  as letter_card_quote
                , ud_ltr.letter_quote_source as letter_card_quote_source
                , op.community_post_id   as orig_post_id
                , op.post_text           as orig_post_text
                , op.post_type           as orig_post_type
                , op.created_at          as orig_post_created_at
                , ou."user_name"         as orig_author_name
                , ou."user_pic"          as orig_author_avatar
                , ps.share_caption       as orig_share_caption
                , od.diary_id      as orig_diary_card_id
                , od.diary_title   as orig_diary_card_title
                , od.diary_content as orig_diary_card_content
                , od.diary_date    as orig_diary_card_date
                , ows."summary_id"      as orig_summary_card_id
                , ows."summary_title"   as orig_summary_card_title
                , ows."summary_content" as orig_summary_card_content
                , ows."bible_quote"     as orig_summary_card_bible_quote
                , ows."year"            as orig_summary_card_year
                , ows."week_number"     as orig_summary_card_week_number
                , ol.summary_text          as orig_letter_card_summary
                , olaq.question_text       as orig_letter_card_question
                , olaq.image_url           as orig_letter_card_image_url
                , oud.letter_quote         as orig_letter_card_quote
                , oud.letter_quote_source  as orig_letter_card_quote_source
            FROM community_posts p
            LEFT JOIN "user" u ON p.author_user_id = u."userID"
            LEFT JOIN diary d ON p.post_type = 'diary' AND p.diary_id = d.diary_id
            LEFT JOIN "weekly_summary" ws ON p.post_type = 'summary' AND p.summary_id = ws."summary_id"
            LEFT JOIN letters ltr ON p.post_type = 'letter' AND p.letter_id = ltr.letter_id
            LEFT JOIN user_draws ud_ltr ON ud_ltr.summary = ltr.summary_text AND ud_ltr.is_completed = true
            LEFT JOIN weekly_cards lwc ON lwc.weekly_cards_id = ud_ltr.weekly_card_id
            LEFT JOIN ai_questions laq ON laq.ai_question_id = lwc.ai_question_id
            LEFT JOIN community_post_shares ps
                ON ps.shared_post_id = p.community_post_id
            LEFT JOIN community_posts op
                ON ps.original_post_id = op.community_post_id AND op.deleted_at IS NULL
            LEFT JOIN "user" ou ON op.author_user_id = ou."userID"
            LEFT JOIN diary od ON op.post_type = 'diary' AND op.diary_id = od.diary_id
            LEFT JOIN "weekly_summary" ows ON op.post_type = 'summary' AND op.summary_id = ows."summary_id"
            LEFT JOIN letters ol ON op.post_type = 'letter' AND op.letter_id = ol.letter_id
            LEFT JOIN user_draws oud ON oud.summary = ol.summary_text AND oud.is_completed = true
            LEFT JOIN weekly_cards owc ON owc.weekly_cards_id = oud.weekly_card_id
            LEFT JOIN ai_questions olaq ON olaq.ai_question_id = owc.ai_question_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY p.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const result = await pool.query(query, params);
        return result.rows.map(row => {
            const post = { ...row };

            // 整理當前貼文的日記卡片
            if (row.diary_card_id) {
                post.diary_card = {
                    diary_id:      row.diary_card_id,
                    diary_title:   row.diary_card_title,
                    diary_content: row.diary_card_content,
                    diary_date:    row.diary_card_date,
                };
            }
            delete post.diary_card_id;
            delete post.diary_card_title;
            delete post.diary_card_content;
            delete post.diary_card_date;

            // 整理當前貼文的周回顧卡片
            if (row.summary_card_id) {
                post.summary_card = {
                    summary_id:      row.summary_card_id,
                    summary_title:   row.summary_card_title,
                    summary_content: row.summary_card_content,
                    bible_quote:     row.summary_card_bible_quote,
                    year:            row.summary_card_year,
                    week_number:     row.summary_card_week_number,
                    start_date:      row.summary_card_start_date,
                    end_date:        row.summary_card_end_date,
                };
            }
            delete post.summary_card_id;
            delete post.summary_card_title;
            delete post.summary_card_content;
            delete post.summary_card_bible_quote;
            delete post.summary_card_year;
            delete post.summary_card_week_number;
            delete post.summary_card_start_date;
            delete post.summary_card_end_date;

            // ✨ 整理信箋卡片
            if (row.letter_card_summary) {
                post.letter_card = {
                    summary_text: row.letter_card_summary,
                    question:     row.letter_card_question,
                    image_url:    row.letter_card_image_url,
                    quote:        row.letter_card_quote,
                    quote_source: row.letter_card_quote_source,
                };
            }
            delete post.letter_card_summary;
            delete post.letter_card_question;
            delete post.letter_card_image_url;
            delete post.letter_card_quote;
            delete post.letter_card_quote_source;

            // 整理轉發來源貼文
            if (row.post_type === 'shared' && row.orig_post_id) {
                post.original_post = {
                    community_post_id:     row.orig_post_id,
                    post_text:             row.orig_post_text,
                    post_type:             row.orig_post_type,
                    created_at:            row.orig_post_created_at,
                    original_author_name:  row.orig_author_name,
                    original_author_avatar: row.orig_author_avatar,
                    ...(row.orig_diary_card_id ? {
                        diary_card: {
                            diary_id:      row.orig_diary_card_id,
                            diary_title:   row.orig_diary_card_title,
                            diary_content: row.orig_diary_card_content,
                            diary_date:    row.orig_diary_card_date,
                        }
                    } : {}),
                    ...(row.orig_summary_card_id ? {
                        summary_card: {
                            summary_id:      row.orig_summary_card_id,
                            summary_title:   row.orig_summary_card_title,
                            summary_content: row.orig_summary_card_content,
                            bible_quote:     row.orig_summary_card_bible_quote,
                            year:            row.orig_summary_card_year,
                            week_number:     row.orig_summary_card_week_number,
                        }
                    } : {}),
                    ...(row.orig_letter_card_summary ? {
                        letter_card: {
                            summary_text: row.orig_letter_card_summary,
                            question:     row.orig_letter_card_question,
                            image_url:    row.orig_letter_card_image_url,
                            quote:        row.orig_letter_card_quote,
                            quote_source: row.orig_letter_card_quote_source,
                        }
                    } : {})
                };
            }
            delete post.orig_post_id;
            delete post.orig_post_text;
            delete post.orig_post_type;
            delete post.orig_post_created_at;
            delete post.orig_author_name;
            delete post.orig_author_avatar;
            delete post.orig_share_caption;
            delete post.orig_diary_card_id;
            delete post.orig_diary_card_title;
            delete post.orig_diary_card_content;
            delete post.orig_diary_card_date;
            delete post.orig_summary_card_id;
            delete post.orig_summary_card_title;
            delete post.orig_summary_card_content;
            delete post.orig_summary_card_bible_quote;
            delete post.orig_summary_card_year;
            delete post.orig_summary_card_week_number;
            delete post.orig_letter_card_summary;
            delete post.orig_letter_card_question;
            delete post.orig_letter_card_image_url;
            delete post.orig_letter_card_quote;
            delete post.orig_letter_card_quote_source;
            return post;
        });
    }

    // 獲取貼文總數（用於分頁）
    async getPostsCount(filters) {
        const { user_id, post_type, tag, visibility } = filters;

        let conditions = ['deleted_at IS NULL'];
        let params = [];
        let paramIndex = 1;

        if (user_id) {
            conditions.push(`author_user_id = $${paramIndex}`);
            params.push(user_id);
            paramIndex++;
        }

        if (post_type) {
            conditions.push(`post_type = $${paramIndex}`);
            params.push(post_type);
            paramIndex++;
        }

        if (visibility) {
            conditions.push(`visibility = $${paramIndex}`);
            params.push(visibility);
            paramIndex++;
        }

        if (tag) {
            conditions.push(`EXISTS (
                SELECT 1 FROM post_tags pt 
                WHERE pt.community_post_id = community_posts.community_post_id 
                AND pt.tag_name = $${paramIndex}
            )`);
            params.push(tag);
            paramIndex++;
        }

        const query = `
            SELECT COUNT(*) as total
            FROM community_posts
            WHERE ${conditions.join(' AND ')}
        `;

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].total);
    }

    // ⭐ 刪除貼文（軟刪除 + 刪除 R2 圖片）
    async deletePost(postId, userId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // 先獲取貼文資訊（包含圖片 URL）
            const getPostQuery = `
                SELECT post_pic
                FROM community_posts
                WHERE community_post_id = $1
                AND author_user_id = $2
                AND deleted_at IS NULL
            `;
            
            const postResult = await client.query(getPostQuery, [postId, userId]);
            
            if (postResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return null;
            }

            const post = postResult.rows[0];

            // 執行軟刪除
            const deleteQuery = `
                UPDATE community_posts 
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE community_post_id = $1 
                AND author_user_id = $2 
                AND deleted_at IS NULL
                RETURNING community_post_id
            `;
            
            const result = await client.query(deleteQuery, [postId, userId]);

            await client.query('COMMIT');

            // 如果有圖片，從 R2 刪除
            if (post.post_pic) {
                console.log('🗑️ 刪除 R2 圖片:', post.post_pic);
                await cloudflareService.deleteImage(post.post_pic);
            }

            return result.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // ⭐ 更新貼文（支援圖片更換）
    async updatePost(postId, userId, updateData, newImageFile = null) {
        let newImageUrl = null;
        let oldImageUrl = null;
        let didCommit = false;

        // 【第一步】先查舊圖片 URL（快速查詢，用 pool.query 即可）
        const oldPostResult = await pool.query(
            `SELECT post_pic FROM community_posts
             WHERE community_post_id = $1 AND author_user_id = $2 AND deleted_at IS NULL`,
            [postId, userId]
        );

        if (oldPostResult.rows.length === 0) return null;
        oldImageUrl = oldPostResult.rows[0].post_pic;

        // 【第二步】有新圖片就先上傳 R2（不佔 DB 連線）
        if (newImageFile) {
            console.log('📤 上傳新圖片到 Cloudflare R2...');
            newImageUrl = await cloudflareService.uploadImage(
                newImageFile.buffer,
                newImageFile.originalname,
                newImageFile.mimetype
            );
            console.log('✅ 新圖片上傳成功:', newImageUrl);
        }

        // 【第三步】才拿 DB 連線做更新
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const { post_text, visibility, tags } = updateData;
            const finalImageUrl = newImageUrl !== null ? newImageUrl : oldImageUrl;

            const result = await client.query(
                `UPDATE community_posts
                 SET post_text = $3, visibility = $4, tags = $5, post_pic = $6
                 WHERE community_post_id = $1 AND author_user_id = $2 AND deleted_at IS NULL
                 RETURNING community_post_id`,
                [postId, userId, post_text, visibility || 'public', tags || null, finalImageUrl]
            );

            await client.query('COMMIT');
            didCommit = true;
            client.release();

            // 更新成功後才刪舊圖
            if (result.rows[0] && newImageUrl && oldImageUrl) {
                console.log('🗑️ 刪除舊圖片:', oldImageUrl);
                await cloudflareService.deleteImage(oldImageUrl).catch(console.error);
            }

            if (!result.rows[0]) return null;

            return await this.getPostById(postId, userId);

        } catch (error) {
            if (!didCommit) {
                await client.query('ROLLBACK');
                // DB 沒寫入，新圖片用不到了，清掉
                if (newImageUrl) {
                    console.log('🗑️ 更新失敗，刪除新上傳的圖片...');
                    await cloudflareService.deleteImage(newImageUrl).catch(console.error);
                }
            }
            client.release();
            throw error;
        }
    }

    // 檢舉貼文
    async reportPost(postId, reporterUserId, reason) {
        const validReasons = ['我不喜歡', '騷擾', '不符合天主教教義', '不符現實', '其他'];
        if (!validReasons.includes(reason)) {
            throw new Error('無效的檢舉原因');
        }

        const postCheck = await pool.query(
            'SELECT community_post_id, author_user_id FROM community_posts WHERE community_post_id = $1 AND deleted_at IS NULL',
            [postId]
        );
        if (postCheck.rows.length === 0) throw new Error('貼文不存在');
        if (postCheck.rows[0].author_user_id === reporterUserId) throw new Error('不能檢舉自己的貼文');

        try {
            await pool.query(
                'INSERT INTO post_reports (post_id, reporter_user_id, reason) VALUES ($1, $2, $3)',
                [postId, reporterUserId, reason]
            );
            return { success: true };
        } catch (error) {
            if (error.code === '23505') throw new Error('您已經檢舉過這篇貼文');
            throw error;
        }
    }

    // 驗證貼文擁有者
    async isPostOwner(postId, userId) {
        const query = `
            SELECT author_user_id 
            FROM community_posts 
            WHERE community_post_id = $1 AND deleted_at IS NULL
        `;
        
        const result = await pool.query(query, [postId]);
        
        if (result.rows.length === 0) {
            return false;
        }
        
        return result.rows[0].author_user_id === userId;
    }
}

module.exports = new PostService();