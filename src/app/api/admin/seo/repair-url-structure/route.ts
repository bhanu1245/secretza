import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";
import { logSeoGenerationAction } from "@/lib/seo-generation-audit";
import {
  previewSeoUrlRepair,
  repairSeoUrlStructure,
  resolveSeoUrlRepairAccess,
} from "@/lib/seo-url-repair";

const DIAG = "[SEO-REPAIR-DIAG]";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const denied = resolveSeoUrlRepairAccess(user?.role);
    if (denied === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (denied === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const preview = await previewSeoUrlRepair();
    return NextResponse.json({ preview });
  } catch (error) {
    logError(error, { component: "route:api/admin/seo/repair-url-structure" });
    return NextResponse.json({ error: "Failed to load repair preview" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log(`${DIAG} POST route entered`);
  try {
    const user = await getCurrentUser();
    console.log(`${DIAG} current user id: ${user?.id ?? "null"}`);
    console.log(`${DIAG} current role: ${user?.role ?? "null"}`);

    const denied = resolveSeoUrlRepairAccess(user?.role);
    if (denied === 401) {
      console.log(`${DIAG} auth denied: 401 Unauthorized`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (denied === 403) {
      console.log(`${DIAG} auth denied: 403 Forbidden`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.preview === true) {
      const preview = await previewSeoUrlRepair();
      console.log(`${DIAG} preview-only POST — preview count: ${preview.brokenCount}, repairable: ${preview.repairableCount}`);
      return NextResponse.json({ preview });
    }

    console.log(`${DIAG} repair started`);

    const result = await repairSeoUrlStructure();

    console.log(`${DIAG} preview count: ${result.processed}`);
    console.log(`${DIAG} repairable count: ${result.repaired}`);
    console.log(`${DIAG} repair completed — processed: ${result.processed}, repaired: ${result.repaired}, skipped: ${result.skipped}`);

    await logSeoGenerationAction({
      adminUserId: user!.id,
      action: "seo_repair_url_structure",
      processed: result.processed,
      generated: result.repaired,
      skipped: result.skipped,
    });

    console.log(`${DIAG} audit completed — action: seo_repair_url_structure, repaired: ${result.repaired}`);

    const responseBody = {
      success: true,
      processed: result.processed,
      repaired: result.repaired,
      skipped: result.skipped,
      message: `Repaired ${result.repaired} page(s), skipped ${result.skipped}`,
    };
    console.log(`${DIAG} POST response body:`, JSON.stringify(responseBody));

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error(`${DIAG} POST failed:`, error);
    logError(error, { component: "route:api/admin/seo/repair-url-structure" });
    return NextResponse.json({ error: "Failed to repair SEO URLs" }, { status: 500 });
  }
}
