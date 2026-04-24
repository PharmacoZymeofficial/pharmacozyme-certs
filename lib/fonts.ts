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
    const cssRes = await fetch(cssUrl, {
      headers: { "User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)" },
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/url\(([^)]+)\)/);
    if (!match) return null;
    const fontUrl = match[1].replace(/['"]/g, "");
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) return null;
    const buf = await fontRes.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}
