import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { loadFontBytes } from "@/lib/fonts.server";
import { buildCertificateUrl } from "@/lib/urls";

export interface RenderCustomElement {
  id: string;
  text: string;
  x: number;
  y: number;
  size?: number;
  color?: string;
  font?: string;
  bg?: string;
  bgPadding?: number;
  letterSpacing?: number;
  /** When set, the printed text comes from fieldValues[sourceField] instead of the literal `text`. */
  sourceField?: string;
}

export interface RenderPositions {
  name: { x: number; y: number; size?: number; color?: string; font?: string; bg?: string; bgPadding?: number; letterSpacing?: number };
  certId: { x: number; y: number; size?: number; color?: string; font?: string; bg?: string; bgPadding?: number; letterSpacing?: number };
  qr: { x: number; y: number; size?: number; darkColor?: string; lightColor?: string; transparentBg?: boolean };
  customElements?: RenderCustomElement[];
}

export interface RenderCertificateParams {
  templateBytes: ArrayBuffer;
  positions?: RenderPositions;
  recipientName: string;
  certId: string;
  verificationUrl: string;
  qrDarkColor?: string;
  qrLightColor?: string;
  /** Per-participant values for custom elements bound via sourceField (e.g. { Designation: "Volunteer" }). */
  fieldValues?: Record<string, string>;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 };
  }
  return { r: 0.1, g: 0.26, b: 0.2 };
}

function resolvePositions(width: number, height: number, positions?: RenderPositions) {
  if (!positions) {
    const qrSize = Math.min(width, height) * 0.12;
    return {
      namePos: { x: width / 2, y: height * 0.55, size: 48, color: { r: 0.1, g: 0.26, b: 0.2 }, font: null as string | null, bg: null as string | null, bgPadding: 6, letterSpacing: 0 },
      certIdPos: { x: width / 2, y: height * 0.38, size: 12, color: { r: 0.2, g: 0.2, b: 0.2 }, font: null as string | null, bg: null as string | null, bgPadding: 4, letterSpacing: 0 },
      qrPos: { x: width - qrSize - 60, y: height * 0.42, width: qrSize, height: qrSize, darkColor: "#000000", lightColor: "#ffffff" },
      customElements: [] as Array<RenderCustomElement & { px: number; py: number; rgbColor: { r: number; g: number; b: number } }>,
    };
  }
  const qrSizeValue = positions.qr.size || 12;
  const qrDimension = (Math.min(width, height) * qrSizeValue) / 100;
  return {
    namePos: {
      x: (width * positions.name.x) / 100,
      y: height - (height * positions.name.y) / 100,
      size: positions.name.size || 48,
      color: hexToRgb(positions.name.color || "#1b4332"),
      font: positions.name.font || null,
      bg: positions.name.bg || null,
      bgPadding: positions.name.bgPadding ?? 6,
      letterSpacing: positions.name.letterSpacing || 0,
    },
    certIdPos: {
      x: (width * positions.certId.x) / 100,
      y: height - (height * positions.certId.y) / 100,
      size: positions.certId.size || 12,
      color: hexToRgb(positions.certId.color || "#333333"),
      font: positions.certId.font || null,
      bg: positions.certId.bg || null,
      bgPadding: positions.certId.bgPadding ?? 4,
      letterSpacing: positions.certId.letterSpacing || 0,
    },
    qrPos: {
      x: (width * positions.qr.x) / 100,
      y: height - (height * positions.qr.y) / 100,
      width: qrDimension,
      height: qrDimension,
      darkColor: positions.qr.darkColor || "#000000",
      lightColor: positions.qr.transparentBg ? "#00000000" : (positions.qr.lightColor || "#ffffff"),
    },
    customElements: (positions.customElements || []).map((el) => ({
      ...el,
      px: (width * el.x) / 100,
      py: height - (height * el.y) / 100,
      rgbColor: hexToRgb(el.color || "#333333"),
    })),
  };
}

/** Draws text with optional letter spacing and an optional background box behind it, centered on (x, y). */
function drawCenteredText(page: PDFPage, text: string, opts: {
  x: number; y: number; size: number; font: PDFFont; color: { r: number; g: number; b: number };
  letterSpacing?: number; bg?: string | null; bgPadding?: number;
}) {
  const { x, y, size, font, color, bg, bgPadding = 6 } = opts;
  const letterSpacing = opts.letterSpacing || 0;

  const baseWidth = font.widthOfTextAtSize(text, size);
  const totalWidth = letterSpacing ? baseWidth + letterSpacing * Math.max(0, text.length - 1) : baseWidth;
  const startX = x - totalWidth / 2;

  if (bg) {
    const bgColor = hexToRgb(bg);
    const ascent = size * 0.75;
    const descent = size * 0.25;
    page.drawRectangle({
      x: startX - bgPadding,
      y: y - descent - bgPadding,
      width: totalWidth + bgPadding * 2,
      height: ascent + descent + bgPadding * 2,
      color: rgb(bgColor.r, bgColor.g, bgColor.b),
    });
  }

  if (!letterSpacing) {
    page.drawText(text, { x: startX, y, size, font, color: rgb(color.r, color.g, color.b) });
    return;
  }

  let cursorX = startX;
  for (const ch of text) {
    page.drawText(ch, { x: cursorX, y, size, font, color: rgb(color.r, color.g, color.b) });
    cursorX += font.widthOfTextAtSize(ch, size) + letterSpacing;
  }
}

export async function renderCertificatePdf(params: RenderCertificateParams): Promise<Uint8Array> {
  const { templateBytes, positions, recipientName, certId, verificationUrl, qrDarkColor, qrLightColor, fieldValues } = params;

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();

  const pos = resolvePositions(width, height, positions);

  const customEls = pos.customElements;
  const uniqueCustomFonts = [...new Set(customEls.map((el) => el.font).filter(Boolean))] as string[];
  const [nameFontBytes, certIdFontBytes, ...customFontBytesArr] = await Promise.all([
    pos.namePos.font ? loadFontBytes(pos.namePos.font) : Promise.resolve(null),
    pos.certIdPos.font ? loadFontBytes(pos.certIdPos.font) : Promise.resolve(null),
    ...uniqueCustomFonts.map((f) => loadFontBytes(f)),
  ]);
  const customFontMap = new Map<string, Uint8Array | null>();
  uniqueCustomFonts.forEach((f, i) => customFontMap.set(f, customFontBytesArr[i] ?? null));

  let nameFont: PDFFont, certIdFont: PDFFont;
  try {
    nameFont = nameFontBytes ? await pdfDoc.embedFont(nameFontBytes, { subset: true }) : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  } catch (e) {
    console.error("[certificateRender] Name font embed failed:", e);
    nameFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }
  try {
    certIdFont = certIdFontBytes ? await pdfDoc.embedFont(certIdFontBytes, { subset: true }) : await pdfDoc.embedFont(StandardFonts.Helvetica);
  } catch (e) {
    console.error("[certificateRender] CertId font embed failed:", e);
    certIdFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  // Name — proactively scale for word count, then hard overflow guard
  const nameMargin = 20;
  const nameWordCount = recipientName.trim().split(/\s+/).length;
  const wordCountFactor = nameWordCount <= 2 ? 1.0 : nameWordCount === 3 ? 0.82 : 0.70;
  let nameFontSize = Math.max(8, Math.floor(pos.namePos.size * wordCountFactor));
  const maxNameWidth = width - 2 * nameMargin;
  let nameTextWidth = nameFont.widthOfTextAtSize(recipientName, nameFontSize);
  if (nameTextWidth > maxNameWidth) {
    nameFontSize = Math.max(8, Math.floor(nameFontSize * (maxNameWidth / nameTextWidth)));
    nameTextWidth = nameFont.widthOfTextAtSize(recipientName, nameFontSize);
    while (nameTextWidth > maxNameWidth && nameFontSize > 8) {
      nameFontSize -= 1;
      nameTextWidth = nameFont.widthOfTextAtSize(recipientName, nameFontSize);
    }
  }
  drawCenteredText(page, recipientName, {
    x: pos.namePos.x, y: pos.namePos.y, size: nameFontSize, font: nameFont, color: pos.namePos.color,
    letterSpacing: pos.namePos.letterSpacing, bg: pos.namePos.bg, bgPadding: pos.namePos.bgPadding,
  });

  // Certificate ID
  drawCenteredText(page, certId, {
    x: pos.certIdPos.x, y: pos.certIdPos.y, size: pos.certIdPos.size, font: certIdFont, color: pos.certIdPos.color,
    letterSpacing: pos.certIdPos.letterSpacing, bg: pos.certIdPos.bg, bgPadding: pos.certIdPos.bgPadding,
  });

  // QR code
  const qrUrl = verificationUrl || buildCertificateUrl(certId);
  const qrSize = pos.qrPos.width;
  const qrX = pos.qrPos.x - qrSize / 2;
  const qrY = pos.qrPos.y - qrSize / 2;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: Math.round(qrSize),
      margin: 1,
      color: { dark: qrDarkColor || pos.qrPos.darkColor || "#000000", light: qrLightColor || pos.qrPos.lightColor || "#ffffff" },
    });
    const qrImageBytes = await fetch(qrDataUrl).then((r) => r.arrayBuffer());
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  } catch (qrErr) {
    console.error("[certificateRender] QR error:", qrErr);
    page.drawRectangle({ x: qrX, y: qrY, width: qrSize, height: qrSize, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  }

  // Custom text elements — either literal static text, or bound to a per-participant field
  for (const cel of customEls) {
    try {
      const fontBytes = cel.font ? customFontMap.get(cel.font) ?? null : null;
      let font: PDFFont;
      try {
        font = fontBytes ? await pdfDoc.embedFont(fontBytes, { subset: true }) : await pdfDoc.embedFont(StandardFonts.Helvetica);
      } catch {
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }
      const text = cel.sourceField ? (fieldValues?.[cel.sourceField] ?? "") : cel.text;
      if (!text) continue; // nothing to draw — don't print an empty box for a missing bound value
      drawCenteredText(page, text, {
        x: cel.px, y: cel.py, size: cel.size || 18, font, color: cel.rgbColor,
        letterSpacing: cel.letterSpacing, bg: cel.bg, bgPadding: cel.bgPadding,
      });
    } catch { /* skip broken custom element */ }
  }

  return pdfDoc.save();
}
