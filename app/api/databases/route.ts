import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, where, getCountFromServer } from "firebase/firestore";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "Database ID is required" }, { status: 400 });
    }

    const databaseRef = doc(db, "databases", id);
    await updateDoc(databaseRef, updateData);

    return NextResponse.json({ success: true, id, updated: updateData });
  } catch (error: any) {
    console.error("Error updating database:", error);
    return NextResponse.json(
      { error: "Failed to update database", details: error?.message },
      { status: 500 }
    );
  }
}

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

async function callAppsScript(action: string, payload: any) {
  if (!APPS_SCRIPT_URL) return null;
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action, ...payload }),
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
  });
  const text = await response.text();
  try { return JSON.parse(text); } catch { return null; }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Database ID is required" }, { status: 400 });
    }

    // Get database metadata (sheetId etc.) before deleting
    const databaseRef = doc(db, "databases", id);
    const dbSnap = await getDocs(collection(db, "databases"));
    const dbDoc = dbSnap.docs.find(d => d.id === id);
    const dbData = dbDoc?.data();

    // Delete all participants and their Drive files
    const participantsRef = collection(db, "databases", id, "participants");
    const participantsSnap = await getDocs(participantsRef);

    for (const pDoc of participantsSnap.docs) {
      const pData = pDoc.data();
      // Delete Drive PDF if file ID exists
      if (pData.driveFileId && APPS_SCRIPT_URL) {
        try {
          await callAppsScript("deletePDF", { fileId: pData.driveFileId });
        } catch { /* non-fatal */ }
      }
      await deleteDoc(pDoc.ref);
    }
    console.log(`Deleted ${participantsSnap.size} participants`);

    // Clear Google Sheet data if linked
    if (dbData?.sheetId && APPS_SCRIPT_URL) {
      try {
        await callAppsScript("syncData", {
          spreadsheetId: dbData.sheetId,
          tabName: dbData.sheetTabName || "Participants",
          data: [],
          mode: "write",
          writeHeaders: true,
          headers: ["certificateId", "name", "email", "certificateUrl", "status", "issueDate", "emailSent", "driveLink", "createdAt"],
        });
        console.log("Cleared sheet data");
      } catch (sheetErr) {
        console.error("Failed to clear sheet:", sheetErr);
      }
    }

    // Delete templates subcollection
    const templatesRef = collection(db, "databases", id, "templates");
    const templatesSnap = await getDocs(templatesRef);
    for (const tDoc of templatesSnap.docs) {
      await deleteDoc(tDoc.ref);
    }

    // Delete database document
    await deleteDoc(databaseRef);

    return NextResponse.json({
      success: true,
      message: "Database, participants, Drive files and Sheet data deleted",
      participantsDeleted: participantsSnap.size,
    });
  } catch (error: any) {
    console.error("Error deleting database:", error);
    return NextResponse.json(
      { error: "Failed to delete database", details: error?.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log("GET /api/databases called");
    console.log("Firebase db:", db);
    
    const databasesRef = collection(db, "databases");
    // Use simple query without orderBy to avoid index issues
    const querySnapshot = await getDocs(databasesRef);
    console.log("Fetched", querySnapshot.size, "databases");

    // Sort manually by createdAt descending
    const allDocs = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt || null,
      } as { id: string; [key: string]: any };
    }).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    // Fetch participant counts for each database (non-blocking)
    const databases = await Promise.all(
      allDocs.map(async (dbDoc) => {
        try {
          // Use nested subcollection path
          const participantsRef = collection(db, "databases", dbDoc.id, "participants");
          const countSnap = await getCountFromServer(participantsRef);
          return {
            ...dbDoc,
            participantCount: countSnap.data().count || 0,
          };
        } catch {
          return {
            ...dbDoc,
            participantCount: 0,
          };
        }
      })
    );

    return NextResponse.json({ databases });
  } catch (error: any) {
    console.error("Error fetching databases:", error);
    console.error("Error code:", error?.code);
    return NextResponse.json(
      { error: "Failed to fetch databases", details: error?.message, code: error?.code },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log("Request body:", JSON.stringify(body, null, 2));
    console.log("Firebase db:", db);
    
    const databasesRef = collection(db, "databases");
    console.log("Collection reference created");

    const newDatabase: any = {
      name: body.name || "",
      category: body.category || "General",
      subCategory: body.subCategory || "Courses",
      topic: body.topic || "",
      description: body.description || "",
      participantCount: 0,
      certificateCount: 0,
      createdAt: new Date().toISOString(),
    };

    // Handle Google Sheet linking
    if (body.sheetId) {
      newDatabase.sheetId = body.sheetId;
      newDatabase.sheetTabName = body.sheetTabName || "Participants";
      newDatabase.linkedSheet = true;
    }

    console.log("Creating database with data:", newDatabase);

    const docRef = await addDoc(databasesRef, newDatabase);

    console.log("Database created successfully with ID:", docRef.id);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      database: { id: docRef.id, ...newDatabase },
    });
  } catch (error: any) {
    console.error("Error creating database:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    
    return NextResponse.json(
      { 
        error: "Failed to create database", 
        details: error?.message,
        code: error?.code 
      },
      { status: 500 }
    );
  }
}
