/**
 * Build-time audit — verifies SEO job queue integrity.
 * Usage: bun run seo:audit-jobs
 */
import { db } from "@/lib/db";

const STALE_RUNNING_MS = 6 * 60 * 60 * 1000; // 6 hours

async function main() {
  const issues: string[] = [];

  const allJobs = await db.seoJob.findMany({
    select: {
      id: true,
      jobType: true,
      status: true,
      progress: true,
      total: true,
      processed: true,
      successCount: true,
      failedCount: true,
      skippedCount: true,
      lastProcessedId: true,
      startedAt: true,
      createdAt: true,
    },
  });

  const runningByType = new Map<string, string[]>();
  const jobIdSet = new Set(allJobs.map((j) => j.id));

  for (const job of allJobs) {
    if (job.status === "running" || job.status === "queued") {
      const list = runningByType.get(job.jobType) ?? [];
      list.push(job.id);
      runningByType.set(job.jobType, list);
    }

    if (job.status === "running" && job.startedAt) {
      const age = Date.now() - job.startedAt.getTime();
      if (age > STALE_RUNNING_MS) {
        issues.push(`stale_running_job:${job.id} (age ${Math.round(age / 60000)}m)`);
      }
    }

    const itemSum = job.successCount + job.failedCount + job.skippedCount;
    if (job.processed < itemSum - 1) {
      issues.push(`corrupted_progress:${job.id} processed=${job.processed} items=${itemSum}`);
    }
    if (job.total > 0 && job.progress > 100.5) {
      issues.push(`invalid_progress:${job.id} progress=${job.progress}`);
    }
    if (job.total > 0 && job.processed > job.total) {
      issues.push(`checkpoint_overflow:${job.id} processed=${job.processed} total=${job.total}`);
    }
  }

  for (const [jobType, ids] of runningByType) {
    if (ids.length > 1) {
      issues.push(`duplicate_running_jobs:${jobType} ids=${ids.join(",")}`);
    }
  }

  const jobsWithItems = await db.seoJobItem.groupBy({
    by: ["jobId"],
    _count: { id: true },
  });
  const jobIdsWithItems = new Set(jobsWithItems.map((g) => g.jobId));

  for (const job of allJobs) {
    if (job.total > 0 && !jobIdsWithItems.has(job.id)) {
      issues.push(`orphan_job_no_items:${job.id}`);
    }
  }

  const allItems = await db.seoJobItem.findMany({
    select: { id: true, jobId: true },
  });
  const orphanItems = allItems.filter((i) => !jobIdSet.has(i.jobId)).slice(0, 10);

  if (orphanItems.length > 0) {
    issues.push(`orphan_job_items:${orphanItems.map((i) => i.id).join(",")}`);
  }

  const queuedWithoutJob = await db.seoJobItem.count({
    where: {
      status: "queued",
      job: { status: { in: ["completed", "failed", "cancelled"] } },
    },
  });
  if (queuedWithoutJob > 0) {
    issues.push(`invalid_checkpoints:queued_items_on_finished_jobs count=${queuedWithoutJob}`);
  }

  const report = {
    totalJobs: allJobs.length,
    activeJobs: allJobs.filter((j) => j.status === "queued" || j.status === "running").length,
    issues: issues.length,
    issueDetails: issues.slice(0, 50),
  };

  if (issues.length > 0) {
    console.error(JSON.stringify({ error: "SEO_JOBS_AUDIT_FAILED", ...report }, null, 2));
    await db.$disconnect();
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
