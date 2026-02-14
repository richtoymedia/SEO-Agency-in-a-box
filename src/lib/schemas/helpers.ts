import { z } from "zod";

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`${label} validation failed: ${result.error.message}`);
  }
  return result.data;
}

export async function validateLLMOrRepair<T>({
  schema,
  raw,
  repairFn,
}: {
  schema: z.ZodType<T>;
  raw: unknown;
  repairFn: (raw: unknown, error: string) => Promise<unknown>;
}): Promise<T> {
  const first = schema.safeParse(raw);
  if (first.success) return first.data;

  const repaired = await repairFn(raw, first.error.message);
  const second = schema.safeParse(repaired);
  if (second.success) return second.data;

  throw new Error(`LLM output validation failed after repair: ${second.error.message}`);
}
