import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/";
    const dbName = process.env.DbName || "LLMmemory";
    
    await mongoose.connect(mongoUri, {
      dbName,
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    console.log("✅ Mongo Connected");
  } catch (err) {
    console.error("❌ Mongo Connection Error:", err.message);
    process.exit(1);
  }
};
