import { prisma } from "@/server/db";
import { getDefaultTenant } from "@/server/auth";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const { tenantId } = await getDefaultTenant();

  // Check if it's a content job or optimization job
  const contentJob = await prisma.contentJob.findFirst({
    where: { id: jobId, tenantId },
  });
  const optimizationJob = !contentJob
    ? await prisma.optimizationJob.findFirst({
        where: { id: jobId, tenantId },
      })
    : null;

  if (!contentJob && !optimizationJob) {
    return new Response("Job not found", { status: 404 });
  }

  const jobType = contentJob ? "content" : "optimization";
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      let lastState = "";

      const sendEvent = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const poll = async () => {
        if (closed) return;

        try {
          const job =
            jobType === "content"
              ? await prisma.contentJob.findFirst({ where: { id: jobId, tenantId } })
              : await prisma.optimizationJob.findFirst({ where: { id: jobId, tenantId } });

          if (!job) {
            sendEvent({ type: "error", message: "Job not found" });
            controller.close();
            closed = true;
            return;
          }

          const stateStr = JSON.stringify(job);
          if (stateStr !== lastState) {
            lastState = stateStr;
            sendEvent({ type: "update", jobType, job });
          }

          if (job.status === "COMPLETED" || job.status === "FAILED") {
            sendEvent({ type: "done", jobType, job });
            controller.close();
            closed = true;
            return;
          }
        } catch (err) {
          if (!closed) {
            sendEvent({ type: "error", message: String(err) });
          }
        }
      };

      // Poll every 1s
      const interval = setInterval(poll, 1000);
      // Heartbeat every 15s
      const heartbeat = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            closed = true;
          }
        }
      }, 15000);

      // Initial poll
      await poll();

      // Cleanup on abort
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
