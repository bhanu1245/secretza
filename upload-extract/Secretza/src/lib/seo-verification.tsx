/**
 * Site Verification Manager — Enhanced with DB-backed multi-provider support.
 * Generates Google, Bing, and Yandex verification meta tags dynamically.
 * Reads from SiteSettings table for runtime configuration.
 */

import { db } from '@/lib/db';

export interface VerificationConfig {
  provider: 'google' | 'bing' | 'yandex';
  method: 'meta' | 'dns' | 'html' | 'file';
  value: string;
}

const DEFAULT_CONFIG: VerificationConfig = {
  provider: 'google',
  method: 'meta',
  value: '',
};

// Cache for verification configs (invalidated on save)
let _verificationCache: Record<string, VerificationConfig> | null = null;
let _cacheLoadedAt = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Get all verification configs from DB (with caching).
 */
export async function getAllVerificationConfigs(): Promise<Record<string, VerificationConfig>> {
  const now = Date.now();
  if (_verificationCache && now - _cacheLoadedAt < CACHE_TTL) {
    return _verificationCache;
  }

  try {
    const settings = await db.siteSettings.findMany({
      where: {
        key: {
          in: ['google_site_verification', 'bing_site_verification', 'yandex_site_verification'],
        },
      },
    });

    const configs: Record<string, VerificationConfig> = {};

    for (const setting of settings) {
      try {
        const parsed = JSON.parse(setting.value);
        if (parsed && parsed.value) {
          configs[setting.key] = {
            provider: setting.key.replace('_site_verification', '') as VerificationConfig['provider'],
            method: parsed.method || 'meta',
            value: parsed.value,
          };
        }
      } catch {
        // Legacy format: plain string value
        if (setting.value) {
          configs[setting.key] = {
            provider: setting.key.replace('_site_verification', '') as VerificationConfig['provider'],
            method: 'meta',
            value: setting.value,
          };
        }
      }
    }

    // Fallback to env vars if DB has no value
    if (!configs['google_site_verification']) {
      const envGoogle = process.env.GOOGLE_SITE_VERIFICATION;
      if (envGoogle) {
        configs['google_site_verification'] = {
          provider: 'google',
          method: 'meta',
          value: envGoogle,
        };
      }
    }

    if (!configs['bing_site_verification']) {
      const envBing = process.env.BING_SITE_VERIFICATION;
      if (envBing) {
        configs['bing_site_verification'] = {
          provider: 'bing',
          method: 'meta',
          value: envBing,
        };
      }
    }

    if (!configs['yandex_site_verification']) {
      const envYandex = process.env.YANDEX_SITE_VERIFICATION;
      if (envYandex) {
        configs['yandex_site_verification'] = {
          provider: 'yandex',
          method: 'meta',
          value: envYandex,
        };
      }
    }

    _verificationCache = configs;
    _cacheLoadedAt = now;
    return configs;
  } catch {
    return {};
  }
}

/**
 * Get a specific verification config by provider.
 */
export async function getVerificationConfig(provider: string): Promise<VerificationConfig> {
  const configs = await getAllVerificationConfigs();
  return configs[`${provider}_site_verification`] || { ...DEFAULT_CONFIG, provider: provider as VerificationConfig['provider'] };
}

/**
 * Generate ALL verification meta tags for HTML head.
 * Supports Google, Bing, and Yandex simultaneously.
 */
export async function getAllVerificationMetaTags(): Promise<Promise<React.JSX.Element>[]> {
  const configs = await getAllVerificationConfigs();
  const tags: React.JSX.Element[] = [];

  for (const [, config] of Object.entries(configs)) {
    if (!config.value) continue;
    const tag = getMetaTagForProvider(config);
    if (tag) tags.push(tag);
  }

  return tags;
}

/**
 * Generate verification meta tag for HTML head.
 * Supports Google, Bing, and Yandex.
 * This is a synchronous version for compatibility — reads from env only.
 */
export function getVerificationMetaTag(): React.ReactNode {
  const tags: React.ReactNode[] = [];

  // Google from env
  const googleValue = process.env.GOOGLE_SITE_VERIFICATION;
  if (googleValue) {
    tags.push(<meta key="google-verification" name="google-site-verification" content={googleValue} />);
  }

  // Bing from env
  const bingValue = process.env.BING_SITE_VERIFICATION;
  if (bingValue) {
    tags.push(<meta key="bing-verification" name="msvalidate.01" content={bingValue} />);
  }

  // Yandex from env
  const yandexValue = process.env.YANDEX_SITE_VERIFICATION;
  if (yandexValue) {
    tags.push(<meta key="yandex-verification" name="yandex-verification" content={yandexValue} />);
  }

  return tags.length > 0 ? tags : null;
}

function getMetaTagForProvider(config: VerificationConfig): React.JSX.Element | null {
  if (!config.value) return null;

  switch (config.provider) {
    case 'google':
      return <meta key="google-verification" name="google-site-verification" content={config.value} />;
    case 'bing':
      return <meta key="bing-verification" name="msvalidate.01" content={config.value} />;
    case 'yandex':
      return <meta key="yandex-verification" name="yandex-verification" content={config.value} />;
    default:
      return null;
  }
}

/**
 * Generate DNS TXT record for verification.
 * For admin display purposes.
 */
export function getVerificationDNS(config: VerificationConfig): string | null {
  if (!config.value || config.method !== 'dns') return null;

  switch (config.provider) {
    case 'google':
      return config.value;
    case 'bing':
      return `msvalidate.01=${config.value}`;
    case 'yandex':
      return `yandex-verification: ${config.value}`;
    default:
      return null;
  }
}

/**
 * Generate HTML file verification tag.
 * For admin display purposes.
 */
export function getVerificationHTML(config: VerificationConfig): string | null {
  if (!config.value || config.method !== 'html') return null;
  return config.value;
}

/**
 * Save verification config to DB.
 */
export async function saveVerificationConfig(
  provider: 'google' | 'bing' | 'yandex',
  method: 'meta' | 'dns' | 'html' | 'file',
  value: string,
): Promise<void> {
  await db.siteSettings.upsert({
    where: { key: `${provider}_site_verification` },
    create: {
      key: `${provider}_site_verification`,
      value: JSON.stringify({ value: value.trim(), method }),
    },
    update: {
      value: JSON.stringify({ value: value.trim(), method }),
    },
  });

  // Invalidate cache
  _verificationCache = null;
  _cacheLoadedAt = 0;
}

/**
 * Get verification status summary for admin dashboard.
 */
export async function getVerificationStatus(): Promise<{
  google: { configured: boolean; method: string };
  bing: { configured: boolean; method: string };
  yandex: { configured: boolean; method: string };
}> {
  const configs = await getAllVerificationConfigs();

  return {
    google: {
      configured: !!configs['google_site_verification']?.value,
      method: configs['google_site_verification']?.method || 'meta',
    },
    bing: {
      configured: !!configs['bing_site_verification']?.value,
      method: configs['bing_site_verification']?.method || 'meta',
    },
    yandex: {
      configured: !!configs['yandex_site_verification']?.value,
      method: configs['yandex_site_verification']?.method || 'meta',
    },
  };
}
