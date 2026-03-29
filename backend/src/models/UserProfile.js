import mongoose from "mongoose";

const profileFactSchema = new mongoose.Schema({
  key: { type: String, required: true, maxlength: 120 },
  value: { type: String, required: true, maxlength: 500 },
  confidence: { type: Number, min: 0, max: 1, default: 0.8 },
  source: { type: String, default: "user_stated", maxlength: 50 },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const routineSchema = new mongoose.Schema({
  name: { type: String, maxlength: 120 },
  trigger: { type: String, maxlength: 200 },
  action: { type: String, maxlength: 500 }
}, { _id: false });

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    maxlength: 120,
    default: ""
  },
  preferences: {
    responseStyle: { type: String, default: "concise" },
    voice: { type: String, default: "male" },
    wakeWord: { type: String, default: "synapse" }
  },
  facts: {
    type: [profileFactSchema],
    default: []
  },
  routines: {
    type: [routineSchema],
    default: []
  }
}, {
  timestamps: true,
  collection: "user_profiles"
});

const UserProfile = mongoose.model("UserProfile", userProfileSchema);

export default UserProfile;
