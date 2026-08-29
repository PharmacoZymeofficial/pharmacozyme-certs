"use client";

import type { JSX, ReactNode } from "react";
import { Database } from "@/lib/types";
import type { GenerationJob } from "@/lib/types";
import type { useToast } from "@/components/Toast";
import GenerationResumeBanner from "@/components/admin/databases/GenerationResumeBanner";

interface DatabaseDetailProps {
  selectedDatabase: Database;
  setSelectedDatabase: (db: Database | null) => void;
  renamingDbId: string | null;
  setRenamingDbId: (v: string | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  handleRenameDatabase: (dbId: string, newName: string) => void;
  handleSyncFromSheet: () => void;
  handlePushToSheet: () => void;
  isSyncingSheet: boolean;
  handleFindDriveFolder: () => void;
  isFindingFolder: boolean;
  toast: ReturnType<typeof useToast>;
  setShowParticipantModal: (v: boolean) => void;
  setShowImportModal: (v: boolean) => void;
  generationJob?: GenerationJob | null;
  onResumeGeneration?: () => void;
  onDiscardGeneration?: () => void;
  onFixFolderSharing?: () => void;
  children: ReactNode;
}

export default function DatabaseDetail({
  selectedDatabase,
  setSelectedDatabase,
  renamingDbId,
  setRenamingDbId,
  renameValue,
  setRenameValue,
  handleRenameDatabase,
  handleSyncFromSheet,
  handlePushToSheet,
  isSyncingSheet,
  handleFindDriveFolder,
  isFindingFolder,
  toast,
  setShowParticipantModal,
  setShowImportModal,
  generationJob,
  onResumeGeneration,
  onDiscardGeneration,
  onFixFolderSharing,
  children,
}: DatabaseDetailProps): JSX.Element {
  return (
    <>
          <nav className="flex items-center gap-3 mb-6 -mt-2">
            <button
              onClick={() => setSelectedDatabase(null)}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-dark-green text-white rounded-xl text-sm font-bold shadow hover:bg-brand-green transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              All Databases
            </button>
            <span className="text-on-surface-variant text-sm">/</span>
            <span className="text-brand-dark-green font-semibold text-sm truncate max-w-xs">{selectedDatabase.name}</span>
          </nav>

      <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-clip">
            {/* Database Header */}
            <div className="p-6 border-b border-green-50 bg-green-50/30">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  {/* DB name + rename */}
                  <div className="flex items-center gap-2 mb-0.5">
                    {renamingDbId === selectedDatabase.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleRenameDatabase(selectedDatabase.id!, renameValue); if (e.key === "Escape") setRenamingDbId(null); }}
                          autoFocus
                          className="px-3 py-1 border border-green-300 rounded-lg text-xl font-headline font-bold text-brand-dark-green focus:outline-none focus:ring-2 focus:ring-brand-vivid-green"
                        />
                        <button onClick={() => handleRenameDatabase(selectedDatabase.id!, renameValue)} className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">
                          <span className="material-symbols-outlined text-sm">check</span>
                        </button>
                        <button onClick={() => setRenamingDbId(null)} className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-2xl font-headline font-bold text-brand-dark-green">{selectedDatabase.name}</h3>
                        <button
                          onClick={() => { setRenamingDbId(selectedDatabase.id || null); setRenameValue(selectedDatabase.name); }}
                          className="p-1.5 hover:bg-green-100 text-gray-400 hover:text-brand-green rounded-lg transition-colors"
                          title="Rename"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-on-surface-variant mb-3">
                    {selectedDatabase.category} • {selectedDatabase.subCategory} • {selectedDatabase.topic}
                  </p>
  
                  {/* Tool groups */}
                  <div className="flex flex-wrap gap-3">
                    {/* Sheets group */}
                    {selectedDatabase.linkedSheet && selectedDatabase.sheetId && (
                      <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-1">
                        <span className="material-symbols-outlined text-sm text-emerald-600 mr-1">table_chart</span>
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${selectedDatabase.sheetId}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 px-2 py-1 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          Open <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                        </a>
                        <div className="w-px h-4 bg-emerald-200" />
                        <button onClick={handleSyncFromSheet} disabled={isSyncingSheet} className="text-xs font-semibold text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">download</span>Refresh
                        </button>
                        <div className="w-px h-4 bg-emerald-200" />
                        <button onClick={handlePushToSheet} disabled={isSyncingSheet} className="text-xs font-semibold text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">upload</span>Push
                        </button>
                      </div>
                    )}
  
                    {/* Drive group */}
                    <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-xl px-2 py-1">
                      <span className="material-symbols-outlined text-sm text-blue-600 mr-1">folder_open</span>
                      {selectedDatabase.driveFolderId ? (
                        <>
                          <a
                            href={`https://drive.google.com/drive/folders/${selectedDatabase.driveFolderId}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-0.5 px-2 py-1 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            Open <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                          </a>
                          <div className="w-px h-4 bg-blue-200" />
                          <button
                            onClick={() => { navigator.clipboard.writeText(`https://drive.google.com/drive/folders/${selectedDatabase.driveFolderId}`); toast.success("Link copied!"); }}
                            className="text-xs font-semibold text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">content_copy</span>Copy
                          </button>
                          <div className="w-px h-4 bg-blue-200" />
                          <button onClick={handleFindDriveFolder} disabled={isFindingFolder} className="text-xs font-semibold text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                            <span className={`material-symbols-outlined text-sm ${isFindingFolder ? "animate-spin" : ""}`}>{isFindingFolder ? "progress_activity" : "sync"}</span>
                            {isFindingFolder ? "Updating…" : "Update"}
                          </button>
                          {onFixFolderSharing && (
                            <>
                              <div className="w-px h-4 bg-blue-200" />
                              <button
                                onClick={onFixFolderSharing}
                                className="text-xs font-semibold text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-sm">public</span>Fix sharing
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <button onClick={handleFindDriveFolder} disabled={isFindingFolder} className="text-xs font-semibold text-blue-700 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                          <span className={`material-symbols-outlined text-sm ${isFindingFolder ? "animate-spin" : ""}`}>{isFindingFolder ? "progress_activity" : "add_link"}</span>
                          {isFindingFolder ? "Finding…" : "Link Drive Folder"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
  
                {/* Right: primary actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => setShowParticipantModal(true)}
                    className="px-4 py-2 vivid-gradient-cta text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                  >
                    <span className="material-symbols-outlined">person_add</span>
                    Add Participant
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 bg-white border border-green-200 text-brand-grass-green rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-green-50 transition-colors"
                  >
                    <span className="material-symbols-outlined">upload</span>
                    Import CSV
                  </button>
                </div>
              </div>
            </div>

        {generationJob && onResumeGeneration && onDiscardGeneration && (
          <div className="px-6 pt-4">
            <GenerationResumeBanner
              job={generationJob}
              onResume={onResumeGeneration}
              onDiscard={onDiscardGeneration}
            />
          </div>
        )}

        {children}
      </div>
    </>
  );
}
