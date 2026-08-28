"use client";

import type { Dispatch, SetStateAction, JSX } from "react";
import { useMemo } from "react";
import { Database, Participant } from "@/lib/types";
import type { useToast } from "@/components/Toast";
import type { useConfirm } from "@/components/ConfirmModal";
import BulkActionsBar from "@/components/admin/databases/BulkActionsBar";
import ParticipantRow from "@/components/admin/databases/ParticipantRow";

interface ParticipantTableProps {
  participants: Participant[];
  setShowParticipantModal: Dispatch<SetStateAction<boolean>>;
  setShowImportModal: Dispatch<SetStateAction<boolean>>;
  handleGenerateIds: () => void;
  isGeneratingIds: boolean;
  setBulkTargetAction: Dispatch<SetStateAction<"generate" | "send" | null>>;
  setShowBulkTargetModal: Dispatch<SetStateAction<boolean>>;
  selectedParticipants: string[];
  setShowExportModal: Dispatch<SetStateAction<boolean>>;
  participantSearch: string;
  setParticipantSearch: Dispatch<SetStateAction<string>>;
  sortBy: "name" | "email" | "certId" | "date" | "status" | "sheet";
  setSortBy: Dispatch<SetStateAction<"name" | "email" | "certId" | "date" | "status" | "sheet">>;
  sortOrder: "asc" | "desc";
  setSortOrder: Dispatch<SetStateAction<"asc" | "desc">>;
  undo: () => void;
  canUndo: boolean;
  redo: () => void;
  canRedo: boolean;
  openDropdown: string | null;
  setOpenDropdown: Dispatch<SetStateAction<string | null>>;
  setShowGeneratorModal: Dispatch<SetStateAction<boolean>>;
  openEmailModal: () => void;
  confirm: ReturnType<typeof useConfirm>;
  setBulkDeleteLabel: Dispatch<SetStateAction<string>>;
  setIsBulkDeleting: Dispatch<SetStateAction<boolean>>;
  selectedDatabase: Database;
  toast: ReturnType<typeof useToast>;
  setSelectedParticipants: Dispatch<SetStateAction<string[]>>;
  fetchParticipants: (databaseId: string) => void;
  setFilterStatus: Dispatch<SetStateAction<"all" | "pending" | "id-only" | "generated" | "missing-drive">>;
  filterStatus: "all" | "pending" | "id-only" | "generated" | "missing-drive";
  setFilterEmailed: Dispatch<SetStateAction<"all" | "yes" | "no">>;
  filterEmailed: "all" | "yes" | "no";
  focusedRowIndex: number;
  anchorRowIndex: number;
  setFocusedRowIndex: Dispatch<SetStateAction<number>>;
  setAnchorRowIndex: Dispatch<SetStateAction<number>>;
  editingName: string | null;
  setEditingName: Dispatch<SetStateAction<string | null>>;
  editingEmail: string | null;
  setEditingEmail: Dispatch<SetStateAction<string | null>>;
  editingCertId: string | null;
  setEditingCertId: Dispatch<SetStateAction<string | null>>;
  tempCertId: string;
  setTempCertId: Dispatch<SetStateAction<string>>;
  handleSaveCertId: (participant: Participant) => void;
  handleDeletePdfOnly: (participant: Participant) => void;
  handleDeleteCertificate: (participant: Participant) => void;
  handleDeleteCertId: (participant: Participant) => void;
  handleDeleteParticipant: (participant: Participant) => void;
}

export default function ParticipantTable({
  participants,
  setShowParticipantModal,
  setShowImportModal,
  handleGenerateIds,
  isGeneratingIds,
  setBulkTargetAction,
  setShowBulkTargetModal,
  selectedParticipants,
  setShowExportModal,
  participantSearch,
  setParticipantSearch,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  undo,
  canUndo,
  redo,
  canRedo,
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
  setFilterStatus,
  filterStatus,
  setFilterEmailed,
  filterEmailed,
  focusedRowIndex,
  anchorRowIndex,
  setFocusedRowIndex,
  setAnchorRowIndex,
  editingName,
  setEditingName,
  editingEmail,
  setEditingEmail,
  editingCertId,
  setEditingCertId,
  tempCertId,
  setTempCertId,
  handleSaveCertId,
  handleDeletePdfOnly,
  handleDeleteCertificate,
  handleDeleteCertId,
  handleDeleteParticipant,
}: ParticipantTableProps): JSX.Element {
  const sorted = useMemo(() => {
    const q = participantSearch.toLowerCase();
    let filtered = q
      ? participants.filter(p =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.email || "").toLowerCase().includes(q) ||
          (p.certificateId || "").toLowerCase().includes(q)
        )
      : [...participants];
    if (filterStatus !== "all") {
      filtered = filtered.filter(p => {
        if (filterStatus === "pending") return !p.certificateId;
        if (filterStatus === "id-only") return p.certificateId && !p.driveLink && !p.certificateUrl;
        if (filterStatus === "generated") return !!(p.driveLink || p.certificateUrl);
        if (filterStatus === "missing-drive") return !!p.certificateId && !p.driveLink;
        return true;
      });
    }
    if (filterEmailed !== "all") {
      filtered = filtered.filter(p =>
        filterEmailed === "yes" ? (p as any).emailSent : !(p as any).emailSent
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      let aVal = "", bVal = "";
      if (sortBy === "sheet") {
        // Preserve import order: sort by createdAt ascending always
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      } else if (sortBy === "certId") {
        // Empty certId goes to end (not top) in ascending order
        if (!a.certificateId && !b.certificateId) return 0;
        if (!a.certificateId) return sortOrder === "asc" ? 1 : -1;
        if (!b.certificateId) return sortOrder === "asc" ? -1 : 1;
        const aNum = parseInt(a.certificateId.split("-").pop() || "0");
        const bNum = parseInt(b.certificateId.split("-").pop() || "0");
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      } else if (sortBy === "name") {
        aVal = a.name || "";
        bVal = b.name || "";
      } else if (sortBy === "email") {
        aVal = a.email || "";
        bVal = b.email || "";
      } else if (sortBy === "status") {
        aVal = a.certificateId ? "generated" : "pending";
        bVal = b.certificateId ? "generated" : "pending";
      } else if (sortBy === "date") {
        return sortOrder === "asc"
          ? (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
          : (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      }
      return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return sorted;
  }, [participants, participantSearch, filterStatus, filterEmailed, sortBy, sortOrder]);

  return (
    <>
          {/* Participants Table */}
          <div className="p-6">
            {participants.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-5xl text-gray-300 mb-4 block">person_off</span>
                <p className="text-on-surface-variant mb-4">No participants added yet</p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowParticipantModal(true)}
                    className="px-4 py-2 bg-brand-vivid-green text-white rounded-xl text-sm font-medium"
                  >
                    Add Single Participant
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 border border-green-200 text-brand-grass-green rounded-xl text-sm font-medium"
                  >
                    Import from CSV
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Sticky toolbar: actions + search + sort + filters */}
                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm -mx-6 px-6 pt-3 pb-3 border-b border-green-100 mb-4">
                {/* Actions */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <button
                    onClick={handleGenerateIds}
                    disabled={isGeneratingIds || participants.filter(p => !p.certificateId).length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                    title="Generate certificate IDs for participants without IDs"
                  >
                    <span className="material-symbols-outlined">{isGeneratingIds ? "progress_activity" : "tag"}</span>
                    Generate IDs ({participants.filter(p => !p.certificateId).length})
                  </button>
                  <button
                    onClick={() => {
                      setBulkTargetAction("generate");
                      setShowBulkTargetModal(true);
                    }}
                    disabled={participants.length === 0}
                    className="px-4 py-2 vivid-gradient-cta text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">auto_awesome</span>
                    Generate PDFs ({selectedParticipants.length > 0 ? selectedParticipants.length : participants.length})
                  </button>
                  <button
                    onClick={() => {
                      setBulkTargetAction("send");
                      setShowBulkTargetModal(true);
                    }}
                    disabled={participants.length === 0}
                    className="px-4 py-2 bg-white border border-green-200 text-brand-grass-green rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">send</span>
                    Send Emails
                  </button>
                  <button
                    onClick={() => setShowExportModal(true)}
                    disabled={participants.length === 0}
                    className="px-4 py-2 bg-white border border-green-200 text-brand-grass-green rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">download</span>
                    Export
                  </button>
                </div>

                {/* Search */}
                <div className="mb-2">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                    <input
                      type="text"
                      placeholder="Search by name, email, or certificate ID…"
                      value={participantSearch}
                      onChange={e => setParticipantSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-green-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/40"
                    />
                    {participantSearch && (
                      <button onClick={() => setParticipantSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-brand-dark-green">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sorting */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-on-surface-variant font-medium">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-white border border-green-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-vivid-green"
                    >
                      <option value="sheet">Sheet Order</option>
                      <option value="certId">Certificate ID</option>
                      <option value="name">Name</option>
                      <option value="email">Email</option>
                      <option value="status">Generation Status</option>
                      <option value="date">Date Added</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      className="px-3 py-1.5 bg-white border border-green-200 rounded-lg text-sm flex items-center gap-1 hover:bg-green-50"
                    >
                      <span className="material-symbols-outlined text-sm">{sortOrder === "asc" ? "arrow_upward" : "arrow_downward"}</span>
                      {sortOrder === "asc" ? "Ascending" : "Descending"}
                    </button>
                    <button
                      onClick={undo}
                      className="px-3 py-1.5 border rounded-lg text-sm flex items-center gap-1 bg-gray-50 border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canUndo}
                      title="Undo"
                    >
                      <span className="material-symbols-outlined text-sm">undo</span>
                      Undo
                    </button>
                    <button
                      onClick={redo}
                      className="px-3 py-1.5 border rounded-lg text-sm flex items-center gap-1 bg-gray-50 border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canRedo}
                      title="Redo"
                    >
                      <span className="material-symbols-outlined text-sm">redo</span>
                      Redo
                    </button>
                  </div>

                  {/* Bulk Actions */}
                  <BulkActionsBar
                    selectedParticipants={selectedParticipants}
                    participants={participants}
                    openDropdown={openDropdown}
                    setOpenDropdown={setOpenDropdown}
                    setShowGeneratorModal={setShowGeneratorModal}
                    openEmailModal={openEmailModal}
                    confirm={confirm}
                    setBulkDeleteLabel={setBulkDeleteLabel}
                    setIsBulkDeleting={setIsBulkDeleting}
                    selectedDatabase={selectedDatabase}
                    toast={toast}
                    setSelectedParticipants={setSelectedParticipants}
                    fetchParticipants={fetchParticipants}
                  />
                </div>

                {/* Filter chips */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-xs font-semibold text-on-surface-variant">Filter:</span>
                  {(["all", "pending", "id-only", "generated", "missing-drive"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filterStatus === s ? "bg-brand-vivid-green text-white border-brand-vivid-green" : "bg-white border-green-200 text-on-surface-variant hover:bg-green-50"}`}
                    >
                      {s === "all" ? "All" : s === "pending" ? "No ID" : s === "id-only" ? "ID Only" : s === "generated" ? "Generated" : "Missing Drive Link"}
                    </button>
                  ))}
                  <div className="w-px h-4 bg-green-200 mx-1" />
                  {(["all", "yes", "no"] as const).map(s => (
                    <button
                      key={`em-${s}`}
                      onClick={() => setFilterEmailed(s)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${filterEmailed === s ? "bg-blue-600 text-white border-blue-600" : "bg-white border-green-200 text-on-surface-variant hover:bg-blue-50"}`}
                    >
                      {s === "all" ? "All Emails" : s === "yes" ? "✉ Emailed" : "✉ Not Emailed"}
                    </button>
                  ))}
                  {(filterStatus !== "all" || filterEmailed !== "all") && (
                    <button onClick={() => { setFilterStatus("all"); setFilterEmailed("all"); }} className="px-2 py-1 rounded-full text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-sm">close</span> Clear
                    </button>
                  )}
                </div>
                </div>{/* end sticky toolbar */}

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-green-50/50 text-brand-grass-green uppercase text-[10px] tracking-widest font-bold">
                        <th className="px-4 py-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              sorted.length > 0 &&
                              sorted.every(p => selectedParticipants.includes(p.id || ""))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const visibleIds = sorted.map(p => p.id || "").filter(Boolean);
                                setSelectedParticipants(prev => Array.from(new Set([...prev, ...visibleIds])));
                              } else {
                                const visibleIds = new Set(sorted.map(p => p.id || ""));
                                setSelectedParticipants(prev => prev.filter(id => !visibleIds.has(id)));
                              }
                            }}
                            className="w-4 h-4 rounded border-green-300 text-brand-vivid-green focus:ring-brand-vivid-green"
                          />
                        </th>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Certificate ID</th>
                        <th className="px-4 py-3">PDF</th>
                        <th className="px-4 py-3">Generation Status</th>
                        <th className="px-4 py-3">Issuance Status</th>
                        <th className="px-4 py-3">Emailed</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody
                      className="divide-y divide-green-50 outline-none"
                      tabIndex={-1}
                      onKeyDown={(e) => {
                        const rows = sorted;
                        if (!rows.length) return;
                        const cur = focusedRowIndex;
                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                          e.preventDefault();
                          const next = e.key === "ArrowDown"
                            ? Math.min(cur + 1, rows.length - 1)
                            : Math.max(cur - 1, 0);
                          if (e.shiftKey) {
                            const anchor = anchorRowIndex < 0 ? (cur < 0 ? 0 : cur) : anchorRowIndex;
                            const lo = Math.min(anchor, next);
                            const hi = Math.max(anchor, next);
                            setSelectedParticipants(rows.slice(lo, hi + 1).map(p => p.id!).filter(Boolean));
                          } else {
                            setAnchorRowIndex(next);
                            setSelectedParticipants(rows[next]?.id ? [rows[next].id!] : []);
                          }
                          setFocusedRowIndex(next);
                          (e.currentTarget.querySelectorAll("tr")[next] as HTMLElement)?.focus();
                        }
                        if (e.key === " ") {
                          e.preventDefault();
                          if (cur >= 0 && rows[cur]?.id) {
                            const id = rows[cur].id!;
                            setSelectedParticipants(prev =>
                              prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                            );
                          }
                        }
                        if (e.key === "Escape") setSelectedParticipants([]);
                      }}
                    >
                      {sorted.map((participant, index) => (
                          <ParticipantRow
                            key={participant.id || index}
                            participant={participant}
                            index={index}
                            sorted={sorted}
                            focusedRowIndex={focusedRowIndex}
                            anchorRowIndex={anchorRowIndex}
                            setFocusedRowIndex={setFocusedRowIndex}
                            setAnchorRowIndex={setAnchorRowIndex}
                            selectedParticipants={selectedParticipants}
                            setSelectedParticipants={setSelectedParticipants}
                            editingName={editingName}
                            setEditingName={setEditingName}
                            editingEmail={editingEmail}
                            setEditingEmail={setEditingEmail}
                            editingCertId={editingCertId}
                            setEditingCertId={setEditingCertId}
                            tempCertId={tempCertId}
                            setTempCertId={setTempCertId}
                            selectedDatabase={selectedDatabase}
                            fetchParticipants={fetchParticipants}
                            handleSaveCertId={handleSaveCertId}
                            openDropdown={openDropdown}
                            setOpenDropdown={setOpenDropdown}
                            handleDeletePdfOnly={handleDeletePdfOnly}
                            handleDeleteCertificate={handleDeleteCertificate}
                            handleDeleteCertId={handleDeleteCertId}
                            handleDeleteParticipant={handleDeleteParticipant}
                            toast={toast}
                          />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
    </>
  );
}
