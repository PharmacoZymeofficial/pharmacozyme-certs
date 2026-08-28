"use client";

import CertificateGenerator from "@/components/CertificateGenerator";
import { sfx } from "@/lib/sfx";
import IdFormatModal from "@/components/admin/databases/modals/IdFormatModal";
import ExportModal from "@/components/admin/databases/modals/ExportModal";
import AddParticipantModal from "@/components/admin/databases/modals/AddParticipantModal";
import ImportModal from "@/components/admin/databases/modals/ImportModal";
import CreateDatabaseModal from "@/components/admin/databases/modals/CreateDatabaseModal";
import BulkTargetModal from "@/components/admin/databases/modals/BulkTargetModal";
import EmailModal from "@/components/admin/databases/modals/EmailModal";
import { useDatabaseManager } from "@/components/admin/databases/useDatabaseManager";

export default function DatabaseManager() {
  const m = useDatabaseManager();
  const {
    databases,
    participants,
    isCreating,
    selectedDatabase,
    isLoading,
    fetchedOnce,
    showCreateModal,
    showParticipantModal,
    showImportModal,
    showEmailModal,
    showGeneratorModal,
    newDatabase,
    newParticipant,
    bulkParticipants,
    importFile,
    importPreview,
    isImporting,
    emailSubject,
    emailMessage,
    isSending,
    sendProgress,
    emailStats,
    scheduleMode,
    scheduledAt,
    selectedSenderIndex,
    editingCertId,
    editingName,
    editingEmail,
    tempCertId,
    isGeneratingIds,
    selectedParticipants,
    showExportModal,
    sortBy,
    sortOrder,
    participantSearch,
    isRefreshing,
    openDropdown,
    showBulkTargetModal,
    bulkTargetAction,
    isDeletingDatabase,
    isSyncingSheet,
    isFindingFolder,
    isBulkDeleting,
    bulkDeleteLabel,
    isAddingParticipant,
    showIdFormatModal,
    renamingDbId,
    renameValue,
    filterStatus,
    filterEmailed,
    focusedRowIndex,
    anchorRowIndex,
    idFormat,
    idFormatCode,
    idFormatCategoryNo,
    idFormatCustomizeSubCat,
    idFormatAppSubCat,
    idFormatCustomPrefix,
    history,
    historyIndex,
    linkSheet,
    sheetOption,
    existingSheetId,
    existingSheetTabs,
    selectedSheetTab,
    subDatabases,
    isLoadingTabs,
    tabFetchError,
    showSheetModal,
    setDatabases,
    setParticipants,
    setIsCreating,
    setSelectedDatabase,
    setIsLoading,
    setFetchedOnce,
    setShowCreateModal,
    setShowParticipantModal,
    setShowImportModal,
    setShowEmailModal,
    setShowGeneratorModal,
    setNewDatabase,
    setNewParticipant,
    setBulkParticipants,
    setImportFile,
    setImportPreview,
    setIsImporting,
    setEmailSubject,
    setEmailMessage,
    setIsSending,
    setSendProgress,
    setEmailStats,
    setScheduleMode,
    setScheduledAt,
    setSelectedSenderIndex,
    setEditingCertId,
    setEditingName,
    setEditingEmail,
    setTempCertId,
    setIsGeneratingIds,
    setSelectedParticipants,
    setShowExportModal,
    setSortBy,
    setSortOrder,
    setParticipantSearch,
    setIsRefreshing,
    setOpenDropdown,
    setShowBulkTargetModal,
    setBulkTargetAction,
    setIsDeletingDatabase,
    setIsSyncingSheet,
    setIsFindingFolder,
    setIsBulkDeleting,
    setBulkDeleteLabel,
    setIsAddingParticipant,
    setShowIdFormatModal,
    setRenamingDbId,
    setRenameValue,
    setFilterStatus,
    setFilterEmailed,
    setFocusedRowIndex,
    setAnchorRowIndex,
    setIdFormat,
    setIdFormatCode,
    setIdFormatCategoryNo,
    setIdFormatCustomizeSubCat,
    setIdFormatAppSubCat,
    setIdFormatCustomPrefix,
    setHistory,
    setHistoryIndex,
    setLinkSheet,
    setSheetOption,
    setExistingSheetId,
    setExistingSheetTabs,
    setSelectedSheetTab,
    setSubDatabases,
    setIsLoadingTabs,
    setTabFetchError,
    setShowSheetModal,
    canUndo,
    canRedo,
    displayedRowsRef,
    toast,
    confirm,
    saveToHistory,
    undo,
    redo,
    fetchDatabases,
    fetchParticipants,
    handleCreateDatabase,
    handleToggleLive,
    handleRenameDatabase,
    extractSheetIdFromUrl,
    fetchSheetTabs,
    handleAddParticipant,
    handleBulkImport,
    handleSendEmails,
    openEmailModal,
    handleScheduleEmails,
    handleDeleteParticipant,
    handleDeleteDatabase,
    handleSyncFromSheet,
    handlePushToSheet,
    handleFindDriveFolder,
    handleGenerateIds,
    handleConfirmGenerateIds,
    handleSaveCertId,
    handleDeleteCertificate,
    handleDeleteCertId,
    handleDeletePdfOnly,
  } = m;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
        {/* Animated top progress bar */}
        <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden">
          <div
            className="h-full bg-brand-vivid-green"
            style={{ animation: "loadingBar 1.4s ease-in-out infinite" }}
          />
        </div>
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-10 bg-green-100 rounded-xl w-1/3" />
            <div className="h-10 bg-green-100 rounded-xl w-24 ml-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-green-50 rounded-xl border border-green-100">
                <div className="p-6 space-y-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl" />
                  <div className="h-4 bg-green-100 rounded w-3/4" />
                  <div className="h-3 bg-green-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes loadingBar {
            0%   { width: 0%;   margin-left: 0;    }
            50%  { width: 60%;  margin-left: 20%;  }
            100% { width: 0%;   margin-left: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12" onClick={() => setOpenDropdown(null)}>
      {/* Global loading overlay for important actions */}
      {isDeletingDatabase && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
            <span className="material-symbols-outlined text-5xl text-red-500 animate-spin">progress_activity</span>
            <p className="font-bold text-brand-dark-green text-lg">Deleting Database...</p>
            <p className="text-sm text-on-surface-variant text-center">Removing all participants and Drive files. Please wait.</p>
          </div>
        </div>
      )}
      {isSending && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
            <span className="material-symbols-outlined text-5xl text-brand-vivid-green animate-spin">progress_activity</span>
            <p className="font-bold text-brand-dark-green text-lg">Sending Emails...</p>
            <p className="text-sm text-on-surface-variant text-center">This may take a moment for large batches.</p>
          </div>
        </div>
      )}
      {isGeneratingIds && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
            <span className="material-symbols-outlined text-5xl text-blue-500 animate-spin">progress_activity</span>
            <p className="font-bold text-brand-dark-green text-lg">Generating IDs...</p>
            <p className="text-sm text-on-surface-variant text-center">Assigning certificate IDs to participants.</p>
          </div>
        </div>
      )}
      {isImporting && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
            <span className="material-symbols-outlined text-5xl text-purple-500 animate-spin">progress_activity</span>
            <p className="font-bold text-brand-dark-green text-lg">Importing Participants...</p>
            <p className="text-sm text-on-surface-variant text-center">Processing your file data.</p>
          </div>
        </div>
      )}
      {isBulkDeleting && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
            <span className="material-symbols-outlined text-5xl text-red-500 animate-spin">progress_activity</span>
            <p className="font-bold text-brand-dark-green text-lg">{bulkDeleteLabel}...</p>
            <p className="text-sm text-on-surface-variant text-center">Please wait while we process all selected participants.</p>
          </div>
        </div>
      )}

      {/* ID Format Choice Modal */}
      <IdFormatModal
        open={showIdFormatModal}
        onClose={() => setShowIdFormatModal(false)}
        idFormat={idFormat} setIdFormat={setIdFormat}
        idFormatCode={idFormatCode} setIdFormatCode={setIdFormatCode}
        idFormatCategoryNo={idFormatCategoryNo} setIdFormatCategoryNo={setIdFormatCategoryNo}
        idFormatCustomizeSubCat={idFormatCustomizeSubCat} setIdFormatCustomizeSubCat={setIdFormatCustomizeSubCat}
        idFormatAppSubCat={idFormatAppSubCat} setIdFormatAppSubCat={setIdFormatAppSubCat}
        idFormatCustomPrefix={idFormatCustomPrefix} setIdFormatCustomPrefix={setIdFormatCustomPrefix}
        onConfirm={handleConfirmGenerateIds}
        selectedDatabase={selectedDatabase}
        participants={participants}
      />
      {isCreating && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
            <span className="material-symbols-outlined text-5xl text-brand-vivid-green animate-spin">progress_activity</span>
            <p className="font-bold text-brand-dark-green text-lg">Creating Database...</p>
            <p className="text-sm text-on-surface-variant text-center">Setting up your new database. Please wait.</p>
          </div>
        </div>
      )}
      {isSyncingSheet && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm mx-4">
            <span className="material-symbols-outlined text-5xl text-emerald-500 animate-spin">progress_activity</span>
            <p className="font-bold text-brand-dark-green text-lg">Syncing from Sheet...</p>
            <p className="text-sm text-on-surface-variant text-center">Fetching latest data from Google Sheets.</p>
          </div>
        </div>
      )}
      {/* Quiet refresh bar */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden">
          <div className="h-full bg-brand-vivid-green animate-pulse" style={{ animation: "loadingBar 1.2s ease-in-out infinite" }} />
        </div>
      )}
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
            Database Management
          </h2>
          <p className="text-on-surface-variant text-sm sm:text-base">
            Create databases, add participants, generate certificates, and send emails
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          Create Database
        </button>
      </header>

      {/* Breadcrumb — only when a database is open */}
      {selectedDatabase && (
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
      )}

      {/* Database Cards — hidden when a database is open */}
      {!selectedDatabase && (
        databases.length === 0 ? (
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
        )
      )}

      {/* Selected Database Detail View */}
      {selectedDatabase && (
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
                  {selectedParticipants.length > 0 && (
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
                  )}
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
                              displayedRowsRef.current.length > 0 &&
                              displayedRowsRef.current.every(p => selectedParticipants.includes(p.id || ""))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const visibleIds = displayedRowsRef.current.map(p => p.id || "").filter(Boolean);
                                setSelectedParticipants(prev => Array.from(new Set([...prev, ...visibleIds])));
                              } else {
                                const visibleIds = new Set(displayedRowsRef.current.map(p => p.id || ""));
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
                        const rows = displayedRowsRef.current;
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
                      {(() => {
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
                        displayedRowsRef.current = sorted;
                        return sorted.map((participant, index) => (
                        <tr
                          key={participant.id || index}
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
                      ));
                    })()}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Database Modal */}
      <CreateDatabaseModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        newDatabase={newDatabase}
        setNewDatabase={setNewDatabase}
        isCreating={isCreating}
        onCreate={handleCreateDatabase}
        linkSheet={linkSheet}
        setLinkSheet={setLinkSheet}
        sheetOption={sheetOption}
        setSheetOption={setSheetOption}
        subDatabases={subDatabases}
        setSubDatabases={setSubDatabases}
        existingSheetId={existingSheetId}
        setExistingSheetId={setExistingSheetId}
        existingSheetTabs={existingSheetTabs}
        setExistingSheetTabs={setExistingSheetTabs}
        selectedSheetTab={selectedSheetTab}
        setSelectedSheetTab={setSelectedSheetTab}
        isLoadingTabs={isLoadingTabs}
        tabFetchError={tabFetchError}
        setTabFetchError={setTabFetchError}
        extractSheetIdFromUrl={extractSheetIdFromUrl}
        fetchSheetTabs={fetchSheetTabs}
      />

      {/* Add Participant Modal */}
      <AddParticipantModal
        open={showParticipantModal}
        onClose={() => setShowParticipantModal(false)}
        newParticipant={newParticipant}
        setNewParticipant={setNewParticipant}
        isAddingParticipant={isAddingParticipant}
        onAddSingle={handleAddParticipant}
        selectedDatabase={selectedDatabase}
      />

      {/* Import Modal */}
      <ImportModal
        open={showImportModal}
        onClose={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); setBulkParticipants(""); }}
        importFile={importFile}
        setImportFile={setImportFile}
        importPreview={importPreview}
        setImportPreview={setImportPreview}
        isImporting={isImporting}
        bulkParticipants={bulkParticipants}
        setBulkParticipants={setBulkParticipants}
        toast={toast}
        onConfirmImport={handleBulkImport}
      />

      {/* Certificate Generator Modal */}
      {showGeneratorModal && selectedDatabase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b border-green-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-headline font-bold text-brand-dark-green">Certificate Generator</h3>
                <p className="text-sm text-on-surface-variant">
                  {selectedParticipants.length > 0 
                    ? `Generate certificates for ${selectedParticipants.length} selected participant${selectedParticipants.length !== 1 ? "s" : ""}`
                    : `Generate certificates for all ${participants.length} participants`}
                </p>
              </div>
              <button onClick={() => setShowGeneratorModal(false)} className="p-2 hover:bg-green-50 rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6">
              <CertificateGenerator
                database={selectedDatabase}
                participants={selectedParticipants.length > 0 
                  ? participants.filter(p => selectedParticipants.includes(p.id || ""))
                  : participants}
                onGenerated={() => {
                  saveToHistory(participants);
                  if (selectedDatabase?.id) fetchParticipants(selectedDatabase.id!);
                  const targetCount = selectedParticipants.length > 0 ? selectedParticipants.length : participants.length;
                  fetch("/api/activity-logs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "cert_generated",
                      databaseId: selectedDatabase?.id,
                      databaseName: selectedDatabase?.name,
                      count: targetCount,
                      details: `Generated PDFs for ${targetCount} participant${targetCount !== 1 ? "s" : ""}`,
                    }),
                  }).catch(() => {});
                }}
              />
            </div>
            <div className="p-6 border-t border-green-50 flex justify-end">
              <button onClick={() => setShowGeneratorModal(false)} className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Target Modal — "Generate for All" vs "Generate for Selected" */}
      <BulkTargetModal
        open={showBulkTargetModal}
        action={bulkTargetAction}
        selectedCount={selectedParticipants.length}
        totalCount={participants.length}
        onChoose={(target) => {
          if (target === "all") setSelectedParticipants([]);
          setShowBulkTargetModal(false);
          if (bulkTargetAction === "generate") setShowGeneratorModal(true);
          else openEmailModal();
        }}
        onClose={() => setShowBulkTargetModal(false)}
      />

      {/* Email Modal */}
      <EmailModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        emailSubject={emailSubject}
        setEmailSubject={setEmailSubject}
        emailMessage={emailMessage}
        setEmailMessage={setEmailMessage}
        isSending={isSending}
        sendProgress={sendProgress}
        emailStats={emailStats}
        scheduleMode={scheduleMode}
        setScheduleMode={setScheduleMode}
        scheduledAt={scheduledAt}
        setScheduledAt={setScheduledAt}
        selectedSenderIndex={selectedSenderIndex}
        setSelectedSenderIndex={setSelectedSenderIndex}
        onSend={handleSendEmails}
        onSchedule={handleScheduleEmails}
        selectedCount={selectedParticipants.length}
        totalCount={participants.length}
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        participants={participants}
        selectedParticipants={selectedParticipants}
        selectedDatabase={selectedDatabase}
        toast={toast}
      />
    </div>
  );
}
