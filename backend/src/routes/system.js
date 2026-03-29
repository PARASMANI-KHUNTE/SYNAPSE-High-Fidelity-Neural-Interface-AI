import express from "express";
import { getSystemStatus } from "../services/systemStatus.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const status = await getSystemStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: "Failed to load system status",
      details: err.message
    });
  }
});

export default router;
