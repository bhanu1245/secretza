/**
 * SEO Quality Engine — Core Type Definitions
 *
 * Purpose:
 *   Single source of truth for every interface in the SEO Quality Engine pipeline.
 *   No implementation lives here — only contracts.
 *
 * Architecture layers (top → bottom):
 *   MetricsProvider[] → QualityMetrics
 *   RuleRegistry      → RuleEvaluationResult[]
 *   ScorerModule[]    → ModuleResult[]
 *   QualityEngine     → ScoringResult
 *
 * Extension points:
 *   - Add fields to QualityMetrics when a new provider is added
 *   - Add a new ModuleId / ProfileId union when a scorer / profile is registered
 *   - ScoreExplanation and ImproveHint are consumed by UI — keep them stable
 *
 * Thread safety:
 *   All types are plain data objects. Immutability is enforced by callers via
 *   `Object.freeze` on construction; interfaces here carry no mutability guarantees.
 *
 * Usage notes:
 *   Import from this file for all type references. Never import concrete classes
 *   into types — that would create circular deps.
 */

// ─── Identity ──────────────────────────────────────────────────────────────────

export type ProfileId = string;
export type ModuleId = string;
export type ProviderId = string;
export type RuleId = string;
export type GradeLabel = "A" | "B" | "C" | "D" | "F";
export type Severity = "error" | "warning" | "info";
export type DuplicateRisk = "low" | "medium" | "high" | "unscored";
export type ModuleLifecycleState =
  | "REGISTERED"
  | "ENABLED"
  | "SCHEDULED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

// ─── QualityMetrics ────────────────────────────────────────────────────────────

/**
 * Pure measured facts about a page's content.
 * No weights, no scores, no business rules.
 * Every field is computed by a MetricsProvider; none are scored here.
 * Nullable fields indicate the provider responsible was skipped or unavailable.
 */
export interface QualityMetrics {
  // Content length & character counts
  wordCount: number;
  wordCountIntro: number;
  characterCount: number;
  paragraphCount: number;
  avgParagraphWords: number;
  sentenceCount: number;
  avgSentenceWords: number;
  sentenceLengthVariance: number;
  longSentenceRatio: number;

  // Structural element counts
  headingCount: number;
  h3Count: number;
  listCount: number;
  tableCount: number;
  imageCount: number;
  externalLinksCount: number;
  headingDensity: number;
  contentDensity: number;

  // Readability
  readabilityScore: number;         // Flesch Reading Ease (0–100)
  typeTokenRatio: number;           // unique tokens / total tokens
  boilerplateTokenRatio: number;    // boilerplate tokens / total tokens
  longSentenceCount: number;        // sentences > longSentenceThreshold words
  shortSentenceCount: number;       // sentences < shortSentenceThreshold words
  shortSentenceRatio: number;       // shortSentenceCount / sentenceCount
  punctuationDensity: number;       // punctuation marks per 100 words
  questionSentenceCount: number;    // sentences ending in '?'
  exclamationSentenceCount: number; // sentences ending in '!'
  complexWordCount: number;         // words with 3+ syllables
  complexWordRatio: number;         // complexWordCount / wordCount
  estimatedReadingTimeMinutes: number;  // @ 238 wpm
  estimatedSpeakingTimeMinutes: number; // @ 150 wpm
  paragraphFlow: number;            // fraction of paragraphs with a transition word opener

  // Uniqueness
  uniquenessOverall: number;
  uniquenessParagraphMin: number;
  uniquenessFaq: number;
  uniquenessTitle: number;
  uniquenessMeta: number;
  maxIntroSimilarity: number;

  // Keyword coverage — primary keyword presence
  primaryKeywordPresent: boolean;           // keyword appears at least once in full text
  primaryKeywordOccurrences: number;        // whole-word exact-phrase occurrences in full text
  primaryKeywordDensity: number;            // occurrences / total words * 100
  primaryKeywordFirstPosition: number;      // word index of first occurrence (-1 if absent)
  primaryKeywordLastPosition: number;       // word index of last occurrence (-1 if absent)
  primaryKeywordInTitle: boolean;
  primaryKeywordInH1: boolean;
  primaryKeywordInMeta: boolean;
  primaryKeywordInIntro: boolean;
  primaryKeywordInFaq: boolean;
  primaryKeywordInInternalLinks: boolean;   // keyword in any anchor text
  primaryKeywordInSlug: boolean;            // keyword in pageSlug
  primaryKeywordInCanonical: boolean;       // keyword in canonicalUrl

  // Keyword coverage — secondary keywords
  secondaryKeywordHits: number;             // count of distinct secondary keywords found
  secondaryKeywordCount: number;            // total secondary keywords supplied
  secondaryKeywordCoverage: number;         // secondaryKeywordHits / secondaryKeywordCount
  secondaryKeywordOccurrences: number;      // total occurrences across all secondary keywords
  secondaryKeywordDensity: number;          // secondaryKeywordOccurrences / totalWords * 100

  // Keyword coverage — semantic variants (caller-supplied list only)
  semanticVariantCount: number;             // variants supplied
  semanticVariantCoverage: number;          // fraction of variants found at least once

  // Keyword coverage — match types for primary keyword
  exactMatchCount: number;                  // whole-word matches (= primaryKeywordOccurrences)
  partialMatchCount: number;                // substring-only matches (inside larger words)

  // Keyword distribution
  keywordDistributionScore: number;         // fraction of equal-length document sections containing keyword
  keywordSpread: number;                    // (lastPosition − firstPosition) / max(totalWords−1, 1)

  // Section-level coverage
  sectionCoverage: number;                  // fraction of heading-delimited sections with keyword
  headingCoverage: number;                  // fraction of H2/H3 headings containing keyword
  faqCoverage: number;                      // fraction of FAQ items (question+answer) with keyword
  introCoverage: number;                    // fraction of intro paragraphs containing keyword

  // Legacy keyword fields (production engine — not owned by KeywordMetricsProvider)
  keywordDensity: number;
  keywordStuffingRisk: boolean;

  // Semantic & entity coverage
  localEntityCount: number;
  localEntityDensityPer100: number;
  topicCoverageScore: number | null;

  // FAQ quality — counts (existing fields)
  faqCount: number;
  faqThinAnswers: number;         // legacy (threshold-dependent; not owned by FAQMetricsProvider)
  faqDuplicateLeadIns: number;    // questions sharing identical first-3-word lead-in
  faqAvgAnswerWords: number;      // alias for averageAnswerWords

  // FAQ quality — lengths
  questionCount: number;
  answerCount: number;
  averageQuestionLength: number;  // avg char count
  averageAnswerLength: number;
  averageQuestionWords: number;
  averageAnswerWords: number;
  longestQuestionLength: number;
  longestAnswerLength: number;
  shortestQuestionLength: number;
  shortestAnswerLength: number;

  // FAQ quality — duplicates
  duplicateQuestionCount: number; // questions appearing more than once
  duplicateAnswerCount: number;   // answers appearing more than once
  duplicateFaqPairCount: number;  // identical question+answer pairs

  // FAQ quality — empty / malformed
  emptyQuestionCount: number;
  emptyAnswerCount: number;

  // FAQ quality — question format
  questionMarkCount: number;       // questions ending with '?'
  questionStartsWithWhWord: number;
  questionStartsWithHow: number;
  questionStartsWithWhat: number;
  questionStartsWithWhere: number;
  questionStartsWithWhen: number;
  questionStartsWithWhy: number;
  questionStartsWithCan: number;
  questionStartsWithIs: number;
  questionStartsWithAre: number;

  // FAQ quality — answer signals (counts of FAQ items exhibiting each signal)
  answerContainsList: number;
  answerContainsInternalLink: number;
  answerContainsKeyword: number;
  answerContainsNumber: number;
  answerContainsLocation: number;
  answerContainsCallToAction: number;
  answerReadingTimeMinutes: number; // total reading time for all answer text @ 238 wpm

  // FAQ quality — completeness
  faqCompleteness: number;          // fraction of items with both non-empty Q and A

  // FAQ quality — structured FAQ schema parity
  structuredFaqParity: number;              // fraction of content FAQs matched in schema
  structuredFaqQuestionCoverage: number;    // fraction of schema questions found in content
  structuredFaqAnswerCoverage: number;      // fraction of schema answers matched in content
  missingStructuredFaqCount: number;        // content FAQs absent from schema
  extraStructuredFaqCount: number;          // schema FAQs absent from content

  // Internal links — legacy (ContentMetricsProvider)
  internalLinksCount: number;
  uniqueAnchorTexts: number;
  anchorTextDiversity: number;

  // Internal links — InternalLinkMetricsProvider
  internalLinkCount: number;         // total links in internalLinks array
  externalLinkCount: number;         // external links (0 when only internalLinks provided)
  followLinkCount: number;           // links without rel=nofollow
  nofollowLinkCount: number;         // links with rel containing "nofollow"
  anchorTextCount: number;           // links with non-empty anchor text
  uniqueAnchorTextCount: number;     // distinct non-empty anchor texts
  duplicateAnchorTextCount: number;  // anchor texts used more than once
  averageAnchorLength: number;       // avg char length of non-empty anchors
  longestAnchorLength: number;
  shortestAnchorLength: number;
  emptyAnchorCount: number;          // links with empty/whitespace-only anchor
  samePageAnchorCount: number;       // href starts with '#'
  relativeLinkCount: number;         // href starts with '/' (not '//')
  absoluteInternalLinkCount: number; // href starts with 'http' (in internalLinks array)
  externalHttpLinkCount: number;     // http(s) links classified as external (not in internalLinks)
  mailtoLinkCount: number;           // href starts with 'mailto:'
  telLinkCount: number;              // href starts with 'tel:'
  categoryLinkCount: number;         // href matches /category/ /categories/ /cat/ pattern
  cityLinkCount: number;             // href matches /city/ /cities/ /location/ pattern
  listingLinkCount: number;          // href matches /listing/ /listings/ /profile/ pattern
  faqInternalLinkCount: number;      // href contains '/faq' or anchor mentions 'faq'
  ctaInternalLinkCount: number;      // anchor is a generic CTA phrase
  sectionLinkDistribution: number;   // fraction of equal-size link-index sections containing a link
  firstLinkPosition: number;         // 0-based index of first link (-1 if none)
  lastLinkPosition: number;          // 0-based index of last link (-1 if none)
  linkSpread: number;                // (last - first) / max(total - 1, 1)
  linkDensity: number;               // internalLinkCount per 100 words of page content
  uniqueTargetCount: number;         // distinct normalised hrefs
  duplicateTargetCount: number;      // hrefs used more than once
  anchorKeywordCoverage: number;     // fraction of non-empty anchors containing the primary keyword
  descriptiveAnchorCount: number;    // non-empty, non-generic anchor texts
  genericAnchorCount: number;        // anchors matching generic phrases ("click here", "read more"…)
  imageLinkCount: number;            // links with empty anchor (likely image-only links)

  // Metadata quality — title
  titlePresent: boolean;
  titleLength: number;
  titleInOptimalRange: boolean;
  estimatedTitlePixelWidth: number;

  // Metadata quality — meta description
  metaPresent: boolean;
  metaLength: number;
  metaInOptimalRange: boolean;
  metaDescriptionPixelWidth: number;

  // Metadata quality — H1
  h1Present: boolean;
  h1Count: number;
  h1EqualsTitle: boolean;

  // Metadata quality — canonical & image
  canonicalPresent: boolean;
  featuredImagePresent: boolean;
  imageAltPresent: boolean;

  // Metadata quality — robots meta
  robotsMetaExists: boolean;
  robotsMetaContent: string | null;
  robotsNoindex: boolean;
  robotsNofollow: boolean;

  // Metadata quality — Open Graph
  openGraphExists: boolean;
  openGraphPropertyCount: number;

  // Metadata quality — Twitter card
  twitterCardExists: boolean;
  twitterMetaCount: number;

  // Metadata quality — structured data / JSON-LD
  structuredDataPresent: boolean;
  structuredDataParseable: boolean;
  jsonLdCount: number;
  schemaTypeList: string | null;        // comma-separated detected @type values
  breadcrumbSchemaExists: boolean;
  organizationSchemaExists: boolean;
  websiteSchemaExists: boolean;
  faqSchemaExists: boolean;
  articleSchemaExists: boolean;

  // Metadata quality — internationalization
  hreflangExists: boolean;
  hreflangCount: number;
  alternateLinkCount: number;

  // Metadata quality — technical page signals
  viewportMetaExists: boolean;
  charsetMetaExists: boolean;
  faviconExists: boolean;
  manifestExists: boolean;

  // Heading quality
  h2Count: number;
  h2UniqueCount: number;
  h2TemplateCount: number;
  headingKeywordCoverage: number;

  // Duplicate content — DuplicateContentMetricsProvider (intra-document only)
  duplicateSentenceCount: number;       // sentences appearing more than once within this doc
  duplicateParagraphCount: number;      // paragraphs appearing more than once
  duplicateHeadingCount: number;        // headings appearing more than once
  duplicateFaqQuestionCount: number;    // FAQ questions appearing more than once
  duplicateFaqAnswerCount: number;      // FAQ answers appearing more than once
  duplicateLeadInCount: number;         // distinct first-3-word lead-ins shared by 2+ sentences
  duplicateIntroSentenceCount: number;  // sentences within introContent appearing more than once
  repeatedPhraseCount: number;          // distinct n-grams (n≥2) appearing more than once
  repeatedBigramCount: number;          // distinct word pairs appearing more than once
  repeatedTrigramCount: number;         // distinct word triples appearing more than once
  repeatedFourGramCount: number;        // distinct word 4-tuples appearing more than once
  maxDuplicateRunLength: number;        // length of longest run of identical consecutive tokens
  uniqueSentenceRatio: number;          // unique sentences / total sentences
  uniqueParagraphRatio: number;         // unique paragraphs / total paragraphs
  uniqueHeadingRatio: number;           // unique headings / total headings
  uniqueFaqQuestionRatio: number;       // unique FAQ questions / total
  uniqueFaqAnswerRatio: number;         // unique FAQ answers / total
  templateReuseRatio: number;           // fraction of sentence occurrences that are duplicated
  boilerplateParagraphCount: number;    // paragraphs matching any boilerplate pattern
  boilerplateSentenceCount: number;     // sentences matching any boilerplate pattern
  selfSimilarityScore: number;          // Jaccard(intro tokens, faq tokens)
  introSectionSimilarity: number;       // average pairwise Jaccard between intro paragraphs
  headingSimilarity: number;            // average pairwise Jaccard between heading token sets
  faqSimilarity: number;                // average pairwise Jaccard between FAQ answer token sets
  duplicateWordRunCount: number;        // number of maximal runs of 2+ identical consecutive tokens
  duplicateTokenRatio: number;          // fraction of total tokens belonging to repeated token types
  largestRepeatedBlockLength: number;   // largest n where any n-gram appears 2+ times in content

  // Semantic coverage — SemanticMetricsProvider
  semanticKeywordCoverage: number;     // fraction of (primary + secondary) keywords found in content
  keywordVariantCoverage: number;      // fraction of semantic variants found in content
  topicCoverage: number;               // fraction of all 4 cluster slots with ≥1 mention
  entityCoverage: number;              // fraction of local intel entities found in content
  conceptCount: number;                // total concept-phrase occurrences across all types
  uniqueConceptCount: number;          // distinct concept phrases found ≥1 time
  conceptDensity: number;              // conceptCount per 100 content words
  conceptDiversity: number;            // uniqueConceptCount / totalConceptsAvailable
  conceptRedundancy: number;           // 1 − (uniqueConceptCount / conceptCount), 0 if empty
  semanticClusterCount: number;        // number of non-empty cluster types defined
  semanticClusterCoverage: number;     // fraction of non-empty clusters with ≥1 mention
  headingSemanticCoverage: number;     // fraction of headings containing ≥1 concept
  introSemanticCoverage: number;       // fraction of intro paragraphs containing ≥1 concept
  faqSemanticCoverage: number;         // fraction of FAQ items containing ≥1 concept
  sectionSemanticCoverage: number;     // fraction of all content segments (paras + headings + FAQ) with ≥1 concept
  entityDistribution: number;          // fraction of content zones (intro/headings/faq) with ≥1 entity
  topicDistribution: number;           // fraction of clusters that appear in ≥2 content zones
  phraseVariationScore: number;        // fraction of secondary/variant concepts co-occurring with primary in ≥1 sentence
  coOccurrenceCount: number;           // total distinct concept pairs co-occurring within the same sentence
  coOccurrenceDensity: number;         // coOccurrenceCount / total sentence count
  semanticConsistency: number;         // fraction of content sections referencing ≥1 primary-cluster term
  semanticTransitionScore: number;     // fraction of consecutive intro paragraph pairs sharing ≥1 concept
  entityReuseRatio: number;            // (totalEntityOccurrences − uniqueEntitiesFound) / totalEntityOccurrences
  variantReuseRatio: number;           // (totalVariantOccurrences − variantsFound) / totalVariantOccurrences
  semanticGapCount: number;            // number of non-empty clusters with 0 mentions
  semanticOverlapRatio: number;        // fraction of found concepts that appear in ≥2 content zones

  // Duplicate detection — legacy (inter-page, production engine)
  duplicateRisk: DuplicateRisk;
  duplicateTitle: boolean;
  duplicateMeta: boolean;
  duplicateH1: boolean;
  duplicateIntro: boolean;
  duplicateFaq: boolean;
  contentHashCollision: boolean;
  duplicateFieldCount: number;

  // Template repetition
  templateSentenceCount: number;
  templateSentenceRatio: number;
  sectionOpenerVariance: number;

  // AI pattern signals — legacy (owned by AIPatternMetricsProvider below)
  aiPhraseCount: number;
  aiPhraseRatio: number;

  // AI pattern signals — AIPatternMetricsProvider (extended)
  aiPhraseDensity: number;             // aiPhraseCount per 100 words
  aiTransitionPhraseCount: number;     // AI-connector phrase occurrences (additionally, furthermore…)
  aiHedgingPhraseCount: number;        // epistemic hedge phrase occurrences (it is important to note…)
  aiMarketingPhraseCount: number;      // marketing superlative phrase occurrences
  templatePhraseCount: number;         // occurrences from stock + conclusion phrase lists combined
  stockPhraseCount: number;            // occurrences from stock AI phrase list specifically
  genericClaimCount: number;           // generic claim phrase occurrences (easy to use, high quality…)
  repetitiveOpeningCount: number;      // distinct sentence-opening patterns shared by ≥2 sentences
  repetitiveClosingCount: number;      // distinct sentence-closing patterns shared by ≥2 sentences
  sentenceLengthUniformity: number;    // 1/(1+CV) of sentence word counts; 1=all same length
  paragraphLengthUniformity: number;   // 1/(1+CV) of paragraph word counts
  headingLengthUniformity: number;     // 1/(1+CV) of heading word counts
  lexicalBurstiness: number;           // CV of word-frequency distribution (high=few words dominate)
  paragraphBurstiness: number;         // CV of paragraph word counts (raw spread)
  vocabularyRepetition: number;        // fraction of tokens belonging to word types used more than once
  templateParagraphCount: number;      // paragraphs containing ≥1 phrase from any AI-pattern dictionary
  passiveVoiceProxy: number;           // fraction of sentences containing a passive construction proxy
  listHeavyRatio: number;              // fraction of intro paragraphs that are list-heavy
  conclusionPatternCount: number;      // occurrences of conclusion-opening patterns
  callToActionPatternCount: number;    // occurrences of CTA patterns
  exclamationDensity: number;          // exclamation marks per 100 words
  questionDensity: number;             // question marks per 100 words
  repetitionRisk: number;              // composite 0-1 score combining uniformity + vocabulary + AI signals
  humanVariationScore: number;         // 1 − repetitionRisk
  transitionOveruseScore: number;      // fraction of sentences containing ≥1 AI transition phrase
  openingVariationScore: number;       // unique sentence openings / total sentences
  closingVariationScore: number;       // unique sentence closings / total sentences
  averageSentenceVariance: number;     // variance of sentence word counts (words²)
  averageParagraphVariance: number;    // variance of paragraph word counts (words²)

  // Transition quality
  transitionWordCount: number;   // total transition word occurrences
  transitionDensity: number;     // transitions per 100 words
  transitionCoverage: number;    // fraction of paragraphs containing a transition word

  // Local authenticity — legacy (production engine)
  localAuthenticityScore: number;
  genericPhraseCount: number;
  genericPhraseRatio: number;

  // Local authenticity — LocalAuthenticityMetricsProvider
  localReferenceCount: number;              // total entity mention occurrences across all content
  uniqueLocalReferenceCount: number;        // distinct entities mentioned at least once
  duplicateLocalReferenceCount: number;     // entities mentioned more than once
  districtMentionCount: number;             // mentions of dbAreas entries
  landmarkMentionCount: number;             // mentions of landmarks + historicMonuments
  transportMentionCount: number;            // airports + railwayStations + busStands total
  airportMentionCount: number;
  railwayStationMentionCount: number;
  busStandMentionCount: number;
  shoppingMallMentionCount: number;
  marketMentionCount: number;               // markets[]
  businessDistrictMentionCount: number;
  techParkMentionCount: number;             // itParks[]
  touristAreaMentionCount: number;          // touristAttractions + beachesLakesParks
  festivalMentionCount: number;
  localCuisineMentionCount: number;         // foodStreets[]
  hotelAreaMentionCount: number;            // hotels + businessHotels + resorts
  luxuryAreaMentionCount: number;           // luxuryAreas + premiumResidentialAreas
  neighborhoodCoverage: number;             // fraction of dbAreas mentioned at least once
  geographicSpread: number;                 // fraction of non-empty category arrays with ≥1 mention
  introLocalReferenceCount: number;         // local entity mentions in introContent
  faqLocalReferenceCount: number;           // local entity mentions across all FAQ text
  headingLocalReferenceCount: number;       // local entity mentions in h1
  sectionLocalReferenceCoverage: number;    // fraction of FAQ items with ≥1 local ref
  curatedReferenceCount: number;            // total mentions when source is "curated"
  generatedReferenceCount: number;          // total mentions when source is "geo_generated"/"city_context"
  localEntityDensity: number;               // localReferenceCount per 100 words of content
  locationMentionFrequency: number;         // avg mentions per unique entity
  referenceDistributionScore: number;       // fraction of content zones (intro/h1/faq) with ≥1 ref
  referenceEntropy: number;                 // normalised Shannon entropy across category mention counts
  referenceRedundancy: number;              // 1 − (uniqueLocalReferenceCount / localReferenceCount)
  cityNameOccurrences: number;              // occurrences of the city name in full content
  primaryLocationCoverage: number;          // fraction of luxuryAreas + businessDistricts mentioned
  secondaryLocationCoverage: number;        // fraction of landmarks + touristAttractions mentioned

  // Freshness
  daysSinceGeneration: number | null;
  generationAttempt: number;
}

// ─── Provider ──────────────────────────────────────────────────────────────────

export type CacheScope = "request" | "run" | "process" | "none";
export type EstimatedCost = "fast" | "medium" | "slow";

export interface CacheStrategy {
  readonly scope: CacheScope;
  readonly ttlMs: number | null;
  readonly keyFields: string[];
  readonly estimatedMemoryBytes: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface InternalLink {
  anchor: string;
  href: string;
  rel?: string | null;  // e.g. "nofollow", "noopener", "sponsored"
}

export interface SeoPageSnapshot {
  id?: string;
  pageType: string;
  pageSlug: string;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  introContent?: string | null;
  faqText?: string | null;
}

export interface CityIntelSnapshot {
  city: string;
  areas: string[];
  landmarks: string[];
  transportHubs: string[];
  businessDistricts: string[];
}

/**
 * Rich local intelligence snapshot — mirrors LocalIntelligence from seo-local-intelligence.ts.
 * All arrays are optional so callers can pass partial data without runtime errors.
 * Used by LocalAuthenticityMetricsProvider.
 */
export interface LocalIntelSnapshot {
  city: string;
  slug?: string;
  source?: "curated" | "city_context" | "geo_generated";
  // Areas
  luxuryAreas?: string[];
  premiumResidentialAreas?: string[];
  dbAreas?: string[];                    // DB-sourced area / district names
  // Accommodation
  hotels?: string[];
  businessHotels?: string[];
  resorts?: string[];
  // Transport
  airports?: string[];
  railwayStations?: string[];
  busStands?: string[];
  // Commerce & business
  shoppingMalls?: string[];
  markets?: string[];
  itParks?: string[];                    // tech parks
  businessDistricts?: string[];
  industrialZones?: string[];
  // Tourism & culture
  landmarks?: string[];
  historicMonuments?: string[];
  touristAttractions?: string[];
  beachesLakesParks?: string[];
  // Food & entertainment
  foodStreets?: string[];
  nightlife?: string[];
  // Events
  festivals?: string[];
  // Nearby
  nearbyCities?: Array<{ name: string; slug: string }>;
}

export interface PageContext {
  pageType: string;
  pageSlug: string;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  attempt: number;
}

export interface HreflangEntry {
  lang: string;
  href: string;
}

export interface AlternateLink {
  rel: string;
  href: string;
}

export interface MetricsCollectorInput {
  // Core content
  introContent: string;
  faqItems: FaqItem[];

  // Core metadata (required — always present in pipeline output)
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  featuredImage: string | null;
  imageAlt: string | null;
  structuredData: string | null;     // JSON-LD as a JSON string

  // Links & keywords
  internalLinks: InternalLink[];
  primaryKeyword: string | null;
  secondaryKeywords: string[];

  // Peer pages for duplicate detection
  peerPages: SeoPageSnapshot[];

  // Local intelligence
  cityIntel: CityIntelSnapshot | null;
  localIntel?: LocalIntelSnapshot | null;  // rich LocalIntelligence snapshot for authenticity metrics

  // Page context
  pageContext: PageContext;

  // Extended metadata — optional; callers provide when available
  robots?: string | null;                                 // <meta name="robots" content="...">
  openGraphTags?: Record<string, string> | null;          // og:title, og:description, og:image …
  twitterTags?: Record<string, string> | null;            // twitter:card, twitter:title …
  hreflangEntries?: HreflangEntry[] | null;               // <link rel="alternate" hreflang="…">
  alternateLinks?: AlternateLink[] | null;                // <link rel="alternate" …> (non-hreflang)
  viewportMeta?: string | null;                           // <meta name="viewport" content="…">
  charsetMeta?: string | null;                            // <meta charset="…"> value
  faviconHref?: string | null;                            // href of <link rel="icon">
  manifestHref?: string | null;                           // href of <link rel="manifest">
  semanticVariants?: string[] | null;                     // caller-supplied semantic variant list
  headings?: string[] | null;                             // H2/H3/H4 text extracted by caller
}

/**
 * Contract for every metrics provider.
 * Providers are synchronous and pure — no DB calls, no side effects.
 * Each provider owns a slice of QualityMetrics.
 */
export interface MetricsProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly version: string;
  readonly executionOrder: number;
  readonly dependencies: ProviderId[];
  readonly estimatedCost: EstimatedCost;
  readonly cacheStrategy: CacheStrategy;
  readonly outputFields: (keyof QualityMetrics)[];

  provide(
    input: MetricsCollectorInput,
    priorMetrics: Partial<QualityMetrics>,
  ): Partial<QualityMetrics>;
}

// ─── Rules ─────────────────────────────────────────────────────────────────────

export interface RuleEvaluationOutcome {
  triggered: boolean;
  penaltyApplied: number;
  evidence: Record<string, unknown>;
}

export interface QualityRule {
  readonly id: RuleId;
  readonly name: string;
  readonly description: string;
  readonly severity: Severity;
  readonly enabled: boolean;
  readonly defaultPenalty: number;
  readonly maxPenalty: number;
  readonly applicableProfiles: ProfileId[];
  readonly tags: string[];
  evaluator(metrics: QualityMetrics): RuleEvaluationOutcome;
}

export interface ModuleRecommendation {
  severity: Severity;
  code: string;
  message: string;
  field: string | null;
}

export interface RuleEvaluationResult {
  ruleId: RuleId;
  triggered: boolean;
  severity: Severity;
  penaltyApplied: number;
  recommendation: ModuleRecommendation | null;
  evidence: Record<string, unknown>;
}

export interface RuleRegistry {
  register(rule: QualityRule): void;
  evaluate(metrics: QualityMetrics, profileId: ProfileId): RuleEvaluationResult[];
  getRule(id: RuleId): QualityRule | undefined;
  getRulesForProfile(profileId: ProfileId): QualityRule[];
  list(): QualityRule[];
  exists(id: RuleId): boolean;
}

// ─── Scoring Profile ───────────────────────────────────────────────────────────

export interface GradeThreshold {
  label: GradeLabel;
  minScore: number;
}

export interface PenaltyRule {
  id: string;
  description: string;
  evaluate(metrics: QualityMetrics): number;
  maxPenalty: number;
}

export interface ModuleWeight {
  moduleId: ModuleId;
  weight: number;
  enabled: boolean;
}

export interface ProfileThresholds {
  minWordCount: number;
  minQualityScore: number;
  minUniqueness: number;
  maxTemplateSentenceRatio: number;
  maxAiPhraseRatio: number;
  minLocalEntityDensity: number;
}

export interface ScoringProfile {
  readonly id: ProfileId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly pageTypes: string[];
  readonly modules: ModuleWeight[];
  readonly penalties: PenaltyRule[];
  readonly thresholds: ProfileThresholds;
  readonly gradeScale: GradeThreshold[];
  readonly metadata: {
    createdAt: string;
    author: string;
    changelog: string;
  };
}

export interface ProfileRegistry {
  register(profile: ScoringProfile): void;
  get(id: ProfileId): ScoringProfile | undefined;
  resolve(pageType: string, override?: ProfileId): ScoringProfile;
  list(): ScoringProfile[];
  exists(id: ProfileId): boolean;
}

// ─── Scorer Modules ────────────────────────────────────────────────────────────

export interface ModuleBreakdown {
  [key: string]: number | boolean | string | null;
}

export interface ModuleContext {
  metrics: QualityMetrics;
  profile: ScoringProfile;
  pageContext: PageContext;
  ruleResults: RuleEvaluationResult[];
  priorModuleScores: ModuleScoreSummary[];
}

export interface ModuleResult {
  moduleId: ModuleId;
  score: number;
  maxScore: number;
  normalizedScore: number;
  confidence: number;
  breakdown: ModuleBreakdown;
  recommendations: ModuleRecommendation[];
  warnings: ModuleRecommendation[];
  executionMs: number;
  lifecycleState: ModuleLifecycleState;
}

export interface ScorerModule {
  readonly id: ModuleId;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly priority: number;
  readonly requiredMetrics: (keyof QualityMetrics)[];
  readonly dependsOnModules: ModuleId[];
  score(context: ModuleContext): ModuleResult;
}

export interface ModuleScoreSummary {
  moduleId: ModuleId;
  moduleName: string;
  score: number;
  maxScore: number;
  normalizedScore: number;
  confidence: number;
  warnings: ModuleRecommendation[];
}

// ─── Score Explanation ─────────────────────────────────────────────────────────

export interface ImproveHint {
  priority: "high" | "medium" | "low";
  field: string;
  action: string;
  estimatedGain: number;
  ruleId: string | null;
}

export interface ScoreExplanationLine {
  label: string;
  delta: number;
  type: "module" | "penalty" | "bonus";
  moduleId: string | null;
  ruleId: string | null;
  detail: string;
  confidence: number;
}

export interface ScoreExplanation {
  finalScore: number;
  grade: GradeLabel;
  lines: ScoreExplanationLine[];
  summary: string;
  improveHints: ImproveHint[];
}

export interface PenaltySummary {
  penaltyId: string;
  description: string;
  applied: number;
}

// ─── Scoring Result ────────────────────────────────────────────────────────────

export interface ScoringResult {
  pageType: string;
  pageSlug: string;
  profileId: ProfileId;
  profileVersion: string;
  scoringEngineVersion: string;

  finalScore: number;
  prepenaltyScore: number;
  grade: GradeLabel;
  moduleScores: ModuleScoreSummary[];
  penalties: PenaltySummary[];
  totalPenalty: number;

  metrics: QualityMetrics;
  explanation: ScoreExplanation;

  recommendations: ModuleRecommendation[];
  warnings: ModuleRecommendation[];

  failedModules: ModuleId[];
  skippedModules: ModuleId[];

  executionMs: number;
  moduleTimings: Record<ModuleId, number>;

  scoredAt: string;
  metricsSchemaVersion: string;
}

// ─── Observability ─────────────────────────────────────────────────────────────

export interface QualityObserver {
  onEvent(event: string, payload: Record<string, unknown>): void;
  onMetric(name: string, value: number, tags: Record<string, string>): void;
}

// ─── Validation ────────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning";

export interface ValidationError {
  code: string;
  severity: ValidationSeverity;
  message: string;
  context: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ─── Engine ────────────────────────────────────────────────────────────────────

export interface ProfileComparisonResult {
  profileA: ScoringResult;
  profileB: ScoringResult;
  scoreDelta: number;
  gradeDelta: string;
  moduleDeltas: Array<{
    moduleId: ModuleId;
    scoreDelta: number;
    weightDelta: number;
  }>;
}

export interface ExecutionContext {
  input: MetricsCollectorInput;
  profile: ScoringProfile;
  metrics: QualityMetrics;
  ruleResults: RuleEvaluationResult[];
  moduleResults: ModuleResult[];
  startedAt: number;
}

export interface QualityEngineConfig {
  modules: ScorerModule[];
  profiles: ScoringProfile[];
  providers: MetricsProvider[];
  rules: QualityRule[];
  observer?: QualityObserver;
  metricsSchemaVersion: string;
  engineVersion: string;
}
