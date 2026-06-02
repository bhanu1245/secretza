/**
 * Server-side analytics tracking module for SecretZa.
 *
 * Supports two providers:
 *  - GA4 (Google Analytics 4) via Measurement Protocol
 *  - Plausible Analytics via server-side event API
 *
 * Both are fire-and-forget: calls never block and never throw.
 * Configure via environment variables:
 *  - GA4:         GA_MEASUREMENT_ID, GA_API_SECRET
 *  - Plausible:   PLAUSIBLE_DOMAIN, PLAUSIBLE_API_TOKEN
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean | undefined>;
}

interface PageViewData {
  path: string;
  title?: string;
}

interface ListingViewData {
  listingId: string;
  category: string;
  city: string;
}

interface ListingBoostData {
  listingId: string;
  amount: number;
}

interface UploadData {
  userId: string;
  imageCount: number;
}

interface RegistrationData {
  userId: string;
  method: string;
}

interface SearchData {
  query: string;
  resultCount: number;
  filters?: Record<string, string | string[] | undefined>;
}

// ---------------------------------------------------------------------------
// GA4 helpers
// ---------------------------------------------------------------------------

const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
const GA_API_SECRET = process.env.GA_API_SECRET;
const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";

function generateClientId(): string {
  // Generate a pseudo-random UUID v4-style client ID for GA4
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const segments: string[] = [];
  for (let i = 0; i < 4; i++) {
    const hex = Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, "0");
    segments.push(hex);
  }
  // Set version nibble to 4 and variant nibble to {8,9,a,b}
  const s3 = segments[2].split("");
  s3[0] = "4";
  segments[2] = s3.join("");
  const s4 = segments[3].split("");
  s4[0] = ["8", "9", "a", "b"][Math.floor(Math.random() * 4)];
  segments[3] = s4.join("");
  return `${segments[0]}${segments[1]}-${segments[2]}-${segments[3]}-${segments[4]}`;
}

async function sendGA4Event(
  clientId: string,
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<void> {
  if (!GA_MEASUREMENT_ID || !GA_API_SECRET) return;

  const url = `${GA_ENDPOINT}?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;
  const body: Record<string, unknown> = {
    client_id: clientId,
    events: [
      {
        name: eventName,
        params: params ?? {},
      },
    ],
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Fire-and-forget: silently ignore network failures
  }
}

// ---------------------------------------------------------------------------
// Plausible helpers
// ---------------------------------------------------------------------------

const PLAUSIBLE_DOMAIN = process.env.PLAUSIBLE_DOMAIN;
const PLAUSIBLE_API_TOKEN = process.env.PLAUSIBLE_API_TOKEN;
const PLAUSIBLE_ENDPOINT = "https://plausible.io/api/v1/event";

async function sendPlausibleEvent(
  eventName: string,
  props?: Record<string, string | number | boolean | undefined>,
): Promise<void> {
  if (!PLAUSIBLE_DOMAIN) return;

  const body: Record<string, unknown> = {
    domain: PLAUSIBLE_DOMAIN,
    name: eventName,
  };

  if (props && Object.keys(props).length > 0) {
    body.props = props;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SecretZa/1.0 (server-side)",
    };
    if (PLAUSIBLE_API_TOKEN) {
      headers["Authorization"] = `Bearer ${PLAUSIBLE_API_TOKEN}`;
    }

    await fetch(PLAUSIBLE_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    // Fire-and-forget: silently ignore network failures
  }
}

// ---------------------------------------------------------------------------
// Internal: fire to all configured providers (never blocks, never throws)
// ---------------------------------------------------------------------------

function fireToProviders(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  // GA4 needs a client ID — generate one for server-side events
  const clientId = generateClientId();
  // Use void to explicitly mark fire-and-forget (no await)
  void sendGA4Event(clientId, eventName, params);
  void sendPlausibleEvent(eventName, params);
}

// ---------------------------------------------------------------------------
// Public API — generic
// ---------------------------------------------------------------------------

/**
 * Track a generic analytics event.
 * Fire-and-forget: will never block and never throw.
 */
export function trackEvent(event: AnalyticsEvent): void {
  try {
    fireToProviders(event.name, event.properties as Record<string, string | number | boolean | undefined>);
  } catch {
    // Absolute safety — must never throw
  }
}

/**
 * Track a page view.
 * Fire-and-forget: will never block and never throw.
 */
export function trackPageView(data: PageViewData): void {
  try {
    const params: Record<string, string | number | boolean> = {
      page_path: data.path,
    };
    if (data.title) {
      params.page_title = data.title;
    }
    fireToProviders("page_view", params);
  } catch {
    // Absolute safety — must never throw
  }
}

// ---------------------------------------------------------------------------
// Public API — domain-specific
// ---------------------------------------------------------------------------

/**
 * Track a listing detail page view.
 * Fire-and-forget: will never block and never throw.
 */
export function trackListingView(data: ListingViewData): void {
  try {
    fireToProviders("listing_view", {
      listing_id: data.listingId,
      category: data.category,
      city: data.city,
    });
  } catch {
    // Absolute safety — must never throw
  }
}

/**
 * Track a boost purchase for a listing.
 * Fire-and-forget: will never block and never throw.
 */
export function trackListingBoost(data: ListingBoostData): void {
  try {
    fireToProviders("listing_boost", {
      listing_id: data.listingId,
      amount: data.amount,
      currency: "INR",
    });
  } catch {
    // Absolute safety — must never throw
  }
}

/**
 * Track an image upload action.
 * Fire-and-forget: will never block and never throw.
 */
export function trackUpload(data: UploadData): void {
  try {
    fireToProviders("upload", {
      user_id: data.userId,
      image_count: data.imageCount,
    });
  } catch {
    // Absolute safety — must never throw
  }
}

/**
 * Track a user registration event.
 * Fire-and-forget: will never block and never throw.
 */
export function trackRegistration(data: RegistrationData): void {
  try {
    fireToProviders("registration", {
      user_id: data.userId,
      method: data.method,
    });
  } catch {
    // Absolute safety — must never throw
  }
}

/**
 * Track a search event.
 * Fire-and-forget: will never block and never throw.
 */
export function trackSearch(data: SearchData): void {
  try {
    const params: Record<string, string | number | boolean> = {
      search_query: data.query,
      result_count: data.resultCount,
    };
    if (data.filters && Object.keys(data.filters).length > 0) {
      params.filters = JSON.stringify(data.filters);
    }
    fireToProviders("search", params);
  } catch {
    // Absolute safety — must never throw
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { generateClientId };
export type {
  AnalyticsEvent,
  PageViewData,
  ListingViewData,
  ListingBoostData,
  UploadData,
  RegistrationData,
  SearchData,
};
