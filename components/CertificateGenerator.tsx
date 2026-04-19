"use client";

import { useState, useEffect } from "react";
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image, Font } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";



// Register system fonts
Font.register({
  family: "Helvetica-Bold",
  src: "Helvetica-Bold",
});

Font.register({
  family: "Helvetica",
  src: "Helvetica",
});

// Certificate ID format helper with serial numbers
function generateCertificateId(name: string, subCategory: string, serialNumber: number): string {
  const year = new Date().getFullYear();
  const subCatShort = subCategoryShort[subCategory] || subCategory.slice(0, 3).toUpperCase();
  const serial = String(serialNumber).padStart(4, "0");
  return `${year}-PZ-${subCatShort}-${serial}`;
}

// Subcategory short forms
const subCategoryShort: Record<string, string> = {
  "Courses": "CRS",
  "Workshops": "WKS",
  "Webinars": "WBN",
  "MED-Q": "MDQ",
  "Central Team": "CTM",
  "Sub Team": "STM",
  "Ambassadors": "AMB",
  "Affiliates": "AFF",
  "Mentors": "MTR",
};

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 0,
    fontFamily: "Helvetica",
  },
  container: {
    flex: 1,
    margin: 20,
    border: "3px solid #1b4332",
    borderRadius: 10,
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#1b4332",
    padding: 30,
    alignItems: "center",
  },
  headerText: {
    color: "#ffffff",
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    fontWeight: "bold",
    textAlign: "center",
  },
  headerSub: {
    color: "#5cfd80",
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
    fontFamily: "Helvetica",
  },
  body: {
    flex: 1,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  presentedTo: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 10,
    fontFamily: "Helvetica",
  },
  recipientName: {
    fontSize: 36,
    color: "#1b4332",
    fontFamily: "Helvetica-Bold",
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#444444",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Helvetica",
  },
  certificateType: {
    fontSize: 24,
    color: "#2d6a4f",
    fontFamily: "Helvetica-Bold",
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
  },
  topic: {
    fontSize: 18,
    color: "#1b4332",
    fontFamily: "Helvetica-Bold",
    marginBottom: 30,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: 30,
    borderTop: "1px solid #e0e0e0",
    backgroundColor: "#f7f9f7",
  },
  qrSection: {
    alignItems: "center",
  },
  qrImage: {
    width: 80,
    height: 80,
    marginBottom: 5,
  },
  qrText: {
    fontSize: 8,
    color: "#666666",
    fontFamily: "Helvetica",
  },
  detailsSection: {
    flex: 1,
    marginLeft: 20,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 10,
    color: "#666666",
    width: 100,
    fontFamily: "Helvetica",
  },
  detailValue: {
    fontSize: 12,
    color: "#1b4332",
    fontWeight: "bold",
    fontFamily: "Helvetica",
  },
  verifiedBadge: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  verifiedText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: "Helvetica",
  },
  watermark: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-30deg)",
    opacity: 0.03,
    fontSize: 100,
    color: "#1b4332",
    fontFamily: "Helvetica-Bold",
  },
  modernBorder: {
    border: "4px solid #5cfd80",
  },
  modernHeader: {
    backgroundColor: "#2d6a4f",
    padding: 40,
    alignItems: "center",
  },
});

interface CertificateData {
  recipientName: string;
  uniqueCertId: string;
  serialNumber?: number;
  certType: string;
  topic: string;
  category: string;
  subCategory: string;
  issueDate: string;
  verificationUrl: string;
  qrCodeDataUrl?: string;
  template?: string;
  templateName?: string;
  pdfBytes?: Uint8Array;
}

const CertificatePDF = ({ certificate }: { certificate: CertificateData }) => {
  const isModern = certificate.template === "modern";
  const containerStyle = isModern ? [styles.container, styles.modernBorder] : styles.container;
  
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={containerStyle}>
          <View style={isModern ? styles.modernHeader : styles.header}>
            <Text style={styles.headerText}>PHARMACOZYME</Text>
            <Text style={styles.headerSub}>CERTIFICATE OF ACHIEVEMENT</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.presentedTo}>This certificate is proudly presented to</Text>
            <Text style={styles.recipientName}>{certificate.recipientName}</Text>
            <Text style={styles.description}>For successful completion of the</Text>
            <Text style={styles.certificateType}>{certificate.certType}</Text>
            <Text style={styles.topic}>{certificate.topic}</Text>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ VERIFIED CERTIFICATE</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.qrSection}>
              {certificate.qrCodeDataUrl ? (
                <Image style={styles.qrImage} src={certificate.qrCodeDataUrl} />
              ) : (
                <View style={{ width: 80, height: 80, border: "2px solid #1b4332" }} />
              )}
              <Text style={styles.qrText}>Scan to Verify</Text>
            </View>

            <View style={styles.detailsSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Certificate ID:</Text>
                <Text style={styles.detailValue}>{certificate.uniqueCertId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Issue Date:</Text>
                <Text style={styles.detailValue}>{certificate.issueDate}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Category:</Text>
                <Text style={styles.detailValue}>{certificate.category} - {certificate.subCategory}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailValue}>{certificate.verificationUrl || "certs.pharmacozyme.com/verify"}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.watermark}>PHARMACOZYME</Text>
        </View>
      </Page>
    </Document>
  );
};

async function generateQRCode(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
      color: {
        dark: "#1b4332",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("QR generation error:", err);
    return "";
  }
}

// Helper to convert hex to RGB (0-1 range for pdf-lib)
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }
  return { r: 0.1, g: 0.26, b: 0.2 }; // default
}

// Default positions for template overlay (can be adjusted per template)
function getTemplatePositions(width: number, height: number, positions?: { name: { x: number; y: number; size?: number; color?: string }; certId: { x: number; y: number; size?: number; color?: string }; qr: { x: number; y: number; size: number } }) {
  if (positions) {
    // QR size is stored as percentage (1-25), convert to actual dimension
    const qrSizeValue = positions.qr.size || 12;
    const qrDimension = (Math.min(width, height) * qrSizeValue) / 100;
    
    return {
      namePos: { x: (width * positions.name.x) / 100, y: height - (height * positions.name.y) / 100, size: positions.name.size || 48, color: hexToRgb(positions.name.color || "#1b4332") },
      certIdPos: { x: (width * positions.certId.x) / 100, y: height - (height * positions.certId.y) / 100, size: positions.certId.size || 12, color: hexToRgb(positions.certId.color || "#333333") },
      qrPos: { 
        x: (width * positions.qr.x) / 100, 
        y: height - (height * positions.qr.y) / 100, 
        width: qrDimension,
        height: qrDimension
      }
    };
  }
  
  const nameY = height * 0.55;
  const certIdY = height * 0.38;
  const qrY = height * 0.42;
  const qrSize = Math.min(width, height) * 0.12;
  
  return {
    namePos: { x: width / 2, y: nameY, size: 48, color: { r: 0.1, g: 0.26, b: 0.2 } },
    certIdPos: { x: width / 2, y: certIdY, size: 12, color: { r: 0.2, g: 0.2, b: 0.2 } },
    qrPos: { x: width - qrSize - 60, y: qrY, width: qrSize, height: qrSize }
  };
}

// Generate certificate with template overlay using pdf-lib
async function generateCertificateWithTemplate(
  certificateData: CertificateData,
  templateUrl: string,
  templatePositions?: { name: { x: number; y: number }; certId: { x: number; y: number }; qr: { x: number; y: number; size: number } }
): Promise<Uint8Array> {
  try {
    // Fetch the template PDF
    const templateResponse = await fetch(templateUrl);
    const templateBytes = await templateResponse.arrayBuffer();
    
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();
    
    // Get fonts
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Get template positions (custom or defaults)
    const positions = getTemplatePositions(width, height, templatePositions);
    
    // ===== 1. Replace/Overlay Name =====
    const nameText = certificateData.recipientName;
    const nameFontSize = positions.namePos.size || 48;
    const nameX = positions.namePos.x;
    const nameY = positions.namePos.y;
    const nameColor = positions.namePos.color || { r: 0.1, g: 0.26, b: 0.2 };
    
    page.drawText(nameText, {
      x: nameX - (boldFont.widthOfTextAtSize(nameText, nameFontSize) / 2),
      y: nameY,
      size: nameFontSize,
      font: boldFont,
      color: rgb(nameColor.r, nameColor.g, nameColor.b),
    });
    
    // ===== 2. Replace/Overlay Certificate ID =====
    const idText = certificateData.uniqueCertId;
    const idFontSize = positions.certIdPos.size || 12;
    const idX = positions.certIdPos.x;
    const idY = positions.certIdPos.y;
    const idColor = positions.certIdPos.color || { r: 0.2, g: 0.2, b: 0.2 };
    
    page.drawText(idText, {
      x: idX - (regularFont.widthOfTextAtSize(idText, idFontSize) / 2),
      y: idY,
      size: idFontSize,
      font: regularFont,
      color: rgb(idColor.r, idColor.g, idColor.b),
    });
    
    // ===== 3. Replace QR Code =====
    if (certificateData.qrCodeDataUrl) {
      try {
        const qrImageBytes = await fetch(certificateData.qrCodeDataUrl).then(r => r.arrayBuffer());
        const qrImage = await pdfDoc.embedPng(qrImageBytes);
        
        const qrSize = positions.qrPos.width;
        const qrX = positions.qrPos.x - (qrSize / 2); // Center the QR code
        const qrY = positions.qrPos.y - (qrSize / 2); // Center the QR code
        
        page.drawImage(qrImage, {
          x: qrX,
          y: qrY,
          width: qrSize,
          height: qrSize,
        });
      } catch (qrErr) {
        console.error("Failed to embed QR code:", qrErr);
      }
    }
    
    // Save and return
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (err) {
    console.error("Error generating certificate with template:", err);
    throw err;
  }
}

interface CertificateTemplate {
  id: string;
  name: string;
  fileUrl: string;
  positions?: {
    name: { x: number; y: number };
    certId: { x: number; y: number };
    qr: { x: number; y: number; size: number };
  };
}

interface CertificateGeneratorProps {
  database: any;
  participants: any[];
  onGenerated: () => void;
}

export default function CertificateGenerator({ database, participants, onGenerated }: CertificateGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [showDownload, setShowDownload] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("standard");
  const [showTemplateSelect, setShowTemplateSelect] = useState(true);
  const [uploadedTemplates, setUploadedTemplates] = useState<CertificateTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentGenerating, setCurrentGenerating] = useState("");
  const [showExistingWarning, setShowExistingWarning] = useState(false);
  const [existingCertCount, setExistingCertCount] = useState(0);
  const [filterNewOnly, setFilterNewOnly] = useState(false);

  const participantsWithExistingPDFs = participants.filter(p => p.certificateId);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch("/api/templates");
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Templates API error:", response.status, errorData);
          setLoadingTemplates(false);
          return;
        }
        const data = await response.json();
        if (data.templates) {
          setUploadedTemplates(data.templates);
        }
      } catch (err) {
        console.error("Error fetching templates:", err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  const generateCertificates = async () => {
    // Check for existing certificates
    const existingCount = participants.filter(p => p.certificateId).length;
    if (existingCount > 0) {
      setExistingCertCount(existingCount);
      setShowExistingWarning(true);
      return;
    }
    
    await startGeneration();
  };

  const startGeneration = async () => {
    setIsGenerating(true);
    setShowTemplateSelect(false);
    setGenerationProgress(0);
    
    // Sort participants to process in ascending order (first to last)
    const sortedParticipants = [...participants].sort((a, b) => {
      if (a.certificateId && b.certificateId) {
        const aNum = parseInt(a.certificateId.split("-").pop() || "0");
        const bNum = parseInt(b.certificateId.split("-").pop() || "0");
        return aNum - bNum;
      }
      return 0;
    });
    
    // Filter participants if user chose to skip existing
    const participantsToGenerate = filterNewOnly 
      ? sortedParticipants.filter(p => !p.certificateId)
      : sortedParticipants;
    
    try {
      const verificationBase = process.env.NEXT_PUBLIC_VERIFY_URL || "certs.pharmacozyme.com/verify";
      const year = new Date().getFullYear();
      
      // Check if using uploaded template
      const isUploadedTemplate = !["standard", "modern"].includes(selectedTemplate);
      const templateData = uploadedTemplates.find(t => t.id === selectedTemplate);
      
      // Fetch existing certificates count
      let serialNumber = 1;
      try {
        const existingResponse = await fetch(`/api/participants?databaseId=${database.id}`);
        const existingData = await existingResponse.json();
        if (existingData.participants) {
          const existingCerts = existingData.participants.filter((p: any) => p.certificateId && p.certificateId.includes(`-${year}-`));
          serialNumber = existingCerts.length + 1;
        }
      } catch (err) {
        console.log("Could not fetch existing count, starting from 1");
      }
      
      const generatedCerts: CertificateData[] = [];
      let updateSuccess = true;
      
      for (let i = 0; i < participantsToGenerate.length; i++) {
        const participant = participantsToGenerate[i];
        const currentSerial = serialNumber + i;
        setCurrentGenerating(`Generating for ${participant.name}...`);
        setGenerationProgress(Math.round(((i + 1) / participantsToGenerate.length) * 100));
        
        // Use existing certificateId if available, otherwise generate new one
        let certId = participant.certificateId;
        if (!certId) {
          certId = generateCertificateId(participant.name, database.subCategory, currentSerial);
        }
        
        const verificationUrl = `${verificationBase}?id=${certId}`;
        const qrCodeDataUrl = await generateQRCode(verificationUrl);

        let pdfBytes: Uint8Array | undefined;
        
        // If using uploaded template, generate with overlay
        if (isUploadedTemplate && templateData) {
          try {
            pdfBytes = await generateCertificateWithTemplate({
              recipientName: participant.name,
              uniqueCertId: certId,
              certType: database.topic,
              topic: database.topic,
              category: database.category,
              subCategory: database.subCategory,
              issueDate: new Date().toLocaleDateString("en-US", { 
                year: "numeric", 
                month: "long", 
                day: "numeric" 
              }),
              verificationUrl,
              qrCodeDataUrl,
            }, templateData.fileUrl, templateData.positions);
          } catch (templateErr) {
            console.error("Failed to generate with template, using standard:", templateErr);
            // Fall back to standard generation
          }
        }

        // Generate PDF bytes - always needed for upload
        if (!pdfBytes && !isUploadedTemplate) {
          // Use react-pdf to generate standard certificate
          try {
            const { pdf } = await import("@react-pdf/renderer");
            const doc = <CertificatePDF certificate={{
              recipientName: participant.name,
              uniqueCertId: certId,
              serialNumber: currentSerial,
              certType: database.topic,
              topic: database.topic,
              category: database.category,
              subCategory: database.subCategory,
              issueDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
              verificationUrl,
              qrCodeDataUrl,
              template: selectedTemplate,
              templateName: templateData?.name || "Standard",
            }} />;
            const pdfBlob = await pdf(doc).toBlob();
            const arrayBuffer = await pdfBlob.arrayBuffer();
            pdfBytes = new Uint8Array(arrayBuffer);
            console.log("Generated standard PDF bytes:", pdfBytes.length);
          } catch (pdfErr) {
            console.error("Error generating standard PDF:", pdfErr);
          }
        }
        
        const certData: CertificateData = {
          recipientName: participant.name,
          uniqueCertId: certId,
          serialNumber: currentSerial,
          certType: database.topic,
          topic: database.topic,
          category: database.category,
          subCategory: database.subCategory,
          issueDate: new Date().toLocaleDateString("en-US", { 
            year: "numeric", 
            month: "long", 
            day: "numeric" 
          }),
          verificationUrl,
          qrCodeDataUrl,
          template: selectedTemplate,
          templateName: templateData?.name || "Standard",
          pdfBytes,
        };

        generatedCerts.push(certData);

        // Save certificate data to participant
        console.log(`=== Processing participant ${i+1}/${participantsToGenerate.length}: ${participant.id} ===`);
        console.log("database.id:", database.id, "database.name:", database.name);
        
        // Skip Drive upload - use on-demand generation instead
        // Service account needs Shared Drive for regular Drive access
        let certificateUrl = "";
        
        const issueDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const updateResponse = await fetch(`/api/participants/${participant.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            certificateId: certId,
            serialNumber: currentSerial,
            status: "generated",
            verificationUrl: verificationUrl,
            template: selectedTemplate,
            templateName: templateData?.name || "Standard",
            certificateUrl: certificateUrl,
            issueDate,
            databaseId: database.id,
          }),
        });
        
        console.log(`Response status: ${updateResponse.status}`);
        
        let updateData;
        try {
          updateData = await updateResponse.json();
          console.log("Response data:", updateData);
        } catch (e) {
          console.log("Response not JSON");
          updateData = { error: "Invalid JSON response" };
        }
        
        if (!updateResponse.ok) {
          console.error(`FAILED: ${updateData.error || "Unknown error"}`);
          updateSuccess = false;
        } else {
          console.log(`SUCCESS for ${participant.id}`);
          
          // Upload PDF to Drive and update participant with Drive link
          if (pdfBytes && database.linkedSheet) {
            try {
              const base64Data = Buffer.from(pdfBytes).toString("base64");
              const driveFileName = `${participant.name.replace(/[^a-zA-Z0-9]/g, "_")}_${certId}.pdf`;
              
              const driveResponse = await fetch("/api/drive-upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  pdfBytes: base64Data,
                  fileName: driveFileName,
                  databaseName: database.name,
                }),
              });
              
              if (driveResponse.ok) {
                const driveData = await driveResponse.json();
                console.log("Drive upload success:", driveData.webContentLink);
                
                // Update participant with Drive link
                await fetch(`/api/participants/${participant.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    driveLink: driveData.webContentLink || "",
                    driveFileId: driveData.fileId || "",
                    databaseId: database.id,
                  }),
                });
              }
            } catch (driveErr) {
              console.error("Failed to upload to Drive:", driveErr);
            }
          }
        }
      }

      setCertificates(generatedCerts);
      setShowDownload(true);
      onGenerated();
      
      if (updateSuccess) {
        alert(`Successfully generated ${generatedCerts.length} certificates!\nTemplate: ${templateData?.name || "Standard"}`);
      } else {
        alert(`Generated ${generatedCerts.length} certificates, but some updates failed.`);
      }
      
      // Sync updated data to Sheets after all generations complete
      if (database.linkedSheet) {
        try {
          const refreshResponse = await fetch(`/api/participants?databaseId=${database.id}`);
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            await fetch("/api/sheets/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                databaseId: database.id,
                mode: "firebaseToSheets",
              }),
            });
            console.log("Synced to Google Sheets after certificate generation");
          }
        } catch (syncErr) {
          console.error("Failed to sync to Sheets:", syncErr);
        }
      }
    } catch (err) {
      console.error("Error generating certificates:", err);
      alert("Failed to generate certificates: " + (err as Error).message);
    } finally {
      setIsGenerating(false);
      setCurrentGenerating("");
      setGenerationProgress(0);
    }
  };

  // Custom download link component that handles blob URLs
  const DownloadButton = ({ certificate, index }: { certificate: CertificateData; index: number }) => {
    const [blobUrl, setBlobUrl] = useState<string>("");
    const [isPreparing, setIsPreparing] = useState(true);

    useEffect(() => {
      const prepareBlob = async () => {
        try {
          let pdfBlob: Blob;
          
          if (certificate.pdfBytes) {
            pdfBlob = new Blob([new Uint8Array(certificate.pdfBytes)], { type: "application/pdf" });
          } else {
            // Use react-pdf for standard certificates
            const { pdf } = await import("@react-pdf/renderer");
            const doc = <CertificatePDF certificate={certificate} />;
            const blob = await pdf(doc).toBlob();
            pdfBlob = blob;
          }
          
          const url = URL.createObjectURL(pdfBlob);
          setBlobUrl(url);
        } catch (err) {
          console.error("Error preparing PDF:", err);
        } finally {
          setIsPreparing(false);
        }
      };
      
      prepareBlob();
      
      return () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    }, [certificate]);

    if (isPreparing || !blobUrl) {
      return (
        <button className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed">
          Preparing...
        </button>
      );
    }

    return (
      <a
        href={blobUrl}
        download={`${certificate.recipientName.replace(/\s+/g, "_")}_${certificate.uniqueCertId}.pdf`}
        className="px-4 py-2 bg-brand-vivid-green text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-sm">download</span>
        Download PDF
      </a>
    );
  };

  if (showExistingWarning) {
    return (
      <div className="bg-white rounded-xl border border-yellow-200 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-yellow-600 text-2xl">warning</span>
          </div>
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">
              Existing Certificates Found
            </h3>
            <p className="text-sm text-on-surface-variant">
              {existingCertCount} of {participants.length} participants already have certificates
            </p>
          </div>
        </div>

        <div className="bg-yellow-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-800">
            Do you want to regenerate certificates for participants who already have them?
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowExistingWarning(false);
              startGeneration();
            }}
            className="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 transition-colors"
          >
            Regenerate All ({participants.length})
          </button>
          <button
            onClick={() => {
              setShowExistingWarning(false);
              setFilterNewOnly(true);
              startGeneration();
            }}
            className="flex-1 px-4 py-3 bg-brand-vivid-green text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
          >
            Skip Existing ({participants.length - existingCertCount} new)
          </button>
          <button
            onClick={() => {
              setShowExistingWarning(false);
              setShowTemplateSelect(true);
            }}
            className="px-4 py-3 border border-green-200 text-brand-grass-green rounded-xl font-bold hover:bg-green-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (certificates.length > 0 && showDownload) {
    return (
      <div className="bg-white rounded-xl border border-green-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-vivid-green flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-2xl">check_circle</span>
          </div>
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">
              {certificates.length} Certificates Generated!
            </h3>
            <p className="text-sm text-on-surface-variant">
              Download or preview each certificate below
            </p>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-3 mb-6">
          {certificates.map((cert, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-dark-green text-white flex items-center justify-center font-bold">
                  {cert.recipientName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium text-brand-dark-green">{cert.recipientName}</p>
                  <p className="text-xs text-on-surface-variant font-mono">{cert.uniqueCertId}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <DownloadButton certificate={cert} index={index} />
                <button
                  onClick={() => {
                    const pdfUrl = cert.pdfBytes 
                      ? URL.createObjectURL(new Blob([new Uint8Array(cert.pdfBytes)], { type: "application/pdf" }))
                      : null;
                    if (pdfUrl) {
                      window.open(pdfUrl, "_blank");
                    }
                  }}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  Preview
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setCertificates([]);
              setShowDownload(false);
              setShowTemplateSelect(true);
            }}
            className="flex-1 px-4 py-3 border border-green-200 text-brand-grass-green rounded-xl font-medium hover:bg-green-50 transition-colors"
          >
            Generate More
          </button>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="bg-white rounded-xl border border-green-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-2xl animate-spin">progress_activity</span>
          </div>
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">
              Generating Certificates...
            </h3>
            <p className="text-sm text-on-surface-variant">
              {currentGenerating || "Please wait"}
            </p>
          </div>
        </div>
        
        <div className="w-full bg-green-100 rounded-full h-3 mb-2">
          <div 
            className="bg-brand-vivid-green h-3 rounded-full transition-all duration-300"
            style={{ width: `${generationProgress}%` }}
          />
        </div>
        <p className="text-xs text-on-surface-variant text-right">{generationProgress}%</p>
      </div>
    );
  }

  if (showTemplateSelect) {
    return (
      <div className="bg-white rounded-xl border border-green-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-brand-green text-2xl">style</span>
          </div>
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">
              Select Certificate Template
            </h3>
            <p className="text-sm text-on-surface-variant">
              Choose a template for {participants.length} certificate{participants.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {loadingTemplates ? (
          <div className="flex items-center justify-center py-8">
            <span className="material-symbols-outlined animate-spin text-brand-green">progress_activity</span>
            <span className="ml-2 text-on-surface-variant">Loading templates...</span>
          </div>
        ) : (
          <>
            {/* Default Templates */}
            <p className="text-xs font-bold text-brand-grass-green uppercase mb-3">Default Templates</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setSelectedTemplate("standard")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedTemplate === "standard"
                    ? "border-brand-vivid-green bg-green-50"
                    : "border-green-100 hover:border-brand-vivid-green/50"
                }`}
              >
                <div className="w-full h-24 bg-white border-2 border-brand-dark-green rounded-lg mb-2 flex flex-col items-center justify-center overflow-hidden">
                  <span className="material-symbols-outlined text-3xl text-brand-dark-green">description</span>
                  <p className="text-xs font-bold text-brand-dark-green mt-1">Standard</p>
                  <p className="text-[10px] text-gray-400">Classic design</p>
                </div>
                <p className="text-sm font-medium text-brand-dark-green text-center">Standard</p>
                <p className="text-xs text-on-surface-variant text-center">Classic design</p>
              </button>

              <button
                onClick={() => setSelectedTemplate("modern")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedTemplate === "modern"
                    ? "border-brand-vivid-green bg-green-50"
                    : "border-green-100 hover:border-brand-vivid-green/50"
                }`}
              >
                <div className="w-full h-24 bg-white border-4 border-brand-vivid-green rounded-lg mb-2 flex flex-col items-center justify-center overflow-hidden">
                  <span className="material-symbols-outlined text-3xl text-brand-vivid-green">verified_badge</span>
                  <p className="text-xs font-bold text-brand-vivid-green mt-1">Modern</p>
                  <p className="text-[10px] text-gray-400">With accent</p>
                </div>
                <p className="text-sm font-medium text-brand-dark-green text-center">Modern</p>
                <p className="text-xs text-on-surface-variant text-center">With accent</p>
              </button>
            </div>

            {/* Uploaded Templates */}
            {uploadedTemplates.length > 0 && (
              <>
                <p className="text-xs font-bold text-brand-grass-green uppercase mb-3">Your Templates</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  {uploadedTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedTemplate === template.id
                          ? "border-brand-vivid-green bg-green-50"
                          : "border-green-100 hover:border-brand-vivid-green/50"
                      }`}
                    >
                      <div className="w-full h-24 bg-gradient-to-br from-green-50 to-green-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                        {template.fileUrl ? (
                          <iframe 
                            src={`${template.fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitV`}
                            className="w-full h-full object-cover"
                            title={`${template.name} preview`}
                          />
                        ) : (
                          <span className="material-symbols-outlined text-4xl text-brand-green/40">picture_as_pdf</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-brand-dark-green truncate">{template.name}</p>
                      <p className="text-xs text-on-surface-variant">Custom Template</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {uploadedTemplates.length === 0 && (
              <div className="bg-green-50/50 rounded-xl p-4 mb-6 text-center">
                <span className="material-symbols-outlined text-3xl text-brand-green/40 mb-2 block">add_photo_alternate</span>
                <p className="text-sm text-on-surface-variant">
                  Upload custom templates in <span className="font-bold text-brand-green">Templates</span> page
                </p>
              </div>
            )}
          </>
        )}

        <div className="bg-green-50 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-on-surface-variant">Database</p>
              <p className="font-bold text-brand-dark-green">{database.name}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">Participants</p>
              <p className="font-bold text-brand-dark-green">{participants.length}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">Category</p>
              <p className="font-bold text-brand-dark-green">{database.category} - {database.subCategory}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">Topic</p>
              <p className="font-bold text-brand-dark-green">{database.topic}</p>
            </div>
          </div>
        </div>

        <button
          onClick={generateCertificates}
          disabled={isGenerating || participants.length === 0}
          className="w-full py-4 vivid-gradient-cta text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined">auto_awesome</span>
          Generate {participants.length} Certificates
        </button>

        <p className="text-xs text-center text-on-surface-variant mt-4">
          Certificate IDs: YEAR-PZ-SUBCAT-SERIAL (e.g., 2026-PZ-CRS-0001)
        </p>
      </div>
    );
  }

  return null;
}

export function DownloadCertificateButton({ certificate }: { certificate: CertificateData }) {
  return (
    <PDFDownloadLink
      document={<CertificatePDF certificate={certificate} />}
      fileName={`${certificate.recipientName.replace(/\s+/g, "_")}_${certificate.uniqueCertId}.pdf`}
      className="px-4 py-2 bg-brand-vivid-green text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
    >
      {({ loading }) =>
        loading ? (
          <>
            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            Preparing...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-sm">download</span>
            Download PDF
          </>
        )
      }
    </PDFDownloadLink>
  );
}
