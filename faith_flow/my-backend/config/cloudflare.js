// config/cloudflare.js
require('dotenv').config();

module.exports = {
    r2: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
        bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL, // 例如: https://your-bucket.r2.dev
    }
};