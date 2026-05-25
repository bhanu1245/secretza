import { db } from "@/lib/db";

export async function createNotification({
  userId,
  type,
  title,
  message,
  entityType,
  entityId,
}: {
  userId: string;
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
}) {
  return db.notification.create({
    data: {
      userId,
      type,
      title,
      message: message || null,
      entityType: entityType || null,
      entityId: entityId || null,
    },
  });
}
