import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/monitoring";
import {
  analyzeSeoContent,
  countWords,
  detectDuplicateFields,
  computeCompositeUniqueness,
  type SeoPageSnapshot,
} from "@/lib/seo-quality";
import { getCachedPeerPages } from "@/lib/seo-peer-cache";
import type { SeoPageType } from "@/lib/seo-page-service";

const SEO_PAGE_TYPES: SeoPageType[] = [
  "city",
  "category",
  "category_city",
  "state",
  "country",
  "longtail",
];

/**
 * POST /api/seo/quality
 * Real-time SEO quality scoring. Reuses the canonical seo-quality.ts engine and
 * the existing peer-cache for uniqueness. When `pageType`/`pageSlug` reference a
 * real SEO page type, uniqueness is computed against the peer corpus; otherwise
 * (e.g. listing copy) only the structural score is returned (uniqueness = 100).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const title: string = typeof body.title === "string" ? body.title : "";
    const metaDescription: string = typeof body.metaDescription === "string" ? body.metaDescription : "";
    const h1: string = typeof body.h1 === "string" ? body.h1 : "";
    const introContent: string = typeof body.introContent === "string" ? body.introContent : "";
    const canonicalUrl: string | undefined = typeof body.canonicalUrl === "string" ? body.canonicalUrl : undefined;
    const featuredImage: string | undefined = typeof body.featuredImage === "string" ? body.featuredImage : undefined;
    const faqCount: number = Number.isFinite(body.faqCount) ? Number(body.faqCount) : 0;
    const internalLinksCount: number = Number.isFinite(body.internalLinksCount) ? Number(body.internalLinksCount) : 0;
    const pageType: string | undefined = typeof body.pageType === "string" ? body.pageType : undefined;
    const pageSlug: string | undefined = typeof body.pageSlug === "string" ? body.pageSlug : undefined;

    let uniquenessScore = 100;
    let maxIntroSimilarity = 0;
    let duplicateFields = {
      title: false,
      metaDescription: false,
      h1: false,
      introContent: false,
      faqContent: false,
    };

    if (pageType && SEO_PAGE_TYPES.includes(pageType as SeoPageType)) {
      const peers = await getCachedPeerPages(pageType as SeoPageType, pageSlug);
      const candidate: SeoPageSnapshot = {
        pageType,
        pageSlug: pageSlug ?? "",
        title,
        metaDescription,
        h1,
        introContent,
      };
      duplicateFields = detectDuplicateFields(candidate, peers);

      const substantivePeers = peers.filter((p) => countWords(p.introContent) >= 350);
      const comparisonPeers = substantivePeers.length >= 2 ? substantivePeers : peers;
      const breakdown = computeCompositeUniqueness({
        introContent,
        faqText: "",
        title,
        metaDescription,
        peerIntros: comparisonPeers.map((p) => p.introContent ?? "").filter(Boolean),
        peerFaqs: comparisonPeers.map((p) => p.faqText ?? ""),
        peerTitles: comparisonPeers.map((p) => p.title ?? ""),
        peerMetas: comparisonPeers.map((p) => p.metaDescription ?? ""),
      });
      uniquenessScore = breakdown.overall;
      maxIntroSimilarity = breakdown.maxIntroSimilarity;
    }

    const result = analyzeSeoContent(
      {
        title,
        metaDescription,
        h1,
        introContent,
        canonicalUrl,
        featuredImage,
        faqCount,
        internalLinksCount,
        wordCount: countWords(introContent),
        uniquenessScore,
        duplicateFields,
      },
      maxIntroSimilarity,
    );

    return NextResponse.json({ result });
  } catch (error) {
    logError(error, { component: "route:api/seo/quality" });
    return NextResponse.json({ error: "Failed to score content" }, { status: 500 });
  }
}
