import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { slugify } from "@/lib/slugify";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  if (!title || !content) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const existing = await db.$queryRaw<Array<Record<string, any>>>`
    SELECT id, publishedAt FROM CmsPage WHERE id = ${id} LIMIT 1
  `;
  if (!existing[0]) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  const isPublished = Boolean(body.isPublished);
  const slug = slugify(String(body.slug || title));
  await db.$executeRaw`
    UPDATE CmsPage SET
      title = ${title},
      slug = ${slug},
      content = ${content},
      excerpt = ${body.excerpt ? String(body.excerpt) : null},
      seoTitle = ${body.seoTitle ? String(body.seoTitle) : null},
      metaDescription = ${body.metaDescription ? String(body.metaDescription) : null},
      isPublished = ${isPublished ? 1 : 0},
      publishedAt = ${isPublished ? existing[0].publishedAt || new Date() : null},
      updatedAt = ${new Date()}
    WHERE id = ${id}
  `;

  return NextResponse.json({ page: { id, title, slug } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireMinRole("admin");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.$executeRaw`DELETE FROM CmsPage WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
