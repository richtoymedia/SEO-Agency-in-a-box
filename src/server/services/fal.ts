const FAL_API_URL = "https://queue.fal.run/fal-ai/flux/schnell";

function isMockMode(): boolean {
  return !process.env.FAL_KEY;
}

export async function generateImage(opts: {
  prompt: string;
  aspectRatio?: string;
}): Promise<{ imageUrl: string }> {
  if (isMockMode()) {
    return {
      imageUrl: `https://placehold.co/800x450/1a1a2e/e0e0e0?text=${encodeURIComponent(opts.prompt.slice(0, 30))}`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    // Submit request
    const submitRes = await fetch(FAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${process.env.FAL_KEY}`,
      },
      body: JSON.stringify({
        prompt: opts.prompt,
        image_size: opts.aspectRatio === "1:1" ? "square" : "landscape_16_9",
        num_images: 1,
      }),
      signal: controller.signal,
    });

    if (!submitRes.ok) {
      throw new Error(`FAL error ${submitRes.status}: ${await submitRes.text()}`);
    }

    const data = await submitRes.json();

    // Handle queue-based response
    if (data.images?.[0]?.url) {
      return { imageUrl: data.images[0].url };
    }

    // If queued, poll for result
    if (data.request_id) {
      const statusUrl = `https://queue.fal.run/fal-ai/flux/schnell/requests/${data.request_id}/status`;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(statusUrl, {
          headers: { Authorization: `Key ${process.env.FAL_KEY}` },
        });
        const status = await statusRes.json();
        if (status.status === "COMPLETED" && status.response?.images?.[0]?.url) {
          return { imageUrl: status.response.images[0].url };
        }
        if (status.status === "FAILED") {
          throw new Error(`FAL image generation failed: ${status.error}`);
        }
      }
      throw new Error("FAL image generation timed out");
    }

    throw new Error("Unexpected FAL response format");
  } finally {
    clearTimeout(timeout);
  }
}
