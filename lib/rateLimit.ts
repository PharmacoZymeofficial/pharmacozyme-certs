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

export function rateLimit(ip: string): { ok: boolean; retryAfter: number } {
  startCleanup();
  const now = Date.now();
  const rec = store.get(ip);

  if (!rec || now > rec.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (rec.count >= MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  }
  rec.count++;
  return { ok: true, retryAfter: 0 };
}
