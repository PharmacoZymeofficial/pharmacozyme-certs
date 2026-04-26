export const AVAILABLE_FONTS = [
  { label: "Default (Helvetica Bold)", value: "" },
  { label: "Allura", value: "Allura" },
  { label: "Poppins", value: "Poppins" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "Alata", value: "Alata" },
  { label: "Great Vibes", value: "Great Vibes" },
  { label: "Dancing Script", value: "Dancing Script" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "Cormorant Garamond", value: "Cormorant Garamond" },
  { label: "Satisfy", value: "Satisfy" },
  { label: "Sacramento", value: "Sacramento" },
  { label: "Alex Brush", value: "Alex Brush" },
  { label: "Lato", value: "Lato" },
  { label: "Open Sans", value: "Open Sans" },
  { label: "Raleway", value: "Raleway" },
  { label: "Cinzel", value: "Cinzel" },
];

export function getGoogleFontsUrl(fontNames: string[]): string {
  const unique = [...new Set(fontNames.filter(Boolean))];
  if (unique.length === 0) return "";
  const families = unique.map(f => `family=${encodeURIComponent(f)}:wght@400;700`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

// Module-level cache: avoid re-fetching fonts on every certificate render
const fontBytesCache = new Map<string, Uint8Array | null>();

// User-agents that cause Google Fonts to return TTF (pdf-lib only supports TTF/OTF)
const FONT_USER_AGENTS = [
  // Old Android 2.2 → reliably returns TTF for most fonts
  "Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
  // IE6 → Google Fonts fallback returns TTF
  "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)",
  // Old BlackBerry
  "BlackBerry9700/5.0.0.743 Profile/MIDP-2.1 Configuration/CLDC-1.1 VendorID/100",
  // Old Nokia S40
  "NokiaC3-00/5.0 (07.20) Profile/MIDP-2.1 Configuration/CLDC-1.1",
];

// Extract font URL from Google Fonts CSS, preferring truetype format
function parseFontUrl(css: string): string | null {
  // Prefer URL explicitly paired with truetype format hint
  const truetypeMatch = css.match(/url\(['"]?([^'"\n)]+)['"]?\)\s+format\(['"]truetype['"]\)/);
  if (truetypeMatch) return truetypeMatch[1];

  // Fall back: any URL containing .ttf
  const allUrls = [...css.matchAll(/url\(['"]?([^'"\n)]+)['"]?\)/g)].map(m => m[1]);
  const ttfUrl = allUrls.find(u => u.toLowerCase().includes(".ttf"));
  if (ttfUrl) return ttfUrl;

  // Last resort: first URL in CSS
  return allUrls[0] ?? null;
}

// Server-side only: fetch TTF bytes from Google Fonts for pdf-lib embedding
export async function loadFontBytes(fontName: string): Promise<Uint8Array | null> {
  if (!fontName) return null;
  if (fontBytesCache.has(fontName)) return fontBytesCache.get(fontName)!;

  for (const ua of FONT_USER_AGENTS) {
    try {
      const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(fontName)}`;
      const cssRes = await fetch(cssUrl, { headers: { "User-Agent": ua } });
      if (!cssRes.ok) continue;
      const css = await cssRes.text();

      const fontUrl = parseFontUrl(css);
      if (!fontUrl) continue;

      const fontRes = await fetch(fontUrl);
      if (!fontRes.ok) continue;
      const buf = await fontRes.arrayBuffer();
      const bytes = new Uint8Array(buf);

      // Reject WOFF / WOFF2 — pdf-lib only supports TTF/OTF
      const isWOFF  = bytes[0] === 0x77 && bytes[1] === 0x4F && bytes[2] === 0x46 && bytes[3] === 0x46;
      const isWOFF2 = bytes[0] === 0x77 && bytes[1] === 0x4F && bytes[2] === 0x46 && bytes[3] === 0x32;
      if (isWOFF || isWOFF2) continue; // try next UA

      fontBytesCache.set(fontName, bytes);
      return bytes;
    } catch {
      continue;
    }
  }

  fontBytesCache.set(fontName, null);
  return null;
}
