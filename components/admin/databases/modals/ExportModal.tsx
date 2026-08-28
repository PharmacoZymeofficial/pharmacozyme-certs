"use client";

import type { JSX } from "react";
import * as XLSX from "xlsx";
import { Database, Participant } from "@/lib/types";
import type { useToast } from "@/components/Toast";
import { sfx } from "@/lib/sfx";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  participants: Participant[];
  selectedParticipants: string[];
  selectedDatabase: Database | null;
  toast: ReturnType<typeof useToast>;
}

export default function ExportModal({
  open,
  onClose,
  participants,
  selectedParticipants,
  selectedDatabase,
  toast,
}: ExportModalProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-green-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">Export Database</h3>
            <p className="text-sm text-on-surface-variant">
              Export {selectedParticipants.length > 0 ? `${selectedParticipants.length} selected` : `${participants.length} participants`} to file
            </p>
          </div>
          <button onClick={() => onClose()} className="p-2 hover:bg-green-50 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <button
            onClick={() => {
              const exportData = selectedParticipants.length > 0
                ? participants.filter(p => selectedParticipants.includes(p.id || ""))
                : participants;
              const ws = XLSX.utils.json_to_sheet(exportData.map(p => ({
                Name: p.name,
                Email: p.email,
                CertificateID: p.certificateId || "",
                Status: p.certificateId ? "Generated" : "Pending",
              })));
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Participants");
              XLSX.writeFile(wb, `${selectedDatabase?.name.replace(/\s+/g, "_")}_participants.xlsx`);
              onClose();
            }}
            className="w-full p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4 hover:bg-green-100 transition-colors"
          >
            <span className="material-symbols-outlined text-2xl text-brand-vivid-green">table_chart</span>
            <div className="text-left">
              <p className="font-bold text-brand-dark-green">Export as XLSX</p>
              <p className="text-xs text-on-surface-variant">Microsoft Excel format</p>
            </div>
          </button>

          <button
            onClick={() => {
              const exportData = selectedParticipants.length > 0
                ? participants.filter(p => selectedParticipants.includes(p.id || ""))
                : participants;
              const csvContent = "Name,Email,CertificateID,Status\n" + exportData.map(p =>
                `"${p.name}","${p.email}","${p.certificateId || ""}","${p.certificateId ? "Generated" : "Pending"}"`
              ).join("\n");
              const blob = new Blob([csvContent], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${selectedDatabase?.name.replace(/\s+/g, "_")}_participants.csv`;
              a.click();
              URL.revokeObjectURL(url);
              onClose();
            }}
            className="w-full p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4 hover:bg-green-100 transition-colors"
          >
            <span className="material-symbols-outlined text-2xl text-brand-vivid-green">description</span>
            <div className="text-left">
              <p className="font-bold text-brand-dark-green">Export as CSV</p>
              <p className="text-xs text-on-surface-variant">Comma-separated values</p>
            </div>
          </button>

          <button
            onClick={() => {
              toast.info("PDF export requires certificate generation. Generate certificates first.");
              sfx.notify();
              onClose();
            }}
            className="w-full p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4 hover:bg-green-100 transition-colors"
          >
            <span className="material-symbols-outlined text-2xl text-brand-vivid-green">picture_as_pdf</span>
            <div className="text-left">
              <p className="font-bold text-brand-dark-green">Export as PDF</p>
              <p className="text-xs text-on-surface-variant">Print-ready format</p>
            </div>
          </button>
        </div>
        <div className="p-6 border-t border-green-50">
          <button onClick={() => onClose()} className="w-full px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
