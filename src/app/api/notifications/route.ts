import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/monitoring";

/**
 * GET /api/notifications
 * Return notifications for the authenticated user (paginated, newest first, with unread count)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Fetch notifications and unread count in parallel
    const [notifications, unreadCount, totalCount] = await Promise.all([
      db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          entityType: true,
          entityId: true,
          isRead: true,
          createdAt: true,
        },
      }),
      db.notification.count({
        where: { userId, isRead: false },
      }),
      db.notification.count({
        where: { userId },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: n.entityType,
        entityId: n.entityId,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
      total: totalCount,
      page,
      limit,
      hasMore: skip + notifications.length < totalCount,
    });
  } catch (error) {
    logError(error, { component: "route:api/notifications" });
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}
