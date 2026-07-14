import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import {
  analyzePageForStudio,
  buildDuplicateHeatmap,
  buildParagraphDuplicateHeatmap,
  countLinksInContent,
  diffHighlight,
  extractHeadings,
} from "@/lib/seo-studio-analysis";
import { getCachedPeerPages } from "@/lib/seo-peer-cache";
import type { SeoPageType } from "@/lib/seo-page-service";
import { detectDuplicateFields } from "@/lib/seo-quality";
import { textSimilarity } from "@/lib/seo-quality";
import { getSeoEngineInfo } from "@/lib/seo-engine";

/**
 * GET — lazy-loaded page inspector (content loaded on demand).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string; itemId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, itemId } = await params;

    const item = await db.seoRegenerationItem.findFirst({
      where: { id: itemId, runId },
      include: {
        seoPage: {
          include: {
            faqs: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const version = item.versionId
      ? await db.seoContentVersion.findUnique({ where: { id: item.versionId } })
      : null;

    const priorVersion = item.seoPageId
      ? await db.seoContentVersion.findFirst({
          where: {
            seoPageId: item.seoPageId,
            id: version ? { not: version.id } : undefined,
            rolledBackAt: null,
          },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const page = item.seoPage;
    const peers = page
      ? await getCachedPeerPages(page.pageType as SeoPageType, page.pageSlug)
      : [];

    const duplicateFields = page
      ? detectDuplicateFields(
          {
            id: page.id,
            pageType: page.pageType,
            pageSlug: page.pageSlug,
            title: page.title,
            metaDescription: page.metaDescription,
            h1: page.h1,
            introContent: page.introContent,
            faqText: page.faqs.map((f) => `${f.question} ${f.answer}`).join(" "),
          },
          peers,
        )
      : undefined;

    let maxIntroSimilarity = 0;
    if (page?.introContent) {
      for (const peer of peers) {
        if (!peer.introContent) continue;
        maxIntroSimilarity = Math.max(
          maxIntroSimilarity,
          textSimilarity(page.introContent, peer.introContent),
        );
      }
    }

    const currentAnalysis = page
      ? analyzePageForStudio({
          ...page,
          duplicateFields,
          maxIntroSimilarity,
        })
      : null;

    const headings = extractHeadings(page?.introContent);
    const links = countLinksInContent(page?.introContent);
    const peerSnapshots = peers.map((p) => ({
      pageSlug: p.pageSlug,
      pageType: p.pageType,
      introContent: p.introContent ?? null,
    }));
    const heatmap = page ? buildDuplicateHeatmap(page.introContent, peerSnapshots) : [];
    const paragraphHeatmap = page
      ? buildParagraphDuplicateHeatmap(page.introContent, peerSnapshots)
      : [];

    const before = priorVersion ?? version;
    const afterContent = page
      ? {
          title: page.title,
          metaDescription: page.metaDescription,
          h1: page.h1,
          introContent: page.introContent,
          seoScore: page.seoQualityScore,
          uniqueness: page.uniquenessScore,
        }
      : item.status === "completed"
        ? {
            title: null,
            metaDescription: null,
            h1: null,
            introContent: null,
            seoScore: item.predictedScore,
            uniqueness: item.predictedUnique,
          }
        : null;

    const beforeContent = before
      ? {
          title: before.title,
          metaDescription: before.metaDescription,
          h1: before.h1,
          introContent: before.introContent,
          seoScore: before.seoQualityScore,
          uniqueness: before.uniquenessScore,
        }
      : null;

    const comparison = afterContent && beforeContent
      ? {
          title: diffHighlight(beforeContent.title, afterContent.title),
          meta: diffHighlight(beforeContent.metaDescription, afterContent.metaDescription),
          h1: diffHighlight(beforeContent.h1, afterContent.h1),
          content: diffHighlight(beforeContent.introContent, afterContent.introContent),
          seoScore: {
            old: beforeContent.seoScore,
            new: afterContent.seoScore,
            changed: beforeContent.seoScore !== afterContent.seoScore,
          },
          uniqueness: {
            old: beforeContent.uniqueness,
            new: afterContent.uniqueness,
            changed: beforeContent.uniqueness !== afterContent.uniqueness,
          },
        }
      : null;

    const versions = item.seoPageId
      ? await db.seoContentVersion.findMany({
          where: { seoPageId: item.seoPageId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            title: true,
            wordCount: true,
            seoQualityScore: true,
            uniquenessScore: true,
            duplicateRisk: true,
            createdAt: true,
            rolledBackAt: true,
            createdByEmail: true,
          },
        })
      : [];

    return NextResponse.json({
      item: {
        id: item.id,
        pageSlug: item.pageSlug,
        pageType: item.pageType,
        status: item.status,
        predictedWords: item.predictedWords,
        predictedUnique: item.predictedUnique,
        predictedScore: item.predictedScore,
        predictedRisk: item.predictedRisk,
        versionId: item.versionId,
        processedAt: item.processedAt?.toISOString() ?? null,
      },
      inspector: page
        ? {
            seoTitle: page.title,
            metaDescription: page.metaDescription,
            h1: page.h1,
            headings,
            slug: page.pageSlug,
            canonicalUrl: page.canonicalUrl,
            wordCount: page.wordCount,
            seoScore: page.seoQualityScore,
            uniqueness: page.uniquenessScore,
            duplicateRisk: page.duplicateRisk,
            faqCount: page.faqs.length,
            imageCount: page.featuredImage ? 1 : 0,
            internalLinks: links.internal,
            externalLinks: links.external,
            lastGenerated: item.processedAt?.toISOString() ?? null,
            lastUpdated: page.updatedAt.toISOString(),
            introContent: page.introContent,
          }
        : null,
      analysis: currentAnalysis,
      heatmap,
      paragraphHeatmap,
      engineInfo: getSeoEngineInfo(),
      regenerationMeta: {
        status: item.status,
        predictedUnique: item.predictedUnique,
        predictedScore: item.predictedScore,
        priorUnique: beforeContent?.uniqueness ?? null,
        priorSeoScore: beforeContent?.seoScore ?? null,
        processedAt: item.processedAt?.toISOString() ?? null,
        error: item.error,
      },
      comparison,
      versions: versions.map((v) => {
        const isLatestSave = v.id === item.versionId;
        const action = v.createdByEmail?.includes(" · ")
          ? v.createdByEmail.split(" · ").slice(1).join(" · ")
          : "regeneration";
        return {
          ...v,
          createdAt: v.createdAt.toISOString(),
          rolledBackAt: v.rolledBackAt?.toISOString() ?? null,
          priorUniqueness: v.uniquenessScore,
          priorSeoScore: v.seoQualityScore,
          newUniqueness: isLatestSave ? page?.uniquenessScore ?? item.predictedUnique : null,
          newSeoScore: isLatestSave ? page?.seoQualityScore ?? item.predictedScore : null,
          optimizationAction: action,
        };
      }),
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/inspect GET" });
    return NextResponse.json({ error: "Failed to inspect item" }, { status: 500 });
  }
}
