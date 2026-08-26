import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { renderCertificatePdf } from "@/lib/certificateRender";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, recipientName, certId, verificationUrl, qrDarkColor, qrLightColor, fieldValues } = body;

    if (!templateId || !recipientName || !certId) {
      return NextResponse.json({ error: "templateId, recipientName, certId required" }, { status: 400 });
    }

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

    const pdfBytes = await renderCertificatePdf({
      templateBytes,
      positions: templateData.positions,
      recipientName,
      certId,
      verificationUrl,
      qrDarkColor,
      qrLightColor,
      fieldValues,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (error: any) {
    console.error("[render] Error:", error);
    return NextResponse.json({ error: "Failed to render certificate", details: error?.message }, { status: 500 });
  }
}
