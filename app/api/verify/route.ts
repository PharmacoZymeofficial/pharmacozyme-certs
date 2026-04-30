import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { rateLimit } from "@/lib/rateLimit";

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
    const participantRef = doc(db, "databases", certData.databaseId, "participants", certData.participantId);
    const participantSnap = await getDoc(participantRef);
    if (participantSnap.exists()) {
      const pData = participantSnap.data();
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
    const certId = (searchParams.get("certId") || "").toUpperCase().trim() || null;
    const filterCategory = searchParams.get("category") || "";
    const filterSubCategory = searchParams.get("subCategory") || "";

    if (!certId) {
      return NextResponse.json(
        { error: "Certificate ID is required" },
        { status: 400 }
      );
    }

    // Search 1: certificates collection (generated via generate route)
    const certificatesRef = collection(db, "certificates");
    const q = query(certificatesRef, where("uniqueCertId", "==", certId));
    const querySnapshot = await getDocs(q);

    function validateCategoryMatch(certData: any): boolean {
      if (filterCategory && certData.category !== filterCategory) return false;
      if (filterSubCategory && certData.subCategory !== filterSubCategory) return false;
      return true;
    }

    if (!querySnapshot.empty) {
      const certDoc = querySnapshot.docs[0];
      const certData = await enrichDriveLink(certDoc.data() as any);
      if (!validateCategoryMatch(certData)) {
        return NextResponse.json({ error: "Certificate found but does not match the selected category/subcategory." }, { status: 404 });
      }
      return NextResponse.json({ certificate: { id: certDoc.id, ...certData } });
    }

    // Search 2: also try case-insensitive variations
    const qLower = query(certificatesRef, where("uniqueCertId", "==", certId.toLowerCase()));
    const qOrig = query(certificatesRef, where("uniqueCertId", "==", searchParams.get("certId") || ""));
    const [snapLower, snapOrig] = await Promise.all([getDocs(qLower), getDocs(qOrig)]);

    const altSnap = !snapLower.empty ? snapLower : !snapOrig.empty ? snapOrig : null;
    if (altSnap && !altSnap.empty) {
      const altDoc = altSnap.docs[0];
      const certData = await enrichDriveLink(altDoc.data() as any);
      if (!validateCategoryMatch(certData)) {
        return NextResponse.json({ error: "Certificate found but does not match the selected category/subcategory." }, { status: 404 });
      }
      return NextResponse.json({ certificate: { id: altDoc.id, ...certData } });
    }

    // Search 3: fallback — search participants in all databases (try multiple case variants)
    const origCertId = searchParams.get("certId") || "";
    const certIdVariants = [...new Set([certId, origCertId, origCertId.toUpperCase(), origCertId.toLowerCase()])];

    const databasesRef = collection(db, "databases");
    const dbSnap = await getDocs(databasesRef);

    for (const dbDoc of dbSnap.docs) {
      const participantsRef = collection(db, "databases", dbDoc.id, "participants");
      // Try all case variants
      let pSnap: any = null;
      for (const variant of certIdVariants) {
        const pQuery = query(participantsRef, where("certificateId", "==", variant));
        const snap = await getDocs(pQuery);
        if (!snap.empty) { pSnap = snap; break; }
      }
      if (!pSnap) continue;

      {
        const pDoc = pSnap.docs[0];
        const pData = pDoc.data();
        const dbData = dbDoc.data();

        // Map participant data to certificate format for VerificationResult
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
          verificationUrl: pData.certificateUrl || `${process.env.NEXT_PUBLIC_BASE_URL || ""}/verify?certId=${certId}`,
          blockchainHash: `0x${pDoc.id.replace(/-/g, "")}`,
          databaseId: dbDoc.id,
          participantId: pDoc.id,
          createdAt: pData.createdAt || "",
        };

        if (!validateCategoryMatch(certificate)) {
          return NextResponse.json({ error: "Certificate found but does not match the selected category/subcategory." }, { status: 404 });
        }
        return NextResponse.json({ certificate });
      }
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
