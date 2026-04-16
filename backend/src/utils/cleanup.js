import fs from "fs/promises";
import path from "path";
import logger from "./logger.js";

// Clean up old files in the uploads directory
export const runGarbageCollection = async () => {
  const uploadsDir = path.join(process.cwd(), "uploads");
  const MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

  try {
    const files = await fs.readdir(uploadsDir);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (file === ".gitignore") continue; // keep gitignore if exists

      const filePath = path.join(uploadsDir, file);
      const stat = await fs.stat(filePath);

      if (now - stat.mtimeMs > MAX_AGE_MS) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info(`Garbage collection: deleted ${deletedCount} old files from uploads/`);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      logger.error({ err }, "Garbage collection failed");
    }
  }
};

// Run garbage collection every 12 hours
setInterval(runGarbageCollection, 1000 * 60 * 60 * 12);
