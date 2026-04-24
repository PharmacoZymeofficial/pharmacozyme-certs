import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc, getDocs, getDoc, writeBatch } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

async function callAppsScript(action: string, payload: any) {
  const body = {
    action,
    ...payload,
  };

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(body),
    redirect: "follow",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apps Script error: ${errorText}`);
  }

  const text = await response.text();
  
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      databaseId, 
      category, 
      subCategory, 
      topic, 
      certificateType, 
      participants,
      generatePdf = false,
      pdfData = null
    } = body;

    if (!participants || participants.length === 0) {
      return NextResponse.json({ error: "No participants provided" }, { status: 400 });
    }

    if (!databaseId) {
      return NextResponse.json({ error: "Database ID is required" }, { status: 400 });
    }

    // Get database info to check for linked Sheet
    const dbRef = doc(db, "databases", databaseId);
    const dbSnap = await getDoc(dbRef);
    const dbData = dbSnap.exists() ? dbSnap.data() : null;
    
    const hasSheet = dbData?.linkedSheet && dbData?.sheetId;
    const spreadsheetId = dbData?.sheetId;
    const tabName = dbData?.sheetTabName || "Participants";

    // Use nested subcollection
    const certificatesRef = collection(db, "certificates");
    const participantsRef = collection(db, "databases", databaseId, "participants");

    const results = {
      success: 0,
      failed: 0,
      certificates: [] as any[],
    };

    for (const participant of participants) {
      try {
        // Generate unique certificate ID
        const certId = `PZ-${new Date().getFullYear()}-${uuidv4().split('-')[0].toUpperCase()}`;
        const blockchainHash = `0x${uuidv4().replace(/-/g, "")}`;
        const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://verify.pharmacozyme.com"}/verify/${certId}`;

        let driveLink = "";
        let driveFileId = "";

        // Upload PDF to Drive if requested and sheet is linked
        if (generatePdf && pdfData && hasSheet && APPS_SCRIPT_URL) {
          try {
            const fileName = `${participant.name.replace(/[^a-zA-Z0-9]/g, "_")}_${certId}.pdf`;
            const uploadResult = await callAppsScript("uploadPDF", {
              spreadsheetId,
              pdfData,
              fileName,
              databaseName: dbData?.name || topic,
            });
            
            if (uploadResult.success) {
              driveLink = uploadResult.webContentLink || "";
              driveFileId = uploadResult.fileId || "";
              if (uploadResult.folderId) {
                updateDoc(dbRef, {
                  driveFolderId: uploadResult.folderId,
                  driveFolderUrl: uploadResult.folderUrl || `https://drive.google.com/drive/folders/${uploadResult.folderId}`,
                }).catch(() => {});
              }
            }
          } catch (driveErr) {
            console.error("Failed to upload PDF to Drive:", driveErr);
          }
        }

        const certificate = {
          databaseId,
          participantId: participant.id,
          uniqueCertId: certId,
          recipientName: participant.name,
          recipientEmail: participant.email,
          category,
          subCategory,
          topic,
          certType: certificateType || topic,
          issueDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          status: "generated",
          qrCode: verificationUrl,
          pdfUrl: driveLink || "",
          driveFileId: driveFileId,
          blockchainHash,
          verificationUrl,
          createdAt: new Date().toISOString(),
        };

        const docRef = await addDoc(certificatesRef, certificate);

        // Update participant with certificate ID and Drive link
        const participantRef = doc(participantsRef, participant.id);
        await updateDoc(participantRef, {
          certificateId: certId,
          certificateUrl: verificationUrl,
          status: "generated",
          driveLink: driveLink || "",
          driveFileId: driveFileId || "",
          issueDate: certificate.issueDate,
        });

        results.certificates.push({
          id: docRef.id,
          ...certificate,
        });
        results.success++;
      } catch (err) {
        console.error("Failed to generate certificate for:", participant.name, err);
        results.failed++;
      }
    }

    // Sync to Sheets after certificate generation
    if (hasSheet && results.success > 0) {
      try {
        const participantsRef = collection(db, "databases", databaseId, "participants");
        const participantsSnap = await getDocs(participantsRef);
        const allParticipants = participantsSnap.docs.map(doc => doc.data() as any);
        
        // Sort by numeric serial at end of certificate ID (e.g. "Hamza-MDC-001" → 1)
        const getSerial = (id: string) => { const m = id?.match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
        const sortedParticipants = [...allParticipants].sort((a, b) => {
          if (!a.certificateId && !b.certificateId) return 0;
          if (!a.certificateId) return 1;
          if (!b.certificateId) return -1;
          return getSerial(a.certificateId) - getSerial(b.certificateId);
        });
        
        await callAppsScript("syncData", {
          spreadsheetId,
          tabName: tabName,
          data: sortedParticipants.map(p => ({
            certificateId: p.certificateId || "",
            name: p.name || "",
            email: p.email || "",
            certificateUrl: p.certificateUrl || "",
            status: p.status || "pending",
            issueDate: p.issueDate || "",
            emailSent: p.emailSent || false,
            driveLink: p.driveLink || "",  // Include Drive link from certificate generation
            createdAt: p.createdAt || "",
          })),
          mode: "write",
        });
        console.log(`Synced ${allParticipants.length} participants to Sheets after certificate generation`);
      } catch (syncErr) {
        console.error("Failed to sync to Sheets:", syncErr);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error("Error generating certificates:", error);
    return NextResponse.json(
      { error: "Failed to generate certificates", details: error?.message },
      { status: 500 }
    );
  }
}
