import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";

// Serves the raw template PDF for the admin template editor's iframe and for pdf-lib.
// Admin-gated: templates are internal assets, not public downloads.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const snap = await getAdminDb().collection("certificateTemplates").doc(id).get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const data = snap.data() || {};
    const headers = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.originalName || "template.pdf"}"`,
      // Private: this is behind auth, so shared caches must not keep a copy.
      "Cache-Control": "private, max-age=3600",
    };

    if (data.driveFileId) {
      const driveRes = await fetch(
        `https://drive.google.com/uc?export=download&id=${data.driveFileId}`,
        { redirect: "follow" }
      );
      if (!driveRes.ok) {
        return NextResponse.json(
          {
            error: "Failed to fetch template from Drive",
            details:
              `Drive returned ${driveRes.status}. If this is 403, the Workspace sharing policy may be ` +
              `blocking "anyone with the link" on the templates folder.`,
          },
          { status: 502 }
        );
      }
      return new NextResponse(await driveRes.arrayBuffer(), { headers });
    }

    if (!data.pdfBase64) {
      return NextResponse.json({ error: "No PDF data" }, { status: 404 });
    }

    return new NextResponse(Buffer.from(data.pdfBase64, "base64"), { headers });
  } catch (error: any) {
    console.error("Error serving template PDF:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
