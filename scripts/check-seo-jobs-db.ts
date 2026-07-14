import { db } from "@/lib/db";

const jobs = await db.seoJob.findMany({ take: 5, orderBy: { createdAt: "desc" } });
const runs = await db.seoRegenerationRun.findMany({ take: 5, orderBy: { createdAt: "desc" } });
const jobItems = await db.seoJobItem.count();
const runItems = await db.seoRegenerationItem.count();

console.log(JSON.stringify({
  seoJobs: jobs.map((j) => ({ id: j.id, status: j.status, total: j.total, processed: j.processed })),
  regenerationRuns: runs.map((r) => ({ id: r.id, status: r.status, total: r.totalPages })),
  jobItemCount: jobItems,
  runItemCount: runItems,
}, null, 2));

await db.$disconnect();
