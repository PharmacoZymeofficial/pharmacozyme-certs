import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { loadFontBytes } from "@/lib/fonts";

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

function getTemplatePositions(width: number, height: number, positions?: { name: { x: number; y: number; size?: number; color?: string; font?: string }; certId: { x: number; y: number; size?: number; color?: string; font?: string }; qr: { x: number; y: number; size: number; darkColor?: string; lightColor?: string; transparentBg?: boolean } }) {
  if (positions) {
    const qrSizeValue = positions.qr.size || 12;
    const qrDimension = (Math.min(width, height) * qrSizeValue) / 100;

    return {
      namePos: { x: (width * positions.name.x) / 100, y: height - (height * positions.name.y) / 100, size: positions.name.size || 48, color: hexToRgb(positions.name.color || "#1b4332"), font: positions.name.font || null },
      certIdPos: { x: (width * positions.certId.x) / 100, y: height - (height * positions.certId.y) / 100, size: positions.certId.size || 12, color: hexToRgb(positions.certId.color || "#333333"), font: positions.certId.font || null },
      qrPos: {
        x: (width * positions.qr.x) / 100,
        y: height - (height * positions.qr.y) / 100,
        width: qrDimension,
        height: qrDimension,
        darkColor: positions.qr.darkColor || "#000000",
        lightColor: positions.qr.transparentBg ? "#00000000" : (positions.qr.lightColor || "#ffffff"),
      }
    };
  }
  
  return {
    namePos: { x: width / 2, y: height * 0.55, size: 48, color: { r: 0.1, g: 0.26, b: 0.2 } },
    certIdPos: { x: width / 2, y: height * 0.38, size: 12, color: { r: 0.2, g: 0.2, b: 0.2 } },
    qrPos: { x: width - 150, y: height * 0.42, width: 100, height: 100 }
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, templateUrl, templatePositions, testData } = body;

    let templateBytes: ArrayBuffer;

    if (templateId) {
      // Fetch PDF from Firestore directly
      const snap = await getDoc(doc(db, "certificateTemplates", templateId));
      if (!snap.exists() || !snap.data().pdfBase64) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      const buf = Buffer.from(snap.data().pdfBase64, "base64");
      templateBytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } else if (templateUrl) {
      // Legacy: fetch from URL
      let fetchUrl = templateUrl;
      if (templateUrl.startsWith('/')) {
        fetchUrl = `${request.nextUrl.origin}${templateUrl}`;
      }
      const templateResponse = await fetch(fetchUrl);
      if (!templateResponse.ok) {
        return NextResponse.json({ error: `Failed to fetch template: ${templateResponse.status}` }, { status: 400 });
      }
      templateBytes = await templateResponse.arrayBuffer();
    } else {
      return NextResponse.json({ error: "templateId or templateUrl is required" }, { status: 400 });
    }

    console.log("Generating preview with positions:", JSON.stringify(templatePositions, null, 2));
    
    // Load PDF
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();
    console.log("PDF size:", width, "x", height);
    
    // Get positions
    const positions = getTemplatePositions(width, height, templatePositions);
    console.log("Calculated positions:", JSON.stringify(positions, null, 2));

    // Embed fonts — use custom Google Font if specified, else fall back to Helvetica
    const [nameFontBytes, certIdFontBytes] = await Promise.all([
      positions.namePos.font ? loadFontBytes(positions.namePos.font) : Promise.resolve(null),
      positions.certIdPos.font ? loadFontBytes(positions.certIdPos.font) : Promise.resolve(null),
    ]);
    let nameFont, certIdFont;
    try {
      nameFont = nameFontBytes
        ? await pdfDoc.embedFont(nameFontBytes)
        : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    } catch {
      nameFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
    try {
      certIdFont = certIdFontBytes
        ? await pdfDoc.embedFont(certIdFontBytes)
        : await pdfDoc.embedFont(StandardFonts.Helvetica);
    } catch {
      certIdFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Name - with correct color
    const nameText = testData?.name || "John Doe";
    const nameFontSize = positions.namePos.size || 48;
    const nameColor = positions.namePos.color || { r: 0.1, g: 0.26, b: 0.2 };

    page.drawText(nameText, {
      x: positions.namePos.x - (nameFont.widthOfTextAtSize(nameText, nameFontSize) / 2),
      y: positions.namePos.y,
      size: nameFontSize,
      font: nameFont,
      color: rgb(nameColor.r, nameColor.g, nameColor.b),
    });

    // Certificate ID - with correct color
    const idText = testData?.certId || "2026-PZ-CRS-0001";
    const idFontSize = positions.certIdPos.size || 12;
    const idColor = positions.certIdPos.color || { r: 0.2, g: 0.2, b: 0.2 };

    page.drawText(idText, {
      x: positions.certIdPos.x - (certIdFont.widthOfTextAtSize(idText, idFontSize) / 2),
      y: positions.certIdPos.y,
      size: idFontSize,
      font: certIdFont,
      color: rgb(idColor.r, idColor.g, idColor.b),
    });

    // Generate actual QR code
    const qrSize = positions.qrPos.width;
    const qrX = positions.qrPos.x - (qrSize / 2);
    const qrY = positions.qrPos.y - (qrSize / 2);
    
    try {
      // Generate QR code as PNG
      const qrDarkColor = positions.qrPos.darkColor || "#000000";
      const qrLightColor = (positions.qrPos as any).lightColor || "#ffffff";
      const qrDataUrl = await QRCode.toDataURL("https://verify.pharmacozyme.com/verify?id=TEST-123", {
        width: Math.round(qrSize),
        margin: 1,
        color: { dark: qrDarkColor, light: qrLightColor }
      });
      
      // Embed QR code image
      const qrImageBytes = await fetch(qrDataUrl).then(res => res.arrayBuffer());
      const qrImage = await pdfDoc.embedPng(qrImageBytes);
      
      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });
    } catch (qrErr) {
      console.error("QR generation error:", qrErr);
      // Fallback to rectangle
      page.drawRectangle({
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
    }

    const pdfBytes = await pdfDoc.save();
    
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
      },
    });
  } catch (error: any) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview", details: error?.message },
      { status: 500 }
    );
  }
}