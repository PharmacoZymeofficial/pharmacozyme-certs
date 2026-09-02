import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";
import { getAdminDb } from "@/lib/firebase.admin";

const MAX_STORED_B64 = 920_000; // keep the Firestore doc well under the 1 MB limit

/**
 * Template PDF bytes, independent of Drive link-sharing.
 * 1. stored pdfBase64  2. Drive public URL (fast path for shared files)
 * 3. Apps Script getTemplateBytes (always works — runs as the file owner)
 * On a step-3 success, best-effort caches pdfBase64 back onto the template doc.
 */
export async function fetchTemplatePdf(
  templateId: string,
  templateData: { driveFileId?: string; pdfBase64?: string }
): Promise<Buffer<ArrayBuffer>> {
  if (templateData.pdfBase64) {
    return Buffer.from(templateData.pdfBase64, "base64");
  }

  if (templateData.driveFileId) {
    try {
      const res = await fetch(
        `https://drive.google.com/uc?export=download&id=${templateData.driveFileId}`,
        { redirect: "follow" }
      );
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        // Heuristic: Drive's HTML "can't scan / sign in" pages are small and not %PDF.
        if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return buf;
      }
    } catch {
      /* fall through */
    }

    if (appsScriptConfigured()) {
      const r = await callAppsScript<{ success?: boolean; base64?: string; error?: string }>(
        "getTemplateBytes",
        { fileId: templateData.driveFileId }
      );
      if (r?.success && r.base64) {
        const buf = Buffer.from(r.base64, "base64");
        if (r.base64.length <= MAX_STORED_B64) {
          getAdminDb()
            .collection("certificateTemplates")
            .doc(templateId)
            .update({ pdfBase64: r.base64 })
            .catch(() => {});
        }
        return buf;
      }
    }
  }

  throw new Error("Template PDF could not be loaded from Drive or Apps Script.");
}
