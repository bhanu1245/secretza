import { NextResponse } from "next/server";
import { requireMinRole } from "@/lib/auth-helpers";
import { logAdminAction } from "@/lib/audit-logger";
import { extractIpAddress } from "@/lib/audit-logger";
import { logError } from "@/lib/monitoring";
import {
  bulkModerateListingImages,
  getImageModerationStats,
  listModerationQueue,
  moderateListingImage,
  type ImageModerationAction,
  type ImageQueueFilter,
} from "@/lib/image-moderation";

const VALID_FILTERS = new Set<ImageQueueFilter>([
  "pending",
  "approved",
  "rejected",
  "flagged",
  "all",
]);

const VALID_ACTIONS = new Set<ImageModerationAction>([
  "approve",
  "reject",
  "flag",
  "unflag",
]);

/**
 * GET /api/upload/moderate?status=pending&limit=50&search=
 * List image moderation queue with live stats.
 */
export async function GET(request: Request) {
  try {
    const moderator = await requireMinRole("moderator");
    if (!moderator) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = (searchParams.get("status") || "pending") as ImageQueueFilter;
    const filter = VALID_FILTERS.has(statusParam) ? statusParam : "pending";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const search = searchParams.get("search") || undefined;
    const statsOnly = searchParams.get("statsOnly") === "true";

    if (statsOnly) {
      const stats = await getImageModerationStats();
      return NextResponse.json({ stats });
    }

    const result = await listModerationQueue({ filter, search, limit, page });
    return NextResponse.json(result);
  } catch (error) {
    logError(error, { component: "route:api/upload/moderate:GET" });
    return NextResponse.json({ error: "Failed to load moderation queue" }, { status: 500 });
  }
}

/**
 * POST /api/upload/moderate
 * Body: { imageId, action, reason? } or { imageIds, action, reason? } for bulk
 */
export async function POST(request: Request) {
  try {
    const moderator = await requireMinRole("moderator");
    if (!moderator) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as ImageModerationAction;
    const reason = typeof body.reason === "string" ? body.reason : undefined;

    if (!action || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be: approve, reject, flag, unflag" },
        { status: 400 },
      );
    }

    const imageIds: string[] = Array.isArray(body.imageIds)
      ? body.imageIds
      : body.imageId
        ? [body.imageId]
        : [];

    if (imageIds.length === 0) {
      return NextResponse.json({ error: "imageId or imageIds required" }, { status: 400 });
    }

    const results =
      imageIds.length === 1
        ? [
            {
              imageId: imageIds[0],
              success: true,
              image: await moderateListingImage(imageIds[0], action, moderator.id, reason),
            },
          ]
        : await bulkModerateListingImages(imageIds, action, moderator.id, reason);

    const stats = await getImageModerationStats();

    for (const imageId of imageIds) {
      logAdminAction(
        moderator.id,
        "settings_change",
        "ListingImage",
        imageId,
        { action, reason },
        extractIpAddress(request),
      );
    }

    return NextResponse.json({
      success: results.every((r) => r.success),
      results,
      stats,
    });
  } catch (error) {
    logError(error, { component: "route:api/upload/moderate:POST" });
    const message = error instanceof Error ? error.message : "Failed to moderate image";
    const status = message === "Image not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
