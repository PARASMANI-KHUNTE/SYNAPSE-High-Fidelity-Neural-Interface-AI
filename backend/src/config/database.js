import mongoose from "mongoose";
import config from "../utils/config.js";
import logger from "../utils/logger.js";

export const connectDB = async () => {
  try {
    await mongoose.connect(config.mongo.uri, {
      dbName: config.mongo.dbName,
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });
    logger.info({ dbName: config.mongo.dbName }, "Mongo connected");
  } catch (err) {
    logger.error({ err }, "Mongo connection error");
    process.exit(1);
  }
};
