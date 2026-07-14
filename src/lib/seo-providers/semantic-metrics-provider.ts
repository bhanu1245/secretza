/**
 * SemanticMetricsProvider
 *
 * Purpose:
 *   Measures semantic coverage and concept diversity within a page.
 *   Measurement only — no scoring, no thresholds, no recommendations.
 *
 * Owned QualityMetrics fields:
 *   semanticKeywordCoverage, keywordVariantCoverage, topicCoverage,
 *   entityCoverage, conceptCount, uniqueConceptCount, conceptDensity,
 *   conceptDiversity, conceptRedundancy, semanticClusterCount,
 *   semanticClusterCoverage, headingSemanticCoverage, introSemanticCoverage,
 *   faqSemanticCoverage, sectionSemanticCoverage, entityDistribution,
 *   topicDistribution, phraseVariationScore, coOccurrenceCount,
 *   coOccurrenceDensity, semanticConsistency, semanticTransitionScore,
 *   entityReuseRatio, variantReuseRatio, semanticGapCount, semanticOverlapRatio
 *
 * Execution order: 9 (wave 1 — no provider dependencies)
 *
 * Concept sources (in cluster priority order):
 *   primary   → primaryKeyword
 *   secondary → secondaryKeywords
 *   variants  → semanticVariants (caller-supplied; no inference)
 *   entities  → local intel entity names (LocalIntelSnapshot arrays, deduplicated)
 *
 * Matching strategy:
 *   All matching is case-insensitive and Unicode-safe.
 *   Normalisation: lowercase + collapse whitespace.
 *   Whole-phrase boundary matching via indexOf loop with char boundary checks.
 *   No stemming, no synonym inference, no NLP libraries, no embeddings.
 *
 * Performance:
 *   Concept lookup maps built once in O(m) where m = total concept count.
 *   Content zones scanned once per concept in O(n × m).
 *   Co-occurrence scan is O(s × m) where s = sentence count.
 */

import type {
  MetricsProvider,
  MetricsCollectorInput,
  QualityMetrics,
  CacheStrategy,
  EstimatedCost,
  LocalIntelSnapshot,
} from "@/lib/seo-quality-types";

// ─── Constants ────────────────────────────────────────────────────────────────

type ClusterKey = "primary" | "secondary" | "variants" | "entities";
const CLUSTER_KEYS: ClusterKey[] = ["primary", "secondary", "variants", "entities"];
const ZONES = ["intro", "headings", "faq"] as const;
type Zone = (typeof ZONES)[number];

// ─── Normalisation ────────────────────────────────────────────────────────────

/** Lowercase + collapse whitespace + trim. */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// ─── Phrase matching ──────────────────────────────────────────────────────────

/**
 * Count whole-phrase occurrences of `normPhrase` in `normText`.
 * Boundary: the character immediately before/after the phrase must NOT be
 * a Unicode letter, combining mark, or digit.
 */
export function countPhraseOccurrences(normText: string, normPhrase: string): number {
  if (!normPhrase || !normText) return 0;
  let count = 0;
  let pos   = 0;
  for (;;) {
    const i = normText.indexOf(normPhrase, pos);
    if (i === -1) break;
    const charBefore = i > 0 ? normText[i - 1]! : " ";
    const charAfter  = i + normPhrase.length < normText.length
      ? normText[i + normPhrase.length]!
      : " ";
    if (!/[\p{L}\p{M}\p{N}]/u.test(charBefore) && !/[\p{L}\p{M}\p{N}]/u.test(charAfter)) {
      count++;
    }
    pos = i + 1;
  }
  return count;
}

// ─── Sentence / paragraph splitting ──────────────────────────────────────────

/** Split normalised text into sentences on `.`, `!`, `?`. */
export function splitSentences(normText: string): string[] {
  return normText.split(/(?<=[.!?])\s+|(?<=[.!?])$/).filter(Boolean);
}

/** Split raw text into normalised paragraphs on blank lines. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => normalise(p.replace(/\n/g, " ")))
    .filter(Boolean);
}

// ─── Word count ───────────────────────────────────────────────────────────────

/** Unicode-safe word count (letters, combining marks, digits). */
export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).length;
}

// ─── Entity extraction from LocalIntelSnapshot ────────────────────────────────

/**
 * Build a deduplicated list of normalised entity names from all arrays in
 * a LocalIntelSnapshot.  nearbyCities entries are included by .name.
 */
export function buildEntityList(intel: LocalIntelSnapshot | null | undefined): string[] {
  if (!intel) return [];
  const seen   = new Set<string>();
  const result: string[] = [];

  const add = (name: string | null | undefined) => {
    if (!name) return;
    const norm = normalise(name);
    if (norm && !seen.has(norm)) { seen.add(norm); result.push(norm); }
  };

  const addArr = (arr: string[] | null | undefined) => { for (const n of arr ?? []) add(n); };

  addArr(intel.luxuryAreas);
  addArr(intel.premiumResidentialAreas);
  addArr(intel.dbAreas);
  addArr(intel.hotels);
  addArr(intel.businessHotels);
  addArr(intel.resorts);
  addArr(intel.airports);
  addArr(intel.railwayStations);
  addArr(intel.busStands);
  addArr(intel.shoppingMalls);
  addArr(intel.markets);
  addArr(intel.itParks);
  addArr(intel.businessDistricts);
  addArr(intel.industrialZones);
  addArr(intel.landmarks);
  addArr(intel.historicMonuments);
  addArr(intel.touristAttractions);
  addArr(intel.beachesLakesParks);
  addArr(intel.foodStreets);
  addArr(intel.nightlife);
  addArr(intel.festivals);
  for (const c of intel.nearbyCities ?? []) add(c.name);

  return result;
}

// ─── Rounding ─────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── Provider configuration ───────────────────────────────────────────────────

const CACHE_STRATEGY_NONE: CacheStrategy = {
  scope:                "none",
  ttlMs:                null,
  keyFields:            [],
  estimatedMemoryBytes: 0,
};

const OUTPUT_FIELDS: (keyof QualityMetrics)[] = [
  "semanticKeywordCoverage",
  "keywordVariantCoverage",
  "topicCoverage",
  "entityCoverage",
  "conceptCount",
  "uniqueConceptCount",
  "conceptDensity",
  "conceptDiversity",
  "conceptRedundancy",
  "semanticClusterCount",
  "semanticClusterCoverage",
  "headingSemanticCoverage",
  "introSemanticCoverage",
  "faqSemanticCoverage",
  "sectionSemanticCoverage",
  "entityDistribution",
  "topicDistribution",
  "phraseVariationScore",
  "coOccurrenceCount",
  "coOccurrenceDensity",
  "semanticConsistency",
  "semanticTransitionScore",
  "entityReuseRatio",
  "variantReuseRatio",
  "semanticGapCount",
  "semanticOverlapRatio",
];

// ─── Provider implementation ──────────────────────────────────────────────────

export class SemanticMetricsProvider implements MetricsProvider {
  readonly id             = "semantic-metrics";
  readonly name           = "Semantic Metrics Provider";
  readonly version        = "1.0.0";
  readonly executionOrder = 9;
  readonly dependencies: string[] = [];
  readonly estimatedCost: EstimatedCost = "fast";
  readonly cacheStrategy  = CACHE_STRATEGY_NONE;
  readonly outputFields   = OUTPUT_FIELDS;

  provide(
    input: MetricsCollectorInput,
    _priorMetrics: Partial<QualityMetrics>,
  ): Partial<QualityMetrics> {
    return measure(input);
  }
}

/**
 * Pure measurement function — separated from the class for direct testability.
 */
export function measure(input: MetricsCollectorInput): Partial<QualityMetrics> {
  const {
    introContent,
    faqItems,
    h1,
    primaryKeyword,
    secondaryKeywords,
    semanticVariants,
    localIntel,
    headings: suppliedHeadings,
  } = input;

  const intro = introContent ?? "";

  // ── Build concept lists per cluster ────────────────────────────────────────

  const primaryTerms:   string[] = primaryKeyword ? [normalise(primaryKeyword)].filter(Boolean) : [];
  const secondaryTerms: string[] = (secondaryKeywords ?? []).map(normalise).filter(Boolean);
  const variantTerms:   string[] = (semanticVariants ?? []).map(normalise).filter(Boolean);
  const entityTerms:    string[] = buildEntityList(localIntel);

  const clusterPhrases = new Map<ClusterKey, string[]>([
    ["primary",   primaryTerms],
    ["secondary", secondaryTerms],
    ["variants",  variantTerms],
    ["entities",  entityTerms],
  ]);

  // Deduplicated flat list of all unique concept phrases (first-seen across clusters)
  const seen = new Set<string>();
  const allUniquePhrases: string[] = [];
  for (const key of CLUSTER_KEYS) {
    for (const p of clusterPhrases.get(key)!) {
      if (p && !seen.has(p)) { seen.add(p); allUniquePhrases.push(p); }
    }
  }

  const totalConceptsAvailable = allUniquePhrases.length;

  // ── Build content zones ─────────────────────────────────────────────────────

  // Headings: caller-supplied first, then h1 appended
  const allHeadings: string[] = [
    ...(suppliedHeadings?.map(normalise) ?? []),
    ...(h1 ? [normalise(h1)] : []),
  ].filter(Boolean);

  // FAQ text per item (for per-item coverage) and joined (for zone scan)
  const faqPerItem:  string[] = faqItems.map((f) => normalise(`${f.question} ${f.answer}`));

  const introNorm    = normalise(intro);
  const headingsNorm = normalise(allHeadings.join(" "));
  const faqNorm      = normalise(faqPerItem.join(" "));
  const fullText     = [introNorm, headingsNorm, faqNorm].filter(Boolean).join(" ");

  const zoneTexts: Record<Zone, string> = {
    intro:    introNorm,
    headings: headingsNorm,
    faq:      faqNorm,
  };

  // Paragraph and sentence splits
  const introParagraphs = splitParagraphs(intro);
  const allSentences    = splitSentences(fullText);
  const totalWords      = countWords(fullText);

  // ── Scan each concept against full text and each zone (single pass) ─────────

  type ConceptStats = {
    totalOccurrences: number;
    foundInZones: Set<Zone>;
  };

  const stats = new Map<string, ConceptStats>();

  for (const phrase of allUniquePhrases) {
    const total = countPhraseOccurrences(fullText, phrase);
    const foundInZones = new Set<Zone>();
    for (const zone of ZONES) {
      if (countPhraseOccurrences(zoneTexts[zone], phrase) > 0) {
        foundInZones.add(zone);
      }
    }
    stats.set(phrase, { totalOccurrences: total, foundInZones });
  }

  // ── Helper: does a phrase have any occurrence? ───────────────────────────────

  const occ = (phrase: string): number => stats.get(phrase)?.totalOccurrences ?? 0;
  const found = (phrase: string): boolean => occ(phrase) > 0;

  // ── semanticKeywordCoverage ─────────────────────────────────────────────────

  const kwTerms        = [...new Set([...primaryTerms, ...secondaryTerms])];
  const kwFound        = kwTerms.filter(found).length;
  const semanticKeywordCoverage = kwTerms.length > 0
    ? round4(kwFound / kwTerms.length) : 0;

  // ── keywordVariantCoverage ──────────────────────────────────────────────────

  const uniqueVariants         = [...new Set(variantTerms)];
  const variantsFoundCount     = uniqueVariants.filter(found).length;
  const keywordVariantCoverage = uniqueVariants.length > 0
    ? round4(variantsFoundCount / uniqueVariants.length) : 0;

  // ── entityCoverage ──────────────────────────────────────────────────────────

  const uniqueEntityPhrases = [...new Set(entityTerms)];
  const entitiesFoundCount  = uniqueEntityPhrases.filter(found).length;
  const entityCoverage      = uniqueEntityPhrases.length > 0
    ? round4(entitiesFoundCount / uniqueEntityPhrases.length) : 0;

  // ── Cluster-level coverage ──────────────────────────────────────────────────

  // topicCoverage: fraction of all 4 cluster slots (including empty) with ≥1 mention
  const clustersWithAnyMention = CLUSTER_KEYS.filter((k) =>
    (clusterPhrases.get(k) ?? []).some(found)
  );
  const topicCoverage = round4(clustersWithAnyMention.length / CLUSTER_KEYS.length);

  // semanticClusterCount / semanticClusterCoverage: non-empty clusters only
  const nonEmptyClusterKeys = CLUSTER_KEYS.filter(
    (k) => (clusterPhrases.get(k)?.length ?? 0) > 0
  );
  const semanticClusterCount = nonEmptyClusterKeys.length;
  const clustersWithMention  = nonEmptyClusterKeys.filter((k) =>
    (clusterPhrases.get(k) ?? []).some(found)
  );
  const semanticClusterCoverage = semanticClusterCount > 0
    ? round4(clustersWithMention.length / semanticClusterCount) : 0;
  const semanticGapCount = semanticClusterCount - clustersWithMention.length;

  // ── Global concept counts ───────────────────────────────────────────────────

  let conceptCount      = 0;
  let uniqueConceptCount = 0;

  for (const phrase of allUniquePhrases) {
    const c = occ(phrase);
    conceptCount     += c;
    if (c > 0) uniqueConceptCount++;
  }

  const conceptDensity   = totalWords > 0 ? round4(conceptCount / totalWords * 100) : 0;
  const conceptDiversity = totalConceptsAvailable > 0
    ? round4(uniqueConceptCount / totalConceptsAvailable) : 0;
  const conceptRedundancy = conceptCount > 0
    ? round4(1 - uniqueConceptCount / conceptCount) : 0;

  // ── Heading / intro / FAQ / section coverage ────────────────────────────────

  const hasAnyConcept = (text: string): boolean =>
    allUniquePhrases.some((p) => countPhraseOccurrences(text, p) > 0);

  const headingSemanticCoverage = allHeadings.length > 0
    ? round4(allHeadings.filter(hasAnyConcept).length / allHeadings.length) : 0;

  const introSemanticCoverage = introParagraphs.length > 0
    ? round4(introParagraphs.filter(hasAnyConcept).length / introParagraphs.length) : 0;

  const faqSemanticCoverage = faqItems.length > 0
    ? round4(faqPerItem.filter(hasAnyConcept).length / faqItems.length) : 0;

  // sectionSemanticCoverage: all segments — intro paras + headings + FAQ items
  const allSegments  = [...introParagraphs, ...allHeadings, ...faqPerItem];
  const sectionSemanticCoverage = allSegments.length > 0
    ? round4(allSegments.filter(hasAnyConcept).length / allSegments.length) : 0;

  // ── Entity distribution ─────────────────────────────────────────────────────

  const entityZoneHits = ZONES.filter((zone) =>
    uniqueEntityPhrases.some((e) => countPhraseOccurrences(zoneTexts[zone], e) > 0)
  ).length;
  const entityDistribution = round4(entityZoneHits / ZONES.length);

  // ── Topic distribution ──────────────────────────────────────────────────────
  // Fraction of non-empty clusters whose phrases appear in ≥2 content zones

  const clustersIn2Zones = nonEmptyClusterKeys.filter((k) => {
    const zonesHit = new Set<Zone>();
    for (const p of clusterPhrases.get(k) ?? []) {
      for (const z of stats.get(p)?.foundInZones ?? []) zonesHit.add(z);
    }
    return zonesHit.size >= 2;
  }).length;
  const topicDistribution = semanticClusterCount > 0
    ? round4(clustersIn2Zones / semanticClusterCount) : 0;

  // ── Phrase variation score ──────────────────────────────────────────────────
  // Fraction of secondary + variant concepts co-occurring with primary in ≥1 sentence

  const nonPrimaryPhrases = [...new Set([...secondaryTerms, ...variantTerms])];
  let phraseCoOccurrences = 0;

  if (primaryTerms.length > 0 && nonPrimaryPhrases.length > 0) {
    for (const phrase of nonPrimaryPhrases) {
      const coOccurs = allSentences.some(
        (s) =>
          countPhraseOccurrences(s, primaryTerms[0]!) > 0 &&
          countPhraseOccurrences(s, phrase) > 0
      );
      if (coOccurs) phraseCoOccurrences++;
    }
  }

  const phraseVariationScore = nonPrimaryPhrases.length > 0
    ? round4(phraseCoOccurrences / nonPrimaryPhrases.length) : 0;

  // ── Co-occurrence ───────────────────────────────────────────────────────────
  // For each sentence, count pairs of distinct concepts both present

  let coOccurrenceCount = 0;
  for (const sent of allSentences) {
    const presentPhrases = allUniquePhrases.filter(
      (p) => countPhraseOccurrences(sent, p) > 0
    );
    const k = presentPhrases.length;
    if (k >= 2) coOccurrenceCount += (k * (k - 1)) / 2;
  }
  const coOccurrenceDensity = allSentences.length > 0
    ? round4(coOccurrenceCount / allSentences.length) : 0;

  // ── Semantic consistency ────────────────────────────────────────────────────
  // Fraction of content "sections" (intro paras + FAQ items) referencing ≥1 primary term

  const contentSections = [
    ...introParagraphs,
    ...faqPerItem,
  ];
  const semanticConsistency =
    primaryTerms.length > 0 && contentSections.length > 0
      ? round4(
          contentSections.filter((s) =>
            primaryTerms.some((p) => countPhraseOccurrences(s, p) > 0)
          ).length / contentSections.length
        )
      : 0;

  // ── Semantic transition score ───────────────────────────────────────────────
  // Fraction of consecutive intro paragraph pairs sharing ≥1 concept

  let transitionHits  = 0;
  let transitionPairs = 0;
  for (let i = 0; i < introParagraphs.length - 1; i++) {
    transitionPairs++;
    const shared = allUniquePhrases.some(
      (p) =>
        countPhraseOccurrences(introParagraphs[i]!, p) > 0 &&
        countPhraseOccurrences(introParagraphs[i + 1]!, p) > 0
    );
    if (shared) transitionHits++;
  }
  const semanticTransitionScore = transitionPairs > 0
    ? round4(transitionHits / transitionPairs) : 0;

  // ── Entity reuse ratio ──────────────────────────────────────────────────────

  let totalEntityOccurrences = 0;
  let uniqueEntitiesFound    = 0;
  for (const phrase of uniqueEntityPhrases) {
    const c = occ(phrase);
    totalEntityOccurrences += c;
    if (c > 0) uniqueEntitiesFound++;
  }
  const entityReuseRatio = totalEntityOccurrences > 0
    ? round4((totalEntityOccurrences - uniqueEntitiesFound) / totalEntityOccurrences) : 0;

  // ── Variant reuse ratio ─────────────────────────────────────────────────────

  let totalVariantOccurrences = 0;
  let variantsFound           = 0;
  for (const phrase of uniqueVariants) {
    const c = occ(phrase);
    totalVariantOccurrences += c;
    if (c > 0) variantsFound++;
  }
  const variantReuseRatio = totalVariantOccurrences > 0
    ? round4((totalVariantOccurrences - variantsFound) / totalVariantOccurrences) : 0;

  // ── Semantic overlap ratio ──────────────────────────────────────────────────
  // Fraction of found concepts that appear in ≥2 content zones

  const foundConcepts  = allUniquePhrases.filter(found);
  const overlapCount   = foundConcepts.filter(
    (p) => (stats.get(p)?.foundInZones.size ?? 0) >= 2
  ).length;
  const semanticOverlapRatio = foundConcepts.length > 0
    ? round4(overlapCount / foundConcepts.length) : 0;

  // ── Return ──────────────────────────────────────────────────────────────────

  return {
    semanticKeywordCoverage,
    keywordVariantCoverage,
    topicCoverage,
    entityCoverage,
    conceptCount,
    uniqueConceptCount,
    conceptDensity,
    conceptDiversity,
    conceptRedundancy,
    semanticClusterCount,
    semanticClusterCoverage,
    headingSemanticCoverage,
    introSemanticCoverage,
    faqSemanticCoverage,
    sectionSemanticCoverage,
    entityDistribution,
    topicDistribution,
    phraseVariationScore,
    coOccurrenceCount,
    coOccurrenceDensity,
    semanticConsistency,
    semanticTransitionScore,
    entityReuseRatio,
    variantReuseRatio,
    semanticGapCount,
    semanticOverlapRatio,
  };
}

/** Singleton instance for use in QualityEngineConfig.providers */
export const semanticMetricsProvider = new SemanticMetricsProvider();
