/**
 * Smoke test: CSRF + review submission flow.
 * Usage: bun run scripts/test-review-csrf.ts
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
  if (init.csrfToken) {
    headers.set("x-csrf-token", init.csrfToken);
  }
  const cookie = cookieHeader(jar);
  if (cookie) headers.set("cookie", cookie);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const setCookie = res.headers.get("set-cookie");
  parseSetCookie(setCookie, jar);
  // Handle multiple Set-Cookie via getSetCookie if available
  const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") {
    for (const c of getSetCookie.call(res.headers)) {
      parseSetCookie(c, jar);
    }
  }
  return res;
}

async function main() {
  const jar: CookieJar = new Map();

  // 1. Without CSRF — should fail with explicit reason
  const noCsrf = await request("/api/reviews", jar, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: "cmppoptgl00010s0c0n2llhod",
      rating: 5,
      body: "Test review without CSRF token",
    }),
  });
  const noCsrfBody = await noCsrf.json();
  console.log("POST /api/reviews without CSRF:", noCsrf.status, noCsrfBody.details);

  // 2. Fetch CSRF token
  const csrfRes = await request("/api/csrf", jar);
  const csrfData = (await csrfRes.json()) as { token: string };
  console.log("GET /api/csrf:", csrfRes.status, "token length:", csrfData.token?.length);

  // 3. NextAuth CSRF + login
  const providersRes = await request("/api/auth/csrf", jar);
  const authCsrf = (await providersRes.json()) as { csrfToken: string };

  const loginBody = new URLSearchParams({
    csrfToken: authCsrf.csrfToken,
    email: "admin@secretza.com",
    password: "Admin@123",
    json: "true",
  });

  const loginRes = await request("/api/auth/callback/credentials", jar, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody.toString(),
    redirect: "manual",
  });
  console.log("Login:", loginRes.status);

  const sessionRes = await request("/api/auth/session", jar);
  const session = await sessionRes.json();
  console.log("Session user:", session?.user?.email || "none");

  // 4. POST review with CSRF
  const reviewRes = await request("/api/reviews", jar, {
    method: "POST",
    csrfToken: csrfData.token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      listingId: "cmppoptgl00010s0c0n2llhod",
      rating: 5,
      title: "Great experience",
      body: "Automated CSRF smoke test review submission.",
    }),
  });
  const reviewBody = await reviewRes.json();
  console.log("POST /api/reviews with CSRF:", reviewRes.status, reviewBody.message || reviewBody.error);

  if (reviewRes.status === 409) {
    console.log("(409 = user already reviewed — CSRF passed, auth OK)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
