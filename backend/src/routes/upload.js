import express from "express";
import { upload } from "../middleware/upload.js";
import { userIdValidator } from "../middleware/auth.js";

const router = express.Router();

router.post("/", userIdValidator, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const baseUrl = process.env.BASE_URL || "http://localhost:3001";
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  res.json({
    url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

export default router;
