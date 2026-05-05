const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const { v4: uuidv4 } = require('uuid');
const https = require('https');

class R2Uploader {
  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
      requestHandler: new NodeHttpHandler({
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }),
    });
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    this.publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  }

  /**
   * 上傳音檔到 R2
   */
  async uploadAudio(audioBuffer, filename = null) {
    const fileKey = filename || `audio/summaries/${uuidv4()}.mp3`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
    });

    await this.s3Client.send(command);
    
    return `${this.publicUrl}/${fileKey}`;
  }

  /**
   * 🆕 上傳圖片到 R2 (給日記圖片用)
   * 如果你想整合現有的圖片上傳功能
   */
  async uploadImage(imageBuffer, filename = null) {
    const fileKey = filename || `images/diaries/${uuidv4()}.jpg`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
    });

    await this.s3Client.send(command);
    
    return `${this.publicUrl}/${fileKey}`;
  }
}

module.exports = new R2Uploader();