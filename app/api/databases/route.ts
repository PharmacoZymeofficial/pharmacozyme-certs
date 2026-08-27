import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";
import { deleteDriveFolder } from "@/lib/driveCleanup";

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id, ...updateData } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Database ID is required" }, { status: 400 });
    }

    await getAdminDb().collection("databases").doc(id).update(updateData);

    return NextResponse.json({ success: true, id, updated: updateData });
  } catch (error: any) {
    console.error("Error updating database:", error);
    return NextResponse.json({ error: "Failed to update database", details: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Database ID is required" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const databaseRef = adminDb.collection("databases").doc(id);
    const dbSnap = await databaseRef.get();
    const dbData = dbSnap.exists ? dbSnap.data() : undefined;

    // Delete all participants and their Drive files.
    const participantsSnap = await databaseRef.collection("participants").get();
    for (const pDoc of participantsSnap.docs) {
      const pData = pDoc.data();
      if (pData.driveFileId && appsScriptConfigured()) {
        try {
          await callAppsScript("deletePDF", { fileId: pData.driveFileId });
        } catch { /* non-fatal */ }
      }
      await pDoc.ref.delete();
    }

    // Clear only col A (cert IDs the app wrote) — never deletes original rows.
    if (dbData?.sheetId && appsScriptConfigured()) {
      try {
        const emails = participantsSnap.docs.map((d) => d.data().email).filter(Boolean);
        if (emails.length > 0) {
          await callAppsScript("clearCertIdsByEmail", {
            spreadsheetId: dbData.sheetId,
            tabName: dbData.sheetTabName || "Participants",
            emails,
          });
        }
      } catch (sheetErr) {
        console.error("Failed to clear cert IDs from sheet:", sheetErr);
      }
    }

    const templatesSnap = await databaseRef.collection("templates").get();
    for (const tDoc of templatesSnap.docs) {
      await tDoc.ref.delete();
    }

    // Trash the database's Drive folder (best-effort — a leftover folder beats a failed delete).
    if (dbData?.driveFolderId) {
      await deleteDriveFolder(dbData.driveFolderId);
    }

    await databaseRef.delete();

    return NextResponse.json({
      success: true,
      message: "Database, participants, Drive files, Drive folder and Sheet data deleted",
      participantsDeleted: participantsSnap.size,
    });
  } catch (error: any) {
    console.error("Error deleting database:", error);
    return NextResponse.json({ error: "Failed to delete database", details: error?.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const adminDb = getAdminDb();
    const querySnapshot = await adminDb.collection("databases").get();

    const allDocs = querySnapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return { id: docSnap.id, ...data, createdAt: data.createdAt || null } as {
          id: string;
          [key: string]: any;
        };
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

    const databases = await Promise.all(
      allDocs.map(async (dbDoc) => {
        try {
          const countSnap = await adminDb
            .collection("databases")
            .doc(dbDoc.id)
            .collection("participants")
            .count()
            .get();
          return { ...dbDoc, participantCount: countSnap.data().count || 0 };
        } catch {
          return { ...dbDoc, participantCount: 0 };
        }
      })
    );

    return NextResponse.json({ databases });
  } catch (error: any) {
    console.error("Error fetching databases:", error);
    return NextResponse.json(
      { error: "Failed to fetch databases", details: error?.message, code: error?.code },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();

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

    if (body.sheetId) {
      newDatabase.sheetId = body.sheetId;
      newDatabase.sheetTabName = body.sheetTabName || "Participants";
      newDatabase.linkedSheet = true;
    }

    const docRef = await getAdminDb().collection("databases").add(newDatabase);

    return NextResponse.json({ success: true, id: docRef.id, database: { id: docRef.id, ...newDatabase } });
  } catch (error: any) {
    console.error("Error creating database:", error);
    return NextResponse.json(
      { error: "Failed to create database", details: error?.message, code: error?.code },
      { status: 500 }
    );
  }
}
