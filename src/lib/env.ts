/**
 * Secretza Environment Configuration
 *
 * Validates all environment variables at startup using Zod schemas.
 * Supports development, staging, and production profiles.
 *
 * Usage:
 *   import { env, isProduction, isDevelopment, isStaging, runtimeConfig } from '@/lib/env';
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

/** Rejects empty strings — process.env always gives `string | undefined` */
const nonEmptyString = z.string().min(1, "Required but empty");

/** Accepts a URL or a connection string */
const urlString = z.string().url("Must be a valid URL");

/** Accepts an unsigned integer */
const portString = z
  .string()
  .regex(/^\d{1,5}$/, "Must be a valid port number (1-65535)")
  .transform(Number)
  .pipe(z.int().min(1).max(65535));

// ---------------------------------------------------------------------------
// Environment profiles
// ---------------------------------------------------------------------------

const ENV_PROFILES = ["development", "staging", "production", "test"] as const;
type EnvProfile = (typeof ENV_PROFILES)[number];

// ---------------------------------------------------------------------------
// Schema — all variables the app may reference
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // ---- Core ----
  NODE_ENV: z.enum(ENV_PROFILES).default("development"),

  /** Public-facing origin used by the browser and Next.js client. */
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_SITE_URL is required")
    .default("http://localhost:3000"),

  // ---- NextAuth ----
  NEXTAUTH_URL: z.string().min(1, "NEXTAUTH_URL is required"),
  NEXTAUTH_SECRET: nonEmptyString.min(
    32,
    "NEXTAUTH_SECRET must be at least 32 characters"
  ),

  // ---- Database ----
  DATABASE_URL: nonEmptyString,

  // ---- Google OAuth (optional) ----
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // ---- Cloudflare R2 / S3-compatible uploads (optional) ----
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),

  // Fallback S3-compatible provider (optional)
  STORAGE_PROVIDER: z.enum(["local", "r2", "s3"]).default("local"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  LOCAL_PUBLIC_URL: z.string().optional(),

  // ---- Analytics (optional) ----
  GA_MEASUREMENT_ID: z.string().optional(),
  GA_API_SECRET: z.string().optional(),
  PLAUSIBLE_DOMAIN: z.string().optional(),
  PLAUSIBLE_API_TOKEN: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),

  // ---- SEO site verification (optional) ----
  GOOGLE_SITE_VERIFICATION: z.string().optional(),
  BING_SITE_VERIFICATION: z.string().optional(),
  YANDEX_SITE_VERIFICATION: z.string().optional(),

  // ---- Sentry (optional) ----
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // ---- Cron (optional) ----
  CRON_SECRET: z.string().optional(),

  // ---- Redis (optional) ----
  REDIS_URL: z.string().url("Must be a valid Redis URL").optional(),

  // ---- Security / Virus Scanning (optional) ----
  CLAMAV_HOST: z.string().optional(),

  // ---- Email / SMTP (optional) ----
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: portString.optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Parse + validate
// ---------------------------------------------------------------------------

function formatZodError(error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return `  ❌ ${path}: ${issue.message}`;
    })
    .join("\n");

  return `Environment validation failed:\n${issues}\n\nPlease check your .env.local file.`;
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = formatZodError(parsed.error);
  // In production this is fatal; in dev we still warn loudly
  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  } else {
    console.error("\n" + message + "\n");
    // Still assign a partial env so dev doesn't crash completely
  }
}

/**
 * Validated environment variables.
 *
 * All keys are strongly typed. Optional fields may be `undefined`.
 */
export const env = (parsed.success ? parsed.data : process.env) as z.infer<
  typeof envSchema
>;

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------

export function isProduction(): boolean {
  return env.NODE_ENV === "production";
}

export function isStaging(): boolean {
  return env.NODE_ENV === "staging";
}

export function isDevelopment(): boolean {
  return env.NODE_ENV === "development";
}

export function isTest(): boolean {
  return env.NODE_ENV === "test";
}

/** Current environment profile */
export function getProfile(): EnvProfile {
  return env.NODE_ENV;
}

// ---------------------------------------------------------------------------
// Runtime config — derived values convenient for components / API routes
// ---------------------------------------------------------------------------

export function runtimeConfig() {
  return {
    /** Whether uploads should use R2 / S3 instead of local filesystem */
    isCloudStorage: env.STORAGE_PROVIDER === "r2" || env.STORAGE_PROVIDER === "s3",

    /** Whether Google OAuth is configured */
    isGoogleOAuthEnabled:
      Boolean(env.GOOGLE_CLIENT_ID) && Boolean(env.GOOGLE_CLIENT_SECRET),

    /** Whether Resend email is configured */
    isEmailEnabled: Boolean(env.RESEND_API_KEY),

    /** Whether SMTP is configured as a fallback for email */
    isSmtpEnabled:
      Boolean(env.SMTP_HOST) &&
      Boolean(env.SMTP_USER) &&
      Boolean(env.SMTP_PASS),

    /** Whether R2 is configured */
    isR2Configured:
      Boolean(env.R2_ACCESS_KEY_ID) &&
      Boolean(env.R2_SECRET_ACCESS_KEY) &&
      Boolean(env.R2_BUCKET) &&
      Boolean(env.R2_ENDPOINT),

    /** Whether Google Analytics is configured */
    isGAEnabled: Boolean(env.GA_MEASUREMENT_ID),

    /** Whether Plausible analytics is configured */
    isPlausibleEnabled: Boolean(env.PLAUSIBLE_DOMAIN),

    /** Public site origin (without trailing slash) */
    siteUrl: env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, ""),

    /** Whether Google site verification is set */
    isGoogleSiteVerificationEnabled: Boolean(env.GOOGLE_SITE_VERIFICATION),
  };
}

// ---------------------------------------------------------------------------
// Feature flags — convenient booleans that gate optional subsystems
// ---------------------------------------------------------------------------

export const features = {
  get cloudStorage() {
    return runtimeConfig().isCloudStorage;
  },
  get googleOAuth() {
    return runtimeConfig().isGoogleOAuthEnabled;
  },
  get email() {
    return runtimeConfig().isEmailEnabled || runtimeConfig().isSmtpEnabled;
  },
  get analytics() {
    return runtimeConfig().isGAEnabled || runtimeConfig().isPlausibleEnabled;
  },
  get r2() {
    return runtimeConfig().isR2Configured;
  },
  get redis() {
    return Boolean(process.env.REDIS_URL);
  },
};
