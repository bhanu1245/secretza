/**
 * Smoke test SEO city generation.
 * Usage: bun run scripts/test-seo-generate.ts
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

  const genRes = await request("/api/seo/generate/cities", jar, {
    method: "POST",
    csrfToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 100 }),
  });
  const genData = await genRes.json();
  console.log("Generate:", genRes.status, genData);

  const listRes = await request("/api/seo/pages?pageType=city&limit=5", jar);
  const listData = await listRes.json();
  console.log("List total:", listData.total);
  console.log("Example page:", listData.pages?.[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
