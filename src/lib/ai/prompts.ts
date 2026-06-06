// ==========================================
// SecretZa — AI Prompt Registry (single source)
// ==========================================
// Every AI prompt lives here. Do NOT inline prompts in routes or components.

import type { SeoContext } from "@/lib/ai/context";

export interface PromptPair {
  system: string;
  prompt: string;
}

export const SHARED_SAFETY = [
  "You write SEO copy for an adult classifieds marketplace.",
  "Strict rules:",
  "- NEVER include phone numbers, WhatsApp/Telegram handles, email addresses, or website URLs.",
  "- NEVER invent specific services, prices, or guarantees that were not provided.",
  "- Keep it tasteful, professional, and policy-safe.",
  "- Output plain text only, with no quotes, labels, or markdown.",
].join("\n");

export function titlePrompt(ctx: SeoContext): PromptPair {
  return {
    system: SHARED_SAFETY,
    prompt: [
      "Write ONE concise, click-worthy SEO title (max 60 characters).",
      `Context: ${ctx.summary}`,
      ctx.city ? `City: ${ctx.city}` : "",
      ctx.category ? `Category: ${ctx.category}` : "",
      ctx.keywords.length ? `Naturally include these target keywords where it fits: ${ctx.keywords.join(", ")}` : "",
      "Return only the title text.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function descriptionPrompt(ctx: SeoContext): PromptPair {
  return {
    system: SHARED_SAFETY,
    prompt: [
      "Write ONE SEO meta description (max 160 characters), human-readable and natural.",
      `Context: ${ctx.summary}`,
      ctx.keywords.length ? `Naturally include these target keywords where it fits: ${ctx.keywords.join(", ")}` : "",
      ctx.description ? `Base it loosely on this existing copy (do not add new facts): ${ctx.description.slice(0, 400)}` : "",
      "Return only the description text.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function improvePrompt(content: string): PromptPair {
  return {
    system: SHARED_SAFETY,
    prompt: [
      "Improve ONLY the grammar, clarity, and readability of the text below.",
      "Do NOT change the meaning. Do NOT add new services, facts, claims, or contact details.",
      "Keep roughly the same length.",
      "Return only the improved text.",
      "",
      content,
    ].join("\n"),
  };
}
