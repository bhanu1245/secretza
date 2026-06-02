// ==========================================
// UPI QR Code Generator
// ==========================================
// Generates UPI QR codes as data URLs for manual payment flow.

import { toDataURL } from "qrcode";

// ==========================================
// Types
// ==========================================

export interface UPIQRParams {
  /** UPI ID (e.g. "SecretZa@ybl") */
  upiId?: string;
  /** Payee name shown in UPI app */
  name?: string;
  /** Amount to pay (must be > 0) */
  amount: number;
  /** Transaction note / remark */
  note?: string;
  /** Currency code (default: INR) */
  currency?: string;
}

export interface UPIConfig {
  upiId: string;
  name: string;
  phone: string;
  paymentInstructions: string[];
}

// ==========================================
// Constants
// ==========================================

export const UPI_CONFIG: UPIConfig = {
  upiId: "SecretZa@ybl",
  name: "SecretZa",
  phone: "+919876543210",
  paymentInstructions: [
    "Open any UPI app (Google Pay, PhonePe, Paytm, etc.)",
    "Scan the QR code or send payment to the UPI ID",
    "Enter the exact amount shown",
    "After payment, note down the 12-digit UTR number",
    "Come back here and submit the UTR with screenshot",
  ],
};

// ==========================================
// Helpers
// ==========================================

function buildUPIDeepLink(params: UPIQRParams): string {
  const upiId = params.upiId ?? UPI_CONFIG.upiId;
  const name = params.name ?? UPI_CONFIG.name;
  const currency = params.currency ?? "INR";

  const queryParams = new URLSearchParams();
  queryParams.set("pa", upiId);
  queryParams.set("pn", name);
  queryParams.set("am", params.amount.toFixed(2));
  queryParams.set("cu", currency);

  if (params.note) {
    queryParams.set("tn", params.note);
  }

  return `upi://pay?${queryParams.toString()}`;
}

// ==========================================
// Main Export
// ==========================================

/**
 * Generates a UPI QR code as a base64 PNG data URL.
 *
 * @example
 * ```ts
 * const dataUrl = await generateUPIQRCode({ amount: 499 });
 * // "data:image/png;base64,iVBORw0KGgo..."
 * ```
 */
export async function generateUPIQRCode(
  params: UPIQRParams,
): Promise<string> {
  if (!params.amount || params.amount <= 0) {
    throw new Error("UPI QR generation requires a positive amount.");
  }

  const upiLink = buildUPIDeepLink(params);

  const dataUrl = await toDataURL(upiLink, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  return dataUrl;
}
