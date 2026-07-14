import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logError } from "@/lib/monitoring";
import { aggregateRecentV61Stats } from "@/lib/seo-generation-metadata";

export async function GET(request: Request) {
  try {
    const user = await requireMinRole("moderator");
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      pendingJobs,
      runningJobs,
      completedJobs,
      failedJobs,
      totalRuns,
      recentRuns,
      lastRun,
    ] = await Promise.all([
      db.seoRegenerationRun.count({ where: { status: "pending" } }),
      db.seoRegenerationRun.count({ where: { status: "processing" } }),
      db.seoRegenerationRun.count({ where: { status: "completed" } }),
      db.seoRegenerationRun.count({ where: { status: "failed" } }),
      db.seoRegenerationRun.count(),
      db.seoRegenerationRun.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          completedCount: true,
          failedCount: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      db.seoRegenerationRun.findFirst({
        where: { status: { in: ["completed", "failed"] } },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true, id: true },
      }),
    ]);

    let totalDurationMs = 0;
    let completedCount = 0;
    let failedCount = 0;
    let successCount = 0;

    const historyData = new Map<string, any>();

    for (const run of recentRuns) {
      if (run.status === "completed" || run.status === "failed") {
        if (run.startedAt && run.completedAt) {
          totalDurationMs += run.completedAt.getTime() - run.startedAt.getTime();
          completedCount++;
        }
        if (run.status === "failed") failedCount++;
        if (run.status === "completed") successCount++;

        const dateStr = run.completedAt
          ? run.completedAt.toISOString().split("T")[0]
          : run.startedAt?.toISOString().split("T")[0];

        if (dateStr) {
          const entry = historyData.get(dateStr) || { date: dateStr, completed: 0, failed: 0, totalDuration: 0, durationCount: 0 };
          if (run.status === "completed") entry.completed++;
          if (run.status === "failed") entry.failed++;
          if (run.startedAt && run.completedAt) {
            entry.totalDuration += run.completedAt.getTime() - run.startedAt.getTime();
            entry.durationCount++;
          }
          historyData.set(dateStr, entry);
        }
      }
    }

    const history = Array.from(historyData.values()).map(h => ({
      date: h.date,
      completed: h.completed,
      failed: h.failed,
      avgDuration: h.durationCount > 0 ? Math.round(h.totalDuration / h.durationCount / 1000) : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const avgDuration = completedCount > 0 ? Math.round(totalDurationMs / completedCount / 1000) : 0;
    const successRate = (successCount + failedCount) > 0 ? Math.round((successCount / (successCount + failedCount)) * 100) : 100;
    const failureRate = 100 - successRate;
    const v61 = await aggregateRecentV61Stats(days);

    return NextResponse.json({
      metrics: {
        pendingJobs,
        runningJobs,
        completedJobs,
        failedJobs,
        totalRuns,
        lastRunTime: lastRun?.completedAt || null,
        avgDuration, // in seconds
        successRate,
        failureRate,
      },
      history,
      v61,
    });
  } catch (error) {
    logError(error, { component: "route:api/seo/regeneration/monitor GET" });
    return NextResponse.json({ error: "Failed to load regeneration monitor data" }, { status: 500 });
  }
}
