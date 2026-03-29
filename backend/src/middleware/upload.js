import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "audio/webm",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg"
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".webm", ".mp3", ".wav", ".ogg"];
  
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`File type not allowed: ${ext}`), false);
  }
  
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`MIME type not allowed: ${file.mimetype}`), false);
  }
  
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + crypto.randomBytes(8).toString("hex");
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, uniqueSuffix + "_" + safeName);
  }
});

export const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
});
