import { processRegenerationBatch, resetOrphanedRegenerationItems } from "@/lib/seo-regeneration-service";

const runId = "cmq9k6lzb00000sysbrepyqdk";
await resetOrphanedRegenerationItems(runId);
const result = await processRegenerationBatch(runId, 5);
console.log(JSON.stringify(result, null, 2));
await import("@/lib/db").then((m) => m.db.$disconnect());
