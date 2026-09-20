const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler'); 
const https = require('https');

// Initialize Cloudflare R2 Client
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT.replace(/"/g, '').trim(),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED', 
  responseChecksumValidation: 'WHEN_REQUIRED', 
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      keepAlive: false, // ⚡️ FIX 1: Must be false for R2 to prevent ECONNRESET
      family: 4 
    }),
    connectionTimeout: 60000, // ⚡️ Failsafe to prevent hanging
    socketTimeout: 60000
  })
});

const getFileSizeFromR2 = async (fileKey) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME, // ⚡️ FIX 2: Matched to your .env variable
      Key: fileKey,
    });
    
    const response = await s3Client.send(command); 
    
    // Convert bytes to MB and return
    return parseFloat((response.ContentLength / (1024 * 1024)).toFixed(2));
  } catch (error) {
    console.error("Error getting file size from R2:", error);
    return 0; // Fallback to 0 so the deletion doesn't crash if the file is missing
  }
};

// 1. Upload Buffer directly to R2
const uploadFileToR2 = async (fileBuffer, mimeType, uniqueKey) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: uniqueKey,
    Body: fileBuffer,
    ContentType: mimeType,
    // ContentLength is automatically calculated by the AWS SDK for Buffers. 
    // Manually passing it can sometimes cause signature mismatches in R2.
  });
  
  return await s3Client.send(command);
};

// 2. Delete File from R2
const deleteFileFromR2 = async (fileKey) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileKey,
  });

  return await s3Client.send(command);
};

module.exports = {
  uploadFileToR2,
  deleteFileFromR2,
  getFileSizeFromR2
};