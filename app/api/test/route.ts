import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, getDoc } from "firebase/firestore";

export async function GET() {
  try {
    // Try to write a test document
    const testRef = collection(db, "_connection_test");
    const docRef = await addDoc(testRef, {
      test: true,
      timestamp: new Date().toISOString(),
      message: "Firebase connection test"
    });
    
    // Delete the test document
    // await deleteDoc(doc(db, "_connection_test", docRef.id));
    
    return NextResponse.json({ 
      success: true, 
      message: "Firebase connection and write successful!",
      testDocId: docRef.id,
      Firestore: "Connected",
      projectId: "pharmacozyme-certificates"
    });
  } catch (error: any) {
    console.error("Firebase connection error:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || "Unknown error",
        code: error?.code,
        fullError: JSON.stringify(error, null, 2)
      },
      { status: 500 }
    );
  }
}
