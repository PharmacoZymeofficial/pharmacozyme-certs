import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, writeBatch } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { certificates, category, subCategory } = body;

    if (!certificates || !Array.isArray(certificates) || certificates.length === 0) {
      return NextResponse.json(
        { error: "No certificates provided" },
        { status: 400 }
      );
    }

    const batch = writeBatch(db);
    const certificatesRef = collection(db, "certificates");
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < certificates.length; i++) {
      const cert = certificates[i];
      
      if (!cert.recipientName || !cert.recipientEmail) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }

      try {
        const certId = `PZ-${new Date().getFullYear()}-${String(uuidv4()).slice(0, 4).toUpperCase()}`;
        const blockchainHash = `0x${uuidv4().replace(/-/g, "")}`;

        const newCert = {
          uniqueCertId: cert.uniqueCertId || certId,
          recipientName: cert.recipientName,
          recipientEmail: cert.recipientEmail,
          category: cert.category || category || "General",
          subCategory: cert.subCategory || subCategory || "Courses",
          certType: cert.certType || cert.certificateType || "Certificate",
          issueDate: cert.issueDate || cert.date || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          expiryDate: cert.expiryDate || cert.expiry || "",
          status: cert.status || "active",
          blockchainHash: cert.blockchainHash || blockchainHash,
          createdAt: new Date().toISOString(),
        };

        const docRef = await addDoc(certificatesRef, newCert);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error importing certificates:", error);
    return NextResponse.json(
      { error: "Failed to import certificates" },
      { status: 500 }
    );
  }
}
