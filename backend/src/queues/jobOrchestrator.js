import PQueue from "p-queue";
import logger from "../utils/logger.js";

// Max 1 concurrent job for heavy VRAM
export const visionQueue = new PQueue({ concurrency: 1 });
export const ttsQueue = new PQueue({ concurrency: 1 });

// Max 2 concurrent jobs for reasoning/coding models
export const reasoningQueue = new PQueue({ concurrency: 2 });

// Unlimited (but practically bounded by Node/socket connections)
export const casualQueue = new PQueue({ concurrency: 10 });

const queueMap = {
  vision: visionQueue,
  tts: ttsQueue,
  reasoning: reasoningQueue,
  coder: reasoningQueue,
  casual: casualQueue
};

export const enqueueLLMJob = async (modelType, operation) => {
  const queue = queueMap[modelType] || casualQueue;
  
  logger.debug({ modelType, queueSize: queue.size, pending: queue.pending }, "Enqueuing LLM job");
  
  try {
    return await queue.add(operation);
  } catch (error) {
    logger.error({ err: error, modelType }, "Job execution failed in queue");
    throw error;
  }
};

export const getQueueMetrics = () => {
  return {
    vision: { size: visionQueue.size, pending: visionQueue.pending },
    tts: { size: ttsQueue.size, pending: ttsQueue.pending },
    reasoning: { size: reasoningQueue.size, pending: reasoningQueue.pending },
    casual: { size: casualQueue.size, pending: casualQueue.pending }
  };
};
