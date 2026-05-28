import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { slugify } from "@/lib/slugify";
import { randomUUID } from "crypto";

export async function GET() {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pages = await db.$queryRaw<Array<Record<string, any>>>`
    SELECT * FROM CmsPage
    ORDER BY updatedAt DESC
  `;

  return NextResponse.json({
    pages: pages.map((page) => ({
      ...page,
      isPublished: Boolean(page.isPublished),
      createdAt: new Date(page.createdAt).toISOString(),
      updatedAt: new Date(page.updatedAt).toISOString(),
      publishedAt: page.publishedAt ? new Date(page.publishedAt).toISOString() : null,
    })),
  });
}

export async function POST(request: Request) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const isPublished = Boolean(body.isPublished);
  const id = randomUUID();
  const slug = slugify(String(body.slug || title));
  const now = new Date();
  await db.$executeRaw`
    INSERT INTO CmsPage (
      id, title, slug, content, excerpt, seoTitle, metaDescription,
      isPublished, publishedAt, createdAt, updatedAt
    ) VALUES (
      ${id}, ${title}, ${slug}, ${content}, ${body.excerpt ? String(body.excerpt) : null},
      ${body.seoTitle ? String(body.seoTitle) : null},
      ${body.metaDescription ? String(body.metaDescription) : null},
      ${isPublished ? 1 : 0}, ${isPublished ? now : null}, ${now}, ${now}
    )
  `;

  return NextResponse.json({ page: { id, title, slug } }, { status: 201 });
}
