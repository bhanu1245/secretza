// ==========================================
// SecretZa — AI SEO Generator Service (server-only)
// ==========================================
// Thin generators that all follow the same contract:
//   build context → call the single AI client → run the content filter → return.
// AI output that fails the content filter is rejected, so generated copy can
// never reintroduce the contact-leak vector closed in Phase 1.

import { generateCompletion } from "@/lib/ai/client";
import { buildSeoContext, type SeoContextInput } from "@/lib/ai/context";
import { titlePrompt, descriptionPrompt, improvePrompt } from "@/lib/ai/prompts";
import { isContentClean } from "@/lib/content-filter";

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

export class AiUnsafeOutputError extends Error {
  constructor() {
    super("Generated content failed safety checks and was discarded.");
    this.name = "AiUnsafeOutputError";
  }
}

export interface GeneratorResult {
  text: string;
}

/** Strip wrapping quotes/whitespace the model sometimes adds. */
function clean(raw: string): string {
  return raw.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
}

function enforceCleanOutput(text: string): string {
  if (!isContentClean(text)) throw new AiUnsafeOutputError();
  return text;
}

export async function generateSeoTitle(
  input: SeoContextInput,
): Promise<GeneratorResult> {
  const ctx = buildSeoContext(input);
  const { system, prompt } = titlePrompt(ctx);
  const raw = await generateCompletion({ system, prompt, maxTokens: 60, temperature: 0.5 });
  const text = enforceCleanOutput(clean(raw).slice(0, TITLE_MAX));
  return { text };
}

export async function generateSeoDescription(
  input: SeoContextInput,
): Promise<GeneratorResult> {
  const ctx = buildSeoContext(input);
  const { system, prompt } = descriptionPrompt(ctx);
  const raw = await generateCompletion({ system, prompt, maxTokens: 120, temperature: 0.5 });
  const text = enforceCleanOutput(clean(raw).slice(0, DESCRIPTION_MAX));
  return { text };
}

export async function improveContent(content: string): Promise<GeneratorResult> {
  const trimmed = (content ?? "").trim();
  if (!trimmed) return { text: "" };
  const { system, prompt } = improvePrompt(trimmed);
  const raw = await generateCompletion({ system, prompt, maxTokens: 600, temperature: 0.3 });
  const text = enforceCleanOutput(clean(raw));
  return { text };
}
