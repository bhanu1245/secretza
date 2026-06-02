/**
 * Regenerate + measure Agra, Ahmedabad, Mumbai only (no bulk regen).
 */
import { db } from "../src/lib/db";
import { generateCitySEO, resolveIntroContentForStorage } from "../src/lib/seo-content";
import { countWords, computeCompositeUniqueness, computeUniquenessScore } from "../src/lib/seo-quality";
import { upsertFromContent, computePageQualityMetrics } from "../src/lib/seo-page-service";

const SAMPLES = [
  { slug: "agra", stateSlug: "uttar-pradesh", stateName: "Uttar Pradesh" },
  { slug: "ahmedabad", stateSlug: "gujarat", stateName: "Gujarat" },
  { slug: "mumbai", stateSlug: "maharashtra", stateName: "Maharashtra" },
] as const;

async function main() {
  const results: Record<string, unknown>[] = [];

  for (const sample of SAMPLES) {
    const city = await db.city.findFirst({
      where: { slug: sample.slug },
      select: {
        name: true,
        areas: { where: { isActive: true }, select: { name: true }, take: 10 },
        state: { select: { name: true, slug: true, country: { select: { slug: true } } } },
      },
    });

    const cityName = city?.name ?? sample.slug;
    const stateName = city?.state?.name ?? sample.stateName;
    const stateSlug = city?.state?.slug ?? sample.stateSlug;
    const countrySlug = city?.state?.country?.slug ?? "india";

    const seo = generateCitySEO(cityName, sample.slug, stateName, "India", {
      stateSlug,
      dbAreas: city?.areas.map((a) => a.name),
    });

    const introContent = resolveIntroContentForStorage(seo);
    const canonicalUrl = `/${countrySlug}/${stateSlug}/${sample.slug}`;

    await upsertFromContent("city", sample.slug, seo, canonicalUrl);
    const metrics = await computePageQualityMetrics("city", sample.slug, seo, introContent, { canonicalUrl });

    const peers = await db.seoPage.findMany({
      where: { pageType: "city", pageSlug: { not: sample.slug } },
      select: { introContent: true, title: true, metaDescription: true, faqs: { select: { question: true, answer: true } } },
      take: 500,
    });

    const faqText = seo.faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
    const legacyScore = computeUniquenessScore(introContent, peers.map((p) => p.introContent ?? ""));
    const breakdown = computeCompositeUniqueness({
      introContent,
      faqText,
      title: seo.title,
      metaDescription: seo.metaDescription,
      peerIntros: peers.map((p) => p.introContent ?? ""),
      peerFaqs: peers.map((p) => p.faqs.map((f) => `${f.question} ${f.answer}`).join(" ")),
      peerTitles: peers.map((p) => p.title ?? ""),
      peerMetas: peers.map((p) => p.metaDescription ?? ""),
    });

    results.push({
      city: cityName,
      slug: sample.slug,
      contentVariant: seo.cityEnrichment?.contentVariant,
      faqGroup: seo.cityEnrichment?.faqGroup,
      title: seo.title,
      metaDescription: seo.metaDescription,
      h1: seo.h1,
      wordCount: countWords(introContent),
      faqCount: seo.faqs.length,
      internalLinksCount: seo.internalLinks.length,
      legacyUniquenessScore: legacyScore,
      compositeUniquenessScore: breakdown.overall,
      duplicateRisk: metrics.duplicateRisk,
      seoQualityScore: metrics.seoQualityScore,
      uniquenessBreakdown: breakdown,
      sampleFaq: seo.faqs[0],
      introPreview: introContent.slice(0, 350) + "…",
    });
  }

  console.log(JSON.stringify({ samples: results }, null, 2));
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
