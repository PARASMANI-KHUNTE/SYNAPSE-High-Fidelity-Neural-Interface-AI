import mongoose from "mongoose";

const goalSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  sessionId: { type: String, default: null, index: true },
  
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 1000 },
  
  status: { 
    type: String, 
    enum: ["active", "completed", "paused", "failed", "cancelled"],
    default: "active" 
  },
  
  priority: { 
    type: String, 
    enum: ["low", "medium", "high", "critical"],
    default: "medium" 
  },
  
  milestones: [{
    title: { type: String, required: true },
    description: String,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    order: Number
  }],
  
  progress: { type: Number, default: 0, min: 0, max: 100 },
  
  relatedGoals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Goal" }],
  
  context: {
    originalQuery: String,
    outcome: String,
    blockers: [String],
    lessons: [String]
  },
  
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    completedAt: Date,
    lastActiveAt: Date,
    revisitCount: { type: Number, default: 0 }
  },

  source: {
    type: String,
    enum: ["user", "agent", "system"],
    default: "user"
  }
}, {
  collection: "goals",
  indexes: [
    { userId: 1, status: 1 },
    { userId: 1, priority: 1 },
    { userId: 1, "metadata.updatedAt": -1 }
  ]
});

goalSchema.pre("save", function(next) {
  this.metadata.updatedAt = new Date();
  if (this.isModified("status") && this.status === "completed" && !this.metadata.completedAt) {
    this.metadata.completedAt = new Date();
  }
  if (this.isModified("status") && this.status === "active") {
    this.metadata.lastActiveAt = new Date();
  }
  next();
});

goalSchema.methods.updateProgress = function(completedMilestones = []) {
  if (this.milestones.length === 0) {
    this.progress = this.status === "completed" ? 100 : 0;
  } else {
    const completed = this.milestones.filter(m => 
      m.completed || completedMilestones.includes(m.title)
    ).length;
    this.progress = Math.round((completed / this.milestones.length) * 100);
  }
  return this.progress;
};

goalSchema.methods.markComplete = function(outcome = "") {
  this.status = "completed";
  this.progress = 100;
  this.context.outcome = outcome;
  this.metadata.completedAt = new Date();
  return this;
};

goalSchema.methods.pause = function(reason = "") {
  this.status = "paused";
  if (reason) this.context.blockers.push(reason);
  return this;
};

goalSchema.methods.resume = function() {
  this.status = "active";
  this.metadata.lastActiveAt = new Date();
  return this;
};

goalSchema.statics.createFromIntent = async function({ userId, sessionId, query }) => {
  const goalPatterns = [
    { pattern: /^(?:create|build|make|generate)\s+(?:a\s+)?(\w+)/i, titleTemplate: "Create $1" },
    { pattern: /^(?:fix|debug|resolve)\s+(?:the\s+)?(.+?)(?:\s+issue|\s+bug)?$/i, titleTemplate: "Fix $1" },
    { pattern: /^(?:learn|study|understand)\s+(?:how\s+)?(.+)$/i, titleTemplate: "Learn $1" },
    { pattern: /^(?:research|find out|investigate)\s+(?:about\s+)?(.+)$/i, titleTemplate: "Research $1" },
    { pattern: /^(?:complete|finish)\s+(?:the\s+)?(.+)$/i, titleTemplate: "Complete $1" },
    { pattern: /^(?:implement|add)\s+(?:a\s+)?(.+)$/i, titleTemplate: "Implement $1" }
  ];

  let title = query.substring(0, 100);
  let description = "";

  for (const { pattern, titleTemplate } of goalPatterns) {
    const match = query.match(pattern);
    if (match) {
      title = titleTemplate.replace("$1", match[1] || query);
      description = `Goal derived from: "${query}".`;
      break;
    }
  }

  return this.create({
    userId,
    sessionId,
    title,
    description,
    source: "agent",
    context: { originalQuery: query }
  });
};

goalSchema.statics.getActiveGoals = async function(userId, limit = 10) {
  return this.find({ 
    userId, 
    status: "active" 
  })
    .sort({ priority: -1, "metadata.updatedAt": -1 })
    .limit(limit)
    .lean();
};

goalSchema.statics.getPendingGoals = async function(userId, sessionId) {
  return this.find({
    userId,
    $or: [
      { sessionId, status: { $in: ["active", "paused"] } },
      { status: "paused" }
    ]
  }).lean();
};

goalSchema.statics.trackProgress = async function(goalId, update) {
  const goal = await this.findById(goalId);
  if (!goal) return null;

  if (update.milestone) {
    const milestone = goal.milestones.find(m => m.title === update.milestone);
    if (milestone) {
      milestone.completed = true;
      milestone.completedAt = new Date();
    }
  }

  if (update.progress !== undefined) {
    goal.progress = update.progress;
  }

  if (update.blocker) {
    goal.context.blockers.push(update.blocker);
    goal.status = "paused";
  }

  if (update.lesson) {
    goal.context.lessons.push(update.lesson);
  }

  await goal.save();
  return goal;
};

goalSchema.statics.summarizeGoals = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        avgProgress: { $avg: "$progress" }
      }
    }
  ]);

  const total = stats.reduce((sum, s) => sum + s.count, 0);
  const active = stats.find(s => s._id === "active")?.count || 0;
  const completed = stats.find(s => s._id === "completed")?.count || 0;

  return {
    total,
    active,
    completed,
    paused: stats.find(s => s._id === "paused")?.count || 0,
    failed: stats.find(s => s._id === "failed")?.count || 0,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    averageProgress: Math.round(
      stats.reduce((sum, s) => sum + (s.avgProgress || 0), 0) / (total || 1)
    )
  };
};

const Goal = mongoose.model("Goal", goalSchema);

export default Goal;
export { goalSchema };