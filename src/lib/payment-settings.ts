// ==========================================
// Payment Settings Helper
// ==========================================
// Shared utilities for reading, validating, and
// managing the PaymentSettings singleton.

import { db } from "@/lib/db";

// ==========================================
// Types
// ==========================================

export interface PricingTier {
  label: string;
  amount: number;
  durationMinutes?: number; // for boost
  durationDays?: number; // for feature / premium
}

export interface PaymentSettingsData {
  id: string;
  upiId: string;
  whatsappNumber: string;
  boostPrice: number;
  featuredPrice: number;
  premiumPrice: number;
  qrImageUrl: string | null;
  instructions: string[];
  boostTiers: PricingTier[];
  featuredTiers: PricingTier[];
  premiumTiers: PricingTier[];
}

// ==========================================
// Validation Helpers
// ==========================================

/** UPI ID must match format: name@provider */
const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z0-9.\-]{2,}$/;

/** E.164 phone number (with optional leading +) */
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export function validateUpiId(upiId: string): string | null {
  if (!upiId || typeof upiId !== "string") return "UPI ID is required";
  if (upiId.length < 3 || upiId.length > 80) return "UPI ID must be 3-80 characters";
  if (!UPI_REGEX.test(upiId.trim())) return "Invalid UPI format (expected: name@provider)";
  return null;
}

export function validateWhatsappNumber(phone: string): string | null {
  if (!phone || typeof phone !== "string") return "WhatsApp number is required";
  const trimmed = phone.trim();
  if (trimmed.length < 8 || trimmed.length > 16) return "Phone number must be 8-16 digits";
  if (!PHONE_REGEX.test(trimmed)) return "Invalid phone format (use E.164, e.g. +919876543210)";
  return null;
}

export function validatePrice(price: unknown, fieldName: string): string | null {
  if (price === undefined || price === null) return `${fieldName} is required`;
  const num = Number(price);
  if (isNaN(num)) return `${fieldName} must be a number`;
  if (num < 0) return `${fieldName} must be ≥ 0`;
  if (num > 999999) return `${fieldName} must be ≤ 999,999`;
  return null;
}

export function validateTier(tier: unknown, index: number): string | null {
  if (!tier || typeof tier !== "object") return `Tier ${index + 1}: must be an object`;
  const t = tier as Record<string, unknown>;
  if (!t.label || typeof t.label !== "string" || t.label.trim().length === 0) {
    return `Tier ${index + 1}: label is required`;
  }
  const amountErr = validatePrice(t.amount, `Tier ${index + 1} amount`);
  if (amountErr) return amountErr;
  if (t.durationMinutes !== undefined && typeof t.durationMinutes !== "number") {
    return `Tier ${index + 1}: durationMinutes must be a number`;
  }
  if (t.durationDays !== undefined && typeof t.durationDays !== "number") {
    return `Tier ${index + 1}: durationDays must be a number`;
  }
  return null;
}

export function validateInstructions(instructions: unknown): string | null {
  if (instructions === undefined || instructions === null) return null;
  try {
    const parsed = typeof instructions === "string" ? JSON.parse(instructions) : instructions;
    if (!Array.isArray(parsed)) return "Instructions must be a JSON array";
    if (parsed.length > 20) return "Maximum 20 instruction steps allowed";
    for (let i = 0; i < parsed.length; i++) {
      if (typeof parsed[i] !== "string") return `Instruction ${i + 1} must be a string`;
      if (parsed[i].length > 500) return `Instruction ${i + 1} exceeds 500 characters`;
    }
    return null;
  } catch {
    return "Instructions must be valid JSON";
  }
}

// ==========================================
// Default Values
// ==========================================

export const DEFAULT_PAYMENT_SETTINGS = {
  upiId: "SecretZa@ybl",
  whatsappNumber: "+919876543210",
  boostPrice: 199,
  featuredPrice: 399,
  premiumPrice: 999,
  instructions: [
    "Open any UPI app (Google Pay, PhonePe, Paytm, etc.)",
    "Scan the QR code or send payment to the UPI ID",
    "Enter the exact amount shown",
    "After payment, note down the 12-digit UTR number",
    "Come back here and submit the UTR with screenshot",
  ],
  boostTiers: [
    { label: "1 Hour Boost", amount: 99, durationMinutes: 60 },
    { label: "6 Hour Boost", amount: 199, durationMinutes: 360 },
    { label: "24 Hour Boost", amount: 499, durationMinutes: 1440 },
  ],
  featuredTiers: [
    { label: "3 Day Featured", amount: 149, durationDays: 3 },
    { label: "7 Day Featured", amount: 399, durationDays: 7 },
    { label: "14 Day Featured", amount: 799, durationDays: 14 },
  ],
  premiumTiers: [
    { label: "30 Day Premium", amount: 999, durationDays: 30 },
  ],
};

// ==========================================
// Database Access
// ==========================================

/**
 * Get the PaymentSettings singleton, creating with defaults if none exists.
 * This is the single source of truth for all payment config reads.
 */
export async function getPaymentSettings(): Promise<PaymentSettingsData> {
  let settings = await db.paymentSettings.findFirst();

  if (!settings) {
    settings = await db.paymentSettings.create({
      data: {
        upiId: DEFAULT_PAYMENT_SETTINGS.upiId,
        whatsappNumber: DEFAULT_PAYMENT_SETTINGS.whatsappNumber,
        boostPrice: DEFAULT_PAYMENT_SETTINGS.boostPrice,
        featuredPrice: DEFAULT_PAYMENT_SETTINGS.featuredPrice,
        premiumPrice: DEFAULT_PAYMENT_SETTINGS.premiumPrice,
        instructions: JSON.stringify(DEFAULT_PAYMENT_SETTINGS.instructions),
        boostTiers: JSON.stringify(DEFAULT_PAYMENT_SETTINGS.boostTiers),
        featuredTiers: JSON.stringify(DEFAULT_PAYMENT_SETTINGS.featuredTiers),
        premiumTiers: JSON.stringify(DEFAULT_PAYMENT_SETTINGS.premiumTiers),
      },
    });
  }

  return parsePaymentSettings(settings);
}

/**
 * Parse a raw Prisma PaymentSettings row into our typed interface.
 */
function parsePaymentSettings(raw: {
  id: string;
  upiId: string;
  whatsappNumber: string;
  boostPrice: number;
  featuredPrice: number;
  premiumPrice: number;
  qrImageUrl: string | null;
  instructions: string | null;
  boostTiers: string | null;
  featuredTiers: string | null;
  premiumTiers: string | null;
}): PaymentSettingsData {
  const parseTiers = (json: string | null, fallback: PricingTier[]): PricingTier[] => {
    if (!json) return fallback;
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return parsed;
      return fallback;
    } catch {
      return fallback;
    }
  };

  const parseInstructions = (json: string | null): string[] => {
    if (!json) return DEFAULT_PAYMENT_SETTINGS.instructions;
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return parsed;
      return DEFAULT_PAYMENT_SETTINGS.instructions;
    } catch {
      return DEFAULT_PAYMENT_SETTINGS.instructions;
    }
  };

  return {
    id: raw.id,
    upiId: raw.upiId,
    whatsappNumber: raw.whatsappNumber,
    boostPrice: raw.boostPrice,
    featuredPrice: raw.featuredPrice,
    premiumPrice: raw.premiumPrice,
    qrImageUrl: raw.qrImageUrl,
    instructions: parseInstructions(raw.instructions),
    boostTiers: parseTiers(raw.boostTiers, DEFAULT_PAYMENT_SETTINGS.boostTiers),
    featuredTiers: parseTiers(raw.featuredTiers, DEFAULT_PAYMENT_SETTINGS.featuredTiers),
    premiumTiers: parseTiers(raw.premiumTiers, DEFAULT_PAYMENT_SETTINGS.premiumTiers),
  };
}

/**
 * Get valid payment amounts for a given type from PaymentSettings.
 * Used by payment validation routes.
 */
export async function getValidAmounts(
  type: "boost" | "feature" | "premium"
): Promise<number[]> {
  const settings = await getPaymentSettings();
  const tiers =
    type === "boost"
      ? settings.boostTiers
      : type === "feature"
        ? settings.featuredTiers
        : settings.premiumTiers;
  return tiers.map((t) => t.amount);
}

// ==========================================
// Duration Lookup — single source of truth
// ==========================================

export interface TierDuration {
  /** Minutes for boost tiers; 0 for feature/premium. */
  durationMinutes: number;
  /** Days for feature/premium tiers; 0 for boost. */
  durationDays: number;
  /** The matched tier label, for audit logging. */
  label: string;
  /** Whether a tier was actually found (false = safe default applied). */
  matched: boolean;
}

/**
 * Resolve the duration that should be granted for a given payment type and
 * amount by reading live PaymentSettings from the database.
 *
 * This is the ONLY place in the application that maps (type, amount) →
 * duration.  All activation code must call this function; no caller may
 * maintain its own lookup table.
 *
 * Safe-default policy when no tier matches `amount`:
 *   - boost:   60 minutes  (least-valuable tier)
 *   - feature: 3 days      (least-valuable tier)
 *   - premium: 30 days     (only tier)
 *
 * A mismatch means PaymentSettings was changed between submission and
 * approval.  The function logs a warning so operators can investigate.
 */
export async function getDurationForTier(
  type: "boost" | "feature" | "premium",
  amount: number,
): Promise<TierDuration> {
  const settings = await getPaymentSettings();
  const tiers =
    type === "boost"
      ? settings.boostTiers
      : type === "feature"
        ? settings.featuredTiers
        : settings.premiumTiers;

  // Match by exact amount (same logic used by getValidAmounts)
  const tier = tiers.find((t) => t.amount === amount);

  if (tier) {
    return {
      durationMinutes: tier.durationMinutes ?? 0,
      durationDays: tier.durationDays ?? 0,
      label: tier.label,
      matched: true,
    };
  }

  // No tier found — PaymentSettings changed after the submission was created.
  // Apply a safe minimum and let the caller log/alert.
  const safeDefaults: Record<"boost" | "feature" | "premium", TierDuration> = {
    boost:   { durationMinutes: 60,  durationDays: 0,  label: "(fallback) 1 Hour",   matched: false },
    feature: { durationMinutes: 0,   durationDays: 3,  label: "(fallback) 3 Days",   matched: false },
    premium: { durationMinutes: 0,   durationDays: 30, label: "(fallback) 30 Days",  matched: false },
  };

  console.warn("[getDurationForTier] no tier matched — PaymentSettings may have changed", {
    type,
    amount,
    availableAmounts: tiers.map((t) => t.amount),
    fallback: safeDefaults[type],
  });

  return safeDefaults[type];
}
