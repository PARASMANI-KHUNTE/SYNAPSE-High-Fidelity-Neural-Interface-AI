import "dotenv/config";
import mongoose from "mongoose";

async function run() {
  try {
    await mongoose.connect(`${process.env.MONGO_URI}${process.env.DbName}`);
    console.log("Connected. Dropping index userId_1...");
    try {
      await mongoose.connection.collection("chats").dropIndex("userId_1");
      console.log("✅ Dropped unique index successfully.");
    } catch (e) {
      console.log("⚠️ Index probably didn't exist or already dropped:", e.message);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
