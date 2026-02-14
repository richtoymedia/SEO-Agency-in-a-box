/**
 * Queue abstraction with sync fallback.
 * When REDIS_URL is not set, pipelines run inline (sync mode).
 * This allows deploying to serverless platforms like Vercel without Redis.
 */

const hasRedis = !!process.env.REDIS_URL;

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

type SyncHandler = (data: Record<string, unknown>) => Promise<void>;

function createQueueProxy(name: string, syncHandler: SyncHandler) {
  let _queue: import("bullmq").Queue | null = null;

  return {
    add: async (_jobName: string, data: Record<string, unknown>) => {
      if (!hasRedis) {
        // Run synchronously in-process (fire-and-forget for the HTTP response)
        syncHandler(data).catch((err) =>
          console.error(`[sync-mode] ${name} error:`, err)
        );
        return { id: "sync-" + Date.now() };
      }

      // Use BullMQ when Redis is available
      if (!_queue) {
        const { Queue } = await import("bullmq");
        _queue = new Queue(name, { connection: getConnection() });
      }
      return _queue.add(_jobName, data);
    },
  };
}

export const contentQueue = createQueueProxy("content-pipeline", async (data) => {
  const { runContentPipeline } = await import("@/server/services/content-pipeline");
  await runContentPipeline(data.jobId as string, data.fromStep as string | undefined);
});

export const optimizationQueue = createQueueProxy("optimization-pipeline", async (data) => {
  const { runOptimizationPipeline } = await import("@/server/services/optimization-pipeline");
  await runOptimizationPipeline(data.jobId as string, data.fromStep as string | undefined);
});

export const repurposeQueue = createQueueProxy("repurpose-pipeline", async (data) => {
  const { runRepurpose } = await import("@/server/services/content-pipeline");
  await runRepurpose(data.jobId as string);
});
