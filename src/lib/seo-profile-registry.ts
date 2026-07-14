/**
 * SEO Quality Engine — Profile Registry
 *
 * Purpose:
 *   Central registry for all ScoringProfile definitions.
 *   Resolves the correct profile for a given page type at scoring time.
 *
 * Responsibilities:
 *   - Store and index ScoringProfile instances by id
 *   - Validate registrations for duplicate ids
 *   - Resolve the best-matching profile for a page type
 *   - Fall back to the "default" profile when no specific match exists
 *
 * Extension points:
 *   - Register additional profiles via register() during engine init
 *   - A "default" profile (id === "default") serves as universal fallback
 *   - Profile factories in src/lib/seo-profiles/ produce versioned profiles
 *
 * Thread safety:
 *   SeoProfileRegistry is mutated only during engine initialization.
 *   After initialization it is effectively read-only and safe to share.
 *
 * Usage notes:
 *   The registry is constructed by QualityEngine. Do not call register()
 *   after the engine has started scoring pages.
 */

import type {
  ScoringProfile,
  ProfileRegistry,
  ProfileId,
  ModuleWeight,
  PenaltyRule,
  ProfileThresholds,
  GradeThreshold,
  QualityMetrics,
} from "@/lib/seo-quality-types";

export class SeoProfileRegistry implements ProfileRegistry {
  private readonly profiles = new Map<ProfileId, ScoringProfile>();

  /**
   * Register a profile.
   * @throws {Error} if a profile with the same id is already registered.
   */
  register(profile: ScoringProfile): void {
    if (!profile.id || typeof profile.id !== "string" || profile.id.trim() === "") {
      throw new Error(`SeoProfileRegistry: profile id must be a non-empty string`);
    }
    if (this.profiles.has(profile.id)) {
      throw new Error(`SeoProfileRegistry: duplicate profile id "${profile.id}"`);
    }
    this.profiles.set(profile.id, profile);
  }

  get(id: ProfileId): ScoringProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Resolve the best profile for a given pageType, with optional override.
   * Resolution order:
   *   1. explicit override id (if provided and registered)
   *   2. first profile whose pageTypes includes the given pageType
   *   3. profile with id === "default"
   * @throws {Error} if no matching profile and no "default" profile registered.
   */
  resolve(pageType: string, override?: ProfileId): ScoringProfile {
    if (override) {
      const p = this.profiles.get(override);
      if (p) return p;
    }

    for (const profile of this.profiles.values()) {
      if (profile.id !== "default" && profile.pageTypes.includes(pageType)) {
        return profile;
      }
    }

    const fallback = this.profiles.get("default");
    if (fallback) return fallback;

    throw new Error(
      `SeoProfileRegistry: no profile found for pageType "${pageType}" and no "default" profile registered`,
    );
  }

  list(): ScoringProfile[] {
    return [...this.profiles.values()];
  }

  exists(id: ProfileId): boolean {
    return this.profiles.has(id);
  }
}

// ─── Production Profile Definitions ───────────────────────────────────────────

/**
 * Current production weights (mirrors computeSeoQualityScore exactly):
 *   word count    25 pts  (linear cap at 500 words)
 *   uniqueness    25 pts
 *   internal links 15 pts (cap at 5)
 *   FAQ count     15 pts  (cap at 5)
 *   metadata      20 pts  (4 pts × 5 fields)
 *   duplicate     -5 pts per duplicate field
 *
 * This profile is DORMANT — it is registered but not yet used by the engine.
 * It exists so the architecture compiles and the registry can be validated.
 * Production scoring still runs through computeSeoQualityScore() unchanged.
 */
const contentLengthWeight: ModuleWeight = { moduleId: "content-length", weight: 25, enabled: true };
const uniquenessWeight: ModuleWeight    = { moduleId: "uniqueness",      weight: 25, enabled: true };
const internalLinksWeight: ModuleWeight = { moduleId: "internal-links",  weight: 15, enabled: true };
const faqQualityWeight: ModuleWeight    = { moduleId: "faq-quality",     weight: 15, enabled: true };
const metadataWeight: ModuleWeight      = { moduleId: "metadata",        weight: 20, enabled: true };

const duplicateFieldPenalty: PenaltyRule = {
  id: "duplicate-field",
  description: "Exact normalized field match against another page (-5 per field, cap 20).",
  evaluate: (m: QualityMetrics): number => Math.min(m.duplicateFieldCount * 5, 20),
  maxPenalty: 20,
};

const thresholds: ProfileThresholds = {
  minWordCount: 500,
  minQualityScore: 60,
  minUniqueness: 70,
  maxTemplateSentenceRatio: 0.30,
  maxAiPhraseRatio: 0.15,
  minLocalEntityDensity: 2.0,
};

const gradeScale: GradeThreshold[] = [
  { label: "A", minScore: 85 },
  { label: "B", minScore: 70 },
  { label: "C", minScore: 55 },
  { label: "D", minScore: 40 },
  { label: "F", minScore: 0 },
];

export const CITY_SEO_V6_PROFILE: ScoringProfile = Object.freeze({
  id: "city-seo-v6-0",
  name: "City SEO V6",
  version: "6.0.0",
  description:
    "Mirrors the current production scoring formula exactly. " +
    "Dormant until QualityEngine replaces computeSeoQualityScore().",
  pageTypes: ["city", "city_category", "city_escort", "city_massage"],
  modules: [
    contentLengthWeight,
    uniquenessWeight,
    internalLinksWeight,
    faqQualityWeight,
    metadataWeight,
  ],
  penalties: [duplicateFieldPenalty],
  thresholds,
  gradeScale,
  metadata: {
    createdAt: "2026-07-14",
    author: "SecretZa SEO Team",
    changelog: "Initial scaffold profile. Mirrors production computeSeoQualityScore() weights.",
  },
});

/** Fallback profile — identical weights to CITY_SEO_V6_PROFILE. */
export const DEFAULT_PROFILE: ScoringProfile = Object.freeze({
  ...CITY_SEO_V6_PROFILE,
  id: "default",
  name: "Default SEO Profile",
  description: "Universal fallback when no page-type-specific profile is registered.",
  pageTypes: [],
  metadata: {
    ...CITY_SEO_V6_PROFILE.metadata,
    changelog: "Default fallback profile.",
  },
});
