import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { loadFontBytes } from "@/lib/fonts.server";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }
  return { r: 0.1, g: 0.26, b: 0.2 };
}

function getPositions(width: number, height: number, positions: any) {
  if (!positions) {
    const qrSize = Math.min(width, height) * 0.12;
    return {
      namePos: { x: width / 2, y: height * 0.55, size: 48, color: { r: 0.1, g: 0.26, b: 0.2 }, font: null },
      certIdPos: { x: width / 2, y: height * 0.38, size: 12, color: { r: 0.2, g: 0.2, b: 0.2 }, font: null },
      qrPos: { x: width - qrSize - 60, y: height * 0.42, width: qrSize, height: qrSize, darkColor: "#000000", lightColor: "#ffffff" },
      customElements: [] as any[],
    };
  }
  const qrSizeValue = positions.qr?.size || 12;
  const qrDimension = (Math.min(width, height) * qrSizeValue) / 100;
  return {
    namePos: {
      x: (width * positions.name.x) / 100,
      y: height - (height * positions.name.y) / 100,
      size: positions.name.size || 48,
      color: hexToRgb(positions.name.color || "#1b4332"),
      font: positions.name.font || null,
    },
    certIdPos: {
      x: (width * positions.certId.x) / 100,
      y: height - (height * positions.certId.y) / 100,
      size: positions.certId.size || 12,
      color: hexToRgb(positions.certId.color || "#333333"),
      font: positions.certId.font || null,
    },
    qrPos: {
      x: (width * positions.qr.x) / 100,
      y: height - (height * positions.qr.y) / 100,
      width: qrDimension,
      height: qrDimension,
      darkColor: positions.qr.darkColor || "#000000",
      lightColor: positions.qr.transparentBg ? "#00000000" : (positions.qr.lightColor || "#ffffff"),
    },
    customElements: (positions.customElements || []).map((el: any) => ({
      ...el,
      px: (width * el.x) / 100,
      py: height - (height * el.y) / 100,
      color: hexToRgb(el.color || "#333333"),
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, recipientName, certId, verificationUrl, qrDarkColor, qrLightColor } = body;

    if (!templateId || !recipientName || !certId) {
      return NextResponse.json({ error: "templateId, recipientName, certId required" }, { status: 400 });
    }

    // Load template from Firestore
    const snap = await getDoc(doc(db, "certificateTemplates", templateId));
    if (!snap.exists()) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    const templateData = snap.data();

    let templateBytes: ArrayBuffer;
    if (templateData.driveFileId) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${templateData.driveFileId}`;
      const driveRes = await fetch(downloadUrl, { redirect: "follow" });
      if (!driveRes.ok) {
        return NextResponse.json({ error: "Failed to fetch template from Drive" }, { status: 502 });
      }
      templateBytes = await driveRes.arrayBuffer();
    } else if (templateData.pdfBase64) {
      const buf = Buffer.from(templateData.pdfBase64, "base64");
      templateBytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } else {
      return NextResponse.json({ error: "Template has no PDF data" }, { status: 404 });
    }

    const pdfDoc = await PDFDocument.load(templateBytes);
    pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();

    const pos = getPositions(width, height, templateData.positions);

    // Embed fonts server-side
    const customEls = pos.customElements || [];
    const uniqueCustomFonts = [...new Set(customEls.map((el: any) => el.font).filter(Boolean))];
    const [nameFontBytes, certIdFontBytes, ...customFontBytesArr] = await Promise.all([
      pos.namePos.font ? loadFontBytes(pos.namePos.font) : Promise.resolve(null),
      pos.certIdPos.font ? loadFontBytes(pos.certIdPos.font) : Promise.resolve(null),
      ...uniqueCustomFonts.map((f: any) => loadFontBytes(f)),
    ]);
    const customFontMap = new Map<string, Uint8Array | null>();
    uniqueCustomFonts.forEach((f: any, i: number) => customFontMap.set(f, customFontBytesArr[i] ?? null));
    console.log("[render] nameFont:", pos.namePos.font, "loaded:", !!nameFontBytes);

    let nameFont, certIdFont;
    try {
      nameFont = nameFontBytes
        ? await pdfDoc.embedFont(nameFontBytes, { subset: true })
        : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    } catch (e) {
      console.error("[render] Name font embed failed:", e);
      nameFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
    try {
      certIdFont = certIdFontBytes
        ? await pdfDoc.embedFont(certIdFontBytes, { subset: true })
        : await pdfDoc.embedFont(StandardFonts.Helvetica);
    } catch (e) {
      console.error("[render] CertId font embed failed:", e);
      certIdFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Draw name — proactively scale for word count, then hard overflow guard
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
    const nameColor = pos.namePos.color;
    const nameXCentered = pos.namePos.x - nameTextWidth / 2;
    const nameX = Math.max(nameMargin, Math.min(width - nameTextWidth - nameMargin, nameXCentered));
    page.drawText(recipientName, {
      x: nameX,
      y: pos.namePos.y,
      size: nameFontSize,
      font: nameFont,
      color: rgb(nameColor.r, nameColor.g, nameColor.b),
    });

    // Draw cert ID
    const idFontSize = pos.certIdPos.size;
    const idColor = pos.certIdPos.color;
    page.drawText(certId, {
      x: pos.certIdPos.x - certIdFont.widthOfTextAtSize(certId, idFontSize) / 2,
      y: pos.certIdPos.y,
      size: idFontSize,
      font: certIdFont,
      color: rgb(idColor.r, idColor.g, idColor.b),
    });

    // Draw QR code
    const qrUrl = verificationUrl || `https://cert.pharmacozyme.com/claim?id=${certId}`;
    const qrSize = pos.qrPos.width;
    const qrX = pos.qrPos.x - qrSize / 2;
    const qrY = pos.qrPos.y - qrSize / 2;
    try {
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: Math.round(qrSize),
        margin: 1,
        color: {
          dark: qrDarkColor || pos.qrPos.darkColor || "#000000",
          light: qrLightColor || pos.qrPos.lightColor || "#ffffff",
        },
      });
      const qrImageBytes = await fetch(qrDataUrl).then(r => r.arrayBuffer());
      const qrImage = await pdfDoc.embedPng(qrImageBytes);
      page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    } catch (qrErr) {
      console.error("[render] QR error:", qrErr);
      page.drawRectangle({ x: qrX, y: qrY, width: qrSize, height: qrSize, borderColor: rgb(0, 0, 0), borderWidth: 1 });
    }

    // Draw custom text elements
    for (const cel of customEls) {
      try {
        const fontBytes = cel.font ? customFontMap.get(cel.font) ?? null : null;
        let font;
        try { font = fontBytes ? await pdfDoc.embedFont(fontBytes, { subset: true }) : await pdfDoc.embedFont(StandardFonts.Helvetica); }
        catch { font = await pdfDoc.embedFont(StandardFonts.Helvetica); }
        const sz = cel.size || 18;
        const col = cel.color;
        const textW = font.widthOfTextAtSize(cel.text, sz);
        page.drawText(cel.text, {
          x: cel.px - textW / 2,
          y: cel.py,
          size: sz,
          font,
          color: rgb(col.r, col.g, col.b),
        });
      } catch { /* skip broken custom element */ }
    }

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (error: any) {
    console.error("[render] Error:", error);
    return NextResponse.json({ error: "Failed to render certificate", details: error?.message }, { status: 500 });
  }
}
