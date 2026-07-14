/**
 * Safe SeoRegenerationItem queries — works with or without generationMetaJson column.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  getRegenerationSchemaHealth,
  invalidateRegenerationSchemaHealth,
  isMissingColumnError,
  SchemaOutdatedError,
  stripGenerationMetaFromData,
} from "@/lib/seo-schema-health";

const ITEM_COLUMNS = [
  "id",
  "runId",
  "seoPageId",
  "pageType",
  "pageSlug",
  "status",
  "error",
  "predictedWords",
  "predictedUnique",
  "predictedScore",
  "predictedRisk",
  "versionId",
  "processedAt",
  "createdAt",
  "updatedAt",
] as const;

type RawRegenItem = {
  id: string;
  runId: string;
  seoPageId: string | null;
  pageType: string;
  pageSlug: string;
  status: string;
  error: string | null;
  predictedWords: number | null;
  predictedUnique: number | null;
  predictedScore: number | null;
  predictedRisk: string | null;
  versionId: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function withNullMeta<T extends Record<string, unknown>>(row: T) {
  return { ...row, generationMetaJson: null };
}

async function rawFindItems(input: {
  runId?: string;
  whereSql?: string;
  params?: unknown[];
  orderBy?: string;
  skip?: number;
  take?: number;
}): Promise<RawRegenItem[]> {
  const conditions: string[] = [];
  const params: unknown[] = [...(input.params ?? [])];

  if (input.runId) {
    conditions.push(`runId = ?`);
    params.push(input.runId);
  }
  if (input.whereSql) {
    conditions.push(input.whereSql);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const order = input.orderBy ?? "updatedAt DESC";
  const limit = input.take != null ? `LIMIT ${input.take}` : "";
  const offset = input.skip != null ? `OFFSET ${input.skip}` : "";

  const sql = `SELECT ${ITEM_COLUMNS.join(", ")} FROM SeoRegenerationItem ${where} ORDER BY ${order} ${limit} ${offset}`;
  const rows = await db.$queryRawUnsafe<RawRegenItem[]>(sql, ...params);
  return rows;
}

async function rawCountItems(runId: string, whereSql?: string, params: unknown[] = []): Promise<number> {
  const conditions = [`runId = ?`, ...(whereSql ? [whereSql] : [])];
  const allParams = [runId, ...params];
  const sql = `SELECT COUNT(*) as count FROM SeoRegenerationItem WHERE ${conditions.join(" AND ")}`;
  const result = await db.$queryRawUnsafe<Array<{ count: number | bigint }>>(sql, ...allParams);
  const n = result[0]?.count ?? 0;
  return typeof n === "bigint" ? Number(n) : n;
}

export async function safeRegenerationItemFindMany<
  T extends Prisma.SeoRegenerationItemFindManyArgs,
>(args: T): Promise<Prisma.SeoRegenerationItemGetPayload<T>[]> {
  const health = await getRegenerationSchemaHealth();
  if (health.generationMetaJson) {
    try {
      return (await db.seoRegenerationItem.findMany(args)) as Prisma.SeoRegenerationItemGetPayload<T>[];
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      invalidateRegenerationSchemaHealth();
    }
  }

  const runId = (args.where as { runId?: string } | undefined)?.runId;
  if (!runId) {
    throw new SchemaOutdatedError(
      "generationMetaJson column missing — run prisma db push",
    );
  }

  const rows = await rawFindItems({
    runId,
    orderBy: "updatedAt DESC, pageSlug ASC",
    skip: args.skip ?? undefined,
    take: args.take ?? undefined,
  });

  return rows.map((r) => withNullMeta(r)) as Prisma.SeoRegenerationItemGetPayload<T>[];
}

export async function safeRegenerationItemCount(
  args: Prisma.SeoRegenerationItemCountArgs,
): Promise<number> {
  const health = await getRegenerationSchemaHealth();
  if (health.generationMetaJson) {
    try {
      return db.seoRegenerationItem.count(args);
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      invalidateRegenerationSchemaHealth();
    }
  }

  const runId = (args.where as { runId?: string } | undefined)?.runId;
  if (!runId) return 0;
  return rawCountItems(runId);
}

export async function safeRegenerationItemUpdateMany(
  args: Prisma.SeoRegenerationItemUpdateManyArgs,
): Promise<Prisma.BatchPayload> {
  const health = await getRegenerationSchemaHealth();
  const data = health.generationMetaJson
    ? args.data
    : stripGenerationMetaFromData(args.data as Record<string, unknown>);

  try {
    return await db.seoRegenerationItem.updateMany({ ...args, data });
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    invalidateRegenerationSchemaHealth();
    return db.seoRegenerationItem.updateMany({
      ...args,
      data: stripGenerationMetaFromData(args.data as Record<string, unknown>),
    });
  }
}

export async function safeRegenerationItemUpdate(
  args: Prisma.SeoRegenerationItemUpdateArgs,
): Promise<Prisma.SeoRegenerationItemGetPayload<Prisma.SeoRegenerationItemDefaultArgs>> {
  const health = await getRegenerationSchemaHealth();
  const data = health.generationMetaJson
    ? args.data
    : stripGenerationMetaFromData(args.data as Record<string, unknown>);

  try {
    return await db.seoRegenerationItem.update({ ...args, data });
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    invalidateRegenerationSchemaHealth();
    return db.seoRegenerationItem.update({
      ...args,
      data: stripGenerationMetaFromData(args.data as Record<string, unknown>),
    });
  }
}

export type RegenerationItemsListInput = {
  runId: string;
  page: number;
  limit: number;
  status?: string | null;
  risk?: string | null;
  pageType?: string | null;
  search?: string | null;
  seoScoreMax?: string | null;
  uniquenessMax?: string | null;
  missingFaq?: boolean;
  missingMeta?: boolean;
  duplicateOnly?: boolean;
};

/** Paginated items list — Prisma when schema is current, raw SQL fallback otherwise. */
export async function listRegenerationItemsPaginated(input: RegenerationItemsListInput) {
  const health = await getRegenerationSchemaHealth();
  const skip = (input.page - 1) * input.limit;
  const degraded = !health.generationMetaJson;

  if (!degraded) {
    try {
      return await listViaPrisma(input, skip);
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      invalidateRegenerationSchemaHealth();
    }
  }

  return listViaRawFallback(input, skip, degraded);
}

async function listViaPrisma(input: RegenerationItemsListInput, skip: number) {
  const where: Prisma.SeoRegenerationItemWhereInput = { runId: input.runId };
  if (input.status && input.status !== "all") where.status = input.status;
  if (input.risk && input.risk !== "all") where.predictedRisk = input.risk;
  if (input.pageType && input.pageType !== "all") where.pageType = input.pageType;
  if (input.search) {
    where.OR = [
      { pageSlug: { contains: input.search } },
      { seoPage: { title: { contains: input.search } } },
    ];
  }

  const seoPageFilter: Prisma.SeoPageWhereInput = {};
  if (input.seoScoreMax) seoPageFilter.seoQualityScore = { lt: parseFloat(input.seoScoreMax) };
  if (input.uniquenessMax) seoPageFilter.uniquenessScore = { lt: parseFloat(input.uniquenessMax) };
  if (input.missingFaq) seoPageFilter.OR = [{ faqCount: null }, { faqCount: { lt: 1 } }];
  if (input.missingMeta) {
    seoPageFilter.OR = [{ metaDescription: null }, { metaDescription: "" }];
  }
  if (input.duplicateOnly) seoPageFilter.duplicateRisk = { in: ["high", "medium"] };
  if (Object.keys(seoPageFilter).length > 0) where.seoPage = seoPageFilter;

  const [items, total] = await Promise.all([
    db.seoRegenerationItem.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { pageSlug: "asc" }],
      skip,
      take: input.limit,
      include: {
        seoPage: {
          select: {
            id: true,
            title: true,
            metaDescription: true,
            wordCount: true,
            faqCount: true,
            internalLinksCount: true,
            uniquenessScore: true,
            seoQualityScore: true,
            duplicateRisk: true,
            updatedAt: true,
            featuredImage: true,
          },
        },
      },
    }),
    db.seoRegenerationItem.count({ where }),
  ]);

  return { items, total, degraded: false };
}

async function listViaRawFallback(
  input: RegenerationItemsListInput,
  skip: number,
  degraded: boolean,
) {
  const clauses = ["runId = ?"];
  const params: unknown[] = [input.runId];

  if (input.status && input.status !== "all") {
    clauses.push("status = ?");
    params.push(input.status);
  }
  if (input.risk && input.risk !== "all") {
    clauses.push("predictedRisk = ?");
    params.push(input.risk);
  }
  if (input.pageType && input.pageType !== "all") {
    clauses.push("pageType = ?");
    params.push(input.pageType);
  }
  if (input.search) {
    clauses.push("pageSlug LIKE ?");
    params.push(`%${input.search}%`);
  }

  const whereSql = clauses.join(" AND ");
  const countSql = `SELECT COUNT(*) as count FROM SeoRegenerationItem WHERE ${whereSql}`;
  const countRows = await db.$queryRawUnsafe<Array<{ count: number | bigint }>>(countSql, ...params);
  const totalRaw = countRows[0]?.count ?? 0;
  const total = typeof totalRaw === "bigint" ? Number(totalRaw) : totalRaw;

  const listSql = `SELECT ${ITEM_COLUMNS.join(", ")} FROM SeoRegenerationItem WHERE ${whereSql} ORDER BY updatedAt DESC, pageSlug ASC LIMIT ? OFFSET ?`;
  const rawItems = await db.$queryRawUnsafe<RawRegenItem[]>(
    listSql,
    ...params,
    input.limit,
    skip,
  );

  const seoPageIds = rawItems.map((i) => i.seoPageId).filter((id): id is string => Boolean(id));
  const seoPages =
    seoPageIds.length > 0
      ? await db.seoPage.findMany({
          where: { id: { in: seoPageIds } },
          select: {
            id: true,
            title: true,
            metaDescription: true,
            wordCount: true,
            faqCount: true,
            internalLinksCount: true,
            uniquenessScore: true,
            seoQualityScore: true,
            duplicateRisk: true,
            updatedAt: true,
            featuredImage: true,
          },
        })
      : [];
  const pageById = new Map(seoPages.map((p) => [p.id, p]));

  const items = rawItems.map((row) => ({
    ...withNullMeta(row),
    seoPage: row.seoPageId ? pageById.get(row.seoPageId) ?? null : null,
  }));

  return { items, total, degraded };
}
