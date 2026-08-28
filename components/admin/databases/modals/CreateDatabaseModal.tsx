"use client";

import type { JSX } from "react";
import { categoryStructure } from "@/components/admin/databases/constants";

interface CreateDatabaseModalProps {
  open: boolean;
  onClose: () => void;
  newDatabase: { name: string; category: "General" | "Official"; subCategory: string; topic: string; description: string };
  setNewDatabase: (v: CreateDatabaseModalProps["newDatabase"]) => void;
  isCreating: boolean;
  onCreate: () => void;
  // Google Sheet linking state (owned by parent, threaded here)
  linkSheet: boolean;
  setLinkSheet: (v: boolean) => void;
  sheetOption: "new" | "existing";
  setSheetOption: (v: "new" | "existing") => void;
  subDatabases: string[];
  setSubDatabases: (v: string[]) => void;
  existingSheetId: string;
  setExistingSheetId: (v: string) => void;
  existingSheetTabs: string[];
  setExistingSheetTabs: (v: string[]) => void;
  selectedSheetTab: string;
  setSelectedSheetTab: (v: string) => void;
  isLoadingTabs: boolean;
  tabFetchError: boolean;
  setTabFetchError: (v: boolean) => void;
  extractSheetIdFromUrl: (input: string) => string;
  fetchSheetTabs: (sheetId: string) => void;
}

export default function CreateDatabaseModal({
  open,
  onClose,
  newDatabase,
  setNewDatabase,
  isCreating,
  onCreate,
  linkSheet,
  setLinkSheet,
  sheetOption,
  setSheetOption,
  subDatabases,
  setSubDatabases,
  existingSheetId,
  setExistingSheetId,
  existingSheetTabs,
  setExistingSheetTabs,
  selectedSheetTab,
  setSelectedSheetTab,
  isLoadingTabs,
  tabFetchError,
  setTabFetchError,
  extractSheetIdFromUrl,
  fetchSheetTabs,
}: CreateDatabaseModalProps): JSX.Element | null {
  if (!open) return null;

  const subCategories = categoryStructure[newDatabase.category as keyof typeof categoryStructure] || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto my-8">
        <div className="p-6 border-b border-green-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">Create New Database</h3>
            <p className="text-sm text-on-surface-variant">Set up category, subcategory, and topic</p>
          </div>
          <button onClick={() => onClose()} className="p-2 hover:bg-green-50 rounded-lg">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Database Name *</label>
            <input
              type="text"
              value={newDatabase.name}
              onChange={(e) => setNewDatabase({ ...newDatabase, name: e.target.value })}
              placeholder="e.g., Summer 2024 Batch"
              className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Category *</label>
              <select
                value={newDatabase.category}
                disabled
                className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none opacity-70 cursor-not-allowed"
              >
                <option value="General">General</option>
                <option value="Official">Official</option>
              </select>
              <p className="text-xs text-on-surface-variant mt-1">Set by the active tab.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Sub-Category *</label>
              <select
                value={newDatabase.subCategory}
                onChange={(e) => setNewDatabase({ ...newDatabase, subCategory: e.target.value })}
                className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
              >
                {Object.keys(subCategories).map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Topic *</label>
            <input
              type="text"
              value={newDatabase.topic}
              onChange={(e) => setNewDatabase({ ...newDatabase, topic: e.target.value })}
              placeholder="e.g., Dr Mehwish Webinar, PPC Module 1"
              className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
            />
          </div>

          {/* Google Sheets Linking */}
          <div className="border-t border-green-100 pt-4">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-xs font-bold text-brand-grass-green uppercase">
                Link Google Sheet
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkSheet}
                  onChange={(e) => setLinkSheet(e.target.checked)}
                  className="w-4 h-4 accent-brand-vivid-green"
                />
                <span className="text-sm text-on-surface-variant">Enable</span>
              </label>
            </div>

            {linkSheet && (
              <div className="space-y-4 bg-green-50/50 p-4 rounded-xl">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sheetOption"
                      checked={sheetOption === "new"}
                      onChange={() => setSheetOption("new")}
                      className="accent-brand-vivid-green"
                    />
                    <span className="text-sm">Create New Sheet</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sheetOption"
                      checked={sheetOption === "existing"}
                      onChange={() => setSheetOption("existing")}
                      className="accent-brand-vivid-green"
                    />
                    <span className="text-sm">Link Existing</span>
                  </label>
                </div>

                {sheetOption === "new" ? (
                  <div>
                    <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">
                      Sub-Databases (comma-separated tabs)
                    </label>
                    <input
                      type="text"
                      value={subDatabases.join(", ")}
                      onChange={(e) => setSubDatabases(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                      placeholder="e.g., M1, M2, M3, M4, Complete Course"
                      className="w-full bg-white border border-green-100 rounded-xl p-3 text-sm outline-none"
                    />
                    <p className="text-xs text-on-surface-variant mt-1">
                      Leave empty for single "Participants" tab
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">
                        Google Sheet URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={existingSheetId}
                          onChange={(e) => {
                            const extracted = extractSheetIdFromUrl(e.target.value);
                            setExistingSheetId(extracted);
                            setTabFetchError(false);
                            setExistingSheetTabs([]);
                            setSelectedSheetTab("");
                            if (extracted.length > 20) fetchSheetTabs(extracted);
                          }}
                          placeholder="Paste Google Sheet URL or ID"
                          className="flex-1 bg-white border border-green-100 rounded-xl p-3 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => existingSheetId && fetchSheetTabs(existingSheetId)}
                          disabled={!existingSheetId || isLoadingTabs}
                          className="px-3 py-2 bg-brand-vivid-green text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                        >
                          <span className={`material-symbols-outlined text-sm ${isLoadingTabs ? "animate-spin" : ""}`}>
                            {isLoadingTabs ? "progress_activity" : "refresh"}
                          </span>
                          {isLoadingTabs ? "Loading..." : "Fetch Tabs"}
                        </button>
                      </div>
                    </div>
                    {tabFetchError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">error</span>
                        Could not load tabs. Check the Sheet ID and try again.
                      </p>
                    )}
                    {existingSheetTabs.length > 0 && (
                      <div>
                        <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">
                          Select Tab
                        </label>
                        <select
                          value={selectedSheetTab}
                          onChange={(e) => setSelectedSheetTab(e.target.value)}
                          className="w-full bg-white border border-green-100 rounded-xl p-3 text-sm outline-none"
                        >
                          {existingSheetTabs.map((tab) => (
                            <option key={tab} value={tab}>{tab}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {isLoadingTabs && (
                      <p className="text-xs text-on-surface-variant">Loading tabs...</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-green-50 flex justify-end gap-3">
          <button onClick={() => onClose()} className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl">
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={isCreating}
            className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                Creating...
              </>
            ) : "Create Database"}
          </button>
        </div>
      </div>
    </div>
  );
}
