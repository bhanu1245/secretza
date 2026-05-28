import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const pages = await db.$queryRaw<Array<Record<string, any>>>`
    SELECT id, title, slug, excerpt, updatedAt
    FROM CmsPage
    WHERE isPublished = 1
    ORDER BY title ASC
  `;

  return NextResponse.json({
    pages: pages.map((page) => ({
      ...page,
      updatedAt: new Date(page.updatedAt).toISOString(),
    })),
  });
}
