---
Task ID: 1
Agent: Main Agent
Task: Create complete Payment Settings system

Work Log:
- Explored entire codebase: Prisma schema, payment routes, admin UI, ManualPaymentPage, QR generation, upload patterns
- Updated `prisma/schema.prisma`: added `boostTiers`, `featuredTiers`, `premiumTiers` JSON fields to PaymentSettings model
- Ran `bun run db:push` — schema synced successfully
- Created `src/lib/payment-settings.ts` — shared helper with:
  - Types: `PricingTier`, `PaymentSettingsData`
  - Validation: `validateUpiId()` (regex), `validateWhatsappNumber()` (E.164), `validatePrice()`, `validateTier()`, `validateInstructions()`
  - Defaults: `DEFAULT_PAYMENT_SETTINGS` with 3 boost tiers, 3 featured tiers, 1 premium tier
  - `getPaymentSettings()` — singleton getter with auto-seed
  - `getValidAmounts()` — returns valid amounts per payment type from DB
- Rewrote `src/app/api/admin/payment-settings/route.ts`:
  - GET: uses `getPaymentSettings()` shared helper
  - PATCH (new): full validation for all fields including tiers, uses shared validators
- Rewrote `src/app/api/payment-settings/route.ts` (public):
  - GET: returns tier arrays (`boostTiers`, `featuredTiers`, `premiumTiers`)
- Created `src/app/api/admin/payment-settings/upload/route.ts`:
  - POST: QR image upload with MIME validation via magic bytes, 2MB limit
  - Saves to `uploads/payment-qr/`, updates PaymentSettings.qrImageUrl
- Rewrote `src/app/api/payments/manual/route.ts`:
  - Replaced hardcoded `VALID_AMOUNTS` with `getValidAmounts()` from PaymentSettings
- Rewrote `src/app/api/payments/manual/qr/route.ts`:
  - Replaced hardcoded `VALID_QR_AMOUNTS` with dynamic amounts from PaymentSettings
  - Uses `getPaymentSettings()` for UPI ID
- Rewrote `src/app/api/payments/route.ts`:
  - Replaced hardcoded `VALID_AMOUNTS` with `getValidAmounts()` from PaymentSettings
- Updated `src/components/secretza/admin/AdminPanel.tsx`:
  - Added `Upload`, `Plus` icon imports
  - Complete rebuild of `UPIPaymentSettings` component:
    - QR image upload with preview, drag-and-drop support
    - Real-time UPI format validation (regex)
    - Real-time phone validation (E.164)
    - Tier editor with add/remove/edit per type (boost=minutes, featured/premium=days)
    - Base prices section
    - Instructions editor
    - Uses PATCH method instead of PUT
- Updated `src/components/secretza/payment/ManualPaymentPage.tsx`:
  - `PricingTier` interface now includes `durationMinutes`/`durationDays`
  - Replaced hardcoded `pricingTiers` with `FALLBACK_TIERS` (same values, for offline)
  - Loads dynamic tiers from `/api/payment-settings` API response
  - Falls back to `FALLBACK_TIERS` if API unavailable
- Verified: lint 0 errors, homepage 200, public API 200 (returns tiers), admin API 401 (auth required), PATCH 401 (auth required)

Stage Summary:
- Complete Payment Settings system implemented
- All pricing now dynamically configurable from PaymentSettings DB table
- Admin can upload QR images, edit UPI/WhatsApp, configure pricing tiers per type
- ManualPaymentPage loads tiers dynamically with offline fallback
- All payment validation routes (manual, QR, gateway) validate against dynamic settings
- Auto-seeds with sensible defaults on first access
