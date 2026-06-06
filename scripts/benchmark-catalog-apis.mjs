/**
 * Benchmark catalog API endpoints — run against local dev server.
 * Usage: node scripts/benchmark-catalog-apis.mjs [baseUrl]
 */

const BASE = process.argv[2] || "http://localhost:3000";

const ENDPOINTS = [
  "/api/categories",
  "/api/locations",
  "/api/locations?country=india",
  "/api/public/locations",
  "/api/locations/trending-cities",
];

async function bench(url, runs = 3) {
  const times = [];
  let lastSize = 0;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const res = await fetch(`${BASE}${url}`);
    const body = await res.text();
    times.push(performance.now() - start);
    lastSize = body.length;
  }
  times.sort((a, b) => a - b);
  return {
    url,
    minMs: Math.round(times[0]),
    medianMs: Math.round(times[Math.floor(times.length / 2)]),
    maxMs: Math.round(times[times.length - 1]),
    payloadBytes: lastSize,
  };
}

console.log(`Benchmarking ${BASE}\n`);
for (const ep of ENDPOINTS) {
  try {
    const r = await bench(ep);
    console.log(
      `${r.url.padEnd(40)} min=${r.minMs}ms  median=${r.medianMs}ms  max=${r.maxMs}ms  payload=${(r.payloadBytes / 1024).toFixed(1)}KB`,
    );
  } catch (err) {
    console.log(`${ep.padEnd(40)} ERROR: ${err.message}`);
  }
}
