import type { AppView } from "@/lib/types";

export const SPA_HOME = "/";

export function isSpaHome(pathname: string): boolean {
  return pathname === SPA_HOME;
}

/** Build a deep-link URL for SPA-only views when leaving SSR pages. */
export function buildSpaDeepLink(
  view: AppView,
  params: Record<string, string> = {}
): string {
  const q = new URLSearchParams({ view });
  for (const [key, value] of Object.entries(params)) {
    if (value) q.set(key, value);
  }
  return `/?${q.toString()}`;
}

/** Map an app view to a relative Next.js path, or null if SPA-only without slug. */
export function viewToPath(
  view: AppView,
  params: Record<string, string> = {}
): string | null {
  switch (view) {
    case "home":
      return "/";
    case "category":
      return params.slug ? `/category/${params.slug}` : "/";
    case "listing":
      return params.slug ? `/listing/${params.slug}` : null;
    case "location":
      if (params.countrySlug && params.stateSlug && params.citySlug) {
        return `/${params.countrySlug}/${params.stateSlug}/${params.citySlug}`;
      }
      if (params.countrySlug && params.stateSlug) {
        return `/${params.countrySlug}/${params.stateSlug}`;
      }
      if (params.countrySlug) return `/country/${params.countrySlug}`;
      return null;
    case "post-ad":
      return "/create-listing";
    case "pricing":
    case "search":
    case "dashboard":
    case "geo-india":
    case "geo-state":
    case "geo-city":
    case "geo-district":
    case "geo-locality":
    case "payment-manual":
    case "auth-verify":
      return buildSpaDeepLink(view, params);
    default:
      return null;
  }
}

export function parseSpaDeepLink(searchParams: URLSearchParams): {
  view: AppView;
  params: Record<string, string>;
} | null {
  const view = searchParams.get("view") as AppView | null;
  if (!view) return null;
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== "view") params[key] = value;
  });
  return { view, params };
}

export function listingPath(slug: string): string {
  return `/listing/${slug}`;
}

export function categoryPath(slug: string): string {
  return `/category/${slug}`;
}
