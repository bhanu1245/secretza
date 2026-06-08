/**
 * India geo expansion — idempotent upsert with audit report
 * Run: bunx tsx scripts/expand-india-geo.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import {
  expandIndiaGeo,
  formatIndiaGeoAuditReport,
  validateIndiaGeoSourceData,
} from "../src/lib/seed-india-geo-expand";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const OUT_DIR = path.resolve("artifacts/india-geo-expand");

async function main() {
  const sourceCheck = validateIndiaGeoSourceData();
  console.log("Source validation:", sourceCheck.pass ? "PASS" : "FAIL");
  if (!sourceCheck.pass) {
    console.log("  missing major cities:", sourceCheck.missingMajorCities);
  }
  console.log(`  source: ${sourceCheck.sourceStateCount} states/UTs, ${sourceCheck.sourceCityCount} cities`);

  const report = await expandIndiaGeo(db);
  const formatted = formatIndiaGeoAuditReport(report);

  console.log("\n=== India Geo Expansion Audit ===\n");
  console.log(formatted);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, "report.json"), formatted);
  console.log(`\nReport written to ${OUT_DIR}/report.json`);

  const coverageOk =
    report.missingStates.length === 0 && report.missingCities.length === 0;

  if (report.duplicatesFound.length > 0) {
    console.warn(
      `\nℹ️  ${report.duplicatesFound.length} duplicate name/slug record(s) detected (pre-existing, not removed).`,
    );
  }

  if (!coverageOk) {
    console.warn("\n⚠️  Expansion completed with coverage gaps — review report.");
    process.exitCode = 1;
  } else {
    console.log("\n✅ India geo expansion complete — full source coverage verified.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
