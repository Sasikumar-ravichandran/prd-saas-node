const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // endpoint: process.env.AWS_ENDPOINT // Uncomment this if using Cloudflare R2
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const CDN_DOMAIN = process.env.AWS_CDN_DOMAIN; // e.g., 'cdn.yourclinic.com' or S3 bucket URL

const generateUploadUrl = async (fileName, fileType, clinicId, patientId) => {
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(fileName);
  
  // Create a clean folder structure: clinicId/patientId/timestamp-uuid.webp
  const safeFilename = `${clinicId}/${patientId}/${Date.now()}-${uniqueId}${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: safeFilename,
    ContentType: fileType,
  });

  // URL expires in 60 seconds. Frontend MUST upload immediately after requesting.
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

  return {
    uploadUrl,
    fileUrl: `https://${CDN_DOMAIN}/${safeFilename}`,
    fileKey: safeFilename
  };
};

const deleteFileFromS3 = async (fileKey) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
  });
  await s3Client.send(command);
};

module.exports = {
  generateUploadUrl,
  deleteFileFromS3
};