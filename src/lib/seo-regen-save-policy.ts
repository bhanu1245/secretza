/**
 * Regeneration save policy — never overwrite good content with worse results.
 */
export const UNIQUENESS_SAVE_MIN = 80;
export const UNIQUENESS_PREFERRED = 85;
export const SEO_SAVE_MIN = 85;

/** V6.1 save thresholds */
export const V6_UNIQUENESS_HARD_MIN = 80;
export const V6_SEO_HARD_MIN = 85;
export const V6_UNIQUENESS_PREFERRED = 90;
export const V6_SEO_PREFERRED = 90;
export const V6_UNIQUENESS_GOOD_MIN = 80;

export type SaveDecision = {
  save: boolean;
  reason: string;
  meetsThreshold: boolean;
  isImproved: boolean;
  failed?: boolean;
  requiresReview?: boolean;
  saveQuality?: "preferred" | "standard" | "good";
};

export function evaluateSaveDecision(input: {
  priorUniqueness: number | null | undefined;
  priorSeoScore: number | null | undefined;
  newUniqueness: number;
  newSeoScore: number;
  attemptsExhausted?: boolean;
}): SaveDecision {
  const oldU = input.priorUniqueness ?? 0;
  const oldS = input.priorSeoScore ?? 0;
  const newU = input.newUniqueness;
  const newS = input.newSeoScore;

  const isImproved = newU > oldU || newS > oldS;
  const meetsThreshold = newU >= UNIQUENESS_SAVE_MIN && newS >= SEO_SAVE_MIN;
  const meetsPreferred = newU >= UNIQUENESS_PREFERRED && newS >= SEO_SAVE_MIN;

  if (!isImproved) {
    return {
      save: false,
      reason: `No improvement (uniqueness ${oldU.toFixed(0)}%→${newU.toFixed(0)}%, SEO ${oldS.toFixed(0)}→${newS.toFixed(0)})`,
      meetsThreshold,
      isImproved: false,
    };
  }

  if (meetsThreshold || meetsPreferred) {
    return {
      save: true,
      reason: meetsPreferred ? "Meets preferred quality target" : "Meets minimum quality target",
      meetsThreshold: true,
      isImproved: true,
    };
  }

  if (input.attemptsExhausted) {
    return {
      save: true,
      reason: `Retries exhausted — saving best improved result (${newU.toFixed(0)}% unique, SEO ${newS.toFixed(0)})`,
      meetsThreshold: false,
      isImproved: true,
    };
  }

  return {
    save: false,
    reason: `Below threshold (need ≥${UNIQUENESS_SAVE_MIN}% unique & SEO ≥${SEO_SAVE_MIN})`,
    meetsThreshold: false,
    isImproved: true,
  };
}

/** V6.1 adaptive save policy — never save weaker content; manual review when exhausted. */
export function evaluateV61SaveDecision(input: {
  priorUniqueness: number | null | undefined;
  priorSeoScore: number | null | undefined;
  newUniqueness: number;
  newSeoScore: number;
  attemptsExhausted?: boolean;
}): SaveDecision {
  const oldU = input.priorUniqueness ?? 0;
  const oldS = input.priorSeoScore ?? 0;
  const newU = input.newUniqueness;
  const newS = input.newSeoScore;

  const isImproved = newU > oldU || newS > oldS;
  const meetsPreferred = newU >= V6_UNIQUENESS_PREFERRED && newS >= V6_SEO_PREFERRED;
  const meetsMinimum = newU >= V6_UNIQUENESS_HARD_MIN && newS >= V6_SEO_HARD_MIN;
  const meetsGood = newU >= V6_UNIQUENESS_GOOD_MIN && newU < 90 && newS >= V6_SEO_HARD_MIN;

  if (!isImproved) {
    return {
      save: false,
      reason: `No improvement (uniqueness ${oldU.toFixed(0)}%→${newU.toFixed(0)}%, SEO ${oldS.toFixed(0)}→${newS.toFixed(0)})`,
      meetsThreshold: false,
      isImproved: false,
    };
  }

  if (newU >= 90 && newS >= 85) {
    return {
      save: true,
      saveQuality: "preferred",
      reason: "V6.1 excellent — ≥90% unique",
      meetsThreshold: true,
      isImproved: true,
    };
  }

  if (newU >= 85 && newS >= V6_SEO_HARD_MIN) {
    return {
      save: true,
      saveQuality: "standard",
      reason: "V6.1 standard — ≥85% unique",
      meetsThreshold: true,
      isImproved: true,
    };
  }

  if (meetsGood) {
    return {
      save: true,
      saveQuality: "good",
      reason: "V6.1 good — 80–84% unique with SEO ≥85",
      meetsThreshold: true,
      isImproved: true,
    };
  }

  if (meetsPreferred) {
    return {
      save: true,
      saveQuality: "preferred",
      reason: "V6.1 preferred target met",
      meetsThreshold: true,
      isImproved: true,
    };
  }

  if (meetsMinimum && newU >= 85) {
    return {
      save: true,
      saveQuality: "standard",
      reason: `V6.1 minimum met (≥${V6_UNIQUENESS_HARD_MIN}% unique, SEO ≥${V6_SEO_HARD_MIN})`,
      meetsThreshold: true,
      isImproved: true,
    };
  }

  if (input.attemptsExhausted) {
    return {
      save: false,
      failed: true,
      requiresReview: true,
      reason: `Needs manual review — thresholds not met (${newU.toFixed(0)}% unique, SEO ${newS.toFixed(0)})`,
      meetsThreshold: false,
      isImproved: true,
    };
  }

  return {
    save: false,
    reason: `Below V6.1 minimum (need ≥${V6_UNIQUENESS_HARD_MIN}% unique & SEO ≥${V6_SEO_HARD_MIN})`,
    meetsThreshold: false,
    isImproved: true,
  };
}

/** @deprecated Use evaluateV61SaveDecision */
export const evaluateV6SaveDecision = evaluateV61SaveDecision;

export function pickSavePolicy(engine: string) {
  return engine === "v5" ? evaluateSaveDecision : evaluateV61SaveDecision;
}
