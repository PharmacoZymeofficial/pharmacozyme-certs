import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";

const A4_PORTRAIT = { width: 595, height: 842 };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const snap = await getAdminDb().collection("certificateTemplates").doc(id).get();
    if (!snap.exists) return NextResponse.json(A4_PORTRAIT);

    const data = snap.data() || {};
    let buf: Buffer;
    if (data.driveFileId) {
      const driveRes = await fetch(
        `https://drive.google.com/uc?export=download&id=${data.driveFileId}`,
        { redirect: "follow" }
      );
      if (!driveRes.ok) return NextResponse.json(A4_PORTRAIT);
      buf = Buffer.from(await driveRes.arrayBuffer());
    } else if (data.pdfBase64) {
      buf = Buffer.from(data.pdfBase64, "base64");
    } else {
      return NextResponse.json(A4_PORTRAIT);
    }

    const { width, height } = (await PDFDocument.load(buf)).getPages()[0].getSize();
    return NextResponse.json({ width, height });
  } catch {
    return NextResponse.json(A4_PORTRAIT);
  }
}
