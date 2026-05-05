// Retry failed fonts with weight 400 and more user agents
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "fonts");

const FONTS = ["Allura", "Alata", "Great Vibes", "Satisfy", "Sacramento", "Alex Brush"];

const UAS = [
  "Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
  "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)",
  "BlackBerry9700/5.0.0.743 Profile/MIDP-2.1 Configuration/CLDC-1.1 VendorID/100",
  "NokiaC3-00/5.0 (07.20) Profile/MIDP-2.1 Configuration/CLDC-1.1",
  "Dalvik/1.6.0 (Linux; U; Android 2.3.4)",
];

function parseFontUrl(css) {
  const all = [...css.matchAll(/url\(['"]?([^'"\n)]+)['"]?\)/g)].map(m => m[1]);
  const ttf = all.find(u => u.toLowerCase().includes(".ttf"));
  if (ttf) return ttf;
  // Try any format including otf
  const otf = all.find(u => u.toLowerCase().includes(".otf"));
  if (otf) return otf;
  return all[0] ?? null;
}

function isWoff(b) {
  return (b[0] === 0x77 && b[1] === 0x4F && b[2] === 0x46 && (b[3] === 0x46 || b[3] === 0x32));
}

async function downloadFont(name) {
  const outPath = path.join(OUT_DIR, name.replace(/ /g, "_") + ".ttf");
  if (existsSync(outPath)) { console.log(`  skip: ${name}`); return true; }

  // Try both weight 400 and 700 for each UA
  for (const weight of ["400", "700", ""]) {
    for (const ua of UAS) {
      try {
        const family = encodeURIComponent(name) + (weight ? `:${weight}` : "");
        const cssUrl = `https://fonts.googleapis.com/css?family=${family}`;
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
        console.log(`  ✓ ${name} w${weight} (${Math.round(buf.length / 1024)} KB)`);
        return true;
      } catch { continue; }
    }
  }
  console.log(`  ✗ STILL FAILED: ${name}`);
  return false;
}

await mkdir(OUT_DIR, { recursive: true });
console.log("Retrying failed fonts...");
for (const font of FONTS) await downloadFont(font);
console.log("Done.");
