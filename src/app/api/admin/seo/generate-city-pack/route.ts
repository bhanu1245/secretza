import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { logSeoGenerationAction } from "@/lib/seo-generation-audit";
import { scheduleSeoBackgroundWork } from "@/lib/seo-background-scheduler";
import {
  createCityPackJob,
  deleteCityPackJob,
  discardCityPackJob,
  getCityPackJob,
  serializeCityPackJob,
} from "@/lib/seo-city-pack-job";
import {
  buildCommitSummary,
  bulkImproveCityPackPages,
  bulkRegenerateCityPackPages,
  commitCityPackDryRun,
  discardCityPackPreviewPages,
  getCityPackPageDetail,
  improveAllWeakCityPackPages,
  improveCityPackPreviewPage,
  previewCitySeoPack,
  regenerateCityPackPreviewPage,
  resolveSeoGranularAccess,
  runCityPackJob,
  updateCityPackReviewSettings,
} from "@/lib/seo-granular-generation";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const denied = resolveSeoGranularAccess(user?.role);
    if (denied === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (denied === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");
    const includePreview = url.searchParams.get("includePreview") === "true";
    const pageSlug = url.searchParams.get("pageSlug");

    if (jobId && pageSlug) {
      const detail = getCityPackPageDetail(jobId, pageSlug);
      if (!detail) {
        return NextResponse.json({ error: "Page not found in preview" }, { status: 404 });
      }
      return NextResponse.json({ page: detail });
    }

    if (jobId) {
      const job = getCityPackJob(jobId);
      if (!job) {
        return NextResponse.json({ error: "Job not found or expired" }, { status: 404 });
      }
      if (includePreview && job.dryRun && job.status === "completed" && !job.previewReady) {
        return NextResponse.json(
          { error: "Preview not ready yet", job: serializeCityPackJob(job) },
          { status: 202 },
        );
      }
      return NextResponse.json({
        job: serializeCityPackJob(job, includePreview),
        previewReady: job.previewReady,
      });
    }

    const cityId = url.searchParams.get("cityId");
    if (!cityId) {
      return NextResponse.json({ error: "cityId or jobId is required" }, { status: 400 });
    }

    const preview = await previewCitySeoPack(cityId);
    if (!preview) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    return NextResponse.json({ preview });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-city-pack GET" });
    return NextResponse.json({ error: "Failed to load preview" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const routeStart = Date.now();
  try {
    const user = await getCurrentUser();
    const denied = resolveSeoGranularAccess(user?.role);
    if (denied === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (denied === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "generate";

    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
    const pageSlugs = Array.isArray(body.pageSlugs)
      ? body.pageSlugs.filter((s: unknown): s is string => typeof s === "string")
      : typeof body.pageSlug === "string"
        ? [body.pageSlug]
        : [];

    if (action === "commit_summary") {
      if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
      const summary = buildCommitSummary(jobId, pageSlugs.length ? pageSlugs : undefined);
      return NextResponse.json({ success: true, summary });
    }

    if (action === "commit") {
      if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
      const mode =
        body.mode === "all_anyway" || body.mode === "selected" || body.mode === "production_only"
          ? body.mode
          : "production_only";
      const result = await commitCityPackDryRun(jobId, {
        mode,
        slugs: pageSlugs.length ? pageSlugs : undefined,
      });
      if (user && result.committed > 0) {
        try {
          await logSeoGenerationAction({
            adminUserId: user.id,
            action: "seo_generate_city_pack",
            country: result.countryName,
            state: result.stateName,
            city: result.cityName,
            generated: result.committed,
            skipped: result.skipped,
          });
        } catch (auditErr) {
          console.error("CITY_PACK_AUDIT_FAILED", auditErr);
        }
      }
      return NextResponse.json({
        success: true,
        ...result,
        message: `Committed ${result.committed} page(s)`,
      });
    }

    if (action === "discard") {
      if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
      discardCityPackJob(jobId);
      deleteCityPackJob(jobId, "user_discard");
      return NextResponse.json({ success: true, message: "Preview discarded" });
    }

    if (action === "discard_selected") {
      if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
      if (!pageSlugs.length) {
        return NextResponse.json({ error: "pageSlugs required" }, { status: 400 });
      }
      const removed = discardCityPackPreviewPages(jobId, pageSlugs);
      const job = getCityPackJob(jobId);
      return NextResponse.json({
        success: true,
        removed,
        job: job ? serializeCityPackJob(job, true) : null,
      });
    }

    if (action === "regenerate_page") {
      if (!jobId || !pageSlugs[0]) {
        return NextResponse.json({ error: "jobId and pageSlug required" }, { status: 400 });
      }
      const page = await regenerateCityPackPreviewPage(jobId, pageSlugs[0]);
      const job = getCityPackJob(jobId);
      return NextResponse.json({
        success: true,
        page,
        job: job ? serializeCityPackJob(job, true) : null,
      });
    }

    if (action === "improve_page") {
      if (!jobId || !pageSlugs[0]) {
        return NextResponse.json({ error: "jobId and pageSlug required" }, { status: 400 });
      }
      const page = await improveCityPackPreviewPage(jobId, pageSlugs[0]);
      const job = getCityPackJob(jobId);
      return NextResponse.json({
        success: true,
        page,
        job: job ? serializeCityPackJob(job, true) : null,
      });
    }

    if (action === "bulk_regenerate") {
      if (!jobId || !pageSlugs.length) {
        return NextResponse.json({ error: "jobId and pageSlugs required" }, { status: 400 });
      }
      const pages = await bulkRegenerateCityPackPages(jobId, pageSlugs);
      const job = getCityPackJob(jobId);
      return NextResponse.json({
        success: true,
        pages,
        job: job ? serializeCityPackJob(job, true) : null,
      });
    }

    if (action === "bulk_improve") {
      if (!jobId || !pageSlugs.length) {
        return NextResponse.json({ error: "jobId and pageSlugs required" }, { status: 400 });
      }
      const pages = await bulkImproveCityPackPages(jobId, pageSlugs);
      const job = getCityPackJob(jobId);
      return NextResponse.json({
        success: true,
        pages,
        job: job ? serializeCityPackJob(job, true) : null,
      });
    }

    if (action === "improve_weak") {
      if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
      const pages = await improveAllWeakCityPackPages(jobId);
      const job = getCityPackJob(jobId);
      return NextResponse.json({
        success: true,
        pages,
        job: job ? serializeCityPackJob(job, true) : null,
      });
    }

    if (action === "update_settings") {
      if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
      const settings = body.settings && typeof body.settings === "object" ? body.settings : {};
      const job = updateCityPackReviewSettings(jobId, settings);
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
      return NextResponse.json({
        success: true,
        qualitySettings: job.qualitySettings,
        job: serializeCityPackJob(job, true),
      });
    }

    const cityId = typeof body.cityId === "string" ? body.cityId.trim() : "";
    const dryRun = body.dryRun === true;

    if (!cityId) {
      return NextResponse.json({ error: "cityId is required" }, { status: 400 });
    }

    console.log("CITY_PACK_REQUEST", { cityId, dryRun, adminId: user?.id });

    const preview = await previewCitySeoPack(cityId);
    if (!preview) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    const job = createCityPackJob({
      cityId,
      cityName: preview.cityName,
      total: preview.total,
      dryRun,
    });

    console.log("CITY_PACK_JOB_QUEUED", {
      jobId: job.jobId,
      cityId,
      dryRun,
      total: job.total,
      durationMs: Date.now() - routeStart,
    });

    scheduleSeoBackgroundWork(`city-pack:${job.jobId}`, async () => {
      await runCityPackJob(job.jobId, cityId, dryRun);
      const finished = getCityPackJob(job.jobId);
      if (finished?.status === "completed" && finished.result && !dryRun && user) {
        try {
          await logSeoGenerationAction({
            adminUserId: user.id,
            action: "seo_generate_city_pack",
            country: finished.result.countryName,
            state: finished.result.stateName,
            city: finished.result.cityName,
            generated: finished.result.created,
            skipped: finished.result.skipped,
          });
        } catch (auditErr) {
          console.error("CITY_PACK_AUDIT_FAILED", auditErr);
        }
      }
    });

    return NextResponse.json({
      success: true,
      jobId: job.jobId,
      status: "queued",
      dryRun,
      previewOnly: dryRun,
      total: job.total,
      cityName: preview.cityName,
      message: dryRun
        ? `Dry run queued for ${preview.cityName} (${job.total} page(s))`
        : `Generation queued for ${preview.cityName} (${job.total} page(s))`,
    });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/generate-city-pack POST" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to queue city SEO pack" },
      { status: 500 },
    );
  }
}
