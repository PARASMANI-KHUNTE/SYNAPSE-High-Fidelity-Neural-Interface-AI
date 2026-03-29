import express from "express";
import { userIdValidator } from "../middleware/auth.js";
import { getProfileMemory } from "../memory/profileMemory.js";
import { getRelevantEpisodes } from "../memory/episodicMemory.js";

const router = express.Router();

router.get("/profile", userIdValidator, async (req, res) => {
  try {
    const userId = req.query.userId;
    const { profile, facts } = await getProfileMemory({ userId, limit: 8 });
    const episodes = await getRelevantEpisodes({ userId, query: "", limit: 3 });

    res.json({
      profile: profile ? {
        userId: profile.userId,
        name: profile.name,
        preferences: profile.preferences,
        facts: profile.facts || []
      } : null,
      facts: facts.map((fact) => ({
        key: fact.key,
        value: fact.value,
        confidence: fact.confidence,
        source: fact.source,
        timestamp: fact.timestamp
      })),
      episodes: episodes.map((episode) => ({
        date: episode.date,
        kind: episode.kind,
        label: episode.label,
        summary: episode.summary,
        topics: episode.topics || [],
        actions: episode.actions || []
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load memory profile", details: err.message });
  }
});

export default router;
