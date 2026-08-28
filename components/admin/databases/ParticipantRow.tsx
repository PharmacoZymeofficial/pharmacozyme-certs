"use client";

import type { Dispatch, SetStateAction, JSX } from "react";
import { Database, Participant } from "@/lib/types";
import { sfx } from "@/lib/sfx";
import type { useToast } from "@/components/Toast";

interface ParticipantRowProps {
  participant: Participant;
  index: number;
  sorted: Participant[];
  focusedRowIndex: number;
  anchorRowIndex: number;
  setFocusedRowIndex: Dispatch<SetStateAction<number>>;
  setAnchorRowIndex: Dispatch<SetStateAction<number>>;
  selectedParticipants: string[];
  setSelectedParticipants: Dispatch<SetStateAction<string[]>>;
  editingName: string | null;
  setEditingName: Dispatch<SetStateAction<string | null>>;
  editingEmail: string | null;
  setEditingEmail: Dispatch<SetStateAction<string | null>>;
  editingCertId: string | null;
  setEditingCertId: Dispatch<SetStateAction<string | null>>;
  tempCertId: string;
  setTempCertId: Dispatch<SetStateAction<string>>;
  selectedDatabase: Database;
  fetchParticipants: (databaseId: string) => void;
  handleSaveCertId: (participant: Participant) => void;
  openDropdown: string | null;
  setOpenDropdown: Dispatch<SetStateAction<string | null>>;
  handleDeletePdfOnly: (participant: Participant) => void;
  handleDeleteCertificate: (participant: Participant) => void;
  handleDeleteCertId: (participant: Participant) => void;
  handleDeleteParticipant: (participant: Participant) => void;
  toast: ReturnType<typeof useToast>;
}

export default function ParticipantRow({
  participant,
  index,
  sorted,
  focusedRowIndex,
  anchorRowIndex,
  setFocusedRowIndex,
  setAnchorRowIndex,
  selectedParticipants,
  setSelectedParticipants,
  editingName,
  setEditingName,
  editingEmail,
  setEditingEmail,
  editingCertId,
  setEditingCertId,
  tempCertId,
  setTempCertId,
  selectedDatabase,
  fetchParticipants,
  handleSaveCertId,
  openDropdown,
  setOpenDropdown,
  handleDeletePdfOnly,
  handleDeleteCertificate,
  handleDeleteCertId,
  handleDeleteParticipant,
  toast,
}: ParticipantRowProps): JSX.Element {
  return (
                        <tr
                          tabIndex={0}
                          className={`hover:bg-green-50/30 outline-none focus:bg-green-50/60 cursor-pointer ${focusedRowIndex === index ? "bg-green-50/60" : ""}`}
                          onClick={(e) => {
                            if (e.shiftKey && anchorRowIndex >= 0) {
                              const lo = Math.min(anchorRowIndex, index);
                              const hi = Math.max(anchorRowIndex, index);
                              setSelectedParticipants(sorted.slice(lo, hi + 1).map(p => p.id!).filter(Boolean));
                            } else {
                              setAnchorRowIndex(index);
                              const id = participant.id || "";
                              if (e.ctrlKey || e.metaKey) {
                                setSelectedParticipants(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                              }
                            }
                            setFocusedRowIndex(index);
                          }}
                          onFocus={() => setFocusedRowIndex(index)}
                        >
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedParticipants.includes(participant.id || "")}
                              onChange={(e) => {
                                e.stopPropagation();
                                const participantId = participant.id || "";
                                if (e.target.checked) {
                                  setSelectedParticipants([...selectedParticipants, participantId]);
                                } else {
                                  setSelectedParticipants(selectedParticipants.filter(id => id !== participantId));
                                }
                              }}
                              className="w-4 h-4 rounded border-green-300 text-brand-vivid-green focus:ring-brand-vivid-green"
                            />
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-400">{index + 1}</td>
                          <td className="px-4 py-4">
                            {(editingName === participant.id) ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={tempCertId}
                                  onChange={(e) => setTempCertId(e.target.value)}
                                  className="px-2 py-1 border border-green-200 rounded text-sm w-32 focus:outline-none focus:ring-2 focus:ring-brand-vivid-green"
                                  autoFocus
                                />
                                <button
                                  onClick={async () => {
                                    await fetch(`/api/participants/${participant.id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ name: tempCertId, databaseId: selectedDatabase?.id }),
                                    });
                                    setEditingName(null);
                                    setTempCertId("");
                                    fetchParticipants(selectedDatabase.id!);
                                  }}
                                  className="p-1 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  <span className="material-symbols-outlined text-sm">check</span>
                                </button>
                                <button
                                  onClick={() => { setEditingName(null); setTempCertId(""); }}
                                  className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                                >
                                  <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-brand-dark-green">{participant.name}</span>
                                <button
                                  onClick={() => { setEditingName(participant.id || null); setTempCertId(participant.name); }}
                                  className="p-1 hover:bg-green-100 text-brand-green rounded"
                                  title="Edit Name"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {(editingEmail === participant.id) ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="email"
                                  value={tempCertId}
                                  onChange={(e) => setTempCertId(e.target.value)}
                                  className="px-2 py-1 border border-green-200 rounded text-sm w-40 focus:outline-none focus:ring-2 focus:ring-brand-vivid-green"
                                  autoFocus
                                />
                                <button
                                  onClick={async () => {
                                    await fetch(`/api/participants/${participant.id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ email: tempCertId, databaseId: selectedDatabase?.id }),
                                    });
                                    setEditingEmail(null);
                                    setTempCertId("");
                                    fetchParticipants(selectedDatabase.id!);
                                  }}
                                  className="p-1 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  <span className="material-symbols-outlined text-sm">check</span>
                                </button>
                                <button
                                  onClick={() => { setEditingEmail(null); setTempCertId(""); }}
                                  className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                                >
                                  <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-on-surface-variant">{participant.email}</span>
                                <button
                                  onClick={() => { setEditingEmail(participant.id || null); setTempCertId(participant.email); }}
                                  className="p-1 hover:bg-green-100 text-brand-green rounded"
                                  title="Edit Email"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {editingCertId === participant.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={tempCertId}
                                  onChange={(e) => setTempCertId(e.target.value)}
                                  placeholder="Enter Certificate ID"
                                  className="px-2 py-1 border border-green-200 rounded text-xs font-mono w-40 focus:outline-none focus:ring-2 focus:ring-brand-vivid-green"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveCertId(participant)}
                                  className="p-1 bg-green-600 text-white rounded hover:bg-green-700"
                                  title="Save"
                                >
                                  <span className="material-symbols-outlined text-sm">check</span>
                                </button>
                                <button
                                  onClick={() => { setEditingCertId(null); setTempCertId(""); }}
                                  className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                                  title="Cancel"
                                >
                                  <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-xs ${participant.certificateId ? "text-brand-grass-green" : "text-gray-400"}`}>
                                  {participant.certificateId || "Not assigned"}
                                </span>
                                <button
                                  onClick={() => { setEditingCertId(participant.id || null); setTempCertId(participant.certificateId || ""); }}
                                  className="p-1 hover:bg-green-100 text-brand-green rounded"
                                  title="Edit Certificate ID"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {participant.driveLink ? (
                              <div className="flex items-center gap-2">
                                <a
                                  href={participant.driveLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1 w-fit"
                                >
                                  {participant.name}.pdf
                                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                                </a>
                                <div className="relative">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === `pdf-a-${participant.id}` ? null : `pdf-a-${participant.id}`); }}
                                    className="p-1 hover:bg-green-100 text-brand-green rounded"
                                  >
                                    <span className="material-symbols-outlined text-sm">more_vert</span>
                                  </button>
                                  {openDropdown === `pdf-a-${participant.id}` && (
                                    <div className="absolute right-0 top-full bg-white border border-green-200 rounded-lg shadow-lg z-20 min-w-[130px]">
                                      <button
                                        onClick={() => { setOpenDropdown(null); handleDeletePdfOnly(participant); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 text-gray-700"
                                      >
                                        Delete PDF Only
                                      </button>
                                      <button
                                        onClick={() => { setOpenDropdown(null); handleDeleteCertificate(participant); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600"
                                      >
                                        Delete Both
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : participant.certificateId && participant.certificateUrl ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      const response = await fetch('/api/certificates/view', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          name: participant.name,
                                          certificateId: participant.certificateId,
                                          databaseId: selectedDatabase?.id,
                                        })
                                      });
                                      if (!response.ok) throw new Error('Failed to generate');
                                      const blob = await response.blob();
                                      const url = URL.createObjectURL(blob);
                                      window.open(url, '_blank');
                                    } catch (err) {
                                      toast.error('Failed to view certificate. Please regenerate.');
                                      sfx.error();
                                    }
                                  }}
                                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1"
                                >
                                  {participant.name}.pdf
                                  <span className="material-symbols-outlined text-xs">visibility</span>
                                </button>
                                <div className="relative">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === `pdf-b-${participant.id}` ? null : `pdf-b-${participant.id}`); }}
                                    className="p-1 hover:bg-green-100 text-brand-green rounded"
                                  >
                                    <span className="material-symbols-outlined text-sm">more_vert</span>
                                  </button>
                                  {openDropdown === `pdf-b-${participant.id}` && (
                                    <div className="absolute right-0 top-full bg-white border border-green-200 rounded-lg shadow-lg z-20 min-w-[130px]">
                                      <button
                                        onClick={() => { setOpenDropdown(null); handleDeleteCertId(participant); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 text-gray-700"
                                      >
                                        Delete ID Only
                                      </button>
                                      <button
                                        onClick={() => { setOpenDropdown(null); handleDeletePdfOnly(participant); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 text-gray-700"
                                      >
                                        Delete PDF Only
                                      </button>
                                      <button
                                        onClick={() => { setOpenDropdown(null); handleDeleteCertificate(participant); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600"
                                      >
                                        Delete Both
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Not generated</span>
                            )}
                          </td>
                          {/* Generation Status */}
                          <td className="px-4 py-4">
                            {(participant.driveLink || participant.certificateUrl) ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                <span className="text-xs font-medium">Generated</span>
                              </div>
                            ) : participant.certificateId ? (
                              <div className="flex items-center gap-1 text-blue-500">
                                <span className="material-symbols-outlined text-sm">tag</span>
                                <span className="text-xs font-medium">ID Only</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gray-400">
                                <span className="material-symbols-outlined text-sm">cancel</span>
                                <span className="text-xs font-medium">Not Generated</span>
                              </div>
                            )}
                          </td>
                          {/* Issuance Status */}
                          <td className="px-4 py-4">
                            <select
                              value={(participant as any).status || (participant.certificateId ? "generated" : "pending")}
                              onChange={async (e) => {
                                await fetch(`/api/participants/${participant.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: e.target.value, databaseId: selectedDatabase?.id }),
                                });
                                fetchParticipants(selectedDatabase.id!);
                              }}
                              className="text-xs px-2 py-1 border border-green-200 rounded bg-white"
                            >
                              <option value="pending">Pending</option>
                              <option value="generated">Generated</option>
                              <option value="issued">Issued</option>
                            </select>
                          </td>
                          {/* Emailed */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                            <button
                              onClick={async () => {
                                const newEmailSent = !(participant as any).emailSent;
                                await fetch(`/api/participants/${participant.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    emailSent: newEmailSent,
                                    status: newEmailSent ? "issued" : ((participant as any).status || "pending"),
                                    databaseId: selectedDatabase?.id
                                  }),
                                });
                                fetchParticipants(selectedDatabase.id!);
                              }}
                              className={`p-2 rounded-lg ${(participant as any).emailSent ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                              title={(participant as any).emailSent ? "Email sent" : "Email not sent"}
                            >
                              <span className="material-symbols-outlined text-lg">{(participant as any).emailSent ? "check_circle" : "cancel"}</span>
                            </button>
                            {(participant as any).emailError && !(participant as any).emailSent && (
                              <span
                                className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700"
                                title={(participant as any).emailError}
                              >
                                failed
                              </span>
                            )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleDeleteParticipant(participant)}
                                className="p-2 hover:bg-red-50 text-error rounded-lg"
                                title="Delete participant"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
  );
}
