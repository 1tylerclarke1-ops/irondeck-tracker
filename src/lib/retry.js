// Retries a call that fails with a rate-limit error, backing off between tries.
// Use for page data loads that can hit the app's per-minute call budget when
// several overlay pages are polling at the same time.
export async function withRetry(fn, { retries = 3, baseMs = 700 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = /rate limit/i.test(String(err?.message || err));
      if (attempt >= retries || !isRateLimit) throw err;
      await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, attempt)));
    }
  }
}