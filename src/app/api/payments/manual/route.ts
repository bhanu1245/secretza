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

const VALID_PAYMENT_TYPES = ["boost", "feature", "premium"];

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/payments/manual
 * Submit a manual UPI payment proof
 */
export async function POST(request: Request) {
  try {
    // --- Authentication ---
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!session.user.isVerified) {
      return NextResponse.json(
        { error: "Email verification required" },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    // --- Rate Limiting ---
    const rateLimitResult = await rateLimit(
      `manualPayment:${userId}`,
      RATE_LIMITS.manualPayment
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many payment submissions. Please try again later.",
          resetAt: rateLimitResult.resetAt,
        },
        { status: 429 }
      );
    }

    // --- Parse FormData ---
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid request: expected multipart/form-data" },
        { status: 400 }
      );
    }

    const listingId = formData.get("listingId") as string | null;
    const paymentType = formData.get("paymentType") as string;
    const amountStr = formData.get("amount") as string;
    const utrNumber = formData.get("utrNumber") as string;
    const notes = formData.get("notes") as string | null;
    const screenshot = formData.get("screenshot") as File | null;

    // --- Validate required fields ---
    if (!paymentType || !VALID_PAYMENT_TYPES.includes(paymentType)) {
      return NextResponse.json(
        {
          error: `Invalid paymentType. Must be one of: ${VALID_PAYMENT_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!amountStr || isNaN(parseFloat(amountStr))) {
      return NextResponse.json(
        { error: "A valid amount is required" },
        { status: 400 }
      );
    }

    const amount = parseFloat(amountStr);

    // --- Validate amount against dynamic PaymentSettings ---
    const validAmounts = await getValidAmounts(paymentType as "boost" | "feature" | "premium");
    if (!validAmounts.includes(amount)) {
      return NextResponse.json(
        {
          error: `Invalid amount for ${paymentType}. Must be one of: ₹${validAmounts.join(", ₹")}`,
        },
        { status: 400 }
      );
    }

    // --- UTR Validation (12-digit alphanumeric) ---
    if (!utrNumber || !/^[A-Za-z0-9]{12}$/.test(utrNumber.trim())) {
      return NextResponse.json(
        {
          error: "UTR number must be exactly 12 alphanumeric characters",
        },
        { status: 400 }
      );
    }

    const utrTrimmed = utrNumber.trim().toUpperCase();

    // --- Duplicate UTR detection ---
    const existingSubmission = await db.manualPaymentSubmission.findUnique({
      where: { utrNumber: utrTrimmed },
    });

    if (existingSubmission) {
      return NextResponse.json(
        { error: "Duplicate UTR number detected" },
        { status: 409 }
      );
    }

    // --- Validate listing ownership if listingId is provided ---
    if (listingId) {
      const listing = await db.listing.findUnique({
        where: { id: listingId },
        select: { userId: true },
      });
      if (!listing) {
        return NextResponse.json(
          { error: "Listing not found" },
          { status: 404 }
        );
      }
      if (listing.userId !== userId) {
        return NextResponse.json(
          { error: "You do not own this listing" },
          { status: 403 }
        );
      }
    }

    // --- Screenshot validation ---
    let screenshotUrl: string | null = null;
    if (screenshot && screenshot.size > 0) {
      if (screenshot.size > MAX_SCREENSHOT_SIZE) {
        return NextResponse.json(
          { error: `Screenshot must be under ${MAX_SCREENSHOT_SIZE / (1024 * 1024)}MB` },
          { status: 400 }
        );
      }

      const bytes = await screenshot.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const detectedMime = detectMimeType(buffer);
      if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime as typeof ALLOWED_MIME_TYPES[number])) {
        return NextResponse.json(
          { error: "Invalid image format. Allowed: JPEG, PNG, WebP." },
          { status: 400 }
        );
      }
    }

    // --- Create submission in DB ---
    const submission = await db.manualPaymentSubmission.create({
      data: {
        userId,
        listingId: listingId || null,
        paymentType,
        amount,
        utrNumber: utrTrimmed,
        notes: notes || null,
        screenshotUrl: null,
        status: "pending",
      },
    });

    // --- Save screenshot file ---
    if (screenshot && screenshot.size > 0) {
      const uploadDir = path.join(
        process.cwd(),
        "uploads",
        "screenshots"
      );
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      const ext = screenshot.type === "image/png" ? "png" :
                  screenshot.type === "image/webp" ? "webp" : "jpg";
      const timestamp = Date.now();
      const fileName = `${submission.id}-${timestamp}.${ext}`;
      const filePath = path.join(uploadDir, fileName);

      const bytes = await screenshot.arrayBuffer();
      await writeFile(filePath, Buffer.from(bytes));

      const servingUrl = `/api/upload/file?key=screenshots/${fileName}`;
      await db.manualPaymentSubmission.update({
        where: { id: submission.id },
        data: { screenshotUrl: servingUrl },
      });

      screenshotUrl = servingUrl;
    }

    // --- Audit log ---
    await db.auditLog.create({
      data: {
        userId,
        action: "manual_payment_submitted",
        entityType: "ManualPaymentSubmission",
        entityId: submission.id,
        details: JSON.stringify({
          paymentType,
          amount,
          utrNumber: utrTrimmed,
          listingId: listingId || null,
          hasScreenshot: !!screenshotUrl,
        }),
      },
    });

    // --- Notification ---
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
          paymentType: submission.paymentType,
          amount: submission.amount,
          utrNumber: submission.utrNumber,
          status: submission.status,
          screenshotUrl,
          createdAt: submission.createdAt.toISOString(),
        },
        message: "Payment proof submitted successfully. Our team will review it shortly.",
      },
      { status: 201 }
    );
  } catch (error) {
    logError(error, { component: "route:api/payments/manual" });
    return NextResponse.json(
      { error: "Failed to submit payment proof" },
      { status: 500 }
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
        { error: "Authentication required" },
        { status: 401 }
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
      { error: "Failed to fetch payment submissions" },
      { status: 500 }
    );
  }
}
