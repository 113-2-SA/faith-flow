// services/cloudflareService.js
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const cloudflareConfig = require('../config/cloudflare');
const crypto = require('crypto');
const path = require('path');
const https = require('https');

class CloudflareService {
    constructor() {
        // 使用 S3 相容的 API 連接到 Cloudflare R2
        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${cloudflareConfig.r2.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: cloudflareConfig.r2.accessKeyId,
                secretAccessKey: cloudflareConfig.r2.secretAccessKey,
            },
            requestHandler: new NodeHttpHandler({
                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            }),
        });
        
        this.bucketName = cloudflareConfig.r2.bucketName;
        this.publicUrl = cloudflareConfig.r2.publicUrl;
    }

    /**
     * 生成唯一的檔案名稱
     * @param {string} originalName - 原始檔案名稱
     * @returns {string} 唯一的檔案名稱
     */
    generateUniqueFileName(originalName) {
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(originalName);
        return `posts/${timestamp}-${randomString}${ext}`;
    }

    /**
     * 上傳圖片到 R2
     * @param {Buffer} fileBuffer - 檔案內容
     * @param {string} originalName - 原始檔案名稱
     * @param {string} mimeType - MIME 類型
     * @returns {Promise<string>} 圖片的公開 URL
     */
    async uploadImage(fileBuffer, originalName, mimeType) {
        try {
            const fileName = this.generateUniqueFileName(originalName);
            
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
                Body: fileBuffer,
                ContentType: mimeType,
                // 設定快取控制（可選）
                CacheControl: 'public, max-age=31536000',
            });

            await this.s3Client.send(command);
            
            // 返回完整的公開 URL
            const imageUrl = `${this.publicUrl}/${fileName}`;
            console.log(`✅ 圖片上傳成功: ${imageUrl}`);
            
            return imageUrl;
            
        } catch (error) {
            console.error('❌ Cloudflare R2 上傳失敗:', error);
            throw new Error(`圖片上傳失敗: ${error.message}`);
        }
    }

    /**
     * 從 R2 刪除圖片
     * @param {string} imageUrl - 圖片的完整 URL
     * @returns {Promise<boolean>} 是否刪除成功
     */
    async deleteImage(imageUrl) {
        try {
            // 從 URL 中提取檔案路徑
            const fileName = imageUrl.replace(`${this.publicUrl}/`, '');
            
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
            });

            await this.s3Client.send(command);
            console.log(`✅ 圖片刪除成功: ${fileName}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Cloudflare R2 刪除失敗:', error);
            // 不拋出錯誤，因為圖片可能已經不存在
            return false;
        }
    }

    /**
     * 驗證圖片檔案
     * @param {Object} file - Multer 檔案物件
     * @returns {Object} 驗證結果
     */
    validateImageFile(file) {
        const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 預設 5MB
        const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/gif,image/webp').split(',');

        if (!file) {
            return { valid: false, error: '沒有上傳檔案' };
        }

        if (file.size > maxSize) {
            return { 
                valid: false, 
                error: `檔案大小超過限制（最大 ${maxSize / (1024 * 1024)}MB）` 
            };
        }

        if (!allowedTypes.includes(file.mimetype)) {
            return { 
                valid: false, 
                error: `不支援的檔案格式（僅支援: ${allowedTypes.join(', ')}）` 
            };
        }

        return { valid: true };
    }
}

module.exports = new CloudflareService();