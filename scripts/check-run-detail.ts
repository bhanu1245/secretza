import { db } from "@/lib/db";

const runId = "cmq9k6lzb00000sysbrepyqdk";
const run = await db.seoRegenerationRun.findUnique({ where: { id: runId } });
const itemCounts = await db.seoRegenerationItem.groupBy({
  by: ["status"],
  where: { runId },
  _count: { id: true },
});

console.log(JSON.stringify({ run, itemCounts }, null, 2));
await db.$disconnect();
