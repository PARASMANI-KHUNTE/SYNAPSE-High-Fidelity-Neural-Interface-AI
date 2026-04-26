import { getProfileMemory } from "./profileMemory.js";
import { getRelevantEpisodes } from "./episodicMemory.js";

export const queryMemoryContext = async ({ userId, query = "" }) => {
  if (!userId) {
    return {
      profile: null,
      profileFacts: [],
      episodeSummaries: [],
      episodes: []
    };
  }

  const isMemoryHeavyQuery = /\b(remember|recall|about me|my profile|my preference|what do you know)\b/i.test(String(query || ""));
  const profileLimit = isMemoryHeavyQuery ? 14 : 10;
  const episodeLimit = isMemoryHeavyQuery ? 5 : 3;

  const [{ profile, facts }, episodes] = await Promise.all([
    getProfileMemory({ userId, limit: profileLimit }),
    getRelevantEpisodes({ userId, query, limit: episodeLimit })
  ]);

  const episodeSummaries = episodes.map((episode) => ({
    date: episode.date,
    summary: episode.summary,
    topics: episode.topics || []
  }));

  return {
    profile,
    profileFacts: facts,
    episodes,
    episodeSummaries
  };
};

export default { queryMemoryContext };
