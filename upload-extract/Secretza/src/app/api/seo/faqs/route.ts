import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";

/**
 * POST /api/seo/faqs
 * Create a FAQ for an SEO page — admin only
 */
export async function POST(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { seoPageId, question, answer, sortOrder, isActive } = body as {
      seoPageId: string;
      question: string;
      answer: string;
      sortOrder?: number;
      isActive?: boolean;
    };

    if (!seoPageId || !question || !answer) {
      return NextResponse.json(
        { error: "seoPageId, question, and answer are required" },
        { status: 400 }
      );
    }

    // Verify the SEO page exists
    const seoPage = await db.seoPage.findUnique({ where: { id: seoPageId } });
    if (!seoPage) {
      return NextResponse.json({ error: "SEO page not found" }, { status: 404 });
    }

    const faq = await db.seoFaq.create({
      data: {
        seoPageId,
        question: question.trim(),
        answer: answer.trim(),
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({
      success: true,
      faq: {
        id: faq.id,
        seoPageId: faq.seoPageId,
        question: faq.question,
        answer: faq.answer,
        sortOrder: faq.sortOrder,
        isActive: faq.isActive,
        createdAt: faq.createdAt.toISOString(),
        updatedAt: faq.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("SEO FAQ create error:", error);
    return NextResponse.json(
      { error: "Failed to create FAQ" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/seo/faqs
 * Update a FAQ — admin only
 */
export async function PATCH(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      question,
      answer,
      sortOrder,
      isActive,
    } = body as {
      id: string;
      question?: string;
      answer?: string;
      sortOrder?: number;
      isActive?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: "FAQ id is required" }, { status: 400 });
    }

    // Check FAQ exists
    const existing = await db.seoFaq.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    if (question !== undefined) updateData.question = question.trim();
    if (answer !== undefined) updateData.answer = answer.trim();
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedFaq = await db.seoFaq.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      faq: {
        id: updatedFaq.id,
        seoPageId: updatedFaq.seoPageId,
        question: updatedFaq.question,
        answer: updatedFaq.answer,
        sortOrder: updatedFaq.sortOrder,
        isActive: updatedFaq.isActive,
        createdAt: updatedFaq.createdAt.toISOString(),
        updatedAt: updatedFaq.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("SEO FAQ update error:", error);
    return NextResponse.json(
      { error: "Failed to update FAQ" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/seo/faqs
 * Delete a FAQ — admin only
 */
export async function DELETE(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "FAQ id is required" }, { status: 400 });
    }

    // Check FAQ exists
    const existing = await db.seoFaq.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    await db.seoFaq.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (error) {
    console.error("SEO FAQ delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete FAQ" },
      { status: 500 }
    );
  }
}
