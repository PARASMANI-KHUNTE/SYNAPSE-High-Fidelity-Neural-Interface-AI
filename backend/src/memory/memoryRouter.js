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

  const [{ profile, facts }, episodes] = await Promise.all([
    getProfileMemory({ userId, limit: 8 }),
    getRelevantEpisodes({ userId, query, limit: 3 })
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
