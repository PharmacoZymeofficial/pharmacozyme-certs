const store = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 25;

let cleanupRunning = false;
function startCleanup() {
  if (cleanupRunning) return;
  cleanupRunning = true;
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k);
    }
  }, 5 * 60_000);
  if (typeof t === "object" && "unref" in t) (t as any).unref();
}

/**
 * `key` is the bucket identity — pass a plain IP to share the default budget, or a
 * prefixed key (e.g. `cover:${ip}`) to give a caller its own isolated bucket in the same
 * shared `store` Map. `max`/`windowMs` default to the original constants so the two
 * existing callers (app/api/verify, app/api/search-name) are unaffected by omitting them.
 */
export function rateLimit(
  key: string,
  max: number = MAX_REQUESTS,
  windowMs: number = WINDOW_MS
): { ok: boolean; retryAfter: number } {
  startCleanup();
  const now = Date.now();
  const rec = store.get(key);

  if (!rec || now > rec.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (rec.count >= max) {
    return { ok: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  }
  rec.count++;
  return { ok: true, retryAfter: 0 };
}
