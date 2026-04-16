import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);

export const runCpuHeavyTask = (taskName, payload) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { taskName, payload }
    });

    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
};

if (!isMainThread) {
  const { taskName, payload } = workerData;
  
  // This executes in the worker thread safely without blocking the event loop
  (async () => {
    try {
      if (taskName === "parsePdf") {
        // dynamic import so it doesn't slow down the main thread
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(payload.buffer);
        parentPort.postMessage({ success: true, text: data.text });
      } else {
        parentPort.postMessage({ success: false, error: "Unknown task" });
      }
    } catch (err) {
      parentPort.postMessage({ success: false, error: err.message });
    }
  })();
}
