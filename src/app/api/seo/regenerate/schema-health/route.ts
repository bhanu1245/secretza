import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { getRegenerationSchemaHealth, schemaOutdatedJson } from "@/lib/seo-schema-health";

/** GET — regeneration schema health for admin UI */
export async function GET() {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const health = await getRegenerationSchemaHealth(true);
  if (!health.generationMetaJson) {
    return NextResponse.json({
      ...schemaOutdatedJson(),
      health,
    });
  }

  return NextResponse.json({
    success: true,
    health,
  });
}
