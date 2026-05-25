import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({
    categories,
    total: categories.length,
  });
}
