import { z } from "zod";
import { validateLLMOrRepair } from "@/lib/schemas/helpers";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function isMockMode(): boolean {
  return !process.env.GEMINI_API_KEY;
}

interface GeminiChatOptions {
  prompt: string;
  model?: string;
  temperature?: number;
}

export async function geminiChat(opts: GeminiChatOptions): Promise<string> {
  if (isMockMode()) {
    return `[MOCK Gemini Response] Generated content for: "${opts.prompt.slice(0, 100)}..."`;
  }

  const model = opts.model || "gemini-2.0-flash";
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: opts.prompt }] }],
        generationConfig: { temperature: opts.temperature ?? 0.7 },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } finally {
    clearTimeout(timeout);
  }
}

export async function geminiStructured<T>(opts: {
  prompt: string;
  schema: z.ZodType<T>;
  model?: string;
}): Promise<T> {
  if (isMockMode()) {
    return {} as T;
  }

  const response = await geminiChat({
    prompt: opts.prompt + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences.",
    model: opts.model,
    temperature: 0.3,
  });

  let parsed: unknown;
  try {
    const cleaned = response.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Gemini JSON: ${response.slice(0, 200)}`);
  }

  return validateLLMOrRepair({
    schema: opts.schema,
    raw: parsed,
    repairFn: async (data, error) => {
      const repairResp = await geminiChat({
        prompt: `Fix this JSON to match the schema.\nJSON: ${JSON.stringify(data)}\nError: ${error}\nReturn ONLY valid JSON.`,
        temperature: 0,
      });
      const cleaned = repairResp.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      return JSON.parse(cleaned);
    },
  });
}

interface ToolDef {
  name: string;
  description: string;
  fn: (args: Record<string, string>) => Promise<string>;
}

export async function geminiToolLoop<T>(opts: {
  prompt: string;
  tools: ToolDef[];
  maxTurns?: number;
  finalSchema: z.ZodType<T>;
}): Promise<T> {
  if (isMockMode()) {
    return {} as T;
  }

  const maxTurns = opts.maxTurns || 5;
  let conversation = opts.prompt;
  const toolResults: string[] = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    const toolListStr = opts.tools.map(t => `- ${t.name}: ${t.description}`).join("\n");
    const systemPrompt = `You have access to these tools:\n${toolListStr}\n\nTo use a tool, respond with JSON: {"tool": "name", "args": {"key": "value"}}\nWhen you have enough information, respond with your final answer as JSON (no tool call).\n\n${conversation}${toolResults.length > 0 ? "\n\nTool results so far:\n" + toolResults.join("\n") : ""}`;

    const response = await geminiChat({ prompt: systemPrompt, temperature: 0.3 });
    const cleaned = response.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Maybe it's the final answer in non-JSON form, try to extract
      continue;
    }

    if (parsed.tool && typeof parsed.tool === "string") {
      const tool = opts.tools.find(t => t.name === parsed.tool);
      if (tool) {
        const result = await tool.fn((parsed.args || {}) as Record<string, string>);
        toolResults.push(`[${parsed.tool}]: ${result.slice(0, 3000)}`);
        continue;
      }
    }

    // Try to validate as final answer
    const result = opts.finalSchema.safeParse(parsed);
    if (result.success) return result.data;
  }

  throw new Error("Gemini tool loop exhausted without valid final answer");
}
