import mongoose from "mongoose";

const triggerRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    maxlength: 160
  },
  type: {
    type: String,
    enum: ["cron", "file", "system", "clipboard"],
    required: true
  },
  condition: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  action: {
    type: String,
    required: true,
    maxlength: 160
  },
  enabled: {
    type: Boolean,
    default: true
  },
  lastFired: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: "trigger_rules"
});

const TriggerRule = mongoose.model("TriggerRule", triggerRuleSchema);

export default TriggerRule;
