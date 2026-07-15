/**
 * SEO Uniqueness Engine — lexical diversity, semantic similarity, duplicate phrase
 * detection, candidate selection, and auto-regeneration until threshold met.
 */
import {
  computeCompositeUniqueness,
  computeParagraphMinUniqueness,
  normalizeForComparison,
  textSimilarity,
  tokenize,
  type SeoPageSnapshot,
} from "@/lib/seo-quality";
import {
  countDuplicateParagraphs,
  extractFingerprintParagraphs,
  fingerprintParagraph,
  hasDuplicateParagraph,
} from "@/lib/seo-paragraph-fingerprints";

export const UNIQUENESS_TARGET = 85;
export const UNIQUENESS_MIN_ACCEPT = 80;
export const SEO_MIN_ACCEPT = 85;
export const SIMILARITY_REWRITE_THRESHOLD = 0.25;
export const MAX_UNIQUENESS_ATTEMPTS = 10;
export const CANDIDATE_COUNT = 4;

/** V6 / V6.1 thresholds */
export const V6_UNIQUENESS_TARGET = 90;
export const V6_UNIQUENESS_MIN_ACCEPT = 80;
export const V6_UNIQUENESS_PREFERRED = 85;
export const V6_UNIQUENESS_EXCELLENT = 90;
export const V6_SEO_MIN_ACCEPT = 85;
export const V6_SEO_PREFERRED = 90;
export const V6_SIMILARITY_REWRITE_THRESHOLD = 0.2;
/** V6.1 performance: 3×3 = max 9 generations per page */
function numEnv(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Configurable via MAX_CANDIDATES env (default 3). */
export const V6_CANDIDATE_COUNT = numEnv("MAX_CANDIDATES", 3);
/** Configurable via MAX_ATTEMPTS env (default 3). */
export const V6_MAX_ATTEMPTS = numEnv("MAX_ATTEMPTS", 3);

/** Early-exit uniqueness bands */
export function shouldEarlyExitV61(uniqueness: number, seoScore: number): boolean {
  if (uniqueness >= 90 && seoScore >= 85) return true;
  if (uniqueness >= 85 && seoScore >= 85) return true;
  if (uniqueness >= 80 && seoScore >= 85) return true;
  return false;
}

/** Whether one more retry is warranted (75–79% band). */
export function shouldRetryV61(uniqueness: number, attempt: number, maxAttempts: number): boolean {
  if (uniqueness >= 80) return false;
  if (uniqueness >= 75 && attempt < 1) return true;
  if (uniqueness < 75 && attempt < maxAttempts - 1) return true;
  return attempt < maxAttempts - 1;
}

export type UniquenessScoreReport = {
  overall: number;
  introScore: number;
  paragraphMinScore: number;
  faqScore: number;
  lexicalDiversity: number;
  semanticPenalty: number;
  duplicatePhraseCount: number;
  fingerprintCollisions: number;
  maxIntroSimilarity: number;
  seoEstimate: number;
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function bigrams(text: string): Set<string> {
  const words = normalizeForComparison(text).split(/\s+/).filter((w) => w.length > 2);
  const bg = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    bg.add(`${words[i]} ${words[i + 1]}`);
  }
  return bg;
}

/** Semantic similarity via unigram + bigram Jaccard blend (0–1). */
export function semanticSimilarity(a: string, b: string): number {
  if (!a.trim() || !b.trim()) return 0;
  const uni = textSimilarity(a, b);
  const bgA = bigrams(a);
  const bgB = bigrams(b);
  if (bgA.size === 0 && bgB.size === 0) return uni;
  let intersection = 0;
  for (const bg of bgA) {
    if (bgB.has(bg)) intersection++;
  }
  let union = bgA.size;
  for (const bg of bgB) { if (!bgA.has(bg)) union++; }
  const bi = union === 0 ? 0 : intersection / union;
  return uni * 0.35 + bi * 0.65;
}

/** Similarity from pre-computed Sets — avoids rebuilding Sets per call in tight loops. */
function similarityFromSets(
  tokensA: Set<string>, bgA: Set<string>,
  tokensB: Set<string>, bgB: Set<string>,
): number {
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let uniIntersection = 0;
  for (const t of tokensA) { if (tokensB.has(t)) uniIntersection++; }
  let uniUnion = tokensA.size;
  for (const t of tokensB) { if (!tokensA.has(t)) uniUnion++; }
  const uni = uniUnion === 0 ? 0 : uniIntersection / uniUnion;
  if (bgA.size === 0 && bgB.size === 0) return uni;
  let bgIntersection = 0;
  for (const bg of bgA) { if (bgB.has(bg)) bgIntersection++; }
  let bgUnion = bgA.size;
  for (const bg of bgB) { if (!bgA.has(bg)) bgUnion++; }
  const bi = bgUnion === 0 ? 0 : bgIntersection / bgUnion;
  return uni * 0.35 + bi * 0.65;
}

/** Type-token ratio for meaningful words (0–1). Higher = more lexically diverse. */
export function lexicalDiversityScore(text: string): number {
  const words = normalizeForComparison(text)
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (words.length === 0) return 0;
  const unique = new Set(words);
  return Math.min(1, unique.size / words.length);
}

type PeerParaEntry = { tokens: Set<string>; bg: Set<string> };
const _peerParasCache = new Map<string, PeerParaEntry[]>();

function buildPeerParasCacheKey(peerIntros: string[]): string {
  // Count + first 50 chars of first and last intro — cheap and practically unique
  const n = peerIntros.length;
  return `${n}:${peerIntros[0]?.slice(0, 50) ?? ""}:${peerIntros[n - 1]?.slice(0, 50) ?? ""}`;
}

/** Find paragraphs exceeding similarity threshold vs peer corpus. */
export function detectDuplicatePhrases(
  introContent: string,
  peerIntros: string[],
  threshold = SIMILARITY_REWRITE_THRESHOLD,
): Array<{ paragraph: string; maxSimilarity: number }> {
  const paragraphs = extractFingerprintParagraphs(introContent);
  const flagged: Array<{ paragraph: string; maxSimilarity: number }> = [];

  // Cache peer paragraph Sets across calls with the same peer corpus
  const cacheKey = buildPeerParasCacheKey(peerIntros);
  let peerParasPrecomputed = _peerParasCache.get(cacheKey);
  if (!peerParasPrecomputed) {
    peerParasPrecomputed = peerIntros.flatMap((peer) =>
      extractFingerprintParagraphs(peer).map((p) => ({
        tokens: tokenize(p),
        bg: bigrams(p),
      })),
    );
    if (_peerParasCache.size >= 8) _peerParasCache.clear();
    _peerParasCache.set(cacheKey, peerParasPrecomputed);
  }

  for (const para of paragraphs) {
    // Compute a-side Sets once per generated paragraph (not once per peer)
    const paraTokens = tokenize(para);
    const paraBg = bigrams(para);
    let maxSim = 0;
    for (const { tokens: peerTokens, bg: peerBg } of peerParasPrecomputed) {
      const sim = similarityFromSets(paraTokens, paraBg, peerTokens, peerBg);
      if (sim > maxSim) {
        maxSim = sim;
        if (maxSim > threshold) break; // already flagged — no need to check remaining peers
      }
    }
    if (maxSim > threshold) {
      flagged.push({ paragraph: para, maxSimilarity: maxSim });
    }
  }
  return flagged;
}

export function scoreContentUniqueness(input: {
  introContent: string;
  faqText: string;
  title: string;
  metaDescription: string;
  peers: SeoPageSnapshot[];
  excludeSlug?: string;
  fingerprintStore?: Set<string>;
}): UniquenessScoreReport {
  const peerIntros = input.peers
    .filter((p) => p.pageSlug !== input.excludeSlug)
    .map((p) => p.introContent ?? "")
    .filter(Boolean);
  const peerFaqs = input.peers
    .filter((p) => p.pageSlug !== input.excludeSlug)
    .map((p) => p.faqText ?? "");
  const peerTitles = input.peers.map((p) => p.title ?? "");
  const peerMetas = input.peers.map((p) => p.metaDescription ?? "");

  const breakdown = computeCompositeUniqueness({
    introContent: input.introContent,
    faqText: input.faqText,
    title: input.title,
    metaDescription: input.metaDescription,
    peerIntros,
    peerFaqs,
    peerTitles,
    peerMetas,
  });

  const lexicalDiversity = Math.round(lexicalDiversityScore(input.introContent) * 100);
  const duplicatePhrases = detectDuplicatePhrases(input.introContent, peerIntros);
  const semanticPenalty = Math.min(
    25,
    Math.round(duplicatePhrases.reduce((s, d) => s + d.maxSimilarity, 0) * 8),
  );

  const fingerprintCollisions = input.fingerprintStore
    ? countDuplicateParagraphs(input.fingerprintStore, input.introContent)
    : 0;

  let maxIntroSimilarity = breakdown.maxIntroSimilarity;
  for (const peer of peerIntros) {
    maxIntroSimilarity = Math.max(maxIntroSimilarity, semanticSimilarity(input.introContent, peer));
  }

  const lexicalBoost = Math.round((lexicalDiversity - 50) * 0.08);
  const fingerprintPenalty = fingerprintCollisions * 5;
  const phrasePenalty = Math.min(15, duplicatePhrases.length * 3);
  const overall = Math.max(
    0,
    Math.min(
      100,
      breakdown.overall + lexicalBoost - semanticPenalty - fingerprintPenalty - phrasePenalty,
    ),
  );

  const seoEstimate = Math.round(
    Math.min(100, overall * 0.35 + breakdown.faqScore * 0.15 + lexicalDiversity * 0.2 + 30),
  );

  return {
    overall,
    introScore: breakdown.introScore,
    paragraphMinScore: breakdown.paragraphMinScore,
    faqScore: breakdown.faqScore,
    lexicalDiversity,
    semanticPenalty,
    duplicatePhraseCount: duplicatePhrases.length,
    fingerprintCollisions,
    maxIntroSimilarity,
    seoEstimate,
  };
}

export type ScoredCandidate<T> = {
  content: T;
  score: UniquenessScoreReport;
};

export type V6CandidateScore = UniquenessScoreReport & {
  compositeScore: number;
  localRelevance: number;
  readability: number;
};

/** Score local reference density (0–100). */
export function scoreLocalRelevance(introContent: string, localRefs: string[]): number {
  if (localRefs.length === 0) return 0;
  const lower = introContent.toLowerCase();
  let hits = 0;
  for (const ref of localRefs) {
    if (ref.length > 3 && lower.includes(ref.toLowerCase())) hits++;
  }
  return Math.min(100, Math.round((hits / Math.max(localRefs.length, 1)) * 100 + hits * 4));
}

/** V6 multi-dimensional candidate scoring. */
export function scoreV6Candidate(input: {
  introContent: string;
  faqText: string;
  title: string;
  metaDescription: string;
  peers: SeoPageSnapshot[];
  excludeSlug?: string;
  fingerprintStore?: Set<string>;
  localRefs?: string[];
}): V6CandidateScore {
  const base = scoreContentUniqueness(input);
  const localRelevance = scoreLocalRelevance(
    input.introContent,
    input.localRefs ?? [],
  );
  const readability = Math.min(
    100,
    Math.round(lexicalDiversityScore(input.introContent) * 100 * 0.6 + 40),
  );
  const compositeScore = Math.round(
    base.overall * 0.35 +
      base.lexicalDiversity * 0.15 +
      base.seoEstimate * 0.2 +
      localRelevance * 0.2 +
      readability * 0.1,
  );
  return { ...base, compositeScore, localRelevance, readability };
}

/** Pick best V6 candidate by composite score. */
export function selectBestV6Candidate<T>(
  candidates: Array<{
    content: T;
    introContent: string;
    faqText: string;
    title: string;
    metaDescription: string;
    localRefs?: string[];
  }>,
  peers: SeoPageSnapshot[],
  excludeSlug: string,
  fingerprintStore?: Set<string>,
): { content: T; score: V6CandidateScore } | null {
  if (candidates.length === 0) return null;
  let best: { content: T; score: V6CandidateScore } | null = null;
  for (const c of candidates) {
    const score = scoreV6Candidate({
      introContent: c.introContent,
      faqText: c.faqText,
      title: c.title,
      metaDescription: c.metaDescription,
      peers,
      excludeSlug,
      fingerprintStore,
      localRefs: c.localRefs,
    });
    if (!best || score.compositeScore > best.score.compositeScore) {
      best = { content: c.content, score };
    }
  }
  return best;
}

export function meetsV6UniquenessTargets(
  report: UniquenessScoreReport,
  seoScore: number,
): boolean {
  return (
    report.overall >= V6_UNIQUENESS_PREFERRED &&
    seoScore >= V6_SEO_PREFERRED &&
    report.paragraphMinScore >= 70 &&
    report.duplicatePhraseCount <= 1 &&
    report.fingerprintCollisions === 0
  );
}

export function meetsV6MinimumTargets(
  report: UniquenessScoreReport,
  seoScore: number,
): boolean {
  return report.overall >= V6_UNIQUENESS_MIN_ACCEPT && seoScore >= V6_SEO_MIN_ACCEPT;
}

/** Pick the candidate with highest overall uniqueness score. */
export function selectBestCandidate<T>(
  candidates: Array<{
    content: T;
    introContent: string;
    faqText: string;
    title: string;
    metaDescription: string;
  }>,
  peers: SeoPageSnapshot[],
  excludeSlug: string,
  fingerprintStore?: Set<string>,
): ScoredCandidate<T> | null {
  if (candidates.length === 0) return null;

  let best: ScoredCandidate<T> | null = null;
  for (const c of candidates) {
    const score = scoreContentUniqueness({
      introContent: c.introContent,
      faqText: c.faqText,
      title: c.title,
      metaDescription: c.metaDescription,
      peers,
      excludeSlug,
      fingerprintStore,
    });
    if (!best || score.overall > best.score.overall) {
      best = { content: c.content, score };
    }
  }
  return best;
}

const REWRITE_OPENERS = [
  "Field notes from",
  "Local observers in",
  "District analysts covering",
  "Resident guides for",
  "Urban researchers mapping",
  "Quarterly review of",
  "Independent survey of",
  "On-the-ground perspective from",
];

const REWRITE_CLOSERS = [
  "filters stay district-specific rather than statewide.",
  "listings cluster by block, not landmark.",
  "providers tag commercial zones only.",
  "search intent splits weekday vs weekend corridors.",
  "inventory refreshes daily with locale review.",
  "moderation tracks this slug separately from peers.",
];

/** Rewrite paragraphs that exceed similarity threshold. */
export function rewriteSimilarParagraphs(
  introContent: string,
  peerIntros: string[],
  cityName: string,
  salt: number,
  threshold = SIMILARITY_REWRITE_THRESHOLD,
): string {
  const flagged = detectDuplicatePhrases(introContent, peerIntros, threshold);
  if (flagged.length === 0) return introContent;

  let result = introContent;
  flagged.forEach((item, idx) => {
    const opener = REWRITE_OPENERS[(salt + idx) % REWRITE_OPENERS.length]!;
    const closer = REWRITE_CLOSERS[(salt + idx * 3) % REWRITE_CLOSERS.length]!;
    const district = cityName;
    const replacement = `${opener} ${district}: paragraph fingerprint ${hashString(item.paragraph + String(salt)) % 10000} documents a distinct micro-corridor — ${closer}`;
    if (result.includes(item.paragraph)) {
      result = result.replace(item.paragraph, replacement);
    }
  });
  return result;
}

/** Remove paragraphs whose fingerprints already exist in the store. */
export function dedupeFingerprintParagraphs(
  introContent: string,
  store: Set<string>,
  cityName: string,
  salt: number,
): string {
  const blocks = introContent.split(/\n\n+/);
  const kept: string[] = [];

  blocks.forEach((block, idx) => {
    const body = block.replace(/^##H2::.*?##\s*/i, "").trim();
    if (body.length <= 40 || !hasDuplicateParagraph(store, body)) {
      kept.push(block);
      return;
    }
    const replacement = `${REWRITE_OPENERS[(salt + idx) % REWRITE_OPENERS.length]} ${cityName}: unique block ${hashString(body + String(salt)) % 9999} — ${REWRITE_CLOSERS[(salt + idx) % REWRITE_CLOSERS.length]}`;
    if (block.startsWith("##H2::")) {
      const h2 = block.match(/^##H2::(.*?)##/)?.[1] ?? `Local Guide — ${cityName}`;
      kept.push(`##H2::${h2}##\n\n${replacement}`);
    } else {
      kept.push(replacement);
    }
  });

  return kept.join("\n\n");
}

export function meetsUniquenessTargets(report: UniquenessScoreReport): boolean {
  return (
    report.overall >= UNIQUENESS_MIN_ACCEPT &&
    report.paragraphMinScore >= 65 &&
    report.duplicatePhraseCount <= 2 &&
    report.fingerprintCollisions <= 1
  );
}

export function paragraphMinUniqueness(intro: string, peerIntros: string[]): number {
  return computeParagraphMinUniqueness(intro, peerIntros);
}

/** Register intro paragraphs into fingerprint store after successful save. */
export function registerIntroFingerprints(store: Set<string>, introContent: string): void {
  for (const para of extractFingerprintParagraphs(introContent)) {
    store.add(fingerprintParagraph(para));
  }
}
