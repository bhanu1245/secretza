/**
 * Generate all SEO page types and report counts.
 * Usage: bun run scripts/test-seo-all-types.ts
 */
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

type CookieJar = Map<string, string>;

function parseSetCookie(header: string | null, jar: CookieJar) {
  if (!header) return;
  const part = header.split(";")[0]?.trim();
  if (!part) return;
  const eq = part.indexOf("=");
  if (eq <= 0) return;
  jar.set(part.slice(0, eq), part.slice(eq + 1));
}

function cookieHeader(jar: CookieJar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(
  path: string,
  jar: CookieJar,
  init: RequestInit & { csrfToken?: string } = {},
) {
  const headers = new Headers(init.headers);
  if (init.csrfToken) headers.set("x-csrf-token", init.csrfToken);
  const cookie = cookieHeader(jar);
  if (cookie) headers.set("cookie", cookie);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  parseSetCookie(res.headers.get("set-cookie"), jar);
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") {
    for (const c of getSetCookie.call(res.headers)) parseSetCookie(c, jar);
  }
  return res;
}

const TYPES = ["city", "category", "category_city", "state", "country", "longtail"] as const;

async function main() {
  const jar: CookieJar = new Map();
  const csrfRes = await request("/api/csrf", jar);
  const { token: csrfToken } = (await csrfRes.json()) as { token: string };
  const authCsrfRes = await request("/api/auth/csrf", jar);
  const { csrfToken: authCsrf } = (await authCsrfRes.json()) as { csrfToken: string };
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  await request("/api/auth/callback/credentials", jar, {
    method: "POST",
    csrfToken,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: authCsrf,
      email: adminEmail,
      password: adminPassword,
      json: "true",
    }).toString(),
    redirect: "manual",
  });

  const limits: Record<string, number | undefined> = {
    city: 20,
    category: undefined,
    category_city: 30,
    state: undefined,
    country: undefined,
    longtail: 20,
  };

  const results: Record<string, { created: number; example?: string }> = {};

  for (const type of TYPES) {
    const res = await request("/api/seo/generate", jar, {
      method: "POST",
      csrfToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, limit: limits[type], countrySlug: "india" }),
    });
    const data = await res.json();
    results[type] = {
      created: data.created ?? 0,
      example: data.examples?.[0]
        ? `${data.examples[0].canonicalUrl} (${data.examples[0].pageSlug})`
        : undefined,
    };
    console.log(`${type}: ${res.status} created=${data.created}`);
  }

  const statsRes = await request("/api/seo/stats", jar);
  const stats = await statsRes.json();
  console.log("\nCounts by type:", stats.counts);
  console.log("\nExamples:");
  for (const [type, r] of Object.entries(results)) {
    console.log(`  ${type}: ${r.example || "n/a"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
