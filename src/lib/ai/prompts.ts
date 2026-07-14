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

export function rewriteIntroPrompt(ctx: {
  summary: string;
  city?: string;
  category?: string;
  keywords: string[];
  intro: string;
  preserveAfter: string;
}): PromptPair {
  return {
    system: SHARED_SAFETY,
    prompt: [
      "Rewrite ONLY the introduction section of this SEO page.",
      "Rules:",
      "- Replace generic template paragraphs with city-specific narrative.",
      "- Keep markdown structure (paragraphs only, no H2 headings in the intro).",
      "- Do NOT rewrite or reference content after the first H2 — that section is preserved separately.",
      "- Keep similar word count to the original intro.",
      "- Vary sentence openings; avoid duplicated phrases.",
      "- Return ONLY the rewritten introduction paragraphs.",
      "",
      `Context: ${ctx.summary}`,
      ctx.city ? `City: ${ctx.city}` : "",
      ctx.category ? `Category: ${ctx.category}` : "",
      ctx.keywords.length
        ? `Target keywords (use naturally, no stuffing): ${ctx.keywords.join(", ")}`
        : "",
      "",
      "INTRO TO REWRITE:",
      ctx.intro,
      ctx.preserveAfter
        ? "\n(Do not include any of the H2 sections that follow — they stay unchanged.)"
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function reduceRepetitionPrompt(ctx: {
  summary: string;
  city?: string;
  repetitiveSections: string;
  fullContent: string;
}): PromptPair {
  return {
    system: SHARED_SAFETY,
    prompt: [
      "Reduce repetition in this SEO page content while preserving structure.",
      "Rules:",
      "- Rewrite ONLY sentences and paragraphs flagged as repetitive or templated.",
      "- Keep all H2/H3 headings and their order unchanged.",
      "- Vary sentence openings; use different vocabulary.",
      "- Replace generic wording with city-specific descriptions where possible.",
      "- Do NOT add contact details, prices, or new factual claims.",
      "- Return the FULL updated markdown (headings + all paragraphs).",
      "",
      `Context: ${ctx.summary}`,
      ctx.city ? `City: ${ctx.city}` : "",
      "",
      "SECTIONS WITH REPETITION TO FIX:",
      ctx.repetitiveSections,
      "",
      "FULL CONTENT:",
      ctx.fullContent,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function keywordDensityPrompt(ctx: {
  summary: string;
  city?: string;
  category?: string;
  keywords: string[];
  content: string;
}): PromptPair {
  return {
    system: SHARED_SAFETY,
    prompt: [
      "Improve keyword distribution in this SEO page content naturally.",
      "Rules:",
      "- Analyze keyword distribution across H2 headings and paragraphs.",
      "- Naturally weave city + category keywords into H2s and body text.",
      "- Avoid keyword stuffing — max one primary keyword mention per paragraph.",
      "- Keep all headings and overall structure; only adjust wording.",
      "- Do NOT add contact details or new factual claims.",
      "- Return the FULL updated markdown.",
      "",
      `Context: ${ctx.summary}`,
      ctx.city ? `City: ${ctx.city}` : "",
      ctx.category ? `Category: ${ctx.category}` : "",
      `Target keywords: ${ctx.keywords.join(", ")}`,
      "",
      "CONTENT:",
      ctx.content,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
