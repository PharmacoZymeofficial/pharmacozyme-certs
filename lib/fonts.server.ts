import fs from "fs";
import path from "path";

const fontBytesCache = new Map<string, Uint8Array | null>();

export async function loadFontBytes(fontName: string): Promise<Uint8Array | null> {
  if (!fontName) return null;
  if (fontBytesCache.has(fontName)) return fontBytesCache.get(fontName)!;

  // 1. Try local font file (public/fonts/{Name}.ttf — spaces replaced with _)
  try {
    const fileName = fontName.replace(/ /g, "_") + ".ttf";
    const localPath = path.join(process.cwd(), "public", "fonts", fileName);
    if (fs.existsSync(localPath)) {
      const bytes = new Uint8Array(fs.readFileSync(localPath));
      fontBytesCache.set(fontName, bytes);
      return bytes;
    }
  } catch { /* fall through to network */ }

  // 2. Fallback: fetch from Google Fonts (TTF via old user-agent trick)
  const USER_AGENTS = [
    "Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
    "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)",
    "BlackBerry9700/5.0.0.743 Profile/MIDP-2.1 Configuration/CLDC-1.1 VendorID/100",
  ];

  for (const ua of USER_AGENTS) {
    try {
      const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(fontName)}`;
      const cssRes = await fetch(cssUrl, { headers: { "User-Agent": ua } });
      if (!cssRes.ok) continue;
      const css = await cssRes.text();

      const allUrls = [...css.matchAll(/url\(['"]?([^'"\n)]+)['"]?\)/g)].map(m => m[1]);
      const fontUrl = allUrls.find(u => u.toLowerCase().includes(".ttf")) ?? allUrls[0] ?? null;
      if (!fontUrl) continue;

      const fontRes = await fetch(fontUrl);
      if (!fontRes.ok) continue;
      const bytes = new Uint8Array(await fontRes.arrayBuffer());

      const isWOFF = bytes[0] === 0x77 && bytes[1] === 0x4F && bytes[2] === 0x46 && (bytes[3] === 0x46 || bytes[3] === 0x32);
      if (isWOFF) continue;

      fontBytesCache.set(fontName, bytes);
      return bytes;
    } catch { continue; }
  }

  fontBytesCache.set(fontName, null);
  return null;
}
