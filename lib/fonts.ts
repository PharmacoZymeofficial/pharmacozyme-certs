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

// Server-side only: fetch TTF bytes from Google Fonts for pdf-lib embedding
export async function loadFontBytes(fontName: string): Promise<Uint8Array | null> {
  if (!fontName) return null;
  try {
    const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(fontName)}&display=swap`;
    // Old Android UA → Google Fonts returns TTF (pdf-lib only supports TTF/OTF, not WOFF/WOFF2/EOT)
    const cssRes = await fetch(cssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1" },
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/url\(([^)]+)\)/);
    if (!match) return null;
    const fontUrl = match[1].replace(/['"]/g, "");
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;
    const buf = await fontRes.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Reject non-TTF/OTF formats (WOFF starts with "wOFF", WOFF2 "wOF2", EOT is not TTF/OTF)
    const isTTF = (bytes[0] === 0x00 && bytes[1] === 0x01) || (bytes[0] === 0x74 && bytes[1] === 0x72);
    const isOTF = bytes[0] === 0x4F && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4F;
    if (!isTTF && !isOTF) return null;
    return bytes;
  } catch {
    return null;
  }
}
