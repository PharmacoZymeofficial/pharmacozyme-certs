"use client";

import type { JSX } from "react";
import { Database, Participant } from "@/lib/types";
import { sfx } from "@/lib/sfx";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";

interface BulkActionsBarProps {
  selectedParticipants: string[];
  participants: Participant[];
  openDropdown: string | null;
  setOpenDropdown: (v: string | null) => void;
  setShowGeneratorModal: (v: boolean) => void;
  openEmailModal: () => void;
  confirm: ReturnType<typeof useConfirm>;
  setBulkDeleteLabel: (v: string) => void;
  setIsBulkDeleting: (v: boolean) => void;
  selectedDatabase: Database;
  toast: ReturnType<typeof useToast>;
  setSelectedParticipants: (v: string[]) => void;
  fetchParticipants: (databaseId: string) => void;
}

export default function BulkActionsBar({
  selectedParticipants,
  participants,
  openDropdown,
  setOpenDropdown,
  setShowGeneratorModal,
  openEmailModal,
  confirm,
  setBulkDeleteLabel,
  setIsBulkDeleting,
  selectedDatabase,
  toast,
  setSelectedParticipants,
  fetchParticipants,
}: BulkActionsBarProps): JSX.Element | null {
  if (selectedParticipants.length === 0) return null;

  return (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-on-surface-variant">{selectedParticipants.length} selected</span>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === "bulk" ? null : "bulk"); }}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">settings</span>
                          Bulk Actions
                          <span className="material-symbols-outlined text-sm">expand_more</span>
                        </button>
                        {openDropdown === "bulk" && (
                          <div className="absolute right-0 top-full bg-white border border-green-200 rounded-lg shadow-lg z-20 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                            {/* Generate Certs */}
                            <button
                              onClick={() => { setOpenDropdown(null); setShowGeneratorModal(true); }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 text-green-700 flex items-center gap-2 font-semibold"
                            >
                              <span className="material-symbols-outlined text-sm">auto_awesome</span>
                              Generate Certs ({selectedParticipants.length})
                            </button>
                            {/* Send Mail */}
                            <button
                              onClick={() => { setOpenDropdown(null); openEmailModal(); }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-blue-700 flex items-center gap-2 font-semibold"
                            >
                              <span className="material-symbols-outlined text-sm">send</span>
                              Send Mail ({selectedParticipants.length})
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={async () => {
                                setOpenDropdown(null);
                                const ok = await confirm({ title: "Delete PDFs", message: `Delete PDFs for ${selectedParticipants.length} selected participants?`, danger: true, confirmText: "Delete" });
                                if (!ok) return;
                                setBulkDeleteLabel("Deleting PDFs");
                                setIsBulkDeleting(true);
                                try {
                                  // Delete Drive files in parallel (independent)
                                  await Promise.all(selectedParticipants.map(id => {
                                    const p = participants.find(x => x.id === id);
                                    return p?.driveFileId ? fetch(`/api/drive-upload?fileId=${p.driveFileId}`, { method: "DELETE" }) : Promise.resolve();
                                  }));
                                  // Batch-clear PDF fields in Firestore
                                  await fetch("/api/participants/batch-update", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ databaseId: selectedDatabase?.id, participantIds: selectedParticipants, fields: { certificateUrl: "", driveLink: "", driveFileId: "", status: "pending" } }),
                                  });
                                  sfx.delete();
                                  toast.success(`Deleted PDFs for ${selectedParticipants.length} participants`);
                                  setSelectedParticipants([]);
                                  fetchParticipants(selectedDatabase.id!);
                                } finally {
                                  setIsBulkDeleting(false);
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 text-gray-700 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                              Delete PDF Only
                            </button>
                            <button
                              onClick={async () => {
                                setOpenDropdown(null);
                                const ok = await confirm({ title: "Delete IDs", message: `Delete Certificate IDs for ${selectedParticipants.length} selected participants?`, danger: true, confirmText: "Delete" });
                                if (!ok) return;
                                setBulkDeleteLabel("Deleting Certificate IDs");
                                setIsBulkDeleting(true);
                                try {
                                  // Revoke from certificates collection
                                  await Promise.all(selectedParticipants.map(id => {
                                    const p = participants.find(x => x.id === id);
                                    return p?.certificateId ? fetch(`/api/certificates?uniqueCertId=${encodeURIComponent(p.certificateId)}&keepPdf=true`, { method: "DELETE" }) : Promise.resolve();
                                  }));
                                  await fetch("/api/participants/batch-update", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ databaseId: selectedDatabase?.id, participantIds: selectedParticipants, fields: { certificateId: "", serialNumber: null, status: "pending", verificationUrl: "" } }),
                                  });
                                  sfx.delete();
                                  toast.success(`Deleted Certificate IDs for ${selectedParticipants.length} participants`);
                                  setSelectedParticipants([]);
                                  fetchParticipants(selectedDatabase.id!);
                                } finally {
                                  setIsBulkDeleting(false);
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 text-gray-700 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">tag</span>
                              Delete ID Only
                            </button>
                            <button
                              onClick={async () => {
                                setOpenDropdown(null);
                                const ok = await confirm({ title: "Delete Both", message: `Delete Certificate ID + PDF for ${selectedParticipants.length} selected participants?`, danger: true, confirmText: "Delete All" });
                                if (!ok) return;
                                setBulkDeleteLabel("Deleting IDs + PDFs");
                                setIsBulkDeleting(true);
                                try {
                                  // Delete Drive files + revoke from certificates collection in parallel
                                  await Promise.all(selectedParticipants.flatMap(id => {
                                    const p = participants.find(x => x.id === id);
                                    return [
                                      p?.driveFileId ? fetch(`/api/drive-upload?fileId=${p.driveFileId}`, { method: "DELETE" }) : Promise.resolve(),
                                      p?.certificateId ? fetch(`/api/certificates?uniqueCertId=${encodeURIComponent(p.certificateId)}`, { method: "DELETE" }) : Promise.resolve(),
                                    ];
                                  }));
                                  // Batch-clear all cert+pdf fields
                                  await fetch("/api/participants/batch-update", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ databaseId: selectedDatabase?.id, participantIds: selectedParticipants, fields: { certificateId: "", certificateUrl: "", driveLink: "", driveFileId: "", status: "pending" } }),
                                  });
                                  sfx.delete();
                                  toast.success(`Deleted ID + PDF for ${selectedParticipants.length} participants`);
                                  setSelectedParticipants([]);
                                  fetchParticipants(selectedDatabase.id!);
                                } finally {
                                  setIsBulkDeleting(false);
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                              Delete Both
                            </button>
                            <button
                              onClick={() => {
                                setOpenDropdown(null);
                                selectedParticipants.forEach(async (id) => {
                                  await fetch(`/api/participants/${id}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ emailSent: true, databaseId: selectedDatabase?.id }),
                                  });
                                });
                                setSelectedParticipants([]);
                                fetchParticipants(selectedDatabase.id!);
                                sfx.notify();
                                toast.success(`Marked ${selectedParticipants.length} as Emailed`);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-blue-600 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">email</span>
                              Mark as Emailed
                            </button>
                            <button
                              onClick={async () => {
                                setOpenDropdown(null);
                                const ok = await confirm({ title: "Delete Participants", message: `Delete ${selectedParticipants.length} selected participants? This cannot be undone.`, danger: true, confirmText: "Delete" });
                                if (!ok) return;
                                setBulkDeleteLabel("Deleting Participants");
                                setIsBulkDeleting(true);
                                try {
                                  for (const id of selectedParticipants) {
                                    const participant = participants.find(p => p.id === id);
                                    if (participant?.driveFileId) {
                                      await fetch(`/api/drive-upload?fileId=${participant.driveFileId}`, { method: "DELETE" });
                                    }
                                    await fetch(`/api/participants/${id}?databaseId=${selectedDatabase?.id}`, { method: "DELETE" });
                                  }
                                  setSelectedParticipants([]);
                                  sfx.delete();
                                  toast.success(`Deleted ${selectedParticipants.length} participants`);
                                  fetchParticipants(selectedDatabase.id!);
                                } finally {
                                  setIsBulkDeleting(false);
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">person_remove</span>
                              Delete Participants
                            </button>
                            <button
                              onClick={() => { setOpenDropdown(null); setSelectedParticipants([]); }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-500 flex items-center gap-2 border-t border-gray-100 mt-1"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                              Clear Selection
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
  );
}
