import { NextRequest, NextResponse } from "next/server";
import { db, firebaseStorage } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, orderBy, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

export async function GET() {
  try {
    const templatesRef = collection(db, "certificateTemplates");
    const q = query(templatesRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const templates = querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;

    if (!file || !name) {
      return NextResponse.json(
        { error: "File and name are required" },
        { status: 400 }
      );
    }

    if (!file.type.includes("pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    const fileExtension = file.name.split(".").pop() || "pdf";
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const storagePath = `templates/${uniqueFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const storageRef = ref(firebaseStorage, storagePath);
    await uploadBytes(storageRef, buffer, { contentType: "application/pdf" });
    const fileUrl = await getDownloadURL(storageRef);

    const templatesRef = collection(db, "certificateTemplates");
    const newTemplate = {
      name,
      description: description || "",
      category: category || "General",
      fileName: uniqueFileName,
      storagePath,
      fileUrl,
      originalName: file.name,
      fileType: file.type || "application/pdf",
      fileSize: file.size,
      isActive: true,
      usageCount: 0,
      positions: {
        name: { x: 50, y: 45, size: 48, color: "#1b4332" },
        certId: { x: 50, y: 30, size: 12, color: "#333333" },
        qr: { x: 85, y: 60, size: 12 },
      },
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(templatesRef, newTemplate);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      template: { id: docRef.id, ...newTemplate },
    });
  } catch (error: any) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template", details: error?.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, positions } = body;

    if (!id || !positions) {
      return NextResponse.json(
        { error: "ID and positions are required" },
        { status: 400 }
      );
    }

    const templateRef = doc(db, "certificateTemplates", id);
    await updateDoc(templateRef, { positions });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating template positions:", error);
    return NextResponse.json(
      { error: "Failed to update positions", details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    const templateRef = doc(db, "certificateTemplates", id);
    const templateSnap = await getDoc(templateRef);

    if (templateSnap.exists()) {
      const data = templateSnap.data();
      if (data.storagePath) {
        try {
          const storageRef = ref(firebaseStorage, data.storagePath);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.error("Failed to delete from Storage:", storageErr);
        }
      }
    }

    await deleteDoc(templateRef);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template", details: error?.message },
      { status: 500 }
    );
  }
}
