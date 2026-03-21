/**
 * A lightweight, in-memory queue for background tasks.
 * Replaces Redis/BullMQ for single-instance local development.
 */
class SimpleQueue {
  constructor(name) {
    this.name = name;
    this.jobs = new Map();
    this.processor = null;
    this.isProcessing = false;
    this.queue = [];
  }

  setProcessor(processor) {
    this.processor = processor;
  }

  async add(name, data) {
    const jobId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const job = { 
      id: jobId, 
      name, 
      data, 
      status: "waiting",
      result: null,
      error: null,
      finishedPromise: null,
      resolveFinished: null
    };

    job.finishedPromise = new Promise((resolve, reject) => {
      job.resolveFinished = resolve;
      job.rejectFinished = reject;
    });

    this.jobs.set(jobId, job);
    this.queue.push(jobId);
    
    // Start processing loop if not already running
    this.processNext();

    return {
      id: jobId,
      waitUntilFinished: () => job.finishedPromise
    };
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0 || !this.processor) return;

    this.isProcessing = true;
    const jobId = this.queue.shift();
    const job = this.jobs.get(jobId);

    if (job) {
      job.status = "active";
      try {
        job.result = await this.processor(job);
        job.status = "completed";
        job.resolveFinished(job.result);
      } catch (err) {
        job.error = err.message;
        job.status = "failed";
        job.rejectFinished(err);
      }
    }

    this.isProcessing = false;
    this.processNext();
  }
}

const queues = new Map();

export const getQueue = (name) => {
  if (!queues.has(name)) {
    queues.set(name, new SimpleQueue(name));
  }
  return queues.get(name);
};
