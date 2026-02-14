import { z } from "zod";
import { validateLLMOrRepair } from "@/lib/schemas/helpers";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

function isMockMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

interface ClaudeChatOptions {
  system?: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function claudeChat(opts: ClaudeChatOptions): Promise<string> {
  if (isMockMode()) {
    return `[MOCK Claude Response] Generated content for prompt: "${opts.prompt.slice(0, 100)}..."`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const body: Record<string, unknown> = {
      model: opts.model || "claude-sonnet-4-20250514",
      max_tokens: opts.maxTokens || 4096,
      temperature: opts.temperature ?? 0.7,
      messages: [{ role: "user", content: opts.prompt }],
    };
    if (opts.system) {
      body.system = opts.system;
    }

    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claude API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const content = data.content?.[0];
    if (content?.type === "text") return content.text;
    throw new Error("Unexpected Claude response format");
  } finally {
    clearTimeout(timeout);
  }
}

export async function claudeJSON<T>(opts: {
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  model?: string;
}): Promise<T> {
  if (isMockMode()) {
    // Return mock data that validates against the schema
    return getMockForSchema(opts.schema);
  }

  const systemMsg = (opts.system || "") +
    "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences, just raw JSON.";

  const raw = await claudeChat({
    system: systemMsg,
    prompt: opts.prompt,
    model: opts.model,
    temperature: 0.3,
  });

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Claude JSON output: ${raw.slice(0, 200)}`);
  }

  return validateLLMOrRepair({
    schema: opts.schema,
    raw: parsed,
    repairFn: async (data, error) => {
      const repairResponse = await claudeChat({
        system: "Fix the JSON to match the required schema. Return ONLY valid JSON.",
        prompt: `The following JSON failed validation:\n${JSON.stringify(data)}\n\nError: ${error}\n\nFix it and return valid JSON only.`,
        model: opts.model,
        temperature: 0,
      });
      const cleaned = repairResponse.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      return JSON.parse(cleaned);
    },
  });
}

function getMockForSchema<T>(schema: z.ZodType<T>): T {
  // For mock mode, we try parsing a reasonable default
  // This is a generic fallback; specific mocks are in the pipeline steps
  return {} as T;
}
