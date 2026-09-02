import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { renderCertificatePdf } from "@/lib/certificateRender";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { templateId, recipientName, certId, verificationUrl, qrDarkColor, qrLightColor, fieldValues } = body;

    if (!templateId || !recipientName || !certId) {
      return NextResponse.json({ error: "templateId, recipientName, certId required" }, { status: 400 });
    }

    const snap = await getAdminDb().collection("certificateTemplates").doc(templateId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    const templateData = snap.data() || {};

    const { fetchTemplatePdf } = await import("@/lib/templateBytes");
    const templatePdf = await fetchTemplatePdf(templateId, templateData);
    const templateBytes = templatePdf.buffer.slice(
      templatePdf.byteOffset,
      templatePdf.byteOffset + templatePdf.byteLength
    );

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
