/**
 * SEO regeneration schema health — detect missing columns and avoid crash loops.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SchemaOutdatedCode = "SCHEMA_OUTDATED";

export class SchemaOutdatedError extends Error {
  readonly code: SchemaOutdatedCode = "SCHEMA_OUTDATED";
  readonly action = "Run: bunx prisma db push && bunx prisma generate";

  constructor(message = "Database schema mismatch") {
    super(message);
    this.name = "SchemaOutdatedError";
  }
}

export type SeoRegenerationSchemaHealth = {
  generationMetaJson: boolean;
  checkedAt: number;
};

let cachedHealth: SeoRegenerationSchemaHealth | null = null;
let mismatchLogged = false;
let startupCheckDone = false;

/** Detect Prisma errors caused by a column missing in the live database. */
export function isMissingColumnError(error: unknown, column = "generationMetaJson"): boolean {
  if (error instanceof SchemaOutdatedError) return true;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // SQLite / Postgres column errors surface as P2022 or in message text
    const msg = error.message.toLowerCase();
    if (msg.includes(column.toLowerCase()) && msg.includes("does not exist")) return true;
    if (error.code === "P2022") return true;
  }

  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes(column.toLowerCase()) &&
    (lower.includes("does not exist") ||
      lower.includes("unknown column") ||
      lower.includes("no such column"))
  );
}

export function logSchemaMismatchOnce(column = "generationMetaJson"): void {
  if (mismatchLogged) return;
  mismatchLogged = true;
  console.warn(
    `[SEO] Database schema mismatch detected:\nMissing column ${column}\nRun:\n  bunx prisma db push\n  bunx prisma generate\nThen restart the server.`,
  );
}

async function probeGenerationMetaColumn(): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<Array<{ name: string }>>`
      PRAGMA table_info(SeoRegenerationItem)
    `;
    return rows.some((r) => r.name === "generationMetaJson");
  } catch {
    try {
      await db.$queryRaw`SELECT generationMetaJson FROM SeoRegenerationItem LIMIT 0`;
      return true;
    } catch (probeErr) {
      if (isMissingColumnError(probeErr)) return false;
      return true;
    }
  }
}

/** Cached schema probe for SeoRegenerationItem.generationMetaJson. */
export async function getRegenerationSchemaHealth(
  force = false,
): Promise<SeoRegenerationSchemaHealth> {
  if (!force && cachedHealth) return cachedHealth;
  const generationMetaJson = await probeGenerationMetaColumn();
  cachedHealth = { generationMetaJson, checkedAt: Date.now() };
  if (!generationMetaJson) logSchemaMismatchOnce();
  return cachedHealth;
}

export function invalidateRegenerationSchemaHealth(): void {
  cachedHealth = null;
}

export function isRegenerationSchemaOutdated(): boolean {
  return cachedHealth !== null && !cachedHealth.generationMetaJson;
}

/** Server startup warning (logs once). */
export async function runSeoSchemaStartupCheck(): Promise<void> {
  if (startupCheckDone) return;
  startupCheckDone = true;
  const health = await getRegenerationSchemaHealth();
  if (!health.generationMetaJson) {
    console.warn(
      "⚠ SEO Regeneration schema outdated.\nRun:\n  bunx prisma db push\n  bunx prisma generate\nbefore using the regeneration page.",
    );
  }
}

export function schemaOutdatedJson(extra?: Record<string, unknown>) {
  return {
    success: false,
    error: "Database schema mismatch",
    code: "SCHEMA_OUTDATED" as const,
    action: "Run: bunx prisma db push && bunx prisma generate",
    ...extra,
  };
}

export function stripGenerationMetaFromData<T extends Record<string, unknown>>(data: T): T {
  if (!("generationMetaJson" in data)) return data;
  const { generationMetaJson: _omit, ...rest } = data;
  return rest as T;
}
