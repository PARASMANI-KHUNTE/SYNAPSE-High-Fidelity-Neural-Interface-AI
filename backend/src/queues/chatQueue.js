import { getQueue } from "../utils/simpleQueue.js";

const chatQueue = getQueue("chat-tasks");

/**
 * Add a background search or generation job
 * @param {Object} jobData - { type: "web-search" | "image-search", payload: { query } }
 */
export const addChatJob = async (jobData) => {
  console.log(`📡 Queuing background job [${jobData.type}] (In-Memory)`);
  return await chatQueue.add(jobData.type, jobData);
};
