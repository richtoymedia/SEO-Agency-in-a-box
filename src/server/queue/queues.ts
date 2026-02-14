import { Queue } from "bullmq";

function getConnection() {
  try {
    const url = new URL(process.env.REDIS_URL || "redis://localhost:6379");
    return {
      host: url.hostname || "localhost",
      port: parseInt(url.port || "6379"),
      lazyConnect: true,
    };
  } catch {
    return { host: "localhost", port: 6379, lazyConnect: true };
  }
}

let _contentQueue: Queue | null = null;
let _optimizationQueue: Queue | null = null;
let _repurposeQueue: Queue | null = null;

export const contentQueue = {
  add: async (...args: Parameters<Queue["add"]>) => {
    if (!_contentQueue) _contentQueue = new Queue("content-pipeline", { connection: getConnection() });
    return _contentQueue.add(...args);
  },
};

export const optimizationQueue = {
  add: async (...args: Parameters<Queue["add"]>) => {
    if (!_optimizationQueue) _optimizationQueue = new Queue("optimization-pipeline", { connection: getConnection() });
    return _optimizationQueue.add(...args);
  },
};

export const repurposeQueue = {
  add: async (...args: Parameters<Queue["add"]>) => {
    if (!_repurposeQueue) _repurposeQueue = new Queue("repurpose-pipeline", { connection: getConnection() });
    return _repurposeQueue.add(...args);
  },
};
