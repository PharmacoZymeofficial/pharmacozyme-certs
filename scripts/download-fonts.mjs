// Downloads TTF font files from Google Fonts into public/fonts/
// Run with: node scripts/download-fonts.mjs
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "fonts");

const FONTS = [
  "Allura", "Poppins", "Montserrat", "Alata", "Great Vibes",
  "Dancing Script", "Playfair Display", "Cormorant Garamond",
  "Satisfy", "Sacramento", "Alex Brush", "Lato", "Open Sans",
  "Raleway", "Cinzel",
];

// Old user-agents that make Google Fonts return TTF
const UAS = [
  "Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
  "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)",
  "BlackBerry9700/5.0.0.743 Profile/MIDP-2.1 Configuration/CLDC-1.1 VendorID/100",
];

function parseFontUrl(css) {
  const ttMatch = css.match(/url\(['"]?([^'"\n)]+)['"]?\)\s+format\(['"]truetype['"]\)/);
  if (ttMatch) return ttMatch[1];
  const all = [...css.matchAll(/url\(['"]?([^'"\n)]+)['"]?\)/g)].map(m => m[1]);
  return all.find(u => u.toLowerCase().includes(".ttf")) ?? all[0] ?? null;
}

function isWoff(bytes) {
  return (bytes[0] === 0x77 && bytes[1] === 0x4F && bytes[2] === 0x46 && (bytes[3] === 0x46 || bytes[3] === 0x32));
}

async function downloadFont(name) {
  const outPath = path.join(OUT_DIR, name.replace(/ /g, "_") + ".ttf");
  if (existsSync(outPath)) { console.log(`  skip (exists): ${name}`); return true; }

  for (const ua of UAS) {
    try {
      const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(name)}:700`;
      const cssRes = await fetch(cssUrl, { headers: { "User-Agent": ua } });
      if (!cssRes.ok) continue;
      const css = await cssRes.text();
      const fontUrl = parseFontUrl(css);
      if (!fontUrl) continue;
      const fontRes = await fetch(fontUrl);
      if (!fontRes.ok) continue;
      const buf = new Uint8Array(await fontRes.arrayBuffer());
      if (isWoff(buf)) continue;
      await writeFile(outPath, buf);
      console.log(`  ✓ ${name} (${Math.round(buf.length / 1024)} KB)`);
      return true;
    } catch { continue; }
  }
  console.log(`  ✗ FAILED: ${name}`);
  return false;
}

await mkdir(OUT_DIR, { recursive: true });
console.log("Downloading fonts to public/fonts/ ...");
for (const font of FONTS) await downloadFont(font);
console.log("Done.");
