/**
 * Recover missing category_city SEO images.
 *
 * Uses the /api/seo/recover-images endpoint in a loop.
 * Auth: signs in as admin, then calls POST with offset pagination.
 *
 * Usage:
 *   bun run scripts/recover-category-city-images.mjs
 *   TEST_BASE_URL=http://localhost:3000 bun run scripts/recover-category-city-images.mjs
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const BATCH = 100;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  process.exit(1);
}

function parseCookies(jar, header) {
  if (!header) return;
  const part = header.split(';')[0]?.trim();
  if (!part) return;
  const eq = part.indexOf('=');
  if (eq <= 0) return;
  jar.set(part.slice(0, eq), part.slice(eq + 1));
}

function cookieStr(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function req(jar, urlPath, init = {}) {
  const headers = new Headers(init.headers || {});
  const cookie = cookieStr(jar);
  if (cookie) headers.set('cookie', cookie);
  const res = await fetch(`${BASE}${urlPath}`, { ...init, headers });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) parseCookies(jar, setCookie);
  const getAll = res.headers.getSetCookie;
  if (typeof getAll === 'function') {
    for (const c of getAll.call(res.headers)) parseCookies(jar, c);
  }
  return res;
}

async function main() {
  console.log(`=== category_city SEO Image Recovery ===`);
  console.log(`Target: ${BASE}\n`);

  const jar = new Map();

  // ── Auth ─────────────────────────────────────────────────────────────
  const csrfRes = await req(jar, '/api/csrf');
  const { token: csrfToken } = await csrfRes.json();
  const authCsrfRes = await req(jar, '/api/auth/csrf');
  const { csrfToken: authCsrf } = await authCsrfRes.json();

  const loginRes = await req(jar, '/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-csrf-token': csrfToken },
    body: new URLSearchParams({
      csrfToken: authCsrf,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      json: 'true',
    }).toString(),
    redirect: 'manual',
  });
  console.log(`Login: ${loginRes.status}`);

  // ── Pre-flight status ─────────────────────────────────────────────────
  const statusRes = await req(jar, '/api/seo/recover-images', {
    headers: { 'x-csrf-token': csrfToken },
  });
  const status = await statusRes.json();
  console.log(`Pre-flight: total=${status.total} present=${status.present} missing=${status.missing} (${100 - parseFloat(status.percentComplete)}% missing)\n`);

  if (status.missing === 0) {
    console.log('Nothing to recover. All files are present on disk.');
    return;
  }

  // ── Recovery loop ─────────────────────────────────────────────────────
  let offset = 0;
  let totalScanned = 0;
  let totalRegenerated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalDiskBytes = 0;
  let pass = 0;
  const globalStart = Date.now();

  while (true) {
    pass++;
    const res = await req(jar, '/api/seo/recover-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ offset, batchSize: BATCH }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Batch ${pass} failed (HTTP ${res.status}): ${err}`);
      break;
    }

    const data = await res.json();
    totalScanned += data.scanned;
    totalRegenerated += data.regenerated;
    totalSkipped += data.skipped;
    totalErrors += data.errors;
    totalDiskBytes += data.diskBytesWritten;

    console.log(
      `Batch ${String(pass).padStart(2)}: offset=${String(offset).padStart(4)} | ` +
      `scanned=${data.scanned} regenerated=${data.regenerated} skipped=${data.skipped} ` +
      `errors=${data.errors} | +${(data.diskBytesWritten / 1024).toFixed(1)} KB | ${data.elapsedMs}ms`
    );

    if (!data.hasMore) break;
    offset = data.nextOffset;
  }

  const elapsed = Date.now() - globalStart;

  // ── Post-flight verification ──────────────────────────────────────────
  console.log('\n── Post-flight verification ──');
  const afterRes = await req(jar, '/api/seo/recover-images', {
    headers: { 'x-csrf-token': csrfToken },
  });
  const after = await afterRes.json();
  console.log(`After: total=${after.total} present=${after.present} missing=${after.missing}`);

  // ── Final report ──────────────────────────────────────────────────────
  console.log('\n=== Recovery Complete ===');
  console.log(`  Batches run        : ${pass}`);
  console.log(`  Files scanned      : ${totalScanned}`);
  console.log(`  Files regenerated  : ${totalRegenerated}`);
  console.log(`  Files skipped      : ${totalSkipped}`);
  console.log(`  Errors             : ${totalErrors}`);
  console.log(`  Disk written       : ${(totalDiskBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Elapsed            : ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  category_city pages: ${after.total}`);
  console.log(`  Images on disk     : ${after.present}`);
  console.log(`  Broken remaining   : ${after.missing}`);
  console.log(`  Result             : ${after.missing === 0 ? '✓ ALL IMAGES PRESENT' : '✗ STILL MISSING: ' + after.missing}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
