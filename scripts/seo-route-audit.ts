/**
 * Build-time gate: fail if any SeoPage cannot be served by the routing system.
 * Usage: bun run scripts/seo-route-audit.ts
 */
import {
  assertAllSeoPagesRoutable,
  repairSeoPageCanonicalUrls,
  archiveUnroutableSeoPages,
} from "@/lib/seo-route-validation";
import { db } from "@/lib/db";

const autoRepair = process.argv.includes("--repair");

async function main() {
  if (autoRepair) {
    const canonical = await repairSeoPageCanonicalUrls();
    const archived = await archiveUnroutableSeoPages();
    console.log("Auto-repair:", { canonical, archived });
  }

  const result = await assertAllSeoPagesRoutable();

  if (result.invalid.length > 0) {
    console.error(
      JSON.stringify(
        {
          error: "SEO_ROUTE_AUDIT_FAILED",
          total: result.total,
          invalid: result.invalid.length,
          samples: result.invalid.slice(0, 20),
        },
        null,
        2,
      ),
    );
    await db.$disconnect();
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      ok: true,
      total: result.total,
      message: "All SeoPage records resolve to valid public routes",
    }),
  );
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
