import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const connection = {
  host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname || "localhost",
  port: parseInt(new URL(process.env.REDIS_URL || "redis://localhost:6379").port || "6379"),
};

console.log("Starting workers...");

const contentWorker = new Worker(
  "content-pipeline",
  async (job) => {
    console.log(`[content-pipeline] Processing job ${job.id}`, job.data);
    const { runContentPipeline } = await import("../services/content-pipeline");
    await runContentPipeline(job.data.jobId, job.data.fromStep);
  },
  { connection, concurrency: 1 }
);

const optimizationWorker = new Worker(
  "optimization-pipeline",
  async (job) => {
    console.log(`[optimization-pipeline] Processing job ${job.id}`, job.data);
    const { runOptimizationPipeline } = await import("../services/optimization-pipeline");
    await runOptimizationPipeline(job.data.jobId, job.data.fromStep);
  },
  { connection, concurrency: 1 }
);

const repurposeWorker = new Worker(
  "repurpose-pipeline",
  async (job) => {
    console.log(`[repurpose-pipeline] Processing job ${job.id}`, job.data);
    const { runRepurpose } = await import("../services/content-pipeline");
    await runRepurpose(job.data.jobId);
  },
  { connection, concurrency: 1 }
);

contentWorker.on("completed", (job) => {
  console.log(`[content-pipeline] Job ${job?.id} completed`);
});

contentWorker.on("failed", (job, err) => {
  console.error(`[content-pipeline] Job ${job?.id} failed:`, err.message);
});

optimizationWorker.on("completed", (job) => {
  console.log(`[optimization-pipeline] Job ${job?.id} completed`);
});

optimizationWorker.on("failed", (job, err) => {
  console.error(`[optimization-pipeline] Job ${job?.id} failed:`, err.message);
});

repurposeWorker.on("completed", (job) => {
  console.log(`[repurpose-pipeline] Job ${job?.id} completed`);
});

repurposeWorker.on("failed", (job, err) => {
  console.error(`[repurpose-pipeline] Job ${job?.id} failed:`, err.message);
});

console.log("Workers started. Waiting for jobs...");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down workers...");
  await contentWorker.close();
  await optimizationWorker.close();
  await repurposeWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});
