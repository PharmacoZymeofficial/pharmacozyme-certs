"use client";

import CertificateGenerator from "@/components/CertificateGenerator";
import IdFormatModal from "@/components/admin/databases/modals/IdFormatModal";
import ExportModal from "@/components/admin/databases/modals/ExportModal";
import AddParticipantModal from "@/components/admin/databases/modals/AddParticipantModal";
import ImportModal from "@/components/admin/databases/modals/ImportModal";
import CreateDatabaseModal from "@/components/admin/databases/modals/CreateDatabaseModal";
import BulkTargetModal from "@/components/admin/databases/modals/BulkTargetModal";
import EmailModal from "@/components/admin/databases/modals/EmailModal";
import DatabaseList from "@/components/admin/databases/DatabaseList";
import DatabaseDetail from "@/components/admin/databases/DatabaseDetail";
import ParticipantTable from "@/components/admin/databases/ParticipantTable";
import { useDatabaseManager } from "@/components/admin/databases/useDatabaseManager";
import { useEffect } from "react";
import type { Database } from "@/lib/types";

export default function DatabaseManager({
  category,
  onDatabasesLoaded,
}: {
  category: "General" | "Official";
  onDatabasesLoaded?: (list: Database[]) => void;
}) {
  const {
    databases,
    allDatabases,
    participants,
    isCreating,
    selectedDatabase,
    isLoading,
    fetchedOnce,
    generatorResumeMode,
    generationSummary,
    generationJobStatus,
    showResumeBanner,
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
    emailResult,
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
    linkSheet,
    sheetOption,
    existingSheetId,
    existingSheetTabs,
    selectedSheetTab,
    subDatabases,
    isLoadingTabs,
    tabFetchError,
    setSelectedDatabase,
    setShowCreateModal,
    setShowParticipantModal,
    setShowImportModal,
    setShowEmailModal,
    setShowGeneratorModal,
    setGeneratorResumeMode,
    setNewDatabase,
    setNewParticipant,
    setBulkParticipants,
    setImportFile,
    setImportPreview,
    setEmailSubject,
    setEmailMessage,
    setScheduleMode,
    setScheduledAt,
    setSelectedSenderIndex,
    setEditingCertId,
    setEditingName,
    setEditingEmail,
    setTempCertId,
    setSelectedParticipants,
    setShowExportModal,
    setSortBy,
    setSortOrder,
    setParticipantSearch,
    setOpenDropdown,
    setShowBulkTargetModal,
    setBulkTargetAction,
    setIsBulkDeleting,
    setBulkDeleteLabel,
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
    setLinkSheet,
    setSheetOption,
    setExistingSheetId,
    setExistingSheetTabs,
    setSelectedSheetTab,
    setSubDatabases,
    setTabFetchError,
    canUndo,
    canRedo,
    toast,
    confirm,
    saveToHistory,
    undo,
    redo,
    fetchParticipants,
    handleCreateDatabase,
    handleToggleLive,
    handleRenameDatabase,
    extractSheetIdFromUrl,
    fetchSheetTabs,
    handleAddParticipant,
    handleBulkImport,
    handleSendEmails,
    retryFailed,
    openEmailModal,
    handleScheduleEmails,
    handleDeleteParticipant,
    handleDeleteDatabase,
    handleSyncFromSheet,
    handlePushToSheet,
    handleFindDriveFolder,
    fixFolderSharing,
    handleConsolidateFolders,
    refreshGenerationJob,
    resumeGeneration,
    resumeDatabase,
    dismissResumeBanner,
    handleGenerateIds,
    handleConfirmGenerateIds,
    handleSaveCertId,
    handleDeleteCertificate,
    handleDeleteCertId,
    handleDeletePdfOnly,
  } = useDatabaseManager(category);

  useEffect(() => {
    if (fetchedOnce) onDatabasesLoaded?.(allDatabases);
  }, [fetchedOnce, allDatabases, onDatabasesLoaded]);

  if (isLoading) {
    return (
      <div>
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
    <div onClick={() => setOpenDropdown(null)}>
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
          onResumeDatabase={resumeDatabase}
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
          showResumeBanner={showResumeBanner}
          resumeBannerStatus={generationJobStatus}
          generationSummary={generationSummary}
          onResumeGeneration={resumeGeneration}
          onDismissResumeBanner={dismissResumeBanner}
          onFixFolderSharing={fixFolderSharing}
          onConsolidateFolders={handleConsolidateFolders}
        >
          <ParticipantTable
            participants={participants}
            setShowParticipantModal={setShowParticipantModal}
            setShowImportModal={setShowImportModal}
            handleGenerateIds={handleGenerateIds}
            isGeneratingIds={isGeneratingIds}
            setBulkTargetAction={setBulkTargetAction}
            setShowBulkTargetModal={setShowBulkTargetModal}
            selectedParticipants={selectedParticipants}
            setShowExportModal={setShowExportModal}
            participantSearch={participantSearch}
            setParticipantSearch={setParticipantSearch}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            undo={undo}
            canUndo={canUndo}
            redo={redo}
            canRedo={canRedo}
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
            setFilterStatus={setFilterStatus}
            filterStatus={filterStatus}
            setFilterEmailed={setFilterEmailed}
            filterEmailed={filterEmailed}
            focusedRowIndex={focusedRowIndex}
            anchorRowIndex={anchorRowIndex}
            setFocusedRowIndex={setFocusedRowIndex}
            setAnchorRowIndex={setAnchorRowIndex}
            editingName={editingName}
            setEditingName={setEditingName}
            editingEmail={editingEmail}
            setEditingEmail={setEditingEmail}
            editingCertId={editingCertId}
            setEditingCertId={setEditingCertId}
            tempCertId={tempCertId}
            setTempCertId={setTempCertId}
            handleSaveCertId={handleSaveCertId}
            handleDeletePdfOnly={handleDeletePdfOnly}
            handleDeleteCertificate={handleDeleteCertificate}
            handleDeleteCertId={handleDeleteCertId}
            handleDeleteParticipant={handleDeleteParticipant}
          />
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
              <button onClick={() => { setShowGeneratorModal(false); setGeneratorResumeMode(false); }} className="p-2 hover:bg-green-50 rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6">
              <CertificateGenerator
                database={selectedDatabase}
                resumeMode={generatorResumeMode}
                participants={selectedParticipants.length > 0
                  ? participants.filter(p => selectedParticipants.includes(p.id || ""))
                  : participants}
                onGenerated={() => {
                  saveToHistory(participants);
                  setGeneratorResumeMode(false);
                  refreshGenerationJob();
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
              <button onClick={() => { setShowGeneratorModal(false); setGeneratorResumeMode(false); }} className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl">
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
        emailResult={emailResult}
        onRetryFailed={retryFailed}
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
