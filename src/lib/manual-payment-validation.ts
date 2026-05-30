import { z } from "zod";

export const VALID_PAYMENT_TYPES = ["boost", "feature", "premium"] as const;
export const VALID_PAYMENT_METHODS = ["upi", "bank_transfer", "other"] as const;

export type ManualPaymentType = (typeof VALID_PAYMENT_TYPES)[number];

export const manualPaymentFormSchema = z
  .object({
    listingId: z.string().trim().min(1).optional().nullable(),
    paymentType: z.enum(VALID_PAYMENT_TYPES, {
      error: "paymentType must be boost, feature, or premium",
    }),
    amount: z.coerce
      .number({ error: "amount must be a number" })
      .positive("amount must be greater than 0"),
    utrNumber: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(
        z
          .string()
          .regex(/^[A-Z0-9]{12}$/, "utrNumber must be exactly 12 alphanumeric characters"),
      ),
    selectedPlan: z.string().trim().min(1).max(120).optional().nullable(),
    paymentMethod: z.enum(VALID_PAYMENT_METHODS).optional().default("upi"),
    notes: z.string().trim().max(500).optional().nullable(),
    couponCode: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .optional()
      .nullable(),
    originalAmount: z.coerce
      .number({ error: "originalAmount must be a number" })
      .positive("originalAmount must be greater than 0")
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    // boost and feature are listing-level — a listingId is mandatory.
    // premium is account-level and does not require a listing.
    if (
      (data.paymentType === "boost" || data.paymentType === "feature") &&
      !data.listingId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["listingId"],
        message: `listingId is required for ${data.paymentType} payments`,
      });
    }
  });

export type ManualPaymentFormInput = z.infer<typeof manualPaymentFormSchema>;

export function formatZodErrors(error: z.ZodError) {
  const fieldErrors = error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
  const first = fieldErrors[0];
  return {
    error: first?.message || "Validation failed",
    field: first?.field || "body",
    fields: fieldErrors,
  };
}
