import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const templateRef = doc(db, "certificateTemplates", id);
    const snap = await getDoc(templateRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const data = snap.data();

    // Drive-stored template: proxy raw bytes so pdf-lib and iframe both work
    if (data.driveFileId) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${data.driveFileId}`;
      const driveRes = await fetch(downloadUrl, { redirect: "follow" });
      if (!driveRes.ok) {
        return NextResponse.json({ error: "Failed to fetch template from Drive" }, { status: 502 });
      }
      const pdfBytes = await driveRes.arrayBuffer();
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${data.originalName || "template.pdf"}"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Legacy: base64 stored in Firestore
    if (!data.pdfBase64) {
      return NextResponse.json({ error: "No PDF data" }, { status: 404 });
    }

    const pdfBytes = Buffer.from(data.pdfBase64, "base64");

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${data.originalName || "template.pdf"}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("Error serving template PDF:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
