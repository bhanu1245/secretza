import { NextRequest, NextResponse } from 'next/server';
import { requireMinRole } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// Supported providers and their SiteSettings keys
const PROVIDER_KEYS: Record<string, string> = {
  google: 'google_site_verification',
  bing: 'bing_site_verification',
  yandex: 'yandex_site_verification',
};

const VALID_PROVIDERS = Object.keys(PROVIDER_KEYS);
const VALID_METHODS = ['meta', 'dns', 'html', 'file'];

interface VerificationEntry {
  value: string;
  method: string;
}

interface VerificationConfig {
  google: VerificationEntry;
  bing: VerificationEntry;
  yandex: VerificationEntry;
}

async function getSettingValue(key: string): Promise<{ value: string; method: string }> {
  const setting = await db.siteSettings.findUnique({
    where: { key },
  });
  if (setting) {
    try {
      const parsed = JSON.parse(setting.value);
      return { value: parsed.value || '', method: parsed.method || 'meta' };
    } catch {
      // Legacy format: value is stored as plain string
      return { value: setting.value, method: 'meta' };
    }
  }
  return { value: '', method: 'meta' };
}

/**
 * GET /api/seo/verification
 * Retrieve current site verification configuration for all providers.
 * Admin-only.
 */
export async function GET() {
  try {
    const admin = await requireMinRole('admin');
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [google, bing, yandex] = await Promise.all([
      getSettingValue(PROVIDER_KEYS.google),
      getSettingValue(PROVIDER_KEYS.bing),
      getSettingValue(PROVIDER_KEYS.yandex),
    ]);

    const config: VerificationConfig = {
      google,
      bing,
      yandex,
    };

    return NextResponse.json(config);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('SEO verification GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch verification config' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/seo/verification
 * Save site verification config for a provider.
 * Admin-only.
 * Body: { provider: string, method: string, value: string }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireMinRole('admin');
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, method, value } = body as {
      provider?: string;
      method?: string;
      value?: string;
    };

    // Validate provider
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate method
    if (!method || !VALID_METHODS.includes(method)) {
      return NextResponse.json(
        { error: `Invalid method. Must be one of: ${VALID_METHODS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate value
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      return NextResponse.json(
        { error: 'Value is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const settingKey = PROVIDER_KEYS[provider];
    const settingValue = JSON.stringify({ value: value.trim(), method });

    await db.siteSettings.upsert({
      where: { key: settingKey },
      create: { key: settingKey, value: settingValue },
      update: { value: settingValue },
    });

    return NextResponse.json({
      success: true,
      provider,
      method,
      value: value.trim(),
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }
    }
    console.error('SEO verification POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save verification config' },
      { status: 500 }
    );
  }
}
