import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const certId = (searchParams.get("certId") || "").toUpperCase().trim() || null;

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

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return NextResponse.json({ certificate: { id: doc.id, ...doc.data() } });
    }

    // Search 2: also try case-insensitive variations
    const qLower = query(certificatesRef, where("uniqueCertId", "==", certId.toLowerCase()));
    const qOrig = query(certificatesRef, where("uniqueCertId", "==", searchParams.get("certId") || ""));
    const [snapLower, snapOrig] = await Promise.all([getDocs(qLower), getDocs(qOrig)]);

    const altSnap = !snapLower.empty ? snapLower : !snapOrig.empty ? snapOrig : null;
    if (altSnap && !altSnap.empty) {
      const doc = altSnap.docs[0];
      return NextResponse.json({ certificate: { id: doc.id, ...doc.data() } });
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
