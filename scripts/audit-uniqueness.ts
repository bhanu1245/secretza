/**
 * Audit uniqueness scores — measure similarity breakdown for sample cities.
 */
import { db } from "../src/lib/db";
import { generateCitySEO, resolveIntroContentForStorage } from "../src/lib/seo-content";
import {
  textSimilarity,
  computeUniquenessScore,
  normalizeForComparison,
} from "../src/lib/seo-quality";

const SAMPLES = ["agra", "ahmedabad", "mumbai"];

function splitParagraphs(text: string): string[] {
  return text.split(/\n\n+/).filter((p) => p.trim().length > 50);
}

async function main() {
  const peers = await db.seoPage.findMany({
    where: { pageType: "city" },
    select: {
      pageSlug: true,
      title: true,
      metaDescription: true,
      h1: true,
      introContent: true,
      faqs: { select: { question: true, answer: true } },
    },
  });

  const otherIntros = peers.map((p) => p.introContent ?? "").filter(Boolean);

  for (const slug of SAMPLES) {
    const city = peers.find((p) => p.pageSlug === slug);
    const intro = city?.introContent ?? "";
    const faqText = city?.faqs.map((f) => `${f.question} ${f.answer}`).join(" ") ?? "";

    let maxSim = 0;
    let worstPeer = "";
    for (const p of peers) {
      if (p.pageSlug === slug) continue;
      const sim = textSimilarity(intro, p.introContent ?? "");
      if (sim > maxSim) {
        maxSim = sim;
        worstPeer = p.pageSlug;
      }
    }

    const paragraphs = splitParagraphs(intro);
    const paraSims: Array<{ idx: number; max: number; peer: string; preview: string }> = [];
    for (let i = 0; i < paragraphs.length; i++) {
      let pMax = 0;
      let pPeer = "";
      for (const p of peers) {
        if (p.pageSlug === slug) continue;
        const ps = splitParagraphs(p.introContent ?? "");
        for (const op of ps) {
          const s = textSimilarity(paragraphs[i]!, op);
          if (s > pMax) {
            pMax = s;
            pPeer = p.pageSlug;
          }
        }
      }
      paraSims.push({
        idx: i,
        max: Math.round(pMax * 100),
        peer: pPeer,
        preview: paragraphs[i]!.slice(0, 80) + "…",
      });
    }

    // FAQ similarity
    let maxFaqSim = 0;
    let worstFaqPeer = "";
    for (const p of peers) {
      if (p.pageSlug === slug) continue;
      const otherFaq = p.faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
      const s = textSimilarity(faqText, otherFaq);
      if (s > maxFaqSim) {
        maxFaqSim = s;
        worstFaqPeer = p.pageSlug;
      }
    }

    console.log(`\n=== ${slug.toUpperCase()} ===`);
    console.log(`Uniqueness score: ${computeUniquenessScore(intro, otherIntros.filter((_, i) => peers[i]?.pageSlug !== slug))}%`);
    console.log(`Max intro similarity: ${Math.round(maxSim * 100)}% vs ${worstPeer}`);
    console.log(`Max FAQ similarity: ${Math.round(maxFaqSim * 100)}% vs ${worstFaqPeer}`);
    console.log(`Paragraph breakdown:`);
    paraSims.forEach((p) => console.log(`  [${p.idx}] ${p.max}% vs ${p.peer}: "${p.preview}"`));

    // Repeated sentence starters
    const sentences = intro.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 20);
    const starters = sentences.map((s) => s.split(/\s+/).slice(0, 4).join(" ").toLowerCase());
    const starterCounts = new Map<string, number>();
    for (const p of peers) {
      if (p.pageSlug === slug) continue;
      for (const s of (p.introContent ?? "").split(/[.!?]+/).map((x) => x.trim()).filter((x) => x.length > 20)) {
        const st = s.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
        if (starters.includes(st)) {
          starterCounts.set(st, (starterCounts.get(st) ?? 0) + 1);
        }
      }
    }
    const repeatedStarters = [...starterCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (repeatedStarters.length) {
      console.log(`Repeated sentence starters with other cities:`);
      repeatedStarters.forEach(([st, n]) => console.log(`  "${st}…" matches ${n} peers`));
    }
  }

  await db.$disconnect();
}

main().catch(console.error);
