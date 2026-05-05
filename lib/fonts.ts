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

