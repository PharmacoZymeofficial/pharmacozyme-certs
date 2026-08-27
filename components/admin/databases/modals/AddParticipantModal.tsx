"use client";

import type { JSX } from "react";
import { Database } from "@/lib/types";

interface AddParticipantModalProps {
  open: boolean;
  onClose: () => void;
  newParticipant: { name: string; email: string };
  setNewParticipant: (v: { name: string; email: string }) => void;
  isAddingParticipant: boolean;
  onAddSingle: () => void;
  selectedDatabase: Database | null;
}

export default function AddParticipantModal({
  open,
  onClose,
  newParticipant,
  setNewParticipant,
  isAddingParticipant,
  onAddSingle,
  selectedDatabase,
}: AddParticipantModalProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-green-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">Add Participant</h3>
            <p className="text-sm text-on-surface-variant">Add a single participant to {selectedDatabase?.name}</p>
          </div>
          <button onClick={() => onClose()} className="p-2 hover:bg-green-50 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Full Name *</label>
            <input
              type="text"
              value={newParticipant.name}
              onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
              placeholder="Enter full name"
              className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Email Address *</label>
            <input
              type="email"
              value={newParticipant.email}
              onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
              placeholder="email@example.com"
              className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
            />
          </div>
        </div>
        <div className="p-6 border-t border-green-50 flex justify-end gap-3">
          <button onClick={() => onClose()} disabled={isAddingParticipant} className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onAddSingle} disabled={isAddingParticipant} className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold disabled:opacity-70 flex items-center gap-2">
            {isAddingParticipant ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                Adding...
              </>
            ) : "Add Participant"}
          </button>
        </div>
      </div>
    </div>
  );
}
