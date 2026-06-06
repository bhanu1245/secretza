// ==========================================
// SecretZa — Listing SEO V5 Lite: orchestrator
// ==========================================
// Primary path is the deterministic Lite engine. AI is an OPTIONAL enhancement
// layer: it can only run when explicitly requested AND configured, and any
// failure (error, timeout, unsafe output, unconfigured) falls back to the
// deterministic draft. Generation can therefore NEVER fail.

import {
  generateListingTitle as liteTitle,
  generateListingDescription as liteDescription,
  improveListingDescription as liteImprove,
  LISTING_SEO_LIMITS,
  type ListingSeoInput,
} from "@/lib/listing-seo/listing-seo-content";
import {
  computeListingQuality,
  type ListingQualityResult,
} from "@/lib/listing-seo/listing-quality";
import { countWords } from "@/lib/seo-quality";
import { isContentClean } from "@/lib/content-filter";
import { isAiConfigured } from "@/lib/ai/client";
import {
  generateListingTitle as aiTitle,
  improveListingDescription as aiImprove,
} from "@/lib/ai/listing-generators";

const { DESC_MIN_WORDS, DESC_MAX_WORDS } = LISTING_SEO_LIMITS;
const MIN_AI_PARAGRAPHS = 3;

export type ListingSeoAction = "title" | "description" | "improve";

export interface GenerateOptions {
  /** Opt-in AI enhancement. Default false. */
  enhance?: boolean;
  /** Current content for the "improve" action. */
  currentContent?: string;
}

export interface GenerateResult {
  text: string;
  /** Which layer produced the final text. */
  source: "lite" | "ai";
}

/** A deterministic draft that is always safe (filtered) and never throws. */
function buildDraft(action: ListingSeoAction, input: ListingSeoInput, currentContent: string): string {
  let draft: string;
  switch (action) {
    case "title":
      draft = liteTitle(input);
      break;
    case "description":
      draft = liteDescription(input);
      break;
    case "improve":
      draft = liteImprove(currentContent, input);
      break;
  }
  // The deterministic templates never contain contact details, but enforce the
  // Phase 1 safety contract regardless. If somehow unclean, drop to empty so the
  // caller still gets a safe (never unsafe) string.
  return isContentClean(draft) ? draft : "";
}

function countParagraphs(text: string): number {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0).length;
}

/** Score a description body using the same listing title + location context. */
function scoreDescriptionBody(
  input: ListingSeoInput,
  description: string,
): ListingQualityResult {
  return computeListingQuality({
    title: liteTitle(input),
    description,
    keywords: input.keywords,
    city: input.city,
    area: input.area,
    state: input.state,
    peers: [],
  });
}

/**
 * Accept AI-enhanced description copy only when it beats or matches the
 * deterministic draft on every quality dimension the advertiser cares about.
 */
function acceptAiDescription(
  aiText: string,
  draftScore: ListingQualityResult,
  input: ListingSeoInput,
): boolean {
  if (!isContentClean(aiText)) return false;

  const words = countWords(aiText);
  if (words < DESC_MIN_WORDS || words > DESC_MAX_WORDS) return false;
  if (countParagraphs(aiText) < MIN_AI_PARAGRAPHS) return false;

  const aiScore = scoreDescriptionBody(input, aiText);
  if (aiScore.breakdown.keywordCoverage < draftScore.breakdown.keywordCoverage) return false;
  if (aiScore.total < draftScore.total) return false;

  return true;
}

/** Title enhancement: clean output with title sub-score >= draft title sub-score. */
function acceptAiTitle(
  aiText: string,
  draftTitle: string,
  input: ListingSeoInput,
): boolean {
  if (!isContentClean(aiText)) return false;
  if (aiText.trim().length < 30) return false;

  const draftScore = computeListingQuality({
    title: draftTitle,
    description: "",
    keywords: input.keywords,
    city: input.city,
    area: input.area,
    state: input.state,
    peers: [],
  });
  const aiScore = computeListingQuality({
    title: aiText.trim(),
    description: "",
    keywords: input.keywords,
    city: input.city,
    area: input.area,
    state: input.state,
    peers: [],
  });

  return aiScore.breakdown.titleQuality >= draftScore.breakdown.titleQuality;
}

/**
 * Generate listing copy. Deterministic by default; optionally AI-enhanced with
 * guaranteed fallback to the deterministic draft.
 */
export async function generateListingContent(
  action: ListingSeoAction,
  input: ListingSeoInput,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const currentContent = options.currentContent ?? "";
  const draft = buildDraft(action, input, currentContent);

  if (!options.enhance || !isAiConfigured()) {
    return { text: draft, source: "lite" };
  }

  try {
    let enhanced: string | null = null;

    if (action === "title") {
      const r = await aiTitle({
        listingTitle: input.title,
        category: input.category,
        subcategory: input.subcategory,
        city: input.city,
        area: input.area,
        state: input.state,
        country: input.country,
        description: input.description,
        keywords: input.keywords,
      });
      if (r.text && acceptAiTitle(r.text, draft, input)) {
        enhanced = r.text.trim();
      }
    } else {
      // description + improve: score draft, then refine via AI improve prompt.
      const draftScore = scoreDescriptionBody(input, draft);
      const seed = draft || currentContent;
      if (seed.trim()) {
        const r = await aiImprove(seed);
        if (r.text && acceptAiDescription(r.text.trim(), draftScore, input)) {
          enhanced = r.text.trim();
        }
      }
    }

    if (enhanced) return { text: enhanced, source: "ai" };
  } catch {
    // Any AI failure → deterministic draft. Generation never fails.
  }

  return { text: draft, source: "lite" };
}
