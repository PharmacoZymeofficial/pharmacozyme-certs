import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { newCertificateId, newBlockchainHash, normalizeCertId } from "@/lib/certificateId";
import { buildVerificationUrl } from "@/lib/urls";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { certificates, category, subCategory } = await request.json();

    if (!certificates || !Array.isArray(certificates) || certificates.length === 0) {
      return NextResponse.json({ error: "No certificates provided" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const certificatesRef = adminDb.collection("certificates");
    const results = { success: 0, failed: 0, errors: [] as string[] };

    // Previously this built a writeBatch and then never used it, writing one document
    // per round trip instead. Now it actually batches, in Firestore's 500-op chunks.
    const pending: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];

    for (let i = 0; i < certificates.length; i++) {
      const cert = certificates[i];

      if (!cert.recipientName || !cert.recipientEmail) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }

      const uniqueCertId = normalizeCertId(cert.uniqueCertId || newCertificateId());

      pending.push({
        ref: certificatesRef.doc(),
        data: {
          uniqueCertId,
          recipientName: cert.recipientName,
          recipientEmail: cert.recipientEmail,
          category: cert.category || category || "General",
          subCategory: cert.subCategory || subCategory || "Courses",
          certType: cert.certType || cert.certificateType || "Certificate",
          issueDate:
            cert.issueDate ||
            cert.date ||
            new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          expiryDate: cert.expiryDate || cert.expiry || "",
          status: cert.status || "active",
          blockchainHash: cert.blockchainHash || newBlockchainHash(),
          // Imported certificates previously had no verification URL or QR target at all.
          verificationUrl: buildVerificationUrl(uniqueCertId),
          qrCode: buildVerificationUrl(uniqueCertId),
          createdAt: new Date().toISOString(),
        },
      });
    }

    const CHUNK = 500;
    for (let i = 0; i < pending.length; i += CHUNK) {
      const batch = adminDb.batch();
      for (const { ref, data } of pending.slice(i, i + CHUNK)) batch.set(ref, data);
      try {
        await batch.commit();
        results.success += Math.min(CHUNK, pending.length - i);
      } catch (err) {
        results.failed += Math.min(CHUNK, pending.length - i);
        results.errors.push(`Batch starting at row ${i + 1}: ${err instanceof Error ? err.message : err}`);
      }
    }

    return NextResponse.json({ success: results.success > 0, results });
  } catch (error) {
    console.error("Error importing certificates:", error);
    return NextResponse.json({ error: "Failed to import certificates" }, { status: 500 });
  }
}
