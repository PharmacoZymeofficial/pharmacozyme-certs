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
import DatabaseList from "@/components/admin/databases/DatabaseList";
import DatabaseDetail from "@/components/admin/databases/DatabaseDetail";
import BulkActionsBar from "@/components/admin/databases/BulkActionsBar";
import ParticipantRow from "@/components/admin/databases/ParticipantRow";
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

      {/* Database Cards — hidden when a database is open */}
      {!selectedDatabase && (
        <DatabaseList
          databases={databases}
          setShowCreateModal={setShowCreateModal}
          setSelectedDatabase={setSelectedDatabase}
          setFilterStatus={setFilterStatus}
          setFilterEmailed={setFilterEmailed}
          setSortBy={setSortBy}
          setSortOrder={setSortOrder}
          renamingDbId={renamingDbId}
          setRenamingDbId={setRenamingDbId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          handleRenameDatabase={handleRenameDatabase}
          handleDeleteDatabase={handleDeleteDatabase}
          handleToggleLive={handleToggleLive}
        />
      )}

      {/* Selected Database Detail View */}
      {selectedDatabase && (
        <DatabaseDetail
          selectedDatabase={selectedDatabase}
          setSelectedDatabase={setSelectedDatabase}
          renamingDbId={renamingDbId}
          setRenamingDbId={setRenamingDbId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          handleRenameDatabase={handleRenameDatabase}
          handleSyncFromSheet={handleSyncFromSheet}
          handlePushToSheet={handlePushToSheet}
          isSyncingSheet={isSyncingSheet}
          handleFindDriveFolder={handleFindDriveFolder}
          isFindingFolder={isFindingFolder}
          toast={toast}
          setShowParticipantModal={setShowParticipantModal}
          setShowImportModal={setShowImportModal}
        >
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
                      ));
                    })()}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </DatabaseDetail>
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
