import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logAdminAction, extractIpAddress } from "@/lib/audit-logger";
import { logError } from "@/lib/monitoring";
import { autoGenerateCategorySeoPage } from "@/lib/seo-page-service";

// GET /api/admin/categories — list all categories (tree structure)
export async function GET() {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await db.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        children: {
          orderBy: [{ order: "asc" }, { name: "asc" }],
        },
        _count: {
          select: { listings: true, children: true },
        },
      },
    });

    // Recursive function to build tree with unlimited depth
    const buildTree = (parentId: string | null): any[] => {
      return categories
        .filter((c) => c.parentId === parentId)
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          icon: c.icon,
          color: c.color,
          order: c.order,
          isActive: c.isActive,
          isFeatured: c.isFeatured,
          listingCount: c._count.listings,
          parentId: c.parentId,
          seoTitle: c.seoTitle,
          seoDescription: c.seoDescription,
          children: buildTree(c.id),
        }));
    };

    const tree = buildTree(null);

    return NextResponse.json({ categories: tree });
  } catch (error) {
    logError(error, { component: "route:api/admin/categories" });
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

// POST /api/admin/categories — create category
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, description, icon, color, order, isActive, isFeatured, parentId, seoTitle, seoDescription } = body as {
      name?: string;
      slug?: string;
      description?: string;
      icon?: string;
      color?: string;
      order?: number;
      isActive?: boolean;
      isFeatured?: boolean;
      parentId?: string | null;
      seoTitle?: string;
      seoDescription?: string;
    };

    if (!name || !slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = await db.category.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Category with this slug already exists" }, { status: 409 });
    }

    // Validate parentId if provided
    if (parentId) {
      const parent = await db.category.findUnique({ where: { id: parentId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent category not found" }, { status: 400 });
      }
    }

    const category = await db.category.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        color: color || "#7C3AED",
        order: order ?? 0,
        isActive: isActive ?? true,
        isFeatured: isFeatured ?? false,
        parentId: parentId || null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
      },
    });

    if (category.isActive && !parentId) {
      autoGenerateCategorySeoPage(category.id).catch(() => {});
    }

    // Audit log category creation
    logAdminAction(
      admin.id,
      "category_create",
      "Category",
      category.id,
      { name, slug, parentId },
      extractIpAddress(request)
    );

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    logError(error, { component: "route:api/admin/categories" });
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}

// PATCH /api/admin/categories — update category
export async function PATCH(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, slug, description, icon, color, order, isActive, isFeatured, parentId, seoTitle, seoDescription } = body as {
      id?: string;
      name?: string;
      slug?: string;
      description?: string;
      icon?: string;
      color?: string;
      order?: number;
      isActive?: boolean;
      isFeatured?: boolean;
      parentId?: string | null;
      seoTitle?: string;
      seoDescription?: string;
    };

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check slug uniqueness if changing
    if (slug && slug !== existing.slug) {
      const slugTaken = await db.category.findUnique({ where: { slug } });
      if (slugTaken) {
        return NextResponse.json({ error: "Category with this slug already exists" }, { status: 409 });
      }
    }

    // Prevent circular reference
    if (parentId && parentId === id) {
      return NextResponse.json({ error: "Category cannot be its own parent" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (parentId !== undefined) updateData.parentId = parentId;
    if (seoTitle !== undefined) updateData.seoTitle = seoTitle;
    if (seoDescription !== undefined) updateData.seoDescription = seoDescription;

    const category = await db.category.update({
      where: { id },
      data: updateData,
    });

    // Audit log category update
    logAdminAction(
      admin.id,
      "category_update",
      "Category",
      id,
      { name, slug, previousSlug: existing.slug },
      extractIpAddress(request)
    );

    return NextResponse.json({ category });
  } catch (error) {
    logError(error, { component: "route:api/admin/categories" });
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

// DELETE /api/admin/categories — delete category
export async function DELETE(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
    }

    // Check if category has children
    const childrenCount = await db.category.count({ where: { parentId: id } });
    if (childrenCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete category with subcategories. Delete subcategories first." },
        { status: 400 }
      );
    }

    // Fetch category for audit log before deletion
    const existing = await db.category.findUnique({ where: { id }, select: { name: true, slug: true } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    await db.category.delete({ where: { id } });

    // Audit log category deletion
    logAdminAction(
      admin.id,
      "category_delete",
      "Category",
      id,
      { name: existing.name, slug: existing.slug },
      extractIpAddress(request)
    );

    return NextResponse.json({ message: "Category deleted" });
  } catch (error) {
    logError(error, { component: "route:api/admin/categories" });
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
