const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. Define the ABSOLUTE path to the uploads folder
const uploadDir = path.join(process.cwd(), 'uploads');

// 2. Create the folder if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created uploads folder at: ${uploadDir}`); // Debug log
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    // 3. Save files to this absolute path
    cb(null, uploadDir); 
  },
  filename(req, file, cb) {
    // Rename file to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Check file type (Allow Images & PDFs)
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif|pdf|svg|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Images and PDFs Only!'));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

module.exports = upload;