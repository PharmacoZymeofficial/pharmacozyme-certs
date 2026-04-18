import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, certificateId, databaseId } = body;

    if (!name || !certificateId) {
      return NextResponse.json({ error: "Name and certificate ID required" }, { status: 400 });
    }

    // Fetch database details
    let database = { category: "Courses", subCategory: "Workshops", topic: "Certificate" };
    if (databaseId) {
      const dbRef = doc(db, "databases", databaseId);
      const dbSnap = await getDoc(dbRef);
      if (dbSnap.exists()) {
        database = dbSnap.data() as any;
      }
    }

    // Generate QR Code
    const verificationUrl = `${process.env.NEXT_PUBLIC_VERIFY_URL || "certs.pharmacozyme.com/verify"}?id=${certificateId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);
    const qrCodeBytes = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([792, 612]); // Letter size
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();

    // Draw border
    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: rgb(0.106, 0.263, 0.196), // #1b4332
      borderWidth: 3,
    });

    // Header
    page.drawRectangle({
      x: 20,
      y: height - 100,
      width: width - 40,
      height: 80,
      color: rgb(0.106, 0.263, 0.196),
    });

    page.drawText("PHARMACOZYME", {
      x: width / 2 - 120,
      y: height - 70,
      size: 28,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    page.drawText("Certificate of Completion", {
      x: width / 2 - 90,
      y: height - 95,
      size: 14,
      font: helvetica,
      color: rgb(0.361, 0.992, 0.502),
    });

    // Recipient name
    page.drawText("This is to certify that", {
      x: width / 2 - 60,
      y: height - 180,
      size: 14,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });

    page.drawText(name, {
      x: width / 2 - 100,
      y: height - 230,
      size: 32,
      font: helveticaBold,
      color: rgb(0.106, 0.263, 0.196),
    });

    // Topic/Course
    page.drawText(`has successfully completed ${database.topic || "the course"}`, {
      x: width / 2 - 110,
      y: height - 280,
      size: 14,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Certificate ID
    page.drawText(`Certificate ID: ${certificateId}`, {
      x: 50,
      y: 50,
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Date
    const issueDate = new Date().toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });
    page.drawText(`Issued: ${issueDate}`, {
      x: width - 180,
      y: 50,
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Embed QR Code
    const qrImage = await pdfDoc.embedPng(qrCodeBytes);
    page.drawImage(qrImage, {
      x: width - 100,
      y: 80,
      width: 60,
      height: 60,
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${name.replace(/\s+/g, "_")}_${certificateId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating certificate:", error);
    return NextResponse.json(
      { error: "Failed to generate certificate", details: error?.message },
      { status: 500 }
    );
  }
}
