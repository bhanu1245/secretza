import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { logError } from "@/lib/monitoring";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { detectMimeType, ALLOWED_MIME_TYPES } from "@/lib/image-processing";
import { getValidAmounts } from "@/lib/payment-settings";
import {
  formatZodErrors,
  manualPaymentFormSchema,
} from "@/lib/manual-payment-validation";

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB

function parseFormField(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * POST /api/payments/manual
 * Submit a manual UPI payment proof (multipart/form-data)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required", field: "auth" },
        { status: 401 },
      );
    }
    if (!session.user.isVerified) {
      return NextResponse.json(
        {
          error: "Email verification required before submitting payment proof",
          field: "isVerified",
        },
        { status: 403 },
      );
    }

    const userId = session.user.id;

    const rateLimitResult = await rateLimit(
      `manualPayment:${userId}`,
      RATE_LIMITS.manualPayment,
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many payment submissions. Please try again later.",
          field: "rateLimit",
          resetAt: rateLimitResult.resetAt,
        },
        { status: 429 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      logError(error, { component: "route:api/payments/manual", step: "parse-form-data" });
      return NextResponse.json(
        {
          error: "Expected multipart/form-data payload",
          field: "contentType",
          details: "Send FormData with listingId, paymentType, amount, utrNumber, screenshot, notes",
        },
        { status: 400 },
      );
    }

    const parsed = manualPaymentFormSchema.safeParse({
      listingId: parseFormField(formData.get("listingId")),
      paymentType: parseFormField(formData.get("paymentType")),
      amount: parseFormField(formData.get("amount")),
      utrNumber: parseFormField(formData.get("utrNumber")),
      selectedPlan: parseFormField(formData.get("selectedPlan")),
      paymentMethod: parseFormField(formData.get("paymentMethod")) ?? "upi",
      notes: parseFormField(formData.get("notes")),
    });

    if (!parsed.success) {
      const validationError = formatZodErrors(parsed.error);
      console.warn("[payments/manual] validation failed", validationError);
      return NextResponse.json(validationError, { status: 400 });
    }

    const {
      listingId,
      paymentType,
      amount,
      utrNumber,
      selectedPlan,
      paymentMethod,
      notes,
    } = parsed.data;

    const validAmounts = await getValidAmounts(paymentType);
    if (!validAmounts.includes(amount)) {
      return NextResponse.json(
        {
          error: `Invalid amount for ${paymentType}. Must be one of: ₹${validAmounts.join(", ₹")}`,
          field: "amount",
          validAmounts,
        },
        { status: 400 },
      );
    }

    const existingSubmission = await db.manualPaymentSubmission.findUnique({
      where: { utrNumber },
    });
    if (existingSubmission) {
      return NextResponse.json(
        {
          error: "Duplicate UTR number detected",
          field: "utrNumber",
        },
        { status: 409 },
      );
    }

    if (listingId) {
      const listing = await db.listing.findUnique({
        where: { id: listingId },
        select: { userId: true, title: true },
      });
      if (!listing) {
        return NextResponse.json(
          { error: "Listing not found", field: "listingId" },
          { status: 404 },
        );
      }
      if (listing.userId !== userId) {
        return NextResponse.json(
          { error: "You do not own this listing", field: "listingId" },
          { status: 403 },
        );
      }
    }

    const screenshot = formData.get("screenshot");
    const screenshotFile = screenshot instanceof File && screenshot.size > 0 ? screenshot : null;

    if (screenshotFile) {
      if (screenshotFile.size > MAX_SCREENSHOT_SIZE) {
        return NextResponse.json(
          {
            error: `Screenshot must be under ${MAX_SCREENSHOT_SIZE / (1024 * 1024)}MB`,
            field: "screenshot",
          },
          { status: 400 },
        );
      }

      const bytes = await screenshotFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const detectedMime = detectMimeType(buffer);
      if (
        !detectedMime ||
        !ALLOWED_MIME_TYPES.includes(detectedMime as (typeof ALLOWED_MIME_TYPES)[number])
      ) {
        return NextResponse.json(
          {
            error: "Invalid image format. Allowed: JPEG, PNG, WebP.",
            field: "screenshot",
          },
          { status: 400 },
        );
      }
    }

    const submission = await db.manualPaymentSubmission.create({
      data: {
        userId,
        listingId: listingId ?? null,
        paymentType,
        amount,
        utrNumber,
        planLabel: selectedPlan ?? null,
        paymentMethod: paymentMethod ?? "upi",
        notes: notes ?? null,
        screenshotUrl: null,
        status: "pending",
      },
    });

    let screenshotUrl: string | null = null;
    if (screenshotFile) {
      const uploadDir = path.join(process.cwd(), "uploads", "screenshots");
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      const ext =
        screenshotFile.type === "image/png"
          ? "png"
          : screenshotFile.type === "image/webp"
            ? "webp"
            : "jpg";
      const fileName = `${submission.id}-${Date.now()}.${ext}`;
      const filePath = path.join(uploadDir, fileName);

      const bytes = await screenshotFile.arrayBuffer();
      await writeFile(filePath, Buffer.from(bytes));

      screenshotUrl = `/api/upload/file?key=screenshots/${fileName}`;
      await db.manualPaymentSubmission.update({
        where: { id: submission.id },
        data: { screenshotUrl },
      });
    }

    await db.auditLog.create({
      data: {
        userId,
        action: "manual_payment_submitted",
        entityType: "ManualPaymentSubmission",
        entityId: submission.id,
        details: JSON.stringify({
          paymentType,
          amount,
          utrNumber,
          listingId: listingId ?? null,
          selectedPlan: selectedPlan ?? null,
          paymentMethod: paymentMethod ?? "upi",
          hasScreenshot: Boolean(screenshotUrl),
        }),
      },
    });

    await createNotification({
      userId,
      type: "payment_submitted",
      title: "Payment Proof Submitted",
      message: `Your ${paymentType} payment of ₹${amount} has been submitted and is under review.`,
      entityType: "ManualPaymentSubmission",
      entityId: submission.id,
    });

    return NextResponse.json(
      {
        success: true,
        submission: {
          id: submission.id,
          listingId: submission.listingId,
          paymentType: submission.paymentType,
          amount: submission.amount,
          utrNumber: submission.utrNumber,
          selectedPlan: submission.planLabel,
          paymentMethod: submission.paymentMethod,
          status: submission.status,
          screenshotUrl,
          notes: submission.notes,
          createdAt: submission.createdAt.toISOString(),
        },
        message: "Payment proof submitted successfully. Our team will review it shortly.",
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(error, { component: "route:api/payments/manual", message });
    console.error("[payments/manual] POST failed:", message, error);
    return NextResponse.json(
      {
        error: "Failed to submit payment proof",
        field: "server",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/payments/manual
 * Retrieve all manual payment submissions for the current user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required", field: "auth" },
        { status: 401 },
      );
    }

    const submissions = await db.manualPaymentSubmission.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        listingId: true,
        paymentType: true,
        amount: true,
        utrNumber: true,
        screenshotUrl: true,
        planLabel: true,
        paymentMethod: true,
        notes: true,
        status: true,
        adminNotes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      submissions: submissions.map((s) => ({
        id: s.id,
        listingId: s.listingId,
        paymentType: s.paymentType,
        amount: s.amount,
        utrNumber: s.utrNumber,
        screenshotUrl: s.screenshotUrl,
        selectedPlan: s.planLabel,
        paymentMethod: s.paymentMethod,
        notes: s.notes,
        status: s.status,
        adminNotes: s.adminNotes,
        createdAt: s.createdAt.toISOString(),
      })),
      total: submissions.length,
    });
  } catch (error) {
    logError(error, { component: "route:api/payments/manual" });
    return NextResponse.json(
      { error: "Failed to fetch payment submissions", field: "server" },
      { status: 500 },
    );
  }
}
