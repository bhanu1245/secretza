"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  QrCode,
  Upload,
  X,
  Loader2,
  ShieldX,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ImageIcon,
  Zap,
  Star,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore, useNavigationStore } from "@/store/useAppStore";

// ==========================================
// Types
// ==========================================
interface ManualPaymentPageProps {
  listingId?: string;
  paymentType: "boost" | "feature" | "premium";
  listingTitle?: string;
}

interface PricingTier {
  label: string;
  amount: number;
  durationMinutes?: number;
  durationDays?: number;
}

interface PreviousSubmission {
  id: string;
  listingId: string | null;
  paymentType: string;
  amount: number;
  utrNumber: string;
  screenshotUrl: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  adminNotes: string | null;
  createdAt: string;
}

// ==========================================
// Constants
// ==========================================

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const paymentTypeLabels: Record<string, string> = {
  boost: "Listing Boost",
  feature: "Featured Listing",
  premium: "Premium Membership",
};

const paymentTypeIcons: Record<string, typeof Zap> = {
  boost: Zap,
  feature: Star,
  premium: Crown,
};

const paymentTypeColors: Record<string, string> = {
  boost: "text-violet-400 bg-violet-500/15 border-violet-500/30",
  feature: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  premium: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
};

// ==========================================
// Status Badge
// ==========================================
function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
    pending: {
      color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      icon: Clock,
      label: "Pending",
    },
    approved: {
      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      icon: CheckCircle2,
      label: "Approved",
    },
    rejected: {
      color: "bg-red-500/15 text-red-400 border-red-500/30",
      icon: XCircle,
      label: "Rejected",
    },
  };

  const { color, icon: Icon, label } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
      <Icon className="size-3" />
      {label}
    </span>
  );
}

// ==========================================
// Main Component
// ==========================================
export default function ManualPaymentPage({
  listingId,
  paymentType,
  listingTitle,
}: ManualPaymentPageProps) {
  // Auth
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setAuthModalOpen = useAuthStore((s) => s.setAuthModalOpen);
  const setAuthModalTab = useAuthStore((s) => s.setAuthModalTab);

  // Navigation
  const goBack = useNavigationStore((s) => s.goBack);

  // Dynamic payment settings from API
  const [paymentConfig, setPaymentConfig] = useState<{
    upiId: string;
    whatsappNumber: string;
    instructions: string[];
    qrImageUrl: string | null;
    boostTiers?: PricingTier[];
    featuredTiers?: PricingTier[];
    premiumTiers?: PricingTier[];
  } | null>(null);

  // State — tiers come exclusively from PaymentSettings API; show loading until available
  const tiers = paymentConfig
    ? (paymentType === "boost"    ? (paymentConfig.boostTiers    ?? [])
     : paymentType === "feature"  ? (paymentConfig.featuredTiers ?? [])
     :                              (paymentConfig.premiumTiers   ?? []))
    : [];
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const tierOriginalAmount = tiers[selectedTierIndex]?.amount ?? 99;

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const selectedAmount = appliedCoupon?.finalAmount ?? tierOriginalAmount;

  const [utrNumber, setUtrNumber] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [previousSubmissions, setPreviousSubmissions] = useState<PreviousSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived
  const isFormValid = utrNumber.length === 12 && !submitting;

  const clearCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponError(null);
  }, []);

  const handleApplyCoupon = useCallback(async () => {
    const code = couponInput.trim();
    if (!code) {
      setCouponError("Enter a coupon code");
      return;
    }

    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          originalAmount: tierOriginalAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setAppliedCoupon(null);
        setCouponError(data.error || "Invalid coupon");
        return;
      }
      setAppliedCoupon({
        code: data.coupon.code,
        discountAmount: data.discountAmount,
        finalAmount: data.finalAmount,
      });
      toast.success("Coupon applied", {
        description: `You save ₹${data.discountAmount.toFixed(2)}`,
      });
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  }, [couponInput, tierOriginalAmount]);

  const handleTierSelect = useCallback((idx: number) => {
    setSelectedTierIndex(idx);
    clearCoupon();
    setCouponInput("");
  }, [clearCoupon]);
  const PaymentTypeIcon = paymentTypeIcons[paymentType] || Zap;
  const upiId = paymentConfig?.upiId ?? "";
  const whatsAppNumber = paymentConfig?.whatsappNumber ?? "";
  const instructions = paymentConfig?.instructions ?? [];

  // ========================
  // Auth guard
  // ========================
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setAuthModalTab("login");
      setAuthModalOpen(true);
      goBack();
    }
  }, [isAuthenticated, user, setAuthModalOpen, setAuthModalTab, goBack]);

  // ========================
  // Fetch payment settings (UPI ID, WhatsApp, instructions)
  // ========================
  useEffect(() => {
    let cancelled = false;
    async function fetchSettings() {
      try {
        const res = await fetch("/api/payment-settings");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setPaymentConfig(data);
          }
        }
      } catch {
        // Use fallback defaults
      }
    }
    fetchSettings();
    return () => { cancelled = true; };
  }, []);

  // ========================
  // Fetch QR code (prefer admin-uploaded static QR, else generate dynamic UPI QR)
  // ========================
  useEffect(() => {
    let cancelled = false;

    async function fetchQR() {
      setQrLoading(true);
      try {
        if (paymentConfig?.qrImageUrl) {
          if (!cancelled) {
            setQrDataUrl(paymentConfig.qrImageUrl);
          }
          return;
        }

        const qrParams = new URLSearchParams({
          amount: String(selectedAmount),
          paymentType,
          originalAmount: String(tierOriginalAmount),
        });
        if (appliedCoupon?.code) {
          qrParams.set("couponCode", appliedCoupon.code);
        }

        const res = await fetch(`/api/payments/manual/qr?${qrParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.qrDataUrl) {
            setQrDataUrl(data.qrDataUrl);
          }
        } else {
          console.warn("[ManualPaymentPage] dynamic QR generation failed", {
            status: res.status,
            amount: selectedAmount,
            paymentType,
          });
          if (!cancelled) {
            setQrDataUrl(null);
          }
        }
      } catch (error) {
        console.error("[ManualPaymentPage] failed to load payment QR", error);
        if (!cancelled) {
          setQrDataUrl(null);
        }
      } finally {
        if (!cancelled) {
          setQrLoading(false);
        }
      }
    }

    fetchQR();
    return () => {
      cancelled = true;
    };
  }, [selectedAmount, tierOriginalAmount, appliedCoupon?.code, paymentType, paymentConfig?.qrImageUrl]);

  // ========================
  // Fetch previous submissions
  // ========================
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    async function fetchSubmissions() {
      setLoadingSubmissions(true);
      try {
        const res = await fetch("/api/payments/manual");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.submissions) {
            setPreviousSubmissions(data.submissions);
          }
        }
      } catch {
        // Silently fail - previous submissions are supplementary info
      } finally {
        if (!cancelled) {
          setLoadingSubmissions(false);
        }
      }
    }

    fetchSubmissions();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // ========================
  // Handlers
  // ========================
  const handleCopyUPI = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      toast.success("UPI ID copied!", { description: upiId });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy", { description: "Please copy the UPI ID manually." });
    }
  }, [upiId]);

  const handleFileSelect = useCallback((file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Invalid file type", { description: "Please upload a JPG, PNG, or WebP image." });
      return;
    }
    if (file.size > MAX_SCREENSHOT_SIZE) {
      toast.error("File too large", { description: "Please upload an image under 5MB." });
      return;
    }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const removeScreenshot = useCallback(() => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      if (listingId) formData.append("listingId", listingId);
      formData.append("paymentType", paymentType);
      formData.append("amount", String(selectedAmount));
      formData.append("originalAmount", String(tierOriginalAmount));
      if (appliedCoupon?.code) formData.append("couponCode", appliedCoupon.code);
      formData.append("selectedPlan", tiers[selectedTierIndex]?.label || "");
      formData.append("paymentMethod", "upi");
      formData.append("utrNumber", utrNumber);
      if (notes.trim()) formData.append("notes", notes.trim());
      if (screenshotFile) formData.append("screenshot", screenshotFile);

      const res = await fetch("/api/payments/manual", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error || "Failed to submit payment proof. Please try again.";
        const fieldHint = data.field ? ` (${data.field})` : "";
        if (res.status === 409) {
          setSubmitError("Duplicate UTR number detected. This UTR has already been submitted.");
          toast.error("Duplicate UTR", { description: "This transaction number has already been used." });
        } else if (res.status === 429) {
          setSubmitError("Too many submissions. Please wait a moment before trying again.");
          toast.error("Rate limited", { description: "Please wait before submitting again." });
        } else {
          setSubmitError(`${errorMessage}${fieldHint}`);
          toast.error("Submission failed", { description: `${errorMessage}${fieldHint}` });
        }
        return;
      }

      setSubmitted(true);
      setSubmissionId(data.submission?.id || null);
      toast.success("Payment proof submitted!", {
        description: data.message || "Our team will review it shortly.",
      });
    } catch {
      const errorMsg = "Network error. Please check your connection and try again.";
      setSubmitError(errorMsg);
      toast.error("Submission failed", { description: errorMsg });
    } finally {
      setSubmitting(false);
    }
  }, [isFormValid, listingId, paymentType, selectedAmount, tierOriginalAmount, appliedCoupon, selectedTierIndex, tiers, utrNumber, notes, screenshotFile]);

  const handleUTRChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length <= 12) {
      setUtrNumber(value);
    }
  }, []);

  // ========================
  // Auth guard render
  // ========================
  if (!isAuthenticated || !user) {
    return null;
  }

  // ========================
  // Success state
  // ========================
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] px-4 py-8">
        <div className="mx-auto max-w-lg text-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-emerald-500/15 mx-auto">
            <CheckCircle2 className="size-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-[#F5F5F7] mb-2">
            Payment Proof Submitted!
          </h2>
          <p className="text-sm text-[#A1A1AA] mb-2">
            Your payment proof has been received and is under review.
          </p>
          {submissionId && (
            <p className="text-xs text-[#52525B] mb-6">
              Submission ID: {submissionId}
            </p>
          )}
          <p className="text-sm text-[#A1A1AA] mb-8">
            We typically verify payments within a few hours. You&apos;ll receive a
            notification once your {paymentTypeLabels[paymentType].toLowerCase()} is active.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={goBack}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[rgba(255,255,255,0.08)] bg-[#15151D] text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[#1E1E2A] hover:border-[rgba(255,255,255,0.15)] transition-all duration-200"
            >
              Go Back
            </button>
            <button
              onClick={() => {
                setSubmitted(false);
                setSubmissionId(null);
                setUtrNumber("");
                setScreenshotFile(null);
                setScreenshotPreview(null);
                setNotes("");
                setSubmitError(null);
              }}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] text-white shadow-md shadow-[#7C3AED]/20 transition-all duration-200"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // Loading state — wait for PaymentSettings before showing anything
  // ========================
  if (!paymentConfig) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 text-[#7C3AED] animate-spin" />
          <p className="text-sm text-[#A1A1AA]">Loading payment options…</p>
        </div>
      </div>
    );
  }

  // ========================
  // Main page
  // ========================
  return (
    <div className="min-h-screen bg-[#0B0B0F] px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Listing-required notice for boost/feature when no listing was pre-selected */}
        {(paymentType === "boost" || paymentType === "feature") && !listingId && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              After payment is confirmed, our team will contact you via WhatsApp to apply this {paymentType === "boost" ? "boost" : "featured badge"} to your listing.
              You can also go to your <button onClick={goBack} className="underline hover:text-amber-200">dashboard</button> and select a listing directly.
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={goBack}
            className="p-2 rounded-lg text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.05)] transition-all duration-200"
            aria-label="Go back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#F5F5F7]">
              Complete Your Payment
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${paymentTypeColors[paymentType]}`}>
                <PaymentTypeIcon className="size-3" />
                {paymentTypeLabels[paymentType]}
              </span>
              {listingTitle && (
                <span className="text-xs text-[#52525B] truncate">
                  for &quot;{listingTitle}&quot;
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ===== LEFT COLUMN - Payment Info ===== */}
          <div className="space-y-5">
            {/* Tier Selection */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5">
              <h3 className="text-sm font-semibold text-[#F5F5F7] mb-3 flex items-center gap-2">
                <PaymentTypeIcon className="size-4 text-[#7C3AED]" />
                Select Plan
              </h3>
              <div className="space-y-2">
                {tiers.map((tier, idx) => (
                  <button
                    key={tier.label}
                    onClick={() => handleTierSelect(idx)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all duration-200 ${
                      selectedTierIndex === idx
                        ? "bg-[#7C3AED]/15 text-[#8B5CF6] border-[#7C3AED]/30"
                        : "bg-[#1E1E2A] border-[rgba(255,255,255,0.06)] text-[#A1A1AA] hover:text-[#F5F5F7] hover:border-[rgba(255,255,255,0.12)]"
                    }`}
                  >
                    <span className="font-medium">{tier.label}</span>
                    <span className="font-bold text-lg">₹{tier.amount}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Coupon */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5">
              <h3 className="text-sm font-semibold text-[#F5F5F7] mb-3">Have a coupon?</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    if (appliedCoupon) clearCoupon();
                  }}
                  placeholder="Enter coupon code"
                  className="min-w-0 flex-1 rounded-lg bg-[#0B0B0F] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-sm text-[#F5F5F7] uppercase"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponInput.trim()}
                  className="rounded-lg bg-[#7C3AED]/15 px-4 py-2 text-sm font-medium text-[#8B5CF6] border border-[#7C3AED]/30 disabled:opacity-50"
                >
                  {couponLoading ? "..." : "Apply"}
                </button>
              </div>
              {couponError && (
                <p className="text-xs text-red-400 mt-2">{couponError}</p>
              )}
              {appliedCoupon && (
                <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm">
                  <p className="text-emerald-400 font-medium">{appliedCoupon.code} applied</p>
                  <p className="text-[#A1A1AA] text-xs mt-1">
                    Original ₹{tierOriginalAmount} · Discount ₹{appliedCoupon.discountAmount.toFixed(2)} · Pay ₹{appliedCoupon.finalAmount.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* QR Code Section */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5">
              <h3 className="text-sm font-semibold text-[#F5F5F7] mb-4 flex items-center gap-2">
                <QrCode className="size-4 text-[#7C3AED]" />
                Scan to Pay
              </h3>

              <div className="flex flex-col items-center">
                {/* QR Code */}
                <div className="w-56 h-56 rounded-xl bg-white p-3 mb-3 flex items-center justify-center">
                  {qrLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-8 text-[#52525B] animate-spin" />
                      <span className="text-xs text-[#52525B]">Loading QR...</span>
                    </div>
                  ) : qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="UPI Payment QR Code"
                      className="w-full h-full object-contain rounded-md"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <QrCode className="size-10 text-[#52525B]" />
                      <span className="text-xs text-[#52525B]">QR unavailable</span>
                      <span className="text-[10px] text-[#52525B]">Use UPI ID below</span>
                    </div>
                  )}
                </div>

                {/* Amount Badge */}
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#7C3AED]/15 border border-[#7C3AED]/30 mb-3">
                  <span className="text-xs text-[#8B5CF6]">Amount:</span>
                  <span className="text-lg font-bold text-[#8B5CF6]">₹{selectedAmount}</span>
                </div>

                <p className="text-xs text-[#A1A1AA]">
                  Scan with any UPI app
                </p>
              </div>
            </div>

            {/* UPI ID Section */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5">
              <h3 className="text-sm font-semibold text-[#F5F5F7] mb-3">UPI ID</h3>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1 break-all px-4 py-2.5 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.08)] font-mono text-sm text-[#F5F5F7]">
                  {upiId}
                </div>
                <button
                  onClick={handleCopyUPI}
                  className="p-2.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] text-[#A1A1AA] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.06)] transition-all duration-200"
                  aria-label="Copy UPI ID"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-400" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5">
              <h3 className="text-sm font-semibold text-[#F5F5F7] mb-3 flex items-center gap-2">
                <AlertCircle className="size-4 text-amber-400" />
                How to Pay
              </h3>
              <ol className="space-y-3">
                {instructions.map((instruction, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="flex items-center justify-center size-6 rounded-full bg-[#7C3AED]/15 text-[#8B5CF6] text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-[#A1A1AA] leading-relaxed">
                      {instruction}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {/* WhatsApp Contact */}
            <a
              href={`https://wa.me/${whatsAppNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi, I made a payment for ${paymentTypeLabels[paymentType].toLowerCase()}. Amount: ₹${selectedAmount}. Please confirm.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] text-sm font-medium hover:bg-[#25D366]/25 hover:border-[#25D366]/50 transition-all duration-200"
            >
              <MessageSquare className="size-4" />
              Contact on WhatsApp for Support
            </a>
          </div>

          {/* ===== RIGHT COLUMN - Submission Form ===== */}
          <div className="space-y-5">
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5 sm:p-6">
              <h3 className="text-base font-semibold text-[#F5F5F7] mb-5">
                Submit Payment Proof
              </h3>

              <div className="space-y-5">
                {/* UTR Number Input */}
                <div className="space-y-2">
                  <label
                    htmlFor="utr-number"
                    className="text-sm font-medium text-[#A1A1AA]"
                  >
                    UTR / Transaction Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="utr-number"
                    type="text"
                    value={utrNumber}
                    onChange={handleUTRChange}
                    placeholder="Enter 12-digit UTR number"
                    maxLength={12}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.08)] text-[#F5F5F7] text-sm font-mono uppercase placeholder:text-[#52525B] placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 transition-all duration-200"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#52525B]">
                      Find this in your UPI app&apos;s transaction history
                    </p>
                    <span className={`text-xs font-medium ${utrNumber.length === 12 ? "text-emerald-400" : "text-[#52525B]"}`}>
                      {utrNumber.length}/12
                    </span>
                  </div>
                </div>

                {/* Screenshot Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#A1A1AA]">
                    Payment Screenshot
                  </label>

                  {screenshotPreview ? (
                    <div className="relative rounded-lg overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[#1E1E2A]">
                      <img
                        src={screenshotPreview}
                        alt="Payment screenshot preview"
                        className="w-full max-h-48 object-contain"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-2">
                            <ImageIcon className="size-3 text-[#A1A1AA]" />
                            <span className="min-w-0 flex-1 truncate text-xs text-[#F5F5F7]">
                              {screenshotFile?.name}
                            </span>
                            <span className="text-xs text-[#52525B]">
                              {screenshotFile ? formatFileSize(screenshotFile.size) : ""}
                            </span>
                          </div>
                          <button
                            onClick={removeScreenshot}
                            className="p-1 rounded-md text-[#A1A1AA] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                            aria-label="Remove screenshot"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200 ${
                        isDragOver
                          ? "border-[#7C3AED] bg-[#7C3AED]/5"
                          : "border-[rgba(255,255,255,0.08)] bg-[#1E1E2A] hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.03)]"
                      }`}
                    >
                      <div className={`p-3 rounded-xl transition-colors ${isDragOver ? "bg-[#7C3AED]/15" : "bg-[rgba(255,255,255,0.05)]"}`}>
                        <Upload className={`size-5 transition-colors ${isDragOver ? "text-[#7C3AED]" : "text-[#52525B]"}`} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-[#A1A1AA]">
                          <span className="text-[#8B5CF6] font-medium">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-[#52525B] mt-1">
                          JPG, PNG, or WebP (max 5MB)
                        </p>
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>

                {/* Notes Textarea */}
                <div className="space-y-2">
                  <label
                    htmlFor="payment-notes"
                    className="text-sm font-medium text-[#A1A1AA]"
                  >
                    Notes
                    <span className="text-[#52525B] ml-1 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="payment-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes (optional)"
                    maxLength={500}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.08)] text-[#F5F5F7] text-sm placeholder:text-[#52525B] focus:outline-none focus:border-[#7C3AED] focus:ring-[#7C3AED]/30 resize-none transition-all duration-200"
                  />
                  <span className="text-xs text-[#52525B]">
                    {notes.length}/500
                  </span>
                </div>

                {/* Error Message */}
                {submitError && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                    <p className="text-sm text-red-400">{submitError}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={!isFormValid || submitting}
                  className="w-full px-4 py-3 rounded-lg text-sm font-medium bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#A78BFA] text-white shadow-md shadow-[#7C3AED]/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Payment Proof"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Previous Submissions ===== */}
        {previousSubmissions.length > 0 && (
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#15151D] p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-[#F5F5F7] mb-4 flex items-center gap-2">
              <Clock className="size-4 text-[#7C3AED]" />
              Recent Submissions
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {previousSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#1E1E2A] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] transition-all duration-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      <PaymentStatusBadge status={sub.status} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[#F5F5F7] font-medium truncate">
                        {paymentTypeLabels[sub.paymentType] || sub.paymentType} - ₹{sub.amount}
                      </p>
                      <p className="text-xs text-[#52525B] mt-0.5">
                        UTR: {sub.utrNumber} &middot;{" "}
                        {new Date(sub.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {sub.adminNotes && (
                        <p className="text-xs text-[#A1A1AA] mt-0.5 italic">
                          {sub.adminNotes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingSubmissions && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-5 text-[#52525B] animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
