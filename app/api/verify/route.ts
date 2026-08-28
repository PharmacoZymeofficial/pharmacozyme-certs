import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { rateLimit } from "@/lib/rateLimit";
import { normalizeCertId } from "@/lib/certificateId";
import { buildVerificationUrl } from "@/lib/urls";
import { isCategoryMismatch } from "@/lib/category";

// Public route by design — verification is the product. Kept unauthenticated, but it
// reads through the Admin SDK because firestore.rules is now deny-by-default.

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function enrichDriveLink(certData: any) {
  if (certData.driveLink || !certData.databaseId || !certData.participantId) return certData;
  try {
    const participantSnap = await getAdminDb()
      .collection("databases")
      .doc(certData.databaseId)
      .collection("participants")
      .doc(certData.participantId)
      .get();

    if (participantSnap.exists) {
      const pData = participantSnap.data() || {};
      certData.driveLink = pData.driveLink || "";
      certData.pdfUrl = certData.pdfUrl || pData.driveLink || "";
      certData.driveFileId = certData.driveFileId || pData.driveFileId || "";
    }
  } catch { /* non-fatal */ }
  return certData;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { ok, retryAfter } = rateLimit(ip);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before verifying again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawCertId = searchParams.get("certId") || "";
    const certId = normalizeCertId(rawCertId);
    const filterCategory = searchParams.get("category") || "";
    const filterSubCategory = searchParams.get("subCategory") || "";

    if (!certId) {
      return NextResponse.json({ error: "Certificate ID is required" }, { status: 400 });
    }

    const adminDb = getAdminDb();

    function validateCategoryMatch(certData: any): boolean {
      if (filterCategory && certData.category !== filterCategory) return false;
      if (filterSubCategory && certData.subCategory !== filterSubCategory) return false;
      return true;
    }

    function categoryMismatch(certData: any) {
      if (isCategoryMismatch(filterCategory, certData?.category)) {
        return NextResponse.json(
          {
            error: `This certificate belongs to the ${certData.category} category.`,
            mismatch: true,
            actualCategory: certData.category,
            certId,
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Certificate found but does not match the selected category/subcategory." },
        { status: 404 }
      );
    }

    // ── Search 1: certificates collection ────────────────────────────────────
    // Legacy documents may hold the ID in any case, so try the normalized form plus
    // the raw and lowercase variants. These run in parallel rather than sequentially.
    const certVariants = [...new Set([certId, rawCertId, rawCertId.toLowerCase()])].filter(Boolean);
    const certSnaps = await Promise.all(
      certVariants.map((v) => adminDb.collection("certificates").where("uniqueCertId", "==", v).limit(1).get())
    );
    const certHit = certSnaps.find((s) => !s.empty);

    if (certHit) {
      const certDoc = certHit.docs[0];
      const certData = await enrichDriveLink(certDoc.data() as any);
      if (!validateCategoryMatch(certData)) return categoryMismatch(certData);
      return NextResponse.json({ certificate: { id: certDoc.id, ...certData } });
    }

    // ── Search 2: participants, via a single collection-group query ──────────
    // This previously looped every database and issued up to four sequential queries
    // per database — O(databases x 4) round trips on every miss, which is the common
    // case for a typo'd ID. A collection group query covers all of them at once.
    const participantSnaps = await Promise.all(
      certVariants.map((v) =>
        adminDb.collectionGroup("participants").where("certificateId", "==", v).limit(1).get()
      )
    );
    const pHit = participantSnaps.find((s) => !s.empty);

    if (pHit) {
      const pDoc = pHit.docs[0];
      const pData = pDoc.data();

      // The parent of a participants subcollection doc is the database document.
      const dbDoc = await pDoc.ref.parent.parent!.get();
      const dbData = dbDoc.data() || {};

      const certificate = {
        id: pDoc.id,
        uniqueCertId: pData.certificateId || certId,
        recipientName: pData.name || "",
        recipientEmail: pData.email || "",
        category: dbData.category || "",
        subCategory: dbData.subCategory || "",
        topic: dbData.topic || "",
        certType: dbData.topic || dbData.subCategory || "",
        issueDate: pData.issueDate || pData.createdAt || "",
        status: pData.status || "generated",
        pdfUrl: pData.driveLink || "",
        driveLink: pData.driveLink || "",
        verificationUrl: pData.certificateUrl || buildVerificationUrl(certId),
        blockchainHash: `0x${pDoc.id.replace(/-/g, "")}`,
        databaseId: dbDoc.id,
        participantId: pDoc.id,
        createdAt: pData.createdAt || "",
      };

      if (!validateCategoryMatch(certificate)) return categoryMismatch(certificate);
      return NextResponse.json({ certificate });
    }

    return NextResponse.json(
      { error: "Certificate not found. Please check the Certificate ID and try again." },
      { status: 404 }
    );
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: "An error occurred while verifying. Please try again later." },
      { status: 500 }
    );
  }
}
