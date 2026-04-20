import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, query, where, updateDoc, doc } from "firebase/firestore";

export async function GET() {
  try {
    const certificatesRef = collection(db, "certificates");
    
    // Get all certificates without ordering to avoid index issues
    const querySnapshot = await getDocs(certificatesRef);

    const certificates = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ certificates });
  } catch (error: any) {
    console.error("Error fetching certificates:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch certificates", 
        details: error?.message || "Unknown error",
        code: error?.code 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const certificatesRef = collection(db, "certificates");

    const newCert = {
      ...body,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(certificatesRef, newCert);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      certificate: { id: docRef.id, ...newCert },
    });
  } catch (error: any) {
    console.error("Error creating certificate:", error);
    return NextResponse.json(
      {
        error: "Failed to create certificate",
        details: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Update a certificate's driveLink / pdfUrl / driveFileId by uniqueCertId.
// Used after Drive upload completes so the /verify and /claim pages see the PDF.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { uniqueCertId, driveLink, driveFileId, pdfUrl } = body || {};

    if (!uniqueCertId) {
      return NextResponse.json({ error: "uniqueCertId is required" }, { status: 400 });
    }

    const certificatesRef = collection(db, "certificates");
    const q = query(certificatesRef, where("uniqueCertId", "==", uniqueCertId));
    const snap = await getDocs(q);

    if (snap.empty) {
      return NextResponse.json({ success: false, updated: 0, message: "No matching certificate" });
    }

    const updates: Record<string, any> = {};
    if (driveLink !== undefined) updates.driveLink = driveLink || "";
    if (driveFileId !== undefined) updates.driveFileId = driveFileId || "";
    if (pdfUrl !== undefined) updates.pdfUrl = pdfUrl || driveLink || "";
    else if (driveLink !== undefined) updates.pdfUrl = driveLink || "";

    await Promise.all(
      snap.docs.map((d) => updateDoc(doc(db, "certificates", d.id), updates))
    );

    return NextResponse.json({ success: true, updated: snap.size });
  } catch (error: any) {
    console.error("Error updating certificate:", error);
    return NextResponse.json(
      { error: "Failed to update certificate", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
