import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { renderCertificatePdf } from "@/lib/certificateRender";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, templateUrl, templatePositions, testData, testFieldValues } = body;

    let templateBytes: ArrayBuffer;

    if (templateId) {
      const snap = await getDoc(doc(db, "certificateTemplates", templateId));
      if (!snap.exists()) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      const tData = snap.data();
      if (tData.driveFileId) {
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${tData.driveFileId}`;
        const driveRes = await fetch(downloadUrl, { redirect: "follow" });
        if (!driveRes.ok) {
          return NextResponse.json({ error: "Failed to fetch template from Drive" }, { status: 502 });
        }
        templateBytes = await driveRes.arrayBuffer();
      } else if (tData.pdfBase64) {
        const buf = Buffer.from(tData.pdfBase64, "base64");
        templateBytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      } else {
        return NextResponse.json({ error: "Template has no PDF data" }, { status: 404 });
      }
    } else if (templateUrl) {
      // Legacy: fetch from URL
      let fetchUrl = templateUrl;
      if (templateUrl.startsWith("/")) {
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

    const pdfBytes = await renderCertificatePdf({
      templateBytes,
      positions: templatePositions,
      recipientName: testData?.name || "Dr John Doe Wright",
      certId: testData?.certId || "2026-PZ-CRS-0001",
      verificationUrl: "https://cert.pharmacozyme.com/verify?id=TEST-123",
      fieldValues: testFieldValues,
    });

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
