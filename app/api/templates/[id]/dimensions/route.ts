import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const snap = await getDoc(doc(db, "certificateTemplates", id));
    if (!snap.exists() || !snap.data().pdfBase64) {
      return NextResponse.json({ width: 595, height: 842 });
    }
    const buf = Buffer.from(snap.data().pdfBase64, "base64");
    const pdfDoc = await PDFDocument.load(buf);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();
    return NextResponse.json({ width, height });
  } catch {
    return NextResponse.json({ width: 595, height: 842 }); // A4 portrait fallback
  }
}
