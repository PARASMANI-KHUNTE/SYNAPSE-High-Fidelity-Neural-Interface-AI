import { getQueue } from "../utils/simpleQueue.js";
import { searchReferenceImages } from "../services/imageSearch.js";
import { searchInternet } from "../services/search.js";

/**
 * Initialize the in-memory background worker.
 * Replaces the Redis-based BullMQ worker.
 */
export const initWorker = () => {
  const chatQueue = getQueue("chat-tasks");

  chatQueue.setProcessor(async (job) => {
    const { type, payload } = job.data;
    console.log(`👷 Processing job [${job.id}] (${type}) (In-Memory)`);

    switch (type) {
      case "image-search":
        return await searchReferenceImages(payload.query);
      case "web-search":
        return await searchInternet(payload.query);
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  });

  console.log("👷 In-memory background worker initialized.");
};
