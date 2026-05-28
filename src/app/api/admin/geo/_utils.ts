import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";

export type GeoListParams = {
  page: number;
  limit: number;
  search: string;
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function requireAdminResponse() {
  const admin = await requireMinRole("admin");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function getListParams(request: Request): GeoListParams {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20) || 20));
  const search = (searchParams.get("search") || "").trim();
  return { page, limit, search };
}

export function paginatedResponse<T>(items: T[], total: number, page: number, limit: number) {
  return NextResponse.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
