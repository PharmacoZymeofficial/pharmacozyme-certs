"use client";

import type { JSX } from "react";
import * as XLSX from "xlsx";
import type { useToast } from "@/components/Toast";
import { sfx } from "@/lib/sfx";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  importFile: File | null;
  setImportFile: (f: File | null) => void;
  importPreview: { name: string; email: string; certificateId?: string; issueDate?: string; status?: string }[];
  setImportPreview: (v: ImportModalProps["importPreview"]) => void;
  isImporting: boolean;
  bulkParticipants: string;
  setBulkParticipants: (v: string) => void;
  toast: ReturnType<typeof useToast>;
  onConfirmImport: () => void;
}

export default function ImportModal({
  open,
  onClose,
  importFile,
  setImportFile,
  importPreview,
  setImportPreview,
  isImporting,
  bulkParticipants,
  setBulkParticipants,
  toast,
  onConfirmImport,
}: ImportModalProps): JSX.Element | null {
  if (!open) return null;

  const handleFileUpload = (file: File) => {
    setImportFile(file);
    setBulkParticipants(""); // Clear paste data when file is uploaded

    const reader = new FileReader();
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let jsonData: any[] = [];

        if (fileExtension === "csv") {
          // Parse CSV
          const text = data as string;
          const lines = text.split("\n").filter(line => line.trim());
          const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map(v => v.trim());
            const row: any = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx] || "";
            });
            jsonData.push(row);
          }
        } else if (fileExtension === "xlsx" || fileExtension === "xls") {
          // Parse Excel
          const workbook = XLSX.read(data, { type: "binary" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          jsonData = XLSX.utils.sheet_to_json(firstSheet);
        } else {
          toast.error("Unsupported file format. Use CSV or Excel.");
          sfx.error();
          return;
        }

        // Map to participants - use exact column names from the user's Excel file
        const mappedParticipants = jsonData.map((row, idx) => {
          // Find keys case-insensitively
          const getValue = (row: any, possibleNames: string[]) => {
            const rowKeys = Object.keys(row);
            for (const name of possibleNames) {
              const foundKey = rowKeys.find(k => k.trim().toLowerCase() === name.toLowerCase());
              if (foundKey && row[foundKey]) {
                return String(row[foundKey]).trim();
              }
            }
            return "";
          };

          // Exact column names from user's file
          const name = getValue(row, ["Name", "name", "NAME", "Full Name", "full name"]);
          const email = getValue(row, ["Active Email Address", "Email", "email", "E-mail", "Mail"]);
          const certId = getValue(row, ["Certificate ID", "CertificateId", "Cert ID"]);
          const issueDate = getValue(row, ["Issue Date", "IssueDate", "Date"]);
          const status = getValue(row, ["Status", "status"]);

          // Import status logic: always set to "pending" on import
          // Certificate will show as generated only after PDF is created
          const importStatus = "pending";

          // Any other columns (e.g. "Designation", "Start Date") become custom
          // fields a template can bind a placeholder to at generation time.
          const KNOWN_COLUMNS = new Set(["name", "full name", "active email address", "email", "e-mail", "mail", "certificate id", "certificateid", "cert id", "issue date", "issuedate", "date", "status"]);
          const customFields: Record<string, string> = {};
          for (const key of Object.keys(row)) {
            if (KNOWN_COLUMNS.has(key.trim().toLowerCase())) continue;
            const val = row[key];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              customFields[key.trim()] = String(val).trim();
            }
          }

          return {
            name,
            email,
            certificateId: certId, // Store the imported cert ID but status is pending
            issueDate,
            status: importStatus,
            customFields,
          };
        }).filter(p => p.name && p.email);

        console.log("Total rows parsed:", jsonData.length, "Valid participants:", mappedParticipants.length);

        if (mappedParticipants.length === 0) {
          console.log("Import failed - sample row:", jsonData[0]);
          toast.warning("No valid participants found. Check file has 'Name' and 'Email' columns.");
          setImportFile(null);
          return;
        }

        setImportPreview(mappedParticipants);
      } catch (err) {
        console.error("File parse error:", err);
        toast.error("Failed to parse file. Please check the format.");
        setImportFile(null);
      }
    };

    if (fileExtension === "xlsx" || fileExtension === "xls") {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-green-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">Import Participants</h3>
            <p className="text-sm text-on-surface-variant">Upload Excel/CSV file or paste data</p>
          </div>
          <button onClick={() => onClose()} className="p-2 hover:bg-green-50 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-6">
          {/* File Upload */}
          <div className="border-2 border-dashed border-green-200 rounded-xl p-8 text-center hover:border-brand-vivid-green hover:bg-green-50/30 transition-all cursor-pointer"
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <input
              id="fileInput"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
            />
            <span className="material-symbols-outlined text-5xl text-brand-grass-green/40 mb-4 block">
              upload_file
            </span>
            <p className="text-sm text-on-surface-variant mb-2">
              Drag and drop Excel or CSV file here, or <span className="text-brand-vivid-green font-bold">browse</span>
            </p>
            <p className="text-[10px] text-outline uppercase tracking-wider">
              Supports: .xlsx, .xls, .csv (Google Sheets export supported)
            </p>
          </div>

          {/* Selected File */}
          {importFile && (
            <div className="p-4 bg-green-50/50 rounded-xl border border-green-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-vivid-green">description</span>
                <div>
                  <p className="text-sm font-medium text-brand-dark-green">{importFile.name}</p>
                  <p className="text-xs text-on-surface-variant">{importPreview.length} participants found</p>
                </div>
              </div>
              <button
                onClick={() => { setImportFile(null); setImportPreview([]); }}
                className="p-2 hover:bg-green-100 rounded-lg text-error"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          )}

          {/* Preview */}
          {importPreview.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-brand-dark-green mb-3">Preview ({Math.min(importPreview.length, 5)} of {importPreview.length})</h4>
              <div className="overflow-x-auto border border-green-100 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-green-50/50">
                    <tr>
                      <th className="px-4 py-3 font-bold text-brand-grass-green">#</th>
                      <th className="px-4 py-3 font-bold text-brand-grass-green">Name</th>
                      <th className="px-4 py-3 font-bold text-brand-grass-green">Email</th>
                      <th className="px-4 py-3 font-bold text-brand-grass-green">Certificate ID</th>
                      <th className="px-4 py-3 font-bold text-brand-grass-green">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-50">
                    {importPreview.slice(0, 5).map((p, i) => (
                      <tr key={i} className="hover:bg-green-50/30">
                        <td className="px-4 py-3">{i + 1}</td>
                        <td className="px-4 py-3">{p.name}</td>
                        <td className="px-4 py-3">{p.email}</td>
                        <td className="px-4 py-3 font-mono text-xs">{p.certificateId || "-"}</td>
                        <td className="px-4 py-3">
                          {p.status?.toLowerCase() === "issued" || p.status?.toLowerCase() === "sent" ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">Issued</span>
                          ) : p.certificateId ? (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">Generated</span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-green-100"></div>
            <span className="text-xs text-on-surface-variant font-bold">OR</span>
            <div className="flex-1 h-px bg-green-100"></div>
          </div>

          {/* Paste Data */}
          <div>
            <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Paste Data</label>
            <textarea
              value={bulkParticipants}
              onChange={(e) => { setBulkParticipants(e.target.value); setImportFile(null); setImportPreview([]); }}
              placeholder="John Doe, john@email.com
Jane Smith, jane@email.com
Ahmed Khan, ahmed@email.com"
              rows={6}
              className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none resize-none font-mono"
            />
          </div>

          <div className="bg-green-50 rounded-xl p-4 text-sm">
            <p className="font-bold text-brand-dark-green mb-2">Supported Column Names (file headers or paste):</p>
            <code className="text-xs text-on-surface-variant block whitespace-pre-line">
              {'Name: name, full name, recipient name, participant name, Name\n'}
              {'Email: email, email address, mail, Active Email Address\n'}
              {'Certificate ID: certificate id, certificate, Certificate ID\n'}
              {'Course: course/workshop/webinar, course, Course/Workshop/Webinar\n'}
              {'(Google Sheets: Export as .xlsx or copy as CSV)'}
            </code>
          </div>
        </div>
        <div className="p-6 border-t border-green-50 flex justify-end gap-3">
          <button
            onClick={() => onClose()}
            className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmImport}
            disabled={isImporting || (importPreview.length === 0 && !bulkParticipants.trim())}
            className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"
          >
            {isImporting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                Importing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">upload</span>
                Import {importPreview.length > 0 ? importPreview.length : bulkParticipants.split("\n").filter(l => l.trim()).length} Participants
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
