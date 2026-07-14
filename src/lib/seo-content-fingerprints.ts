/**
 * V6.1 — Section-level fingerprinting + semantic duplicate detection.
 */
import { fingerprintParagraph } from "@/lib/seo-paragraph-fingerprints";
import { semanticSimilarity } from "@/lib/seo-uniqueness-engine";
import { normalizeForComparison } from "@/lib/seo-quality";

export const SECTION_SIMILARITY_THRESHOLD = 0.2;

export type ContentSection = "title" | "meta" | "h1" | "paragraph" | "faq_question" | "faq_answer" | "cta" | "conclusion";

export type SectionConflict = {
  section: ContentSection;
  index?: number;
  text: string;
  conflictSlug: string;
  similarityPct: number;
};

export function fingerprintSection(text: string): string {
  return fingerprintParagraph(text);
}

export function detectSectionConflicts(input: {
  title: string;
  metaDescription: string;
  h1: string;
  introContent: string;
  faqs: Array<{ question: string; answer: string }>;
  peers: Array<{
    pageSlug: string;
    title?: string | null;
    metaDescription?: string | null;
    h1?: string | null;
    introContent?: string | null;
    faqText?: string | null;
  }>;
  excludeSlug?: string;
  threshold?: number;
}): SectionConflict[] {
  const threshold = input.threshold ?? SECTION_SIMILARITY_THRESHOLD;
  const conflicts: SectionConflict[] = [];

  const check = (
    section: ContentSection,
    text: string,
    peerText: string,
    peerSlug: string,
    index?: number,
  ) => {
    if (!text.trim() || !peerText.trim()) return;
    const sim = semanticSimilarity(text, peerText);
    if (sim > threshold) {
      conflicts.push({
        section,
        index,
        text,
        conflictSlug: peerSlug,
        similarityPct: Math.round(sim * 100),
      });
    }
  };

  for (const peer of input.peers) {
    if (peer.pageSlug === input.excludeSlug) continue;
    check("title", input.title, peer.title ?? "", peer.pageSlug);
    check("meta", input.metaDescription, peer.metaDescription ?? "", peer.pageSlug);
    check("h1", input.h1, peer.h1 ?? "", peer.pageSlug);

    const blocks = input.introContent.split(/\n\n+/);
    const peerBlocks = (peer.introContent ?? "").split(/\n\n+/);
    blocks.forEach((block, i) => {
      const body = block.replace(/^##H2::.*?##\s*/i, "").trim();
      if (body.length < 40) return;
      for (const pb of peerBlocks) {
        const pbody = pb.replace(/^##H2::.*?##\s*/i, "").trim();
        if (pbody.length < 40) continue;
        check("paragraph", body, pbody, peer.pageSlug, i);
      }
    });

    const cta = blocks[blocks.length - 1] ?? "";
    const peerCta = peerBlocks[peerBlocks.length - 1] ?? "";
    if (cta.length > 30) check("cta", cta, peerCta, peer.pageSlug);

    input.faqs.forEach((faq, fi) => {
      check("faq_question", faq.question, peer.faqText ?? "", peer.pageSlug, fi);
    });
  }

  return conflicts.sort((a, b) => b.similarityPct - a.similarityPct);
}

/** Build fingerprint set from all sections for collision checks. */
export function buildSectionFingerprintSet(input: {
  title: string;
  metaDescription: string;
  h1: string;
  introContent: string;
  faqs: Array<{ question: string; answer: string }>;
}): Set<string> {
  const fps = new Set<string>();
  if (input.title.trim()) fps.add(fingerprintSection(input.title));
  if (input.metaDescription.trim()) fps.add(fingerprintSection(input.metaDescription));
  if (input.h1.trim()) fps.add(fingerprintSection(input.h1));
  for (const block of input.introContent.split(/\n\n+/)) {
    const body = block.replace(/^##H2::.*?##\s*/i, "").trim();
    if (body.length >= 40) fps.add(fingerprintSection(body));
  }
  for (const faq of input.faqs) {
    if (faq.question.length > 20) fps.add(fingerprintSection(faq.question));
    if (faq.answer.length > 40) fps.add(fingerprintSection(faq.answer));
  }
  return fps;
}

export function countFingerprintCollisions(fps: Set<string>, peerFps: Set<string>): number {
  let n = 0;
  for (const fp of fps) {
    if (peerFps.has(fp)) n++;
  }
  return n;
}

export function normalizeSectionKey(text: string): string {
  return normalizeForComparison(text).slice(0, 200);
}

/** Rewrite only sections that exceed the similarity threshold. */
export function applySectionConflictFixes(input: {
  title: string;
  metaDescription: string;
  h1: string;
  introContent: string;
  faqs: Array<{ question: string; answer: string }>;
  conflicts: SectionConflict[];
  cityName: string;
}): {
  title: string;
  metaDescription: string;
  h1: string;
  introContent: string;
  faqs: Array<{ question: string; answer: string }>;
  fixedCount: number;
} {
  let { title, metaDescription, h1, introContent, faqs } = input;
  let fixedCount = 0;

  if (input.conflicts.some((c) => c.section === "title")) {
    title = `${input.cityName} Verified Listings — ${title.replace(input.cityName, "").trim() || "Local Guide"}`;
    fixedCount++;
  }
  if (input.conflicts.some((c) => c.section === "meta") && metaDescription) {
    metaDescription = metaDescription.replace(/\.$/, "") + ` Updated for ${input.cityName} districts.`;
    fixedCount++;
  }
  if (input.conflicts.some((c) => c.section === "h1")) {
    h1 = `${input.cityName} — ${h1.replace(input.cityName, "").trim() || "Local Directory"}`;
    fixedCount++;
  }

  faqs = faqs.map((faq, i) => {
    const qConflict = input.conflicts.find((c) => c.section === "faq_question" && c.index === i);
    if (qConflict) {
      fixedCount++;
      return {
        question: `${input.cityName} local guide — ${faq.question.replace(/^.*—\s*/, "")}`,
        answer: faq.answer,
      };
    }
    const aConflict = input.conflicts.find((c) => c.section === "faq_answer" && c.index === i);
    if (aConflict && faq.answer.length > 40) {
      fixedCount++;
      return {
        question: faq.question,
        answer: faq.answer.replace(/\.$/, "") + ` (${input.cityName} specifics.)`,
      };
    }
    return faq;
  });

  const paraConflicts = input.conflicts.filter((c) => c.section === "paragraph" && c.index != null);
  if (paraConflicts.length > 0) {
    const blocks = introContent.split(/\n\n+/);
    for (const conflict of paraConflicts) {
      const idx = conflict.index!;
      if (idx >= 0 && idx < blocks.length) {
        const raw = blocks[idx]!;
        const h2Match = raw.match(/^(##H2::.*?##\s*)/i);
        const prefix = h2Match?.[1] ?? "";
        const body = raw.replace(/^##H2::.*?##\s*/i, "").trim();
        blocks[idx] = `${prefix}Around ${input.cityName}, ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
        fixedCount++;
      }
    }
    introContent = blocks.join("\n\n");
  }

  return { title, metaDescription, h1, introContent, faqs, fixedCount };
}
