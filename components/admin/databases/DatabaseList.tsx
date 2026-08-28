"use client";

import type { JSX, MouseEvent } from "react";
import { Database } from "@/lib/types";

interface DatabaseListProps {
  databases: Database[];
  setShowCreateModal: (v: boolean) => void;
  setSelectedDatabase: (db: Database | null) => void;
  setFilterStatus: (v: "all" | "pending" | "id-only" | "generated" | "missing-drive") => void;
  setFilterEmailed: (v: "all" | "yes" | "no") => void;
  setSortBy: (v: "name" | "email" | "certId" | "date" | "status" | "sheet") => void;
  setSortOrder: (v: "asc" | "desc") => void;
  renamingDbId: string | null;
  setRenamingDbId: (v: string | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  handleRenameDatabase: (dbId: string, newName: string) => void;
  handleDeleteDatabase: (db: Database) => void;
  handleToggleLive: (db: Database, e: MouseEvent) => void;
}

export default function DatabaseList({
  databases,
  setShowCreateModal,
  setSelectedDatabase,
  setFilterStatus,
  setFilterEmailed,
  setSortBy,
  setSortOrder,
  renamingDbId,
  setRenamingDbId,
  renameValue,
  setRenameValue,
  handleRenameDatabase,
  handleDeleteDatabase,
  handleToggleLive,
}: DatabaseListProps): JSX.Element {
  return (
    <>
      {databases.length === 0 ? (
        <div className="bg-white rounded-xl border border-green-100 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">database</span>
          <h3 className="text-xl font-headline font-bold text-brand-dark-green mb-2">No Databases Yet</h3>
          <p className="text-on-surface-variant mb-6">Create your first database to start issuing certificates</p>
          <button onClick={() => setShowCreateModal(true)} className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold">
            Create First Database
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {databases.map((db) => (
            <div
              key={db.id}
              onClick={() => { setSelectedDatabase(db); setFilterStatus("all"); setFilterEmailed("all"); setSortBy("sheet"); setSortOrder("asc"); }}
              className="bg-white rounded-xl border-2 border-green-100 hover:border-brand-vivid-green/60 hover:shadow-md p-6 cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-brand-green text-2xl">folder</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-2 py-1 bg-green-100 text-brand-green text-xs font-bold rounded-full uppercase">
                    {db.category}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingDbId(db.id || null);
                      setRenameValue(db.name);
                    }}
                    className="p-1.5 hover:bg-green-50 text-gray-400 hover:text-brand-green rounded-lg transition-colors"
                    title="Rename database"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteDatabase(db); }}
                    className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Delete database"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
              {renamingDbId === db.id ? (
                <div className="flex items-center gap-2 mb-1" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleRenameDatabase(db.id!, renameValue); if (e.key === "Escape") setRenamingDbId(null); }}
                    autoFocus
                    className="flex-1 px-2 py-1 border border-green-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-vivid-green"
                  />
                  <button onClick={() => handleRenameDatabase(db.id!, renameValue)} className="p-1 bg-green-600 text-white rounded">
                    <span className="material-symbols-outlined text-sm">check</span>
                  </button>
                  <button onClick={() => setRenamingDbId(null)} className="p-1 bg-gray-200 text-gray-600 rounded">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ) : (
                <h3 className="text-lg font-headline font-bold text-brand-dark-green mb-1">{db.name}</h3>
              )}
              <p className="text-sm text-on-surface-variant mb-4">{db.subCategory} • {db.topic}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm">people</span>
                  {(db as any).participantCount || 0} participants
                </div>
                <span className="text-xs text-on-surface-variant">
                  {db.createdAt ? new Date(db.createdAt).toLocaleDateString() : ""}
                </span>
              </div>
              {(db as any).linkedSheet && (
                <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 font-medium">
                  <span className="material-symbols-outlined text-sm">table_chart</span>
                  Linked to Google Sheets
                </div>
              )}
              {(db as any).driveFolderId && (
                <a href={`https://drive.google.com/drive/folders/${(db as any).driveFolderId}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 mt-1 text-xs text-blue-600 font-medium hover:underline">
                  <span className="material-symbols-outlined text-sm">folder_open</span>
                  Drive Folder
                  <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                </a>
              )}
              {/* Live toggle */}
              <div className="mt-3 pt-3 border-t border-green-50" onClick={e => e.stopPropagation()}>
                <div
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: db.isLive
                      ? "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(6,95,70,0.07))"
                      : "rgba(156,163,175,0.06)",
                    border: db.isLive ? "1px solid rgba(16,185,129,0.22)" : "1px solid rgba(156,163,175,0.1)",
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Pulsing status dot */}
                    <div className="relative flex-shrink-0 w-2.5 h-2.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          background: db.isLive ? "#10b981" : "#9ca3af",
                          boxShadow: db.isLive ? "0 0 0 3px rgba(16,185,129,0.18)" : "none",
                        }}
                      />
                      {db.isLive && (
                        <div
                          className="absolute inset-0 rounded-full animate-ping"
                          style={{ background: "rgba(16,185,129,0.35)" }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${db.isLive ? "text-emerald-700" : "text-gray-500"}`}>
                        {db.isLive ? "Live on Verify Page" : "Hidden from Verify"}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {db.isLive ? "Visible to public" : "Tap to publish"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleToggleLive(db, e)}
                    title={db.isLive ? "Hide from Verify page" : "Publish to Verify page"}
                    className="relative flex-shrink-0 w-12 h-6 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all"
                    style={{
                      background: db.isLive ? "linear-gradient(135deg,#10b981,#059669)" : "#e5e7eb",
                      boxShadow: db.isLive ? "0 2px 10px rgba(16,185,129,0.45)" : "none",
                    }}
                    role="switch"
                    aria-checked={!!db.isLive}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform"
                      style={{ transform: db.isLive ? "translateX(26px)" : "translateX(2px)" }}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
