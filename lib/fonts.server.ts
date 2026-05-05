import fs from "fs";
import path from "path";

const fontBytesCache = new Map<string, Uint8Array | null>();

function isWOFF(bytes: Uint8Array): boolean {
  return bytes[0] === 0x77 && bytes[1] === 0x4F && bytes[2] === 0x46 && (bytes[3] === 0x46 || bytes[3] === 0x32);
}

export async function loadFontBytes(fontName: string): Promise<Uint8Array | null> {
  if (!fontName) return null;
  if (fontBytesCache.has(fontName)) return fontBytesCache.get(fontName)!;

  const fileName = fontName.replace(/ /g, "_") + ".ttf";

  // 1. Try local font file via fs (works in most Node.js/Vercel environments)
  try {
    const localPath = path.join(process.cwd(), "public", "fonts", fileName);
    if (fs.existsSync(localPath)) {
      const bytes = new Uint8Array(fs.readFileSync(localPath));
      fontBytesCache.set(fontName, bytes);
      return bytes;
    }
  } catch { /* fall through */ }

  // 2. Fetch from own static origin (works on Vercel where public/ is on the CDN)
  const origins = [
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NEXT_PUBLIC_APP_URL ?? null,
    "http://localhost:3000",
  ].filter(Boolean) as string[];

  for (const origin of origins) {
    try {
      const res = await fetch(`${origin}/fonts/${fileName}`);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (isWOFF(bytes)) continue;
      fontBytesCache.set(fontName, bytes);
      return bytes;
    } catch { continue; }
  }

  // 3. Fallback: Google Fonts via old user-agent trick to get TTF
  const USER_AGENTS = [
    "Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
    "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)",
    "BlackBerry9700/5.0.0.743 Profile/MIDP-2.1 Configuration/CLDC-1.1 VendorID/100",
  ];

  for (const ua of USER_AGENTS) {
    try {
      const cssRes = await fetch(`https://fonts.googleapis.com/css?family=${encodeURIComponent(fontName)}`, {
        headers: { "User-Agent": ua },
      });
      if (!cssRes.ok) continue;
      const css = await cssRes.text();

      const allUrls = [...css.matchAll(/url\(['"]?([^'"\n)]+)['"]?\)/g)].map(m => m[1]);
      const fontUrl = allUrls.find(u => u.toLowerCase().includes(".ttf")) ?? allUrls[0] ?? null;
      if (!fontUrl) continue;

      const fontRes = await fetch(fontUrl);
      if (!fontRes.ok) continue;
      const bytes = new Uint8Array(await fontRes.arrayBuffer());
      if (isWOFF(bytes)) continue;

      fontBytesCache.set(fontName, bytes);
      return bytes;
    } catch { continue; }
  }

  fontBytesCache.set(fontName, null);
  return null;
}
