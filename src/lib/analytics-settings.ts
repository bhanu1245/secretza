import { db } from "@/lib/db";
import {
  ANALYTICS_SETTING_KEYS,
  DEFAULT_GA_MEASUREMENT_ID,
} from "@/lib/analytics-constants";

export type AnalyticsSettings = {
  gaMeasurementId: string;
};

const GA4_ID_PATTERN = /^G-[A-Z0-9]{6,}$/i;

function normalizeMeasurementId(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function validateGaMeasurementId(value: string): string | null {
  if (!value) return null;
  return GA4_ID_PATTERN.test(value)
    ? null
    : "GA4 Measurement ID must look like G-XXXXXXXXXX.";
}

function validMeasurementId(value: string): string {
  return validateGaMeasurementId(value) ? "" : value;
}

export async function getAnalyticsSettings(): Promise<AnalyticsSettings> {
  const setting = await db.siteSettings.findUnique({
    where: { key: ANALYTICS_SETTING_KEYS.gaMeasurementId },
  });

  const dbValue = normalizeMeasurementId(setting?.value);
  const envValue = normalizeMeasurementId(process.env.NEXT_PUBLIC_GA_ID);
  const serverEnvValue = normalizeMeasurementId(process.env.GA_MEASUREMENT_ID);

  return {
    gaMeasurementId:
      validMeasurementId(dbValue) ||
      validMeasurementId(envValue) ||
      validMeasurementId(serverEnvValue) ||
      DEFAULT_GA_MEASUREMENT_ID,
  };
}

export async function saveAnalyticsSettings(
  input: Partial<AnalyticsSettings>,
): Promise<AnalyticsSettings> {
  if (input.gaMeasurementId !== undefined) {
    const value = normalizeMeasurementId(input.gaMeasurementId);
    const error = validateGaMeasurementId(value);
    if (error) throw new Error(error);

    await db.siteSettings.upsert({
      where: { key: ANALYTICS_SETTING_KEYS.gaMeasurementId },
      create: { key: ANALYTICS_SETTING_KEYS.gaMeasurementId, value },
      update: { value },
    });
  }

  return getAnalyticsSettings();
}

