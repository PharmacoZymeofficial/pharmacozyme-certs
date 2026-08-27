"use client";

import type { JSX } from "react";

interface BulkTargetModalProps {
  open: boolean;
  action: "generate" | "send" | null;
  selectedCount: number;
  totalCount: number;
  onChoose: (target: "all" | "selected") => void;
  onClose: () => void;
}

export default function BulkTargetModal({
  open,
  action,
  selectedCount,
  totalCount,
  onChoose,
  onClose,
}: BulkTargetModalProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-green-50">
          <h3 className="text-lg font-headline font-bold text-brand-dark-green">
            {action === "generate" ? "Generate PDFs" : "Send Emails"}
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">Choose which participants to target</p>
        </div>
        <div className="p-6 space-y-3">
          <button
            onClick={() => onChoose("all")}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-green-100 hover:border-brand-vivid-green hover:bg-green-50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-brand-grass-green">group</span>
            </div>
            <div>
              <p className="font-bold text-brand-dark-green text-sm">All Participants</p>
              <p className="text-xs text-on-surface-variant">{totalCount} participants</p>
            </div>
          </button>
          <button
            onClick={() => onChoose("selected")}
            disabled={selectedCount === 0}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-blue-100 hover:border-blue-400 hover:bg-blue-50 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-blue-600">checklist</span>
            </div>
            <div>
              <p className="font-bold text-brand-dark-green text-sm">Selected Only</p>
              <p className="text-xs text-on-surface-variant">
                {selectedCount === 0 ? "No participants selected" : `${selectedCount} selected`}
              </p>
            </div>
          </button>
        </div>
        <div className="p-4 border-t border-green-50 flex justify-end">
          <button onClick={() => onClose()} className="px-4 py-2 text-sm text-on-surface-variant hover:bg-green-50 rounded-lg">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
