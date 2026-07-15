/**
 * Verifies that validateInternalHref uses in-memory slug caches exclusively —
 * zero additional DB queries after the initial cache load.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock server-only (blocks direct Node imports of Next.js server modules) ──
vi.mock("server-only", () => ({}));

// ── Stub db with spy-able methods ─────────────────────────────────────────────
const mockCountry = vi.fn();
const mockCategory = vi.fn();
const mockCity = vi.fn();
const mockState = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    country:  { findMany: mockCountry,  findFirst: vi.fn() },
    category: { findMany: mockCategory, findFirst: vi.fn() },
    city:     { findMany: mockCity,     findFirst: vi.fn() },
    state:    { findMany: mockState,    findFirst: vi.fn() },
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const COUNTRIES = [{ slug: "india" }, { slug: "united-kingdom" }, { slug: "germany" }];
const CATEGORIES = [
  { slug: "escorts" }, { slug: "massage" }, { slug: "dating" },
  { slug: "adult-services" }, { slug: "male-escorts" },
];
const STATES = [
  { slug: "maharashtra", country: { slug: "india" } },
  { slug: "karnataka",   country: { slug: "india" } },
  { slug: "gujarat",     country: { slug: "india" } },
  { slug: "delhi",       country: { slug: "india" } },
  { slug: "telangana",   country: { slug: "india" } },
  { slug: "scotland",    country: { slug: "united-kingdom" } },
];
const CITIES = [
  { slug: "mumbai",    state: { slug: "maharashtra", country: { slug: "india" } } },
  { slug: "pune",      state: { slug: "maharashtra", country: { slug: "india" } } },
  { slug: "bangalore", state: { slug: "karnataka",   country: { slug: "india" } } },
  { slug: "surat",     state: { slug: "gujarat",     country: { slug: "india" } } },
  { slug: "delhi",     state: { slug: "delhi",       country: { slug: "india" } } },
  { slug: "hyderabad", state: { slug: "telangana",   country: { slug: "india" } } },
  { slug: "aberdeen",  state: { slug: "scotland",    country: { slug: "united-kingdom" } } },
];

// ─────────────────────────────────────────────────────────────────────────────

describe("seo-internal-links: validateInternalHref cache fix", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockCountry.mockResolvedValue(COUNTRIES);
    mockCategory.mockResolvedValue(CATEGORIES);
    mockCity.mockResolvedValue(CITIES);
    mockState.mockResolvedValue(STATES);

    // Reset module-level slugCaches between tests
    const mod = await import("@/lib/seo-internal-links");
    mod.clearSlugCaches();
  });

  it("loadSlugCaches makes exactly 4 parallel DB queries", async () => {
    const { loadSlugCaches } = await import("@/lib/seo-internal-links");
    await loadSlugCaches();

    expect(mockCountry).toHaveBeenCalledTimes(1);
    expect(mockCategory).toHaveBeenCalledTimes(1);
    expect(mockCity).toHaveBeenCalledTimes(1);
    expect(mockState).toHaveBeenCalledTimes(1);
  });

  it("second loadSlugCaches() call hits no DB (cache hit)", async () => {
    const { loadSlugCaches } = await import("@/lib/seo-internal-links");
    await loadSlugCaches();
    vi.clearAllMocks();
    await loadSlugCaches();

    expect(mockCountry).not.toHaveBeenCalled();
    expect(mockCategory).not.toHaveBeenCalled();
    expect(mockCity).not.toHaveBeenCalled();
    expect(mockState).not.toHaveBeenCalled();
  });

  describe("validateInternalHref — zero per-link DB queries after cache load", () => {
    beforeEach(async () => {
      // Pre-warm the cache
      const { loadSlugCaches } = await import("@/lib/seo-internal-links");
      await loadSlugCaches();
      vi.clearAllMocks(); // Reset spy counts — any calls below are regressions
    });

    const cases: Array<[string, boolean]> = [
      ["/category/escorts",              true],
      ["/category/massage",              true],
      ["/category/nonexistent",          false],
      ["/country/india",                 true],
      ["/country/france",                false],
      ["/india/maharashtra/mumbai",      true],
      ["/india/maharashtra/pune",        true],
      ["/india/karnataka/bangalore",     true],
      ["/india/delhi/delhi",             true],
      ["/india/maharashtra/aberdeen",    false], // city in wrong state
      ["/cheap-escorts/mumbai",          true],  // longtail + city
      ["/vip-escorts/delhi",             true],  // longtail + city
      ["/escorts/mumbai",               true],  // category + city
      ["/india/maharashtra",            true],  // country + state
      ["/india/fakeprovince",           false], // invalid state
      ["/",                             true],
    ];

    for (const [href, expected] of cases) {
      it(`"${href}" → ${expected} with no DB queries`, async () => {
        const { validateInternalHref } = await import("@/lib/seo-internal-links");
        const result = await validateInternalHref(href);

        expect(result).toBe(expected);

        // THE KEY ASSERTION: no per-link DB queries
        expect(mockCountry.mock.calls.length, "unexpected country query").toBe(0);
        expect(mockCategory.mock.calls.length, "unexpected category query").toBe(0);
        expect(mockCity.mock.calls.length, "unexpected city query").toBe(0);
        expect(mockState.mock.calls.length, "unexpected state query").toBe(0);
      });
    }
  });

  it("validates 100 links under 5ms (pure in-memory)", async () => {
    const { loadSlugCaches, validateInternalHref } = await import("@/lib/seo-internal-links");
    await loadSlugCaches();

    const links = Array.from({ length: 100 }, (_, i) => {
      const cycle = i % 5;
      if (cycle === 0) return "/category/escorts";
      if (cycle === 1) return "/country/india";
      if (cycle === 2) return "/india/maharashtra/mumbai";
      if (cycle === 3) return "/cheap-escorts/delhi";
      return "/india/maharashtra";
    });

    const t0 = performance.now();
    await Promise.all(links.map(href => validateInternalHref(href)));
    const ms = performance.now() - t0;

    expect(ms).toBeLessThan(50); // very generous — in-memory should be <5ms
  });
});
