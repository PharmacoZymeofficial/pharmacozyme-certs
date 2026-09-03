"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image, Font } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { buildCertificateUrl } from "@/lib/urls";
// loadFontBytes runs server-side only (needs custom User-Agent for TTF from Google Fonts).
// Client-side: proxy through /api/fonts so the server does the fetch with the correct UA.
async function loadFontBytesViaProxy(fontName: string): Promise<Uint8Array | null> {
  if (!fontName) return null;
  try {
    const res = await fetch(`/api/fonts?name=${encodeURIComponent(fontName)}`);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}
import { useToast } from "@/components/Toast";
import { sfx } from "@/lib/sfx";
import { classifyParticipant, deriveGenerationSummary } from "@/lib/generationState";
import { lookupBoundValue } from "@/lib/sheetSchema";
import { splitByCategory, normalizeCategory } from "@/lib/templatePicker";
import type { GenerationJob } from "@/lib/types";



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
                <Text style={styles.detailValue}>{certificate.verificationUrl || "cert.pharmacozyme.com/verify"}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.watermark}>PHARMACOZYME</Text>
        </View>
      </Page>
    </Document>
  );
};

async function generateQRCode(data: string, darkColor = "#1b4332", lightColor = "#ffffff"): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
      color: { dark: darkColor, light: lightColor },
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
function getTemplatePositions(width: number, height: number, positions?: { name: { x: number; y: number; size?: number; color?: string; font?: string }; certId: { x: number; y: number; size?: number; color?: string; font?: string }; qr: { x: number; y: number; size: number } }) {
  if (positions) {
    // QR size is stored as percentage (1-25), convert to actual dimension
    const qrSizeValue = positions.qr.size || 12;
    const qrDimension = (Math.min(width, height) * qrSizeValue) / 100;

    return {
      namePos: { x: (width * positions.name.x) / 100, y: height - (height * positions.name.y) / 100, size: positions.name.size || 48, color: hexToRgb(positions.name.color || "#1b4332"), font: positions.name.font || null },
      certIdPos: { x: (width * positions.certId.x) / 100, y: height - (height * positions.certId.y) / 100, size: positions.certId.size || 12, color: hexToRgb(positions.certId.color || "#333333"), font: positions.certId.font || null },
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
    
    // Get template positions (custom or defaults)
    const positions = getTemplatePositions(width, height, templatePositions);

    // Embed fonts — use custom Google Font if specified, else fall back to Helvetica
    const [nameFontBytes, certIdFontBytes] = await Promise.all([
      positions.namePos.font ? loadFontBytesViaProxy(positions.namePos.font) : Promise.resolve(null),
      positions.certIdPos.font ? loadFontBytesViaProxy(positions.certIdPos.font) : Promise.resolve(null),
    ]);
    console.log("[cert-gen] nameFont:", positions.namePos.font, "bytes loaded:", !!nameFontBytes, "byteLength:", nameFontBytes?.byteLength);
    console.log("[cert-gen] certIdFont:", positions.certIdPos.font, "bytes loaded:", !!certIdFontBytes);
    let boldFont, regularFont;
    try {
      boldFont = nameFontBytes
        ? await pdfDoc.embedFont(nameFontBytes, { subset: true })
        : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    } catch (e) {
      console.error("[cert-gen] Name font embed failed:", e);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
    try {
      regularFont = certIdFontBytes
        ? await pdfDoc.embedFont(certIdFontBytes, { subset: true })
        : await pdfDoc.embedFont(StandardFonts.Helvetica);
    } catch (e) {
      console.error("[cert-gen] CertId font embed failed:", e);
      regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

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
  category?: string;
  positions?: {
    name: { x: number; y: number; size?: number; color?: string; font?: string };
    certId: { x: number; y: number; size?: number; color?: string; font?: string };
    qr: { x: number; y: number; size: number; darkColor?: string; lightColor?: string; transparentBg?: boolean };
    customElements?: Array<{ id: string; label: string; text: string; sourceField?: string }>;
  };
}

interface CertificateGeneratorProps {
  database: any;
  participants: any[];
  onGenerated: () => void;
  resumeMode?: boolean;
}

export default function CertificateGenerator({ database, participants, onGenerated, resumeMode }: CertificateGeneratorProps) {
  const toast = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [showDownload, setShowDownload] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("standard");
  const [showTemplateSelect, setShowTemplateSelect] = useState(true);
  const [uploadedTemplates, setUploadedTemplates] = useState<CertificateTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentGenerating, setCurrentGenerating] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  // Picker paging: show PICKER_STEP templates of the DB's category, reveal more
  // PICKER_STEP at a time. The other category is hidden until asked for.
  const PICKER_STEP = 6;
  const [primaryCount, setPrimaryCount] = useState(PICKER_STEP);
  const [showOtherCategory, setShowOtherCategory] = useState(false);
  const [otherCount, setOtherCount] = useState(PICKER_STEP);

  const summary = deriveGenerationSummary(participants, !!database.linkedSheet);
  // Default target: everything not already complete. Checkbox adds the complete set.
  const [regenerateComplete, setRegenerateComplete] = useState(false);

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

  const startGeneration = async () => {
    setIsGenerating(true);
    setShowTemplateSelect(false);
    setGenerationProgress(0);

    const sortedParticipants = [...participants].sort((a, b) => {
      if (a.certificateId && b.certificateId) {
        const aNum = parseInt(a.certificateId.split("-").pop() || "0");
        const bNum = parseInt(b.certificateId.split("-").pop() || "0");
        return aNum - bNum;
      }
      return 0;
    });

    // Derived run set: needs-cert ∪ needs-pdf, plus complete only if asked.
    const runList = sortedParticipants.filter((p) => {
      const state = classifyParticipant(p, !!database.linkedSheet);
      return state !== "complete" || regenerateComplete;
    });
    // Which of those get a brand-new cert id (and a new certificates doc).
    const needsCertIds = new Set(
      sortedParticipants.filter((p) => classifyParticipant(p, !!database.linkedSheet) === "needs-cert" && p.id).map((p) => p.id as string)
    );

    const jobUrl = `/api/generation-jobs/${database.id}`;

    if (runList.length === 0) {
      setIsGenerating(false);
      setShowTemplateSelect(true);
      if (resumeMode && participants.length > 0) {
        // The interrupted run's remainder is already done — retire the phantom job doc.
        // An empty roster means "not loaded yet", never "all done".
        await fetch(jobUrl, { method: "DELETE" }).catch(() => {});
      }
      toast.info("Nothing to generate — every participant already has a certificate and a PDF.");
      return;
    }

    let effectiveTemplate = selectedTemplate;

    // Bare run marker — written once on start, deleted on clean finish, left in
    // place on any throw (it reads "interrupted" once stale). No progress ledger.
    const markRunning = async (templateId: string) => {
      try {
        await fetch(jobUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, startedAt: new Date().toISOString(), status: "running" }),
        });
      } catch { /* non-fatal */ }
    };

    try {
      if (resumeMode) {
        let job: GenerationJob | undefined;
        try {
          const jr = await fetch(jobUrl);
          if (jr.ok) job = (await jr.json()).job;
        } catch { /* fall through to the picked template */ }

        const originalTemplate = job?.templateId;
        if (
          originalTemplate &&
          (["standard", "modern"].includes(originalTemplate) ||
            uploadedTemplates.some((t) => t.id === originalTemplate))
        ) {
          effectiveTemplate = originalTemplate;
          if (originalTemplate !== selectedTemplate) {
            const name = uploadedTemplates.find((t) => t.id === originalTemplate)?.name || "Standard";
            toast.info(`Resuming with the original run's template (${name}).`);
          }
        } else if (originalTemplate) {
          toast.warning("The original run's template is no longer available — using your current selection.");
        }
      }

      await markRunning(effectiveTemplate);

      const year = new Date().getFullYear();

      const isUploadedTemplate = !["standard", "modern"].includes(effectiveTemplate);
      let templateData = uploadedTemplates.find(t => t.id === effectiveTemplate);

      if (isUploadedTemplate && templateData) {
        try {
          const fullRes = await fetch(`/api/templates/${templateData.id}`);
          if (fullRes.ok) {
            const fullData = await fullRes.json();
            if (fullData.pdfBase64) {
              templateData = { ...templateData, fileUrl: `data:application/pdf;base64,${fullData.pdfBase64}` };
            }
          }
        } catch (err) {
          console.error("Failed to fetch full template data:", err);
        }
      }

      let serialNumber = 1;
      try {
        const existingResponse = await fetch(`/api/participants?databaseId=${database.id}`);
        const existingData = await existingResponse.json();
        if (existingData.participants) {
          const subShort = subCategoryShort[database.subCategory] || database.subCategory.slice(0, 3).toUpperCase();
          const prefix = `${year}-PZ-${subShort}-`;
          const maxSerial = (existingData.participants as { certificateId?: string }[]).reduce((max, p) => {
            if (!p.certificateId || !p.certificateId.startsWith(prefix)) return max;
            const n = parseInt(p.certificateId.slice(prefix.length), 10);
            return Number.isFinite(n) ? Math.max(max, n) : max;
          }, 0);
          serialNumber = maxSerial + 1;
        }
      } catch {}

      const issueDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const qrDark = templateData?.positions?.qr?.darkColor || "#1b4332";
      const qrLight = templateData?.positions?.qr?.transparentBg
        ? "#00000000"
        : (templateData?.positions?.qr?.lightColor || "#ffffff");

      // Warn (non-blocking) if the template has fields bound to sheet/CSV columns
      // that some participants are missing values for — they'll print blank.
      const boundFields = (templateData?.positions?.customElements || [])
        .map(el => el.sourceField)
        .filter((f): f is string => !!f);
      if (boundFields.length > 0) {
        const missingByField = new Map<string, number>();
        for (const p of runList) {
          for (const field of boundFields) {
            if (!lookupBoundValue(p.customFields, field)) missingByField.set(field, (missingByField.get(field) || 0) + 1);
          }
        }
        if (missingByField.size > 0) {
          const summary = [...missingByField.entries()].map(([f, n]) => `${f} (${n})`).join(", ");
          toast.warning(`Some participants are missing values for bound field(s): ${summary}. Those will print blank.`);
        }
      }

      // Pre-assign cert IDs sequentially (serial numbers must be deterministic before parallelizing)
      const participantsWithCertIds = runList.map((participant, i) => ({
        participant,
        certId: participant.certificateId?.trim() || generateCertificateId(participant.name, database.subCategory, serialNumber + i),
      }));

      // ── Phase 1: Parallel render (20 concurrent) ───────────────────────────
      const RENDER_CONCURRENCY = 20;
      type RenderResult = {
        participant: any;
        certId: string;
        verificationUrl: string;
        qrCodeDataUrl: string;
        pdfBytes?: Uint8Array;
      };
      const allResults: RenderResult[] = [];

      for (let i = 0; i < participantsWithCertIds.length; i += RENDER_CONCURRENCY) {
        const batchSlice = participantsWithCertIds.slice(i, i + RENDER_CONCURRENCY);
        const end = Math.min(i + RENDER_CONCURRENCY, participantsWithCertIds.length);
        setCurrentGenerating(`Rendering ${i + 1}–${end} of ${participantsWithCertIds.length}…`);

        const batchResults = await Promise.all(batchSlice.map(async ({ participant, certId }) => {
          const verificationUrl = buildCertificateUrl(certId);
          try {
            let pdfBytes: Uint8Array | undefined;
            let qrCodeDataUrl: string;

            if (isUploadedTemplate && templateData) {
              // QR generation and server render run concurrently
              const [qr, rendered] = await Promise.all([
                generateQRCode(verificationUrl, qrDark, qrLight),
                (async (): Promise<Uint8Array | undefined> => {
                  const renderRes = await fetch("/api/certificates/render", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      templateId: templateData!.id,
                      recipientName: participant.name,
                      certId,
                      verificationUrl,
                      qrDarkColor: qrDark,
                      qrLightColor: qrLight,
                      fieldValues: participant.customFields || {},
                    }),
                  });
                  if (renderRes.ok) return new Uint8Array(await renderRes.arrayBuffer());
                  console.error("Server-side render failed:", await renderRes.json().catch(() => ({})));
                  return undefined;
                })(),
              ]);
              qrCodeDataUrl = qr;
              pdfBytes = rendered;
            } else {
              // Standard template: QR must be embedded in PDF, so generate QR first
              qrCodeDataUrl = await generateQRCode(verificationUrl, qrDark, qrLight);
              try {
                const { pdf } = await import("@react-pdf/renderer");
                const certDoc = (
                  <CertificatePDF certificate={{
                    recipientName: participant.name,
                    uniqueCertId: certId,
                    certType: database.topic,
                    topic: database.topic,
                    category: database.category,
                    subCategory: database.subCategory,
                    issueDate,
                    verificationUrl,
                    qrCodeDataUrl,
                    template: effectiveTemplate,
                    templateName: "Standard",
                  }} />
                );
                const blob = await pdf(certDoc).toBlob();
                pdfBytes = new Uint8Array(await blob.arrayBuffer());
              } catch (pdfErr) {
                console.error("Error generating standard PDF:", pdfErr);
              }
            }

            return { participant, certId, verificationUrl, qrCodeDataUrl, pdfBytes };
          } catch (err) {
            console.error("Failed to render for:", participant.name, err);
            return null;
          }
        }));

        const fresh = batchResults.filter(r => r !== null) as RenderResult[];
        allResults.push(...fresh);

        if (fresh.length > 0) {
          // ── Flush this chunk: Firestore write (participants + cert docs) ────
          const certDocs = fresh
            .filter(({ participant }) => participant.id && needsCertIds.has(participant.id))
            .map(({ participant, certId, verificationUrl }) => ({
            uniqueCertId: certId,
            recipientName: participant.name,
            recipientEmail: participant.email || "",
            category: database.category,
            subCategory: database.subCategory,
            topic: database.topic,
            certType: database.topic || database.subCategory,
            issueDate,
            status: "generated",
            verificationUrl,
            databaseId: database.id,
            participantId: participant.id,
            createdAt: new Date().toISOString(),
          }));

          const buRes = await fetch("/api/participants/batch-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              databaseId: database.id,
              updates: fresh.map(({ participant, certId, verificationUrl }) => ({
                id: participant.id,
                certificateId: certId,
                status: "generated",
                verificationUrl,
                certificateUrl: verificationUrl,
                issueDate,
                template: effectiveTemplate,
                templateName: templateData?.name || "Standard",
              })),
              certDocs,
              skipSheetSync: true,
            }),
          });

          if (!buRes.ok) {
            throw new Error(`Chunk write failed (HTTP ${buRes.status}) — run interrupted, reopen to resume.`);
          }
          // no progress ledger — resume re-derives the remainder from participant docs
        }

        setGenerationProgress(Math.round(((i + RENDER_CONCURRENCY) / participantsWithCertIds.length) * 60));
      }

      // ── Phase 2: renders + cert-doc writes flushed per-chunk above ─────────
      setGenerationProgress(65);

      // ── Phase 3: Drive uploads (5 concurrent) ──────────────────────────────
      let driveFailedCount = 0;
      if (database.linkedSheet) {
        // Resolve ONE canonical Drive folder id before firing concurrent uploads
        // so Apps Script never creates a folder by name under a race.
        let runFolderId: string | undefined = database.driveFolderId || undefined;
        if (!runFolderId) {
          try {
            const fr = await fetch("/api/databases/drive-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ databaseId: database.id, databaseName: database.name }),
            });
            if (fr.ok) runFolderId = (await fr.json()).folderId || undefined;
          } catch { /* fall back to per-upload name lookup */ }
        }
        const DRIVE_CONCURRENCY = 5;
        type DriveResult = { participantId: string; certId: string; driveLink: string; driveFileId: string; failed?: boolean; name?: string };
        const driveResults: DriveResult[] = [];
        let driveFolderUpdated = false;

        for (let i = 0; i < allResults.length; i += DRIVE_CONCURRENCY) {
          const batchSlice = allResults.slice(i, i + DRIVE_CONCURRENCY);
          const end = Math.min(i + DRIVE_CONCURRENCY, allResults.length);
          setCurrentGenerating(`Uploading to Drive ${i + 1}–${end} of ${allResults.length}…`);

          const batchDriveResults = await Promise.all(batchSlice.map(async ({ participant, certId, pdfBytes }) => {
            if (!pdfBytes) return null;
            const base64Data = Buffer.from(pdfBytes).toString("base64");
            const driveFileName = `${participant.name.replace(/[^a-zA-Z0-9]/g, "_")}_${certId}.pdf`;

            // Up to 3 attempts with backoff — Apps Script hiccups under concurrent load,
            // and a single dropped request must not silently lose the Drive link.
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                const res = await fetch("/api/drive-upload", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                  pdfBytes: base64Data,
                  fileName: driveFileName,
                  databaseName: database.name,
                  ...(runFolderId ? { folderId: runFolderId } : {}),
                }),
                });
                if (res.ok) {
                  const data = await res.json();
                  // If the script used a different folder than we asked for (a
                  // stale or trashed folder id it had to self-heal around), adopt
                  // it for the rest of this run and persist it so the next run
                  // targets the right folder instead of repeating the fallback.
                  if (data.folderId && data.folderId !== runFolderId) {
                    runFolderId = data.folderId;
                    if (!driveFolderUpdated) {
                      driveFolderUpdated = true;
                      fetch("/api/databases", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id: database.id,
                          driveFolderId: data.folderId,
                          driveFolderUrl: data.folderUrl || `https://drive.google.com/drive/folders/${data.folderId}`,
                        }),
                      }).catch(() => {});
                    }
                  }
                  return {
                    participantId: participant.id,
                    certId,
                    driveLink: data.webContentLink || "",
                    driveFileId: data.fileId || "",
                  };
                }
                console.error(`Drive upload failed for ${participant.name} (attempt ${attempt}/3): HTTP ${res.status}`);
              } catch (driveErr) {
                console.error(`Drive upload error for ${participant.name} (attempt ${attempt}/3):`, driveErr);
              }
              if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
            }
            return { participantId: participant.id, certId, driveLink: "", driveFileId: "", failed: true, name: participant.name };
          }));

          driveResults.push(...(batchDriveResults.filter(r => r !== null) as DriveResult[]));
          setGenerationProgress(65 + Math.round(((i + DRIVE_CONCURRENCY) / allResults.length) * 25));
        }

        const driveSucceeded = driveResults.filter(r => !r.failed);
        const driveFailed = driveResults.filter(r => r.failed);
        driveFailedCount = driveFailed.length;

        if (driveSucceeded.length > 0) {
          // Batch update participant Drive links (no sheet sync yet)
          const buRes2 = await fetch("/api/participants/batch-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              databaseId: database.id,
              updates: driveSucceeded.map((r) => ({ id: r.participantId, driveLink: r.driveLink, driveFileId: r.driveFileId })),
              skipSheetSync: true,
            }),
          });
          if (!buRes2.ok) {
            throw new Error(`Drive-link write failed (HTTP ${buRes2.status}) — run interrupted, reopen to resume.`);
          }

          // Patch cert docs with Drive links (20 concurrent)
          let certPatchFailures = 0;
          const PATCH_CONCURRENCY = 20;
          for (let i = 0; i < driveSucceeded.length; i += PATCH_CONCURRENCY) {
            await Promise.all(
              driveSucceeded.slice(i, i + PATCH_CONCURRENCY).map((r) =>
                fetch("/api/certificates", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ uniqueCertId: r.certId, driveLink: r.driveLink, driveFileId: r.driveFileId, pdfUrl: r.driveLink }),
                })
                  .then((res) => { if (!res.ok) certPatchFailures++; })
                  .catch(() => { certPatchFailures++; })
              )
            );
          }
          if (certPatchFailures > 0) {
            toast.warning(`${certPatchFailures} certificate record(s) couldn't be updated with their Drive link. Re-run generation to retry.`);
          }
        }

        if (driveFailed.length > 0) {
          const names = driveFailed.slice(0, 3).map(r => r.name).join(", ");
          const more = driveFailed.length > 3 ? ` +${driveFailed.length - 3} more` : "";
          toast.error(
            `${driveFailed.length} certificate(s) uploaded but the Drive link didn't save (${names}${more}). ` +
            `Filter participants by "Missing Drive Link" and use Bulk Actions → Generate Certs → Regenerate All to retry — their existing certificate ID is kept.`
          );
        }
      }

      // ── Phase 4: One sheet sync ─────────────────────────────────────────────
      if (database.linkedSheet) {
        setCurrentGenerating("Syncing to sheet…");
        setGenerationProgress(92);
        await fetch("/api/sheets/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ databaseId: database.id, mode: "firebaseToSheets" }),
        }).catch(err => console.error("Failed to sync to Sheets:", err));
      }

      setGenerationProgress(100);

      // Clean finish = nothing in this run's scope still needs work. Re-derive
      // from fresh docs rather than trusting an in-memory tally.
      let cleanFinish = driveFailedCount === 0;
      try {
        const fresh = await fetch(`/api/participants?databaseId=${database.id}`);
        if (fresh.ok) {
          const data = await fresh.json();
          const byId = new Map<string, { certificateId?: string; driveLink?: string }>(
            (data.participants || []).filter((p: { id?: string }) => p.id).map((p: { id: string }) => [p.id, p])
          );
          cleanFinish = runList.every((p) => {
            const doc = p.id ? byId.get(p.id) : undefined;
            return doc ? classifyParticipant(doc, !!database.linkedSheet) === "complete" : false;
          });
        }
      } catch { /* keep the driveFailed-based guess */ }

      if (cleanFinish) {
        await fetch(jobUrl, { method: "DELETE" }).catch(() => {});
      }
      // else: leave the job doc — it reads "interrupted" once stale and the
      // derived badge already reflects what's left.
      setCertificates(allResults.map(r => ({
        recipientName: r.participant.name,
        uniqueCertId: r.certId,
        certType: database.topic,
        topic: database.topic,
        category: database.category,
        subCategory: database.subCategory,
        issueDate,
        verificationUrl: r.verificationUrl,
        qrCodeDataUrl: r.qrCodeDataUrl,
        template: effectiveTemplate,
        templateName: templateData?.name || "Standard",
        pdfBytes: r.pdfBytes,
      })));
      setShowDownload(true);
      onGenerated();

      if (allResults.length > 0) {
        sfx.fanfare();
        toast.success(`Generated ${allResults.length} certificates! Template: ${templateData?.name || "Standard"}`);
      } else {
        sfx.error();
        toast.error("No certificates were generated.");
      }

    } catch (err) {
      console.error("Error generating certificates:", err);
      sfx.error();
      toast.error("Generation interrupted — reopen this database to resume the rest. " + (err as Error).message);
    } finally {
      setIsGenerating(false);
      setCurrentGenerating("");
      setGenerationProgress(0);
    }
  };

  // Collapse the picker back to its default view every time it reopens.
  useEffect(() => {
    if (showTemplateSelect) {
      setPrimaryCount(PICKER_STEP);
      setShowOtherCategory(false);
      setOtherCount(PICKER_STEP);
      setTemplateSearch("");
    }
  }, [showTemplateSelect]);

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!resumeMode || loadingTemplates || isGenerating || showDownload || autoStartedRef.current) return;
    // Resume skips the picker: startGeneration re-locks to job.templateId itself.
    autoStartedRef.current = true;
    void startGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeMode, loadingTemplates]);

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
    const search = templateSearch.trim().toLowerCase();
    const { primary, other, primaryLabel, otherLabel } = splitByCategory(uploadedTemplates, database.category);
    const searchMatches = search
      ? uploadedTemplates.filter((t) => t.name.toLowerCase().includes(search))
      : [];
    // With no primary-category templates, fall back to showing the other bucket.
    const primaryList = primary.length > 0 ? primary : other;
    const primaryListLabel = primary.length > 0 ? primaryLabel : otherLabel;
    const primaryFellBack = primary.length === 0 && other.length > 0;

    const renderTemplateCard = (template: CertificateTemplate) => (
      <button
        key={template.id}
        onClick={() => setSelectedTemplate(template.id)}
        className={`p-3 rounded-xl border-2 transition-all duration-150 text-left cursor-pointer ${
          selectedTemplate === template.id
            ? "border-brand-vivid-green bg-green-50 shadow-md"
            : "border-green-100 hover:border-brand-vivid-green/60 hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]"
        }`}
      >
        <div className="w-full h-24 bg-gradient-to-br from-green-50 to-green-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
          {template.fileUrl ? (
            <iframe
              src={`${template.fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitV`}
              className="w-full h-full pointer-events-none"
              title={`${template.name} preview`}
              tabIndex={-1}
            />
          ) : (
            <span className="material-symbols-outlined text-4xl text-brand-green/40">picture_as_pdf</span>
          )}
        </div>
        <p className="text-sm font-medium text-brand-dark-green truncate">{template.name}</p>
        <p className="text-xs text-on-surface-variant">{normalizeCategory(template.category)} template</p>
      </button>
    );

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
              {summary.needsCert} need a cert ID · {summary.needsPdf} have an ID, no PDF · {summary.complete} complete
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
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-brand-grass-green uppercase">
                    Your Templates
                    {!search && (
                      <span className="text-on-surface-variant"> · {primaryListLabel}</span>
                    )}
                  </p>
                </div>
                {/* Search */}
                <div className="relative mb-3">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-gray-400 pointer-events-none">search</span>
                  <input
                    type="text"
                    placeholder="Search all templates…"
                    value={templateSearch}
                    onChange={e => setTemplateSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-green-100 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-vivid-green/30 focus:border-brand-vivid-green/50"
                  />
                  {templateSearch && (
                    <button onClick={() => setTemplateSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  )}
                </div>

                {search ? (
                  /* Search overrides the category view: every name match, uncapped. */
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {searchMatches.map(renderTemplateCard)}
                    {searchMatches.length === 0 && (
                      <p className="col-span-full text-sm text-on-surface-variant text-center py-4">No templates match &quot;{templateSearch.trim()}&quot;</p>
                    )}
                  </div>
                ) : (
                  <>
                    {primaryFellBack && (
                      <p className="text-xs text-on-surface-variant mb-3">
                        No {primaryLabel} templates yet — showing {otherLabel} templates.
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-3">
                      {primaryList.slice(0, primaryCount).map(renderTemplateCard)}
                    </div>
                    {primaryList.length > PICKER_STEP && (
                      <div className="flex items-center gap-4">
                        {primaryCount < primaryList.length && (
                          <button
                            onClick={() => setPrimaryCount(c => c + PICKER_STEP)}
                            className="text-sm font-medium text-brand-green hover:text-brand-dark-green flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-base">expand_more</span>
                            Show {Math.min(PICKER_STEP, primaryList.length - primaryCount)} more
                          </button>
                        )}
                        {primaryCount > PICKER_STEP && (
                          <button
                            onClick={() => setPrimaryCount(PICKER_STEP)}
                            className="text-sm font-medium text-on-surface-variant hover:text-brand-dark-green flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-base">expand_less</span>
                            Show fewer
                          </button>
                        )}
                      </div>
                    )}

                    {!primaryFellBack && other.length > 0 && (
                      <div className="border-t border-green-100 mt-4 pt-4">
                        {!showOtherCategory ? (
                          <button
                            onClick={() => setShowOtherCategory(true)}
                            className="text-sm font-medium text-on-surface-variant hover:text-brand-dark-green flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-base">add</span>
                            Show {otherLabel} templates ({other.length})
                          </button>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-brand-grass-green uppercase mb-3">{otherLabel} templates</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-3">
                              {other.slice(0, otherCount).map(renderTemplateCard)}
                            </div>
                            {other.length > PICKER_STEP && (
                              <div className="flex items-center gap-4">
                                {otherCount < other.length && (
                                  <button
                                    onClick={() => setOtherCount(c => c + PICKER_STEP)}
                                    className="text-sm font-medium text-brand-green hover:text-brand-dark-green flex items-center gap-1"
                                  >
                                    <span className="material-symbols-outlined text-base">expand_more</span>
                                    Show {Math.min(PICKER_STEP, other.length - otherCount)} more
                                  </button>
                                )}
                                {otherCount > PICKER_STEP && (
                                  <button
                                    onClick={() => setOtherCount(PICKER_STEP)}
                                    className="text-sm font-medium text-on-surface-variant hover:text-brand-dark-green flex items-center gap-1"
                                  >
                                    <span className="material-symbols-outlined text-base">expand_less</span>
                                    Show fewer
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
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

        {summary.complete > 0 && (
          <label className="flex items-center gap-2 text-sm text-on-surface-variant mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={regenerateComplete}
              onChange={(e) => setRegenerateComplete(e.target.checked)}
            />
            Regenerate the {summary.complete} complete certificate{summary.complete !== 1 ? "s" : ""} too
          </label>
        )}

        {(() => {
          const target = summary.needsCert + summary.needsPdf + (regenerateComplete ? summary.complete : 0);
          return (
            <button
              onClick={startGeneration}
              disabled={isGenerating || participants.length === 0 || target === 0}
              className="w-full py-4 vivid-gradient-cta text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">auto_awesome</span>
              {`Generate ${target} certificate${target !== 1 ? "s" : ""}`}
            </button>
          );
        })()}

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
