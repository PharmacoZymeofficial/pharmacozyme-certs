import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { renderCertificatePdf } from "@/lib/certificateRender";
import { buildVerificationUrl } from "@/lib/urls";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { templateId, templateUrl, templatePositions, testData, testFieldValues } = body;

    let templateBytes: ArrayBuffer;

    if (templateId) {
      const snap = await getAdminDb().collection("certificateTemplates").doc(templateId).get();
      if (!snap.exists) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      const tData = snap.data() || {};
      const { fetchTemplatePdf } = await import("@/lib/templateBytes");
      const templatePdf = await fetchTemplatePdf(templateId, tData);
      templateBytes = templatePdf.buffer.slice(
        templatePdf.byteOffset,
        templatePdf.byteOffset + templatePdf.byteLength
      );
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
      verificationUrl: buildVerificationUrl(testData?.certId || "TEST-123"),
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
