"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Database, Participant } from "@/lib/types";
import type { GenerationJob } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { sfx } from "@/lib/sfx";
import { tallyEmailOutcomes } from "@/lib/emailOutcome";
import { SENDER_IDENTITIES, subCategoryShortMap, categoryStructure } from "@/components/admin/databases/constants";
import { resolveDriveFileId } from "@/lib/driveIds";
import { deriveGenerationSummary, jobEffectiveStatus } from "@/lib/generationState";

export function useDatabaseManager(category: "General" | "Official") {
  const toast = useToast();
  const confirm = useConfirm();

  const [allDatabases, setAllDatabases] = useState<Database[]>([]);
  // The manager is scoped to a single category (driven by the active tab).
  const databases = allDatabases.filter((d) => d.category === category);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchedOnce, setFetchedOnce] = useState(false);
  const [generationJob, setGenerationJob] = useState<GenerationJob | null>(null);
  const [generatorResumeMode, setGeneratorResumeMode] = useState(false);
  const [resumeBannerDismissed, setResumeBannerDismissed] = useState(false);
  // Guards the generation-job fetch against a cross-database race: opening DB A
  // then quickly DB B must not let A's slower response overwrite B's job state.
  const jobFetchSeq = useRef(0);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  
  // Form states
  const [newDatabase, setNewDatabase] = useState({
    name: "",
    category: category as "General" | "Official",
    subCategory: Object.keys(categoryStructure[category])[0],
    topic: "",
    description: "",
  });
  
  const [newParticipant, setNewParticipant] = useState({
    name: "",
    email: "",
  });
  
  const [bulkParticipants, setBulkParticipants] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{name: string; email: string; certificateId?: string; issueDate?: string; status?: string; customFields?: Record<string, string>}[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [emailSubject, setEmailSubject] = useState("Your Certificate from PharmacoZyme");
  const [emailMessage, setEmailMessage] = useState("Dear [Name],\n\nCongratulations! Your certificate is now ready.\n\nYou can verify your certificate at: [VerificationLink]\n\nBest regards,\nPharmacoZyme Team");
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [emailResult, setEmailResult] = useState<{ sent: number; failed: number; queued: number; failures: { email: string; name: string; error: string }[] } | null>(null);
  const [emailStats, setEmailStats] = useState<{
    sent: number; limit: number; remaining: number; source: string;
    accounts?: Record<string, { sent: number; limit: number; remaining: number; label: string; email: string }>;
  }>({ sent: 0, limit: 100, remaining: 100, source: "local" });
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedSenderIndex, setSelectedSenderIndex] = useState(0);
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [tempCertId, setTempCertId] = useState("");
  const [isGeneratingIds, setIsGeneratingIds] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "email" | "certId" | "date" | "status" | "sheet">("sheet");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [participantSearch, setParticipantSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showBulkTargetModal, setShowBulkTargetModal] = useState(false);
  const [bulkTargetAction, setBulkTargetAction] = useState<"generate" | "send" | null>(null);
  const [isDeletingDatabase, setIsDeletingDatabase] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [isFindingFolder, setIsFindingFolder] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteLabel, setBulkDeleteLabel] = useState("");
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [showIdFormatModal, setShowIdFormatModal] = useState(false);
  const [renamingDbId, setRenamingDbId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "id-only" | "generated" | "missing-drive">("all");
  const [filterEmailed, setFilterEmailed] = useState<"all" | "yes" | "no">("all");
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);
  const [anchorRowIndex, setAnchorRowIndex] = useState(-1);
  const [idFormat, setIdFormat] = useState<"app" | "name" | "custom">("app");
  const [idFormatCode, setIdFormatCode] = useState("");
  const [idFormatCategoryNo, setIdFormatCategoryNo] = useState("");
  const [idFormatCustomizeSubCat, setIdFormatCustomizeSubCat] = useState(false);
  const [idFormatAppSubCat, setIdFormatAppSubCat] = useState("");
  const [idFormatCustomPrefix, setIdFormatCustomPrefix] = useState("");
  
  // Undo/Redo history
  const [history, setHistory] = useState<Participant[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const saveToHistory = (participants: Participant[]) => {
    const snapshot = participants.map(p => ({ ...p }));
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = async () => {
    if (!canUndo || !selectedDatabase?.id) return;
    
    const prevIndex = historyIndex - 1;
    const prevParticipants = history[prevIndex];
    const currentParticipants = participants;
    
    // Find participants to delete (in current but not in previous)
    const prevIds = new Set(prevParticipants.map(p => p.id));
    const toDelete = currentParticipants.filter(p => p.id && !prevIds.has(p.id));
    
    // Find participants to add (in previous but not in current)
    const currentIds = new Set(currentParticipants.map(p => p.id));
    const toAdd = prevParticipants.filter(p => !p.id || !currentIds.has(p.id));
    
    // Find participants to update (exist in both)
    const toUpdate = prevParticipants.filter(p => p.id && prevIds.has(p.id));
    
    // Delete participants that were removed
    for (const p of toDelete) {
      if (p.id) {
        // keepPdf/keepCert: undo/redo reverses an edit by deleting then re-POSTing
        // the participant — it must not revoke the certificate or trash its PDF.
        await fetch(`/api/participants/${p.id}?databaseId=${selectedDatabase.id}&keepPdf=true&keepCert=true`, {
          method: "DELETE",
        });
      }
    }
    
    // Add participants that were added
    for (const p of toAdd) {
      await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseId: selectedDatabase.id,
          participants: [{
            name: p.name,
            email: p.email,
            certificateId: p.certificateId || "",
            certificateUrl: p.certificateUrl || "",
            driveLink: p.driveLink || "",
            driveFileId: p.driveFileId || "",
            status: p.status || "pending",
            emailSent: p.emailSent || false,
          }],
        }),
      });
    }
    
    // Update participants that exist in both
    for (const p of toUpdate) {
      if (p.id) {
        await fetch(`/api/participants/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: p.name,
            email: p.email,
            certificateId: p.certificateId || "",
            certificateUrl: p.certificateUrl || "",
            driveLink: p.driveLink || "",
            driveFileId: p.driveFileId || "",
            status: p.status || "pending",
            emailSent: p.emailSent || false,
            databaseId: selectedDatabase.id,
          }),
        });
      }
    }
    
    setHistoryIndex(prevIndex);
    fetchParticipants(selectedDatabase.id);
  };

  const redo = async () => {
    if (!canRedo || !selectedDatabase?.id) return;
    
    const nextIndex = historyIndex + 1;
    const nextParticipants = history[nextIndex];
    const currentParticipants = participants;
    
    // Find participants to delete (in current but not in next)
    const nextIds = new Set(nextParticipants.map(p => p.id));
    const toDelete = currentParticipants.filter(p => p.id && !nextIds.has(p.id));
    
    // Find participants to add (in next but not in current)
    const currentIds = new Set(currentParticipants.map(p => p.id));
    const toAdd = nextParticipants.filter(p => !p.id || !currentIds.has(p.id));
    
    // Find participants to update (exist in both)
    const toUpdate = nextParticipants.filter(p => p.id && nextIds.has(p.id));
    
    // Delete participants that were removed
    for (const p of toDelete) {
      if (p.id) {
        // keepPdf/keepCert: undo/redo reverses an edit by deleting then re-POSTing
        // the participant — it must not revoke the certificate or trash its PDF.
        await fetch(`/api/participants/${p.id}?databaseId=${selectedDatabase.id}&keepPdf=true&keepCert=true`, {
          method: "DELETE",
        });
      }
    }
    
    // Add participants that were added
    for (const p of toAdd) {
      await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseId: selectedDatabase.id,
          participants: [{
            name: p.name,
            email: p.email,
            certificateId: p.certificateId || "",
            certificateUrl: p.certificateUrl || "",
            driveLink: p.driveLink || "",
            driveFileId: p.driveFileId || "",
            status: p.status || "pending",
            emailSent: p.emailSent || false,
          }],
        }),
      });
    }
    
    // Update participants that exist in both
    for (const p of toUpdate) {
      if (p.id) {
        await fetch(`/api/participants/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: p.name,
            email: p.email,
            certificateId: p.certificateId || "",
            certificateUrl: p.certificateUrl || "",
            driveLink: p.driveLink || "",
            driveFileId: p.driveFileId || "",
            status: p.status || "pending",
            emailSent: p.emailSent || false,
            databaseId: selectedDatabase.id,
          }),
        });
      }
    }
    
    setHistoryIndex(nextIndex);
    fetchParticipants(selectedDatabase.id);
  };

  // Google Sheets linking states
  const [linkSheet, setLinkSheet] = useState(false);
  const [sheetOption, setSheetOption] = useState<"new" | "existing">("new");
  const [existingSheetId, setExistingSheetId] = useState("");
  const [existingSheetTabs, setExistingSheetTabs] = useState<string[]>([]);
  const [selectedSheetTab, setSelectedSheetTab] = useState("");
  const [subDatabases, setSubDatabases] = useState<string[]>([]);
  const [isLoadingTabs, setIsLoadingTabs] = useState(false);
  const [tabFetchError, setTabFetchError] = useState(false);

  const fetchDatabases = useCallback(async (quiet = false) => {
    try {
      if (quiet) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const response = await fetch("/api/databases");
      const data = await response.json();
      if (response.ok) {
        // Deduplicate by id
        const uniqueDatabases = (data.databases || []).filter((db: Database, index: number, self: Database[]) =>
          index === self.findIndex((d) => d.id === db.id)
        );
        setAllDatabases(uniqueDatabases);
        setFetchedOnce(true);
      }
    } catch (err) {
      console.error("Error fetching databases:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchParticipants = useCallback(async (databaseId: string) => {
    try {
      const response = await fetch(`/api/participants?databaseId=${databaseId}`);
      const data = await response.json();
      if (response.ok) {
        setParticipants(data.participants || []);
      }
    } catch (err) {
      console.error("Error fetching participants:", err);
    }
  }, []);

  useEffect(() => {
    if (!fetchedOnce) {
      fetchDatabases();
    }
  }, [fetchDatabases, fetchedOnce]);

  useEffect(() => {
    if (selectedDatabase?.id) {
      fetchParticipants(selectedDatabase.id!);
    }
  }, [selectedDatabase, fetchParticipants]);

  // Open a database only if it belongs to the active category. The list is
  // already filtered, so this is a defensive guard against stale references.
  const openDatabase = useCallback((db: Database | null) => {
    if (db && db.category !== category) return;
    const seq = ++jobFetchSeq.current;
    setSelectedDatabase(db);
    setGenerationJob(null);
    setResumeBannerDismissed(false);
    if (db?.id) {
      fetch(`/api/generation-jobs/${db.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (jobFetchSeq.current === seq) setGenerationJob(d?.job ?? null); })
        .catch(() => {});
    }
  }, [category]);

  // Tab switch mid-selection: drop the open database and reset filters so the
  // new category starts from a clean list view.
  useEffect(() => {
    setSelectedDatabase(null);
    setParticipants([]);
    setFilterStatus("all");
    setFilterEmailed("all");
    setParticipantSearch("");
    setSelectedParticipants([]);
    setGenerationJob(null);
    setResumeBannerDismissed(false);
    setGeneratorResumeMode(false);
  }, [category]);

  // When the create modal opens, force the new-database category to the active
  // tab (it is not user-editable) and reset its subcategory to a valid one.
  useEffect(() => {
    if (showCreateModal) {
      setNewDatabase((prev) => ({
        ...prev,
        category,
        subCategory: Object.keys(categoryStructure[category])[0],
      }));
    }
  }, [showCreateModal, category]);

  const handleCreateDatabase = async () => {
    if (!newDatabase.name || !newDatabase.topic) {
      toast.warning("Please fill in all required fields (name and topic)");
      sfx.error();
      return;
    }
    if (isCreating) return;
    setIsCreating(true);

    try {
      const payload: any = { ...newDatabase };

      if (linkSheet) {
        if (sheetOption === "new") {
          const createResponse = await fetch("/api/sheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "createSheet",
              databaseName: newDatabase.name,
              subDatabases: subDatabases.length > 0 ? subDatabases : ["Participants"],
            }),
          });

          const createData = await createResponse.json();
          if (!createResponse.ok || !createData.success) {
            toast.error(createData.error || "Failed to create Google Sheet");
            sfx.error();
            return;
          }

          payload.sheetId = createData.spreadsheetId;
          payload.sheetTabName = (subDatabases.length > 0 ? subDatabases[0] : "Participants");
        } else {
          if (!existingSheetId || !selectedSheetTab) {
            toast.warning("Please enter Sheet ID and select a tab");
            sfx.error();
            return;
          }
          payload.sheetId = existingSheetId;
          payload.sheetTabName = selectedSheetTab;
        }
      }

      const response = await fetch("/api/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShowCreateModal(false);
        setNewDatabase({ name: "", category, subCategory: Object.keys(categoryStructure[category])[0], topic: "", description: "" });
        setLinkSheet(false);
        setSubDatabases([]);
        setExistingSheetId("");
        setSelectedSheetTab("");
        sfx.success();
        toast.success("Database created successfully!");

        if (linkSheet && sheetOption === "existing" && data.id) {
          try {
            const syncRes = await fetch("/api/sheets/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ databaseId: data.id, mode: "sheetsToFirebase" }),
            });
            if (syncRes.ok) {
              fetchParticipants(data.id);
              toast.info("Sheet data imported automatically.");
            }
          } catch (syncErr) {
            console.error("Auto-sync failed after linking sheet:", syncErr);
          }
        }

        await fetchDatabases(true);
      } else {
        toast.error(data.error || "Failed to create database");
        sfx.error();
      }
    } catch (err) {
      console.error("Create database error:", err);
      toast.error("Error creating database. Check console for details.");
      sfx.error();
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleLive = async (db: Database, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !db.isLive;
    const response = await fetch("/api/databases", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: db.id, isLive: next }),
    });
    if (response.ok) {
      await fetchDatabases(true);
      sfx.success();
      toast.success(next ? "Database is now live on Verify page" : "Database hidden from Verify page");
    } else {
      toast.error("Failed to update live status");
    }
  };

  const handleRenameDatabase = async (dbId: string, newName: string) => {
    if (!newName.trim()) return;
    const response = await fetch("/api/databases", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dbId, name: newName.trim() }),
    });
    if (response.ok) {
      if (selectedDatabase?.id === dbId) setSelectedDatabase({ ...selectedDatabase, name: newName.trim() });
      await fetchDatabases(true);
      setRenamingDbId(null);
      setRenameValue("");
      sfx.success();
      toast.success("Database renamed");
    } else {
      toast.error("Failed to rename database");
    }
  };

  const extractSheetIdFromUrl = (input: string): string => {
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : input;
  };

  const fetchSheetTabs = async (sheetId: string) => {
    if (!sheetId) return;
    setIsLoadingTabs(true);
    setTabFetchError(false);
    setExistingSheetTabs([]);
    setSelectedSheetTab("");
    try {
      const response = await fetch(`/api/sheets?action=getTabs&spreadsheetId=${sheetId}`);
      const data = await response.json();
      if (data.success && data.tabs && data.tabs.length > 0) {
        setExistingSheetTabs(data.tabs);
        setSelectedSheetTab(data.tabs[0]);
      } else {
        setTabFetchError(true);
      }
    } catch (err) {
      console.error("Error fetching sheet tabs:", err);
      setTabFetchError(true);
    } finally {
      setIsLoadingTabs(false);
    }
  };

  const handleAddParticipant = async () => {
    if (!newParticipant.name || !newParticipant.email) {
      toast.warning("Please fill in name and email");
      sfx.error();
      return;
    }

    if (!selectedDatabase?.id) {
      toast.warning("Please select a database first by clicking on it");
      sfx.error();
      return;
    }

    setIsAddingParticipant(true);
    try {
      const response = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newParticipant.name,
          email: newParticipant.email,
          databaseId: selectedDatabase.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setNewParticipant({ name: "", email: "" });
        setShowParticipantModal(false);
        sfx.success();
        toast.success("Participant added!");
        if (selectedDatabase?.id) {
          fetchParticipants(selectedDatabase.id!);
          fetchDatabases();
        }
      } else {
        toast.error(data.error || "Failed to add participant");
        sfx.error();
      }
    } catch (err) {
      console.error("Add participant error:", err);
      toast.error("Error adding participant");
      sfx.error();
    } finally {
      setIsAddingParticipant(false);
    }
  };

  const handleBulkImport = async () => {
    if (!selectedDatabase) {
      toast.warning("No database selected");
      sfx.error();
      return;
    }

    let participantsToImport: {name: string; email: string; certificateId?: string; course?: string; issueDate?: string; status?: string}[] = [];

    // If we have a file, use it
    if (importFile) {
      participantsToImport = importPreview;
    } else if (bulkParticipants.trim()) {
      // Otherwise use pasted data
      const lines = bulkParticipants.split("\n").filter(line => line.trim());
      participantsToImport = lines.map(line => {
        const [name, email] = line.split(",").map(s => s.trim());
        return { name, email };
      }).filter(p => p.name && p.email);
    }

    if (participantsToImport.length === 0) {
      toast.warning("No valid participants found. Upload a file or paste data.");
      sfx.error();
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseId: selectedDatabase.id,
          participants: participantsToImport,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBulkParticipants("");
        setImportFile(null);
        setImportPreview([]);
        setShowImportModal(false);
        saveToHistory(participants);
        if (selectedDatabase?.id) {
          fetchParticipants(selectedDatabase.id!);
          fetchDatabases(); // Refresh to update participant count
        }
        sfx.import();
        toast.success(`Imported ${data.results?.success || participantsToImport.length} participants!`);
      } else {
        toast.error("Error importing participants");
        sfx.error();
      }
    } catch (err) {
      toast.error("Error importing participants");
      sfx.error();
    } finally {
      setIsImporting(false);
    }
  };

  const handleSendEmails = async (overrideRecipients?: Participant[]) => {
    const recipients = Array.isArray(overrideRecipients)
      ? overrideRecipients
      : (selectedParticipants.length > 0
          ? participants.filter(p => selectedParticipants.includes(p.id || ""))
          : participants);

    if (!selectedDatabase || recipients.length === 0) {
      toast.warning("No participants to send emails to");
      sfx.error();
      return;
    }

    setIsSending(true);
    setSendProgress({ current: 0, total: recipients.length });

    const sender = SENDER_IDENTITIES[selectedSenderIndex];
    const CHUNK_SIZE = 30;
    let totalSent = 0;
    let totalFailed = 0;
    // `unknown` = the chunk request itself failed (transport/HTTP), so some of its
    // recipients may already have been delivered. Those are counted as failed but
    // deliberately kept out of the one-click retry set.
    const outcomes: { email: string; name: string; id?: string; ok: boolean; queued?: boolean; unknown?: boolean; error?: string }[] = [];
    let queueErrorSeen: string | undefined;

    try {
      for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
        const chunk = recipients.slice(i, i + CHUNK_SIZE);
        const emailRecipients = chunk.map(p => ({
          email: p.email,
          name: p.name,
          certificateId: p.certificateId || "",
          verificationUrl: p.certificateUrl || "",
          driveLink: p.driveLink || "",
        }));

        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: emailRecipients,
            subject: emailSubject,
            message: emailMessage,
            senderName: sender.name,
            ...(sender.email ? { gmailEmail: sender.email } : {}),
          }),
        });

        let result: any = {};
        try { result = await response.json(); } catch { result = {}; }

        if (!response.ok) {
          // Don't abandon the remaining recipients — record this chunk and move on.
          // The request can fail (e.g. a 504) *after* part of the chunk was already
          // sent, so the status of these recipients is genuinely unknown and they
          // must not be offered to one-click retry (it would double-send).
          for (const p of chunk) {
            outcomes.push({
              email: p.email, name: p.name, id: p.id,
              ok: false, queued: false, unknown: true,
              error: "Send status unknown — verify before retrying",
            });
          }
          continue;
        }

        totalSent += result.sent || 0;
        totalFailed += result.failed || 0;

        // Per-recipient outcome mapping. A chunk recipient absent from both
        // `results` and `errors` was either auto-queued after a quota failure, or
        // dropped (blank/malformed address), or lost because auto-queueing itself
        // failed. `autoQueued` is a count, not a list, so index-capping against it
        // is the best attribution available — the queued set is a derivation, not
        // a server-provided list.
        const okEmails = new Set(((result.results || []) as { email: string; success: boolean }[]).filter(r => r.success).map(r => r.email));
        const errByEmail = new Map(((result.errors || []) as { email: string; error: string }[]).map(e => [e.email, e.error] as [string, string]));
        if (result.autoQueueError) queueErrorSeen = String(result.autoQueueError);
        const queueCapacity = (result.autoQueued && !result.autoQueueError) ? result.autoQueued : 0;
        let absentSeen = 0;

        for (const p of chunk) {
          if (okEmails.has(p.email)) {
            outcomes.push({ email: p.email, name: p.name, id: p.id, ok: true });
          } else if (errByEmail.has(p.email)) {
            outcomes.push({ email: p.email, name: p.name, id: p.id, ok: false, queued: false, error: errByEmail.get(p.email) });
          } else if (absentSeen++ < queueCapacity) {
            outcomes.push({ email: p.email, name: p.name, id: p.id, ok: false, queued: true });
          } else {
            outcomes.push({
              email: p.email, name: p.name, id: p.id, ok: false, queued: false,
              error: result.autoQueueError
                ? "Could not be queued for later delivery"
                : "No valid email address on file",
            });
          }
        }

        // Mark emailSent only for participants actually delivered; clear any
        // stale emailError on a successful re-send.
        const sentIds = chunk
          .filter(p => okEmails.has(p.email))
          .map(p => p.id!)
          .filter(Boolean);

        if (sentIds.length > 0) {
          await fetch("/api/participants/batch-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              databaseId: selectedDatabase.id,
              participantIds: sentIds,
              fields: { emailSent: true, emailError: "" },
              skipSheetSync: true,
            }),
          });
        }

        setSendProgress({ current: Math.min(i + CHUNK_SIZE, recipients.length), total: recipients.length });
      }

      // Persist emailError for the recipients that failed outright (not queued),
      // keeping the unknown-status ones distinguishable from confirmed failures.
      const failedIds = outcomes.filter(o => !o.ok && !o.queued && !o.unknown && o.id).map(o => o.id!);
      if (failedIds.length > 0 && selectedDatabase?.id) {
        await fetch("/api/participants/batch-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ databaseId: selectedDatabase.id, participantIds: failedIds, fields: { emailError: "Last send failed" }, skipSheetSync: true }),
        }).catch(() => {});
      }

      const unknownIds = outcomes.filter(o => o.unknown && o.id).map(o => o.id!);
      if (unknownIds.length > 0 && selectedDatabase?.id) {
        await fetch("/api/participants/batch-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ databaseId: selectedDatabase.id, participantIds: unknownIds, fields: { emailError: "Send status unknown" }, skipSheetSync: true }),
        }).catch(() => {});
      }

      // Final sheet sync once after all chunks
      if (selectedDatabase?.linkedSheet) {
        try {
          await fetch("/api/sheets/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ databaseId: selectedDatabase.id, mode: "firebaseToSheets" }),
          });
        } catch (syncErr) {
          console.error("Failed to sync to Sheets after email:", syncErr);
        }
      }

      if (selectedDatabase?.id) fetchParticipants(selectedDatabase.id!);

      // Log activity
      if (totalSent > 0) {
        fetch("/api/activity-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "email_sent",
            databaseId: selectedDatabase?.id,
            databaseName: selectedDatabase?.name,
            count: totalSent,
            details: `Sent to ${totalSent} recipient${totalSent !== 1 ? "s" : ""}${totalFailed > 0 ? ` (${totalFailed} failed)` : ""}`,
          }),
        }).catch(() => {});
      }

      const tally = tallyEmailOutcomes(outcomes);
      // Unknown-status recipients count as failed (the conservative direction) but
      // are withheld from the retry list so retrying can't double-send them.
      setEmailResult({
        ...tally,
        failures: outcomes
          .filter(o => !o.ok && !o.queued && !o.unknown)
          .map(o => ({ email: o.email, name: o.name, error: o.error || "Unknown error" })),
      });

      sfx.send();
      toast.success(`${tally.sent} sent${tally.failed ? `, ${tally.failed} failed` : ""}${tally.queued ? `, ${tally.queued} queued` : ""}.`);

      const unknownCount = outcomes.filter(o => o.unknown).length;
      if (unknownCount > 0) {
        toast.warning(`${unknownCount} recipient(s): delivery status unknown — check the Sheet/provider before retrying.`);
      }
      if (queueErrorSeen) {
        toast.warning("Some quota-blocked recipients could not be queued for later delivery — they were not sent.");
      }
    } catch (err: any) {
      console.error("Error sending emails:", err);
      toast.error("Error sending emails: " + (err?.message || "Network error"));
      sfx.error();
    } finally {
      setIsSending(false);
      setSendProgress({ current: 0, total: 0 });
      // Modal stays open so the result panel is visible; the user closes it.
    }
  };

  const retryFailed = () => {
    if (!emailResult?.failures.length) return;
    const failedEmails = new Set(emailResult.failures.map(f => f.email));
    const retryRecipients = participants.filter(p => failedEmails.has(p.email));
    setEmailResult(null);
    handleSendEmails(retryRecipients);
  };

  const openEmailModal = async () => {
    setScheduleMode(false);
    setScheduledAt("");
    setEmailResult(null);
    setShowEmailModal(true);
    try {
      const res = await fetch("/api/email-stats");
      const data = await res.json();
      setEmailStats({ sent: data.sent ?? 0, limit: data.limit ?? 100, remaining: data.remaining ?? 100, source: data.source ?? "local" });
    } catch { /* non-fatal */ }
  };

  const handleScheduleEmails = async () => {
    const recipients = selectedParticipants.length > 0
      ? participants.filter(p => selectedParticipants.includes(p.id || ""))
      : participants;
    if (!selectedDatabase || recipients.length === 0 || !scheduledAt) return;
    setIsSending(true);
    try {
      const emailRecipients = recipients.map(p => ({
        email: p.email, name: p.name, certificateId: p.certificateId || "", driveLink: p.driveLink || "",
      }));
      const res = await fetch("/api/scheduled-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: emailRecipients, subject: emailSubject, message: emailMessage, scheduledAt }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      sfx.success();
      toast.success(`Emails scheduled for ${new Date(scheduledAt).toLocaleString()}`);
      setShowEmailModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule emails");
      sfx.error();
    }
    setIsSending(false);
  };

  const handleDeleteParticipant = async (participant: Participant) => {
    const ok = await confirm({ title: "Delete Participant", message: `Delete ${participant.name}? This cannot be undone.`, danger: true, confirmText: "Delete" });
    if (!ok) return;

    try {
      const response = await fetch(`/api/participants/${participant.id}?databaseId=${selectedDatabase?.id}&deletePdf=true`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        sfx.delete();
        toast.success("Participant deleted.");
        if (selectedDatabase?.id) {
          fetchParticipants(selectedDatabase.id!);
          fetchDatabases();
        }
      } else {
        toast.error(data.error || "Failed to delete participant");
        sfx.error();
      }
    } catch (err) {
      console.error("Delete participant error:", err);
      toast.error("Error deleting participant");
      sfx.error();
    }
  };

  const handleDeleteDatabase = async (dbToDelete: Database) => {
    const ok = await confirm({
      title: "Delete Database",
      message: `Delete "${dbToDelete.name}" and all its participants? Drive files will also be removed. This cannot be undone.`,
      danger: true,
      confirmText: "Delete",
    });
    if (!ok) return;

    setIsDeletingDatabase(true);
    try {
      // Fetch all participants to delete their Drive files first
      const participantsRes = await fetch(`/api/participants?databaseId=${dbToDelete.id}`);
      if (participantsRes.ok) {
        const participantsData = await participantsRes.json();
        const dbParticipants = participantsData.participants || [];
        // Delete Drive files in parallel
        const driveDeletes = dbParticipants
          .filter((p: any) => p.driveFileId)
          .map((p: any) => fetch(`/api/drive-upload?fileId=${p.driveFileId}`, { method: "DELETE" }).catch(() => {}));
        if (driveDeletes.length > 0) {
          await Promise.allSettled(driveDeletes);
        }
      }

      const response = await fetch(`/api/databases?id=${dbToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();
        if (selectedDatabase?.id === dbToDelete.id) {
          setSelectedDatabase(null);
          setParticipants([]);
        }
        sfx.delete();
        toast.success(`Database deleted. ${data.participantsDeleted || 0} participants and Drive files removed.`);
        fetchDatabases(true);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete database");
        sfx.error();
      }
    } catch (err) {
      console.error("Delete database error:", err);
      toast.error("Error deleting database");
      sfx.error();
    } finally {
      setIsDeletingDatabase(false);
    }
  };

  const handleSyncFromSheet = async () => {
    if (!selectedDatabase?.linkedSheet || !selectedDatabase?.id) return;
    setIsSyncingSheet(true);
    try {
      const response = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseId: selectedDatabase.id, mode: "sheetsToFirebase" }),
      });
      const data = await response.json();
      if (response.ok) {
        sfx.success();
        toast.success(`Sheet synced! ${data.imported || 0} records updated.`);
        fetchParticipants(selectedDatabase.id);
        fetchDatabases();
      } else {
        toast.error(data.error || "Failed to sync from sheet");
        sfx.error();
      }
    } catch (err) {
      toast.error("Error syncing from sheet");
      sfx.error();
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handlePushToSheet = async () => {
    if (!selectedDatabase?.linkedSheet || !selectedDatabase?.id) return;
    setIsSyncingSheet(true);
    try {
      const response = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseId: selectedDatabase.id, mode: "firebaseToSheets" }),
      });
      const data = await response.json();
      if (response.ok) {
        sfx.success();
        toast.success(`Sheet synced! ${data.synced ?? 0} participants pushed.`);
      } else {
        toast.error(data.error || "Failed to push to sheet");
        sfx.error();
      }
    } catch (err) {
      toast.error("Error pushing to sheet");
      sfx.error();
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleFindDriveFolder = async () => {
    if (!selectedDatabase?.id || !selectedDatabase?.name) return;
    setIsFindingFolder(true);
    try {
      const res = await fetch("/api/databases/drive-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseId: selectedDatabase.id, databaseName: selectedDatabase.name }),
      });
      const data = await res.json();
      if (res.ok) {
        sfx.success();
        toast.success("Drive folder linked!");
        fetchDatabases(true);
        setSelectedDatabase(prev => prev ? { ...prev, driveFolderId: data.folderId, driveFolderUrl: data.folderUrl } : prev);
      } else {
        toast.error(data.error || "Could not find Drive folder");
        sfx.error();
      }
    } catch {
      toast.error("Error finding Drive folder");
      sfx.error();
    } finally {
      setIsFindingFolder(false);
    }
  };

  const fixFolderSharing = async () => {
    if (!selectedDatabase?.driveFolderId) return;
    try {
      const res = await fetch("/api/drive/ensure-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: selectedDatabase.driveFolderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.shared) toast.success("Folder is now shared with anyone who has the link.");
      else toast.error("Could not make the folder public — the bridge account may block link sharing.");
    } catch {
      toast.error("Could not reach the sharing service.");
    }
  };

  const handleConsolidateFolders = async () => {
    if (!selectedDatabase?.id) return;
    if (!(selectedDatabase as Database).driveFolderId) {
      toast.warning("Generate certificates first — there's no main Drive folder to consolidate into yet.");
      return;
    }
    try {
      const res = await fetch("/api/drive/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseId: selectedDatabase.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          data.movedFiles || data.trashedFolders
            ? `Moved ${data.movedFiles} file(s), removed ${data.trashedFolders} duplicate folder(s).`
            : "No duplicate folders found — nothing to consolidate."
        );
      } else {
        toast.error(data.error || "Could not consolidate folders.");
      }
    } catch {
      toast.error("Could not reach the consolidation service.");
    }
  };

  const resumeGeneration = () => {
    // A stale row selection would scope the resumed run to a subset of the
    // original batch (DatabaseManager passes the selection into the generator).
    setSelectedParticipants([]);
    setGeneratorResumeMode(true);
    setShowGeneratorModal(true);
  };

  // Flag-only: the job-doc lifecycle is the generator's responsibility now (it
  // deletes on clean/no-op finish, keeps on interrupt). Dismissing just hides the
  // banner locally — derived participant state is the truth.
  const dismissResumeBanner = () => setResumeBannerDismissed(true);

  const refreshGenerationJob = () => {
    if (!selectedDatabase?.id) return;
    const seq = ++jobFetchSeq.current;
    fetch(`/api/generation-jobs/${selectedDatabase.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (jobFetchSeq.current === seq) setGenerationJob(d?.job ?? null); })
      .catch(() => {});
  };

  // Generate certificate IDs for all participants
  const handleGenerateIds = () => {
    if (!selectedDatabase) return;
    const unassigned = participants.filter(p => !p.certificateId);
    if (unassigned.length === 0) {
      toast.info("All participants already have certificate IDs");
      return;
    }
    // Detect existing code from sheet IDs (e.g. "Hamza-MDC-001" → "MDC")
    const existingIds = participants.filter(p => p.certificateId).map(p => p.certificateId!);
    const detectedCode = (() => {
      for (const id of existingIds) {
        const parts = id.split("-");
        if (parts.length >= 3 && !/^\d{4}$/.test(parts[0])) return parts[1];
      }
      return subCategoryShortMap[selectedDatabase.subCategory] || selectedDatabase.subCategory.slice(0, 3).toUpperCase();
    })();
    setIdFormatCode(detectedCode);
    setIdFormat("app");
    const subCatShortDefault = subCategoryShortMap[selectedDatabase.subCategory] || selectedDatabase.subCategory.slice(0, 3).toUpperCase();
    setIdFormatAppSubCat(subCatShortDefault);
    setIdFormatCustomizeSubCat(false);
    setIdFormatCustomPrefix("");
    setShowIdFormatModal(true);
  };

  const handleConfirmGenerateIds = async () => {
    if (!selectedDatabase) return;
    const unassignedParticipants = participants.filter(p => !p.certificateId);
    setShowIdFormatModal(false);
    setIsGeneratingIds(true);
    const year = new Date().getFullYear();
    const subCatShort = subCategoryShortMap[selectedDatabase.subCategory] || selectedDatabase.subCategory.slice(0, 3).toUpperCase();

    // Find starting serial number
    const existingSerials = participants
      .filter(p => p.certificateId)
      .map(p => {
        const parts = p.certificateId!.split("-");
        const last = parts[parts.length - 1];
        return parseInt(last, 10) || 0;
      });
    const maxSerial = existingSerials.length > 0 ? Math.max(...existingSerials) : 0;

    try {
      // Sort by createdAt ascending so sheet row order (first imported = lowest serial)
      const ordered = [...unassignedParticipants].sort((a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );

      // Build all ID assignments locally, then send in one batch request
      const updates = ordered.map((participant, i) => {
        const serial = String(maxSerial + i + 1).padStart(3, "0");
        let certId: string;
        if (idFormat === "app") {
          const catCode = idFormatCustomizeSubCat ? idFormatAppSubCat.trim() : subCatShort;
          certId = `PZ-${catCode}-${idFormatCategoryNo.trim()}-${serial}`;
        } else if (idFormat === "name") {
          const firstName = participant.name.split(" ")[0];
          certId = `${firstName}-${idFormatCode}-${serial}`;
        } else {
          certId = `${idFormatCustomPrefix.trim()}-${serial}`;
        }
        return { id: participant.id, certificateId: certId, status: "pending" };
      });

      const response = await fetch("/api/participants/batch-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseId: selectedDatabase?.id, updates }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Batch update failed");
      }

      sfx.success();
      toast.success(`Generated ${unassignedParticipants.length} certificate IDs!`);
      fetchParticipants(selectedDatabase.id!);

      // Auto-sync cert IDs to sheet (fast targeted column-A update)
      if (selectedDatabase?.linkedSheet) {
        const certIdUpdates = updates.map(u => {
          const p = participants.find(x => x.id === u.id);
          return { email: p?.email || "", certificateId: u.certificateId };
        }).filter(u => u.email);

        fetch("/api/sheets/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ databaseId: selectedDatabase.id, mode: "updateCertIds", updates: certIdUpdates }),
        }).then(r => r.json()).then(d => {
          if (d.updated) toast.info(`Sheet updated: ${d.updated} IDs synced.`);
          else if (d.error) toast.error(`Sheet sync failed — check Apps Script deployment: ${d.error.substring(0, 80)}`);
        }).catch(() => toast.error("Sheet sync failed — Apps Script unreachable"));
      }
    } catch (err) {
      console.error("Error generating IDs:", err);
      toast.error("Error generating certificate IDs");
      sfx.error();
    } finally {
      setIsGeneratingIds(false);
    }
  };

  // Save custom certificate ID
  const handleSaveCertId = async (participant: Participant) => {
    if (!tempCertId.trim()) {
      toast.warning("Please enter a certificate ID");
      sfx.error();
      return;
    }

    try {
      const response = await fetch(`/api/participants/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateId: tempCertId.trim(),
          status: participant.certificateId ? "generated" : "pending",
          databaseId: selectedDatabase?.id,
        }),
      });

      if (response.ok) {
        sfx.click();
        setEditingCertId(null);
        setTempCertId("");
        if (selectedDatabase?.id) {
          fetchParticipants(selectedDatabase.id!);
        }
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save certificate ID");
        sfx.error();
      }
    } catch (err) {
      console.error("Error saving cert ID:", err);
      toast.error("Error saving certificate ID");
      sfx.error();
    }
  };

  // Delete certificate only (keep participant)
  const handleDeleteCertificate = async (participant: Participant) => {
    if (!participant.certificateId) return;

    const ok = await confirm({ title: "Delete Certificate", message: `Delete Certificate ID and PDF for ${participant.name}?`, danger: true, confirmText: "Delete Both" });
    if (!ok) return;

    try {
      await Promise.all([
        participant.driveFileId
          ? fetch(`/api/drive-upload?fileId=${participant.driveFileId}`, { method: "DELETE" })
          : Promise.resolve(),
        participant.certificateId
          ? fetch(`/api/certificates?uniqueCertId=${encodeURIComponent(participant.certificateId)}`, { method: "DELETE" })
          : Promise.resolve(),
      ]);

      const response = await fetch(`/api/participants/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateId: "", serialNumber: null, status: "pending",
          verificationUrl: "", certificateUrl: "", driveLink: "", driveFileId: "",
          emailSent: false, databaseId: selectedDatabase?.id,
        }),
      });

      if (response.ok) {
        sfx.delete();
        toast.success("Certificate ID and PDF deleted.");
        if (selectedDatabase?.id) fetchParticipants(selectedDatabase.id!);
      } else {
        toast.error("Failed to delete certificate");
        sfx.error();
      }
    } catch (err) {
      toast.error("Error deleting certificate");
      sfx.error();
    }
  };

  // Delete only Certificate ID (keep PDF placeholder)
  const handleDeleteCertId = async (participant: Participant) => {
    if (!participant.certificateId) return;

    const ok = await confirm({ title: "Delete Certificate ID", message: `Delete Certificate ID for ${participant.name}? PDF will remain.`, danger: true, confirmText: "Delete ID" });
    if (!ok) return;

    try {
      // Revoke from certificates collection (cert ID removed → no longer valid).
      // keepPdf=true: this is "Delete ID Only" — the PDF must survive.
      await fetch(`/api/certificates?uniqueCertId=${encodeURIComponent(participant.certificateId)}&keepPdf=true`, { method: "DELETE" });

      const response = await fetch(`/api/participants/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateId: "", serialNumber: null, status: "pending", verificationUrl: "", databaseId: selectedDatabase?.id }),
      });

      if (response.ok) {
        sfx.delete();
        toast.success("Certificate ID deleted.");
        if (selectedDatabase?.id) fetchParticipants(selectedDatabase.id!);
      } else {
        toast.error("Failed to delete certificate ID");
        sfx.error();
      }
    } catch (err) {
      toast.error("Error deleting certificate ID");
      sfx.error();
    }
  };

  // Delete only PDF (keep Certificate ID)
  const handleDeletePdfOnly = async (participant: Participant) => {
    if (!participant.certificateId) return;

    const ok = await confirm({ title: "Delete PDF", message: `Delete PDF for ${participant.name}? Certificate ID will remain.`, danger: true, confirmText: "Delete PDF" });
    if (!ok) return;

    try {
      const fid = resolveDriveFileId(participant);
      if (fid) {
        const driveRes = await fetch(`/api/drive-upload?fileId=${fid}`, { method: "DELETE" });
        if (!driveRes.ok) {
          const driveData = await driveRes.json().catch(() => ({}));
          console.error("Drive delete failed:", driveData.error);
          // Still proceed to clear from Firebase
        }
      }

      const response = await fetch(`/api/participants/${participant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateUrl: "", driveLink: "", driveFileId: "", status: "pending", databaseId: selectedDatabase?.id }),
      });

      if (response.ok) {
        sfx.delete();
        toast.success("PDF deleted. Certificate ID retained.");
        if (selectedDatabase?.id) fetchParticipants(selectedDatabase.id!);
      } else {
        toast.error("Failed to delete PDF");
        sfx.error();
      }
    } catch (err) {
      toast.error("Error deleting PDF");
      sfx.error();
    }
  };

  // A DB with no linked sheet has no PDF phase — never park those at needs-pdf.
  const generationSummary = deriveGenerationSummary(participants, !!selectedDatabase?.linkedSheet);
  const generationJobStatus = generationJob
    ? jobEffectiveStatus({ status: (generationJob as { status?: string }).status, startedAt: generationJob.startedAt })
    : null;
  const showResumeBanner =
    !!generationJob &&
    !resumeBannerDismissed &&
    generationSummary.needsCert + generationSummary.needsPdf > 0;

  return {
    databases,
    allDatabases,
    participants,
    isCreating,
    selectedDatabase,
    isLoading,
    fetchedOnce,
    generationJob,
    generatorResumeMode,
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
    emailResult,
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
    linkSheet,
    sheetOption,
    existingSheetId,
    existingSheetTabs,
    selectedSheetTab,
    subDatabases,
    isLoadingTabs,
    tabFetchError,
    setSelectedDatabase: openDatabase,
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
    generationSummary,
    generationJobStatus,
    showResumeBanner,
    resumeGeneration,
    dismissResumeBanner,
    refreshGenerationJob,
    handleGenerateIds,
    handleConfirmGenerateIds,
    handleSaveCertId,
    handleDeleteCertificate,
    handleDeleteCertId,
    handleDeletePdfOnly,
  };
}
