/**
 * Single client for the Google Apps Script bridge (Sheets + Drive).
 *
 * Previously this helper was copy-pasted into four route files with subtly different
 * error handling. Collapsed into one so the shared secret is added in exactly one
 * place — and so the good HTML-error-page diagnostics apply everywhere, not just to
 * the sheets/sync route.
 */

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

export function appsScriptConfigured(): boolean {
  return Boolean(APPS_SCRIPT_URL);
}

// The Apps Script response is an arbitrary JSON blob from a Google Apps Script web app --
// there is no schema to type it against, so callers narrow it themselves.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callAppsScript<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!APPS_SCRIPT_URL) {
    throw new Error("GOOGLE_APPS_SCRIPT_URL is not set");
  }

  // The Apps Script web app must be deployed with access "Anyone" for the app to reach
  // it at all, which also means anyone else who learns the URL can reach it. This shared
  // secret is what actually authenticates the caller. Set the same value in the Apps
  // Script editor under Project Settings → Script Properties (key: APPS_SCRIPT_SECRET).
  const secret = process.env.APPS_SCRIPT_SECRET;

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action, ...payload, ...(secret ? { secret } : {}) }),
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
  });

  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error(
        "Apps Script returned an HTML error page. Likely causes: " +
          "(1) URL ends in /dev instead of /exec, " +
          "(2) Web app access is not set to 'Anyone', " +
          "(3) Script not redeployed after code change, " +
          "(4) GOOGLE_APPS_SCRIPT_URL changed but Vercel was not redeployed (env vars are " +
          "baked in at deploy time, not hot-reloaded). " +
          `HTTP status: ${response.status}`
      );
    }
    throw new Error(`Apps Script returned invalid JSON: ${text.substring(0, 150)}`);
  }
}
