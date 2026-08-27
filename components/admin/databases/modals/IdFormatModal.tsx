"use client";

import type { JSX } from "react";
import { Database, Participant } from "@/lib/types";
import { subCategoryShortMap } from "@/components/admin/databases/constants";

interface IdFormatModalProps {
  open: boolean;
  onClose: () => void;
  idFormat: "app" | "name" | "custom";
  setIdFormat: (v: "app" | "name" | "custom") => void;
  idFormatCode: string;
  setIdFormatCode: (v: string) => void;
  idFormatCategoryNo: string;
  setIdFormatCategoryNo: (v: string) => void;
  idFormatCustomizeSubCat: boolean;
  setIdFormatCustomizeSubCat: (v: boolean) => void;
  idFormatAppSubCat: string;
  setIdFormatAppSubCat: (v: string) => void;
  idFormatCustomPrefix: string;
  setIdFormatCustomPrefix: (v: string) => void;
  onConfirm: () => void;
  selectedDatabase: Database | null;
  participants: Participant[];
}

export default function IdFormatModal({
  open,
  onClose,
  idFormat,
  setIdFormat,
  idFormatCode,
  setIdFormatCode,
  idFormatCategoryNo,
  setIdFormatCategoryNo,
  idFormatCustomizeSubCat,
  setIdFormatCustomizeSubCat,
  idFormatAppSubCat,
  setIdFormatAppSubCat,
  idFormatCustomPrefix,
  setIdFormatCustomPrefix,
  onConfirm,
  selectedDatabase,
  participants,
}: IdFormatModalProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-auto flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        <div className="p-6 border-b border-green-50 flex-shrink-0">
          <h3 className="text-xl font-headline font-bold text-brand-dark-green">Choose ID Format</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Select how certificate IDs should be generated for {participants.filter(p => !p.certificateId).length} unassigned participant(s).
          </p>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* 1 — App Format */}
          <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${idFormat === "app" ? "border-brand-vivid-green bg-green-50" : "border-gray-100 hover:border-green-200"}`}>
            <input type="radio" className="mt-1 accent-green-700" checked={idFormat === "app"} onChange={() => setIdFormat("app")} />
            <div className="flex-1">
              <p className="font-bold text-sm text-brand-dark-green">App Format</p>
              <p className="text-xs text-on-surface-variant mt-0.5 mb-2">
                Pattern: <span className="font-mono bg-gray-100 px-1 rounded">PZ-{idFormatCustomizeSubCat ? (idFormatAppSubCat || "CAT") : (subCategoryShortMap[selectedDatabase?.subCategory || ""] || "CRS")}-{idFormatCategoryNo || "No"}-001</span>
              </p>
              {idFormat === "app" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-brand-grass-green uppercase mb-1">Category Number</label>
                    <input
                      type="text"
                      value={idFormatCategoryNo}
                      onChange={e => setIdFormatCategoryNo(e.target.value)}
                      placeholder="e.g. 11"
                      maxLength={6}
                      className="w-full bg-surface-container-low border border-green-100 rounded-lg p-2 text-sm font-mono outline-none focus:border-brand-vivid-green"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={idFormatCustomizeSubCat}
                      onChange={e => setIdFormatCustomizeSubCat(e.target.checked)}
                      className="accent-green-700 w-3.5 h-3.5"
                    />
                    <span className="text-xs font-bold text-brand-grass-green uppercase">Customise Category Code</span>
                  </label>
                  {idFormatCustomizeSubCat && (
                    <div>
                      <input
                        type="text"
                        value={idFormatAppSubCat}
                        onChange={e => setIdFormatAppSubCat(e.target.value.toUpperCase())}
                        placeholder={subCategoryShortMap[selectedDatabase?.subCategory || ""] || "CRS"}
                        maxLength={6}
                        className="w-full bg-surface-container-low border border-green-100 rounded-lg p-2 text-sm font-mono outline-none focus:border-brand-vivid-green"
                      />
                    </div>
                  )}
                  <p className="text-xs text-on-surface-variant">
                    Preview: <span className="font-mono">PZ-{idFormatCustomizeSubCat ? (idFormatAppSubCat || "CAT") : (subCategoryShortMap[selectedDatabase?.subCategory || ""] || "CRS")}-{idFormatCategoryNo || "No"}-001</span>
                  </p>
                </div>
              )}
            </div>
          </label>

          {/* 2 — Name Format */}
          <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${idFormat === "name" ? "border-brand-vivid-green bg-green-50" : "border-gray-100 hover:border-green-200"}`}>
            <input type="radio" className="mt-1 accent-green-700" checked={idFormat === "name"} onChange={() => setIdFormat("name")} />
            <div className="flex-1">
              <p className="font-bold text-sm text-brand-dark-green">Name Format</p>
              <p className="text-xs text-on-surface-variant mt-0.5 mb-2">
                Pattern: <span className="font-mono bg-gray-100 px-1 rounded">FirstName-CODE-001</span>
              </p>
              {idFormat === "name" && (
                <div>
                  <label className="block text-xs font-bold text-brand-grass-green uppercase mb-1">Middle Code</label>
                  <input
                    type="text"
                    value={idFormatCode}
                    onChange={e => setIdFormatCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MDC"
                    maxLength={6}
                    className="w-full bg-surface-container-low border border-green-100 rounded-lg p-2 text-sm font-mono outline-none focus:border-brand-vivid-green"
                  />
                  <p className="text-xs text-on-surface-variant mt-1">
                    Preview: <span className="font-mono">{participants.filter(p => !p.certificateId)[0]?.name.split(" ")[0] || "Name"}-{idFormatCode || "CODE"}-001</span>
                  </p>
                </div>
              )}
            </div>
          </label>

          {/* 3 — Custom ID */}
          <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${idFormat === "custom" ? "border-brand-vivid-green bg-green-50" : "border-gray-100 hover:border-green-200"}`}>
            <input type="radio" className="mt-1 accent-green-700" checked={idFormat === "custom"} onChange={() => setIdFormat("custom")} />
            <div className="flex-1">
              <p className="font-bold text-sm text-brand-dark-green">Custom ID</p>
              <p className="text-xs text-on-surface-variant mt-0.5 mb-2">
                Pattern: <span className="font-mono bg-gray-100 px-1 rounded">PREFIX-001</span>
              </p>
              {idFormat === "custom" && (
                <div>
                  <label className="block text-xs font-bold text-brand-grass-green uppercase mb-1">Prefix</label>
                  <input
                    type="text"
                    value={idFormatCustomPrefix}
                    onChange={e => setIdFormatCustomPrefix(e.target.value.toUpperCase())}
                    placeholder="e.g. CERT-2025"
                    maxLength={20}
                    className="w-full bg-surface-container-low border border-green-100 rounded-lg p-2 text-sm font-mono outline-none focus:border-brand-vivid-green"
                  />
                  <p className="text-xs text-on-surface-variant mt-1">
                    Preview: <span className="font-mono">{idFormatCustomPrefix || "PREFIX"}-001</span>
                  </p>
                </div>
              )}
            </div>
          </label>
        </div>
        <div className="p-6 border-t border-green-50 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={
              (idFormat === "name" && !idFormatCode.trim()) ||
              (idFormat === "app" && (!idFormatCategoryNo.trim() || (idFormatCustomizeSubCat && !idFormatAppSubCat.trim()))) ||
              (idFormat === "custom" && !idFormatCustomPrefix.trim())
            }
            className="px-5 py-2.5 vivid-gradient-cta text-white rounded-xl font-bold text-sm disabled:opacity-50"
          >
            Generate IDs
          </button>
        </div>{/* end footer, flex-shrink-0 implicitly */}
      </div>
    </div>
  );
}
