import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";

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
