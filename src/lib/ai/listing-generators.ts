// ==========================================
// SecretZa — Listing AI Generator Service (server-only)
// ==========================================
// Dedicated generators for ADVERTISER LISTINGS (title, body, improve).
// Same contract as the SEO generators — build context → call the single AI
// client → run the content filter → return — but tuned for listing copy
// (longer bodies, descriptive titles, no 160-char meta truncation).

import { generateCompletion } from "@/lib/ai/client";
import { buildSeoContext, type SeoContextInput } from "@/lib/ai/context";
import {
  listingTitlePrompt,
  listingDescriptionPrompt,
  improveListingPrompt,
} from "@/lib/ai/listing-prompts";
import { AiUnsafeOutputError } from "@/lib/ai/seo-generators";
import { isContentClean } from "@/lib/content-filter";

export { AiUnsafeOutputError };

// Generous safety cap for a listing title (descriptive, not a 60-char meta tag).
const TITLE_MAX = 90;

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

export async function generateListingTitle(
  input: SeoContextInput,
): Promise<GeneratorResult> {
  const ctx = buildSeoContext(input);
  const { system, prompt } = listingTitlePrompt(ctx);
  const raw = await generateCompletion({ system, prompt, maxTokens: 120, temperature: 0.6 });
  const text = enforceCleanOutput(clean(raw).slice(0, TITLE_MAX));
  return { text };
}

export async function generateListingDescription(
  input: SeoContextInput,
): Promise<GeneratorResult> {
  const ctx = buildSeoContext(input);
  const { system, prompt } = listingDescriptionPrompt(ctx);
  const raw = await generateCompletion({ system, prompt, maxTokens: 1024, temperature: 0.7 });
  const text = enforceCleanOutput(clean(raw));
  return { text };
}

export async function improveListingDescription(
  content: string,
): Promise<GeneratorResult> {
  const trimmed = (content ?? "").trim();
  if (!trimmed) return { text: "" };
  const { system, prompt } = improveListingPrompt(trimmed);
  const raw = await generateCompletion({ system, prompt, maxTokens: 1024, temperature: 0.4 });
  const text = enforceCleanOutput(clean(raw));
  return { text };
}
