import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const snap = await getDoc(doc(db, "certificateTemplates", id));
    if (!snap.exists()) return NextResponse.json({ width: 595, height: 842 });

    const data = snap.data();
    let buf: Buffer;
    if (data.driveFileId) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${data.driveFileId}`;
      const driveRes = await fetch(downloadUrl, { redirect: "follow" });
      if (!driveRes.ok) return NextResponse.json({ width: 595, height: 842 });
      buf = Buffer.from(await driveRes.arrayBuffer());
    } else if (data.pdfBase64) {
      buf = Buffer.from(data.pdfBase64, "base64");
    } else {
      return NextResponse.json({ width: 595, height: 842 });
    }

    const pdfDoc = await PDFDocument.load(buf);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();
    return NextResponse.json({ width, height });
  } catch {
    return NextResponse.json({ width: 595, height: 842 }); // A4 portrait fallback
  }
}
