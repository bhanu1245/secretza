// ==========================================
// SecretZa — Listing AI Prompt Registry (single source)
// ==========================================
// Prompts dedicated to ADVERTISER LISTINGS. These produce listing titles and
// human-readable listing bodies — NOT the SEO meta-tag copy in prompts.ts.
// Reuses SHARED_SAFETY so the contact-leak/safety rules stay identical.

import type { SeoContext } from "@/lib/ai/context";
import { SHARED_SAFETY } from "@/lib/ai/prompts";
import type { PromptPair } from "@/lib/ai/prompts";

export type { PromptPair };

export function listingTitlePrompt(ctx: SeoContext): PromptPair {
  return {
    system: SHARED_SAFETY,
    prompt: [
      "Write ONE click-worthy listing title for an advertiser profile.",
      "Length: 50–70 characters (must be at least 50). One line, Title Case.",
      `Describe the offering: ${ctx.listingSummary}.`,
      ctx.category ? `Category: ${ctx.category}` : "",
      ctx.subcategory ? `Subcategory: ${ctx.subcategory}` : "",
      ctx.area || ctx.city ? `Location: ${[ctx.area, ctx.city].filter(Boolean).join(", ")}` : "",
      ctx.keywords.length
        ? `Include ONE of these keywords naturally (no stuffing): ${ctx.keywords.join(", ")}`
        : "",
      "Make it natural and appealing — do not stuff keywords or repeat the city.",
      "Return only the title text.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function listingDescriptionPrompt(ctx: SeoContext): PromptPair {
  return {
    system: SHARED_SAFETY,
    prompt: [
      "Write an advertiser listing description of 150–350 words in 2–4 short paragraphs.",
      `Subject: ${ctx.listingSummary}.`,
      "Structure: an inviting intro; what the listing offers in general terms; location and availability cues; a warm closing line.",
      ctx.keywords.length
        ? `Weave these keywords in naturally (2–5 total, no stuffing): ${ctx.keywords.join(", ")}`
        : "",
      ctx.description
        ? `Build loosely on this existing copy (do not contradict it, do not add new facts): ${ctx.description.slice(0, 600)}`
        : "",
      "Do NOT invent specific services, prices, guarantees, schedules, or contact details.",
      "Be human, friendly, and policy-safe. Plain text only, no markdown or headings.",
      "Return only the description text.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function improveListingPrompt(content: string): PromptPair {
  return {
    system: SHARED_SAFETY,
    prompt: [
      "Improve the advertiser listing description below.",
      "Improve grammar, clarity, flow, structure, and SEO readability.",
      "You MAY restructure into short paragraphs and expand thin content toward 150–350 words.",
      "Preserve the original meaning. Do NOT add new services, facts, prices, claims, or contact details.",
      "Plain text only, no markdown. Return only the improved text.",
      "",
      content,
    ].join("\n"),
  };
}
