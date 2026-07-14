import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import { analyzePageForStudio } from "@/lib/seo-studio-analysis";
import { formatRecommendations, rowsToCsv, type ExportRow } from "@/lib/seo-studio-export";

/**
 * GET /api/seo/regenerate/[runId]/export?format=csv|json
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await params;
    const format = new URL(request.url).searchParams.get("format") ?? "csv";
    const itemIds = new URL(request.url).searchParams.get("itemIds")?.split(",").filter(Boolean);

    const items = await db.seoRegenerationItem.findMany({
      where: {
        runId,
        ...(itemIds?.length ? { id: { in: itemIds } } : {}),
      },
      include: {
        seoPage: {
          select: {
            title: true,
            metaDescription: true,
            h1: true,
            introContent: true,
            wordCount: true,
            faqCount: true,
            internalLinksCount: true,
            uniquenessScore: true,
            seoQualityScore: true,
            duplicateRisk: true,
            canonicalUrl: true,
            featuredImage: true,
          },
        },
      },
      orderBy: { pageSlug: "asc" },
      take: 5000,
    });

    const rows: ExportRow[] = items.map((item) => {
      const page = item.seoPage;
      let recommendations = "";
      if (page) {
        const { diagnostics, suggestions } = analyzePageForStudio(page);
        recommendations = formatRecommendations(diagnostics, suggestions);
      }
      return {
        pageSlug: item.pageSlug,
        pageType: item.pageType,
        status: item.status,
        seoScore: item.predictedScore ?? page?.seoQualityScore ?? "—",
        uniqueness: item.predictedUnique ?? page?.uniquenessScore ?? "—",
        duplicateRisk: item.predictedRisk ?? page?.duplicateRisk ?? "—",
        wordCount: item.predictedWords ?? page?.wordCount ?? "—",
        lastGenerated: item.processedAt?.toISOString() ?? "—",
        recommendations,
      };
    });

    if (format === "json") {
      return NextResponse.json({ rows, total: rows.length });
    }

    const csv = rowsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="seo-studio-export-${runId}.csv"`,
      },
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regenerate/export GET" });
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
