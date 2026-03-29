import MemoryFact from "../models/MemoryFact.js";
import UserProfile from "../models/UserProfile.js";
import logger from "../utils/logger.js";

const PROFILE_FACT_LIMIT = 12;

export const rememberFacts = async ({ userId, sessionId = "", facts = [] }) => {
  if (!userId || facts.length === 0) {
    return [];
  }

  const storedFacts = [];

  for (const fact of facts) {
    const existing = await MemoryFact.findOne({
      userId,
      key: fact.key,
      value: fact.value,
      active: true
    }).sort({ timestamp: -1 });

    if (existing) {
      existing.timestamp = new Date();
      existing.confidence = Math.max(existing.confidence, fact.confidence ?? existing.confidence);
      existing.sessionId = sessionId || existing.sessionId;
      await existing.save();
      storedFacts.push(existing);
      continue;
    }

    const created = await MemoryFact.create({
      userId,
      key: fact.key,
      value: fact.value,
      confidence: fact.confidence ?? 0.8,
      source: fact.source || "user_stated",
      sessionId
    });
    storedFacts.push(created);
  }

  return storedFacts;
};

export const syncProfileFacts = async ({ userId }) => {
  if (!userId) return null;

  const facts = await MemoryFact.find({ userId, active: true })
    .sort({ timestamp: -1, confidence: -1 })
    .limit(PROFILE_FACT_LIMIT);

  const profileFacts = facts.map((fact) => ({
    key: fact.key,
    value: fact.value,
    confidence: fact.confidence,
    source: fact.source,
    updatedAt: fact.timestamp
  }));

  const update = {
    userId,
    facts: profileFacts
  };

  const nameFact = facts.find((fact) => fact.key === "name");
  if (nameFact) {
    update.name = nameFact.value;
  }

  return UserProfile.findOneAndUpdate(
    { userId },
    { $set: update, $setOnInsert: { preferences: { responseStyle: "concise", voice: "male", wakeWord: "synapse" } } },
    { upsert: true, returnDocument: "after" }
  );
};

export const getProfileMemory = async ({ userId, limit = 5 }) => {
  if (!userId) return { profile: null, facts: [] };

  try {
    const [profile, facts] = await Promise.all([
      UserProfile.findOne({ userId }),
      MemoryFact.find({ userId, active: true }).sort({ timestamp: -1, confidence: -1 }).limit(limit)
    ]);

    return { profile, facts };
  } catch (err) {
    logger.warn({ err, userId }, "Failed to fetch profile memory");
    return { profile: null, facts: [] };
  }
};

export default {
  getProfileMemory,
  rememberFacts,
  syncProfileFacts
};
