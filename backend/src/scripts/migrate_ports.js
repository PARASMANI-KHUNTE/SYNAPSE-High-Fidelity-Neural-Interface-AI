import mongoose from "mongoose";
import "dotenv/config";
import Chat from "../models/Chat.js";

async function migrate() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/";
    const dbName = process.env.DbName || "LLMmemory";
    
    console.log(`🔌 Connecting to MongoDB: ${mongoUri} (DB: ${dbName})`);
    await mongoose.connect(mongoUri, { dbName });

    const chats = await Chat.find({});
    console.log(`📂 Found ${chats.length} chats to process.`);

    let totalUpdated = 0;

    for (const chat of chats) {
      let updated = false;
      
      chat.messages = chat.messages.map(m => {
        // Fix audioUrl
        if (m.audioUrl && m.audioUrl.includes(":3000")) {
          m.audioUrl = m.audioUrl.replace(":3000", ":3001");
          updated = true;
        }
        
        // Fix imageUrls
        if (m.imageUrls && m.imageUrls.length > 0) {
          const newUrls = m.imageUrls.map(url => {
            if (url && typeof url === "string" && url.includes(":3000")) {
              updated = true;
              return url.replace(":3000", ":3001");
            }
            return url;
          });
          m.imageUrls = newUrls;
        }
        return m;
      });

      if (updated) {
        await chat.save();
        totalUpdated++;
      }
    }

    console.log(`✅ Migration complete. Updated ${totalUpdated} chats.`);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
