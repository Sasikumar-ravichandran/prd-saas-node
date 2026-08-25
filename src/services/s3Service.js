const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
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
  requestChecksumCalculation: 'WHEN_REQUIRED', //1. MUST BE HERE FOR R2
  responseChecksumValidation: 'WHEN_REQUIRED', //1. MUST BE HERE FOR R2
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      keepAlive: true,
      family: 4 
    })
  })
});

// 1. Upload Buffer directly to R2
const uploadFileToR2 = async (fileBuffer, mimeType, uniqueKey) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: uniqueKey,
    Body: fileBuffer,
    ContentType: mimeType,
    ContentLength: fileBuffer.length, //2. CRITICAL: Stops R2 from dropping the connection
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
};