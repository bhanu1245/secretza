import { NextResponse } from "next/server";

import { requireMinRole } from "@/lib/auth-helpers";

import { db } from "@/lib/db";

import { logError } from "@/lib/monitoring";

import { listRegenerationItemsPaginated } from "@/lib/seo-regeneration-queries";

import {

  isMissingColumnError,

  logSchemaMismatchOnce,

  schemaOutdatedJson,

} from "@/lib/seo-schema-health";



/**

 * GET /api/seo/regenerate/[runId]/items — paginated, filterable run items.

 */

export async function GET(

  request: Request,

  { params }: { params: Promise<{ runId: string }> },

) {

  try {

    const admin = await requireMinRole("admin");

    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });



    const { runId } = await params;

    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));



    const { items, total, degraded } = await listRegenerationItemsPaginated({

      runId,

      page,

      limit,

      status: searchParams.get("status"),

      risk: searchParams.get("risk"),

      pageType: searchParams.get("pageType"),

      search: searchParams.get("search")?.trim() ?? null,

      seoScoreMax: searchParams.get("seoScoreMax"),

      uniquenessMax: searchParams.get("uniquenessMax"),

      missingFaq: searchParams.get("missingFaq") === "true",

      missingMeta: searchParams.get("missingMeta") === "true",

      duplicateOnly: searchParams.get("duplicateOnly") === "true",

    });



    const versionIds = items

      .map((item) => item.versionId)

      .filter((id): id is string => Boolean(id));

    const versions =

      versionIds.length > 0

        ? await db.seoContentVersion.findMany({

            where: { id: { in: versionIds } },

            select: { id: true, uniquenessScore: true, seoQualityScore: true },

          })

        : [];

    const versionById = new Map(versions.map((v) => [v.id, v]));



    const body = {

      success: true,

      items: items.map((item) => {

        const snapshot = item.versionId ? versionById.get(item.versionId) : null;

        return {

          id: item.id,

          seoPageId: item.seoPageId,

          pageSlug: item.pageSlug,

          pageType: item.pageType,

          status: item.status,

          error: item.error,

          predictedWords: item.predictedWords,

          predictedUnique: item.predictedUnique,

          predictedScore: item.predictedScore,

          predictedRisk: item.predictedRisk,

          versionId: item.versionId,

          priorUnique:

            snapshot?.uniquenessScore ?? item.seoPage?.uniquenessScore ?? null,

          priorSeoScore:

            snapshot?.seoQualityScore ?? item.seoPage?.seoQualityScore ?? null,

          saved: item.status === "completed" && item.error === "saved",

          discarded: item.status === "skipped",

          processedAt: item.processedAt?.toISOString() ?? null,

          updatedAt: item.updatedAt.toISOString(),

          page: item.seoPage

            ? {

                title: item.seoPage.title,

                wordCount: item.seoPage.wordCount,

                faqCount: item.seoPage.faqCount,

                internalLinksCount: item.seoPage.internalLinksCount,

                uniquenessScore: item.seoPage.uniquenessScore,

                seoQualityScore: item.seoPage.seoQualityScore,

                duplicateRisk: item.seoPage.duplicateRisk,

                hasMeta: Boolean(item.seoPage.metaDescription?.trim()),

                hasImage: Boolean(item.seoPage.featuredImage?.trim()),

                updatedAt: item.seoPage.updatedAt.toISOString(),

              }

            : null,

        };

      }),

      page,

      limit,

      total,

      totalPages: Math.ceil(total / limit),

      schemaDegraded: degraded,

    };



    if (degraded) {

      return NextResponse.json({

        ...body,

        warning: schemaOutdatedJson().error,

        code: "SCHEMA_OUTDATED",

        action: schemaOutdatedJson().action,

      });

    }



    return NextResponse.json(body);

  } catch (error) {

    if (isMissingColumnError(error)) {

      logSchemaMismatchOnce();

      return NextResponse.json(schemaOutdatedJson(), { status: 503 });

    }

    logError(error, { component: "route:api/seo/regenerate/items GET" });

    return NextResponse.json({ success: false, error: "Failed to list items" }, { status: 500 });

  }

}


