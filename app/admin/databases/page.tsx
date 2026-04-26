"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, Participant } from "@/lib/types";
import CertificateGenerator, { DownloadCertificateButton } from "@/components/CertificateGenerator";
import * as XLSX from "xlsx";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmModal";
import { sfx } from "@/lib/sfx";

const SENDER_IDENTITIES = [
  { name: "PharmacoZyme Certificates", email: "" },
  { name: "PharmacoZyme Official", email: "pharmacozymeofficial@gmail.com" },
  { name: "PZ Academy", email: "pz.academy9@gmail.com" },
  { name: "Team PharmacoZyme", email: "teampharmacozyme@gmail.com" },
];

const categoryStructure = {
  General: {
    Courses: ["Module 1", "Module 2", "Module 3", "Module 4", "Course Completion"],
    Workshops: ["Workshop"],
    Webinars: ["Webinar"],
    "MED-Q": ["MED-Q Assessment"],
  },
  Official: {
    "Central Team": ["Team Certificate"],
    "Sub Team": ["Team Certificate"],
    Ambassadors: ["Ambassador Certificate"],
    Affiliates: ["Affiliate Certificate"],
    Mentors: ["Mentor Certificate"],
  },
};

export default function DatabaseManagementPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [databases, setDatabases] = useState<Database[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchedOnce, setFetchedOnce] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  
  // Form states
  const [newDatabase, setNewDatabase] = useState({
    name: "",
    category: "General" as "General" | "Official",
    subCategory: "Courses",
    topic: "",
    description: "",
  });
  
  const [newParticipant, setNewParticipant] = useState({
    name: "",
    email: "",
  });
  
  const [bulkParticipants, setBulkParticipants] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{name: string; email: string; certificateId?: string; issueDate?: string; status?: string}[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [emailSubject, setEmailSubject] = useState("Your Certificate from PharmacoZyme");
  const [emailMessage, setEmailMessage] = useState("Dear [Name],\n\nCongratulations! Your certificate is now ready.\n\nYou can verify your certificate at: [VerificationLink]\n\nBest regards,\nPharmacoZyme Team");
  const [isSending, setIsSending] = useState(false);
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
  const [sortBy, setSortBy] = useState<"name" | "email" | "certId" | "date" | "status">("certId");
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
  const [idFormat, setIdFormat] = useState<"app" | "name">("app");
  const [idFormatCode, setIdFormatCode] = useState("");
  const [idFormatCategoryNo, setIdFormatCategoryNo] = useState("");
  
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
        await fetch(`/api/participants/${p.id}?databaseId=${selectedDatabase.id}`, {
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
        await fetch(`/api/participants/${p.id}?databaseId=${selectedDatabase.id}`, {
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
  const [showSheetModal, setShowSheetModal] = useState(false);

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
        setDatabases(uniqueDatabases);
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
        setNewDatabase({ name: "", category: "General", subCategory: "Courses", topic: "", description: "" });
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

  const handleFileUpload = (file: File) => {
    setImportFile(file);
    setBulkParticipants(""); // Clear paste data when file is uploaded
    
    const reader = new FileReader();
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let jsonData: any[] = [];

        if (fileExtension === "csv") {
          // Parse CSV
          const text = data as string;
          const lines = text.split("\n").filter(line => line.trim());
          const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
          
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map(v => v.trim());
            const row: any = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx] || "";
            });
            jsonData.push(row);
          }
        } else if (fileExtension === "xlsx" || fileExtension === "xls") {
          // Parse Excel
          const workbook = XLSX.read(data, { type: "binary" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          jsonData = XLSX.utils.sheet_to_json(firstSheet);
        } else {
          toast.error("Unsupported file format. Use CSV or Excel.");
          sfx.error();
          return;
        }

        // Map to participants - use exact column names from the user's Excel file
        const mappedParticipants = jsonData.map((row, idx) => {
          // Find keys case-insensitively
          const getValue = (row: any, possibleNames: string[]) => {
            const rowKeys = Object.keys(row);
            for (const name of possibleNames) {
              const foundKey = rowKeys.find(k => k.trim().toLowerCase() === name.toLowerCase());
              if (foundKey && row[foundKey]) {
                return String(row[foundKey]).trim();
              }
            }
            return "";
          };
          
          // Exact column names from user's file
          const name = getValue(row, ["Name", "name", "NAME", "Full Name", "full name"]);
          const email = getValue(row, ["Active Email Address", "Email", "email", "E-mail", "Mail"]);
          const certId = getValue(row, ["Certificate ID", "CertificateId", "Cert ID"]);
          const issueDate = getValue(row, ["Issue Date", "IssueDate", "Date"]);
          const status = getValue(row, ["Status", "status"]);
          
          // Import status logic: always set to "pending" on import
          // Certificate will show as generated only after PDF is created
          const importStatus = "pending";
          
          return { 
            name, 
            email,
            certificateId: certId, // Store the imported cert ID but status is pending
            issueDate,
            status: importStatus
          };
        }).filter(p => p.name && p.email);
        
        console.log("Total rows parsed:", jsonData.length, "Valid participants:", mappedParticipants.length);

        if (mappedParticipants.length === 0) {
          console.log("Import failed - sample row:", jsonData[0]);
          toast.warning("No valid participants found. Check file has 'Name' and 'Email' columns.");
          setImportFile(null);
          return;
        }

        setImportPreview(mappedParticipants);
      } catch (err) {
        console.error("File parse error:", err);
        toast.error("Failed to parse file. Please check the format.");
        setImportFile(null);
      }
    };

    if (fileExtension === "xlsx" || fileExtension === "xls") {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleSendEmails = async () => {
    const recipients = selectedParticipants.length > 0
      ? participants.filter(p => selectedParticipants.includes(p.id || ""))
      : participants;
      
    if (!selectedDatabase || recipients.length === 0) {
      toast.warning("No participants to send emails to");
      sfx.error();
      return;
    }

    setIsSending(true);
    
    // Prepare email data with drive link for PDF download
    const emailRecipients = recipients.map(p => ({
      email: p.email,
      name: p.name,
      certificateId: p.certificateId || "",
      verificationUrl: p.certificateUrl || "",
      driveLink: p.driveLink || "",
    }));
    
    try {
      // Call the email API
      const sender = SENDER_IDENTITIES[selectedSenderIndex];
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
      
      const result = await response.json();
      
      if (!response.ok) {
        toast.error(result.error || "Failed to send emails");
        sfx.error();
        setIsSending(false);
        return;
      }
      
      // Update emailSent status for all recipients
      for (const recipient of recipients) {
        await fetch(`/api/participants/${recipient.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailSent: true, databaseId: selectedDatabase?.id }),
        });
      }
      
      // Sync to Sheets after email update
      if (selectedDatabase?.linkedSheet) {
        try {
          await fetch("/api/sheets/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              databaseId: selectedDatabase.id,
              mode: "firebaseToSheets",
            }),
          });
        } catch (syncErr) {
          console.error("Failed to sync to Sheets after email:", syncErr);
        }
      }
      
      if (selectedDatabase?.id) {
        fetchParticipants(selectedDatabase.id!);
      }
      
      sfx.send();
      toast.success(`Emails sent! ${result.sent || recipients.length} delivered${result.failed ? `, ${result.failed} failed` : ""}${result.autoQueued ? ` • ${result.autoQueued} queued for tomorrow (quota reached)` : ""}.`);
    } catch (err) {
      console.error("Error sending emails:", err);
      toast.error("Failed to send emails. Check email configuration.");
      sfx.error();
    }
    
    setIsSending(false);
    setShowEmailModal(false);
  };

  const openEmailModal = async () => {
    setScheduleMode(false);
    setScheduledAt("");
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
          certId = `PZ-${subCatShort}-${idFormatCategoryNo.trim()}-${serial}`;
        } else {
          const firstName = participant.name.split(" ")[0];
          certId = `${firstName}-${idFormatCode}-${serial}`;
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
      if (participant.driveFileId) {
        await fetch(`/api/drive-upload?fileId=${participant.driveFileId}`, { method: "DELETE" });
      }

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
      if (participant.driveFileId) {
        const driveRes = await fetch(`/api/drive-upload?fileId=${participant.driveFileId}`, { method: "DELETE" });
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

  // Subcategory short forms
  const subCategoryShortMap: Record<string, string> = {
    "Courses": "CRS",
    "Workshops": "WKS",
    "Webinars": "WBN",
    "MED-Q": "MDQ",
    "Central Team": "CTM",
    "Sub Team": "STM",
    "Ambassadors": "AMB",
    "Affiliates": "AFF",
    "Mentors": "MTR",
  };

  const subCategories = categoryStructure[newDatabase.category as keyof typeof categoryStructure] || {};

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
      {showIdFormatModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-green-50">
              <h3 className="text-xl font-headline font-bold text-brand-dark-green">Choose ID Format</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                Select how certificate IDs should be generated for {participants.filter(p => !p.certificateId).length} unassigned participant(s).
              </p>
            </div>
            <div className="p-6 space-y-4">
              <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${idFormat === "app" ? "border-brand-vivid-green bg-green-50" : "border-gray-100 hover:border-green-200"}`}>
                <input type="radio" className="mt-1 accent-green-700" checked={idFormat === "app"} onChange={() => setIdFormat("app")} />
                <div className="flex-1">
                  <p className="font-bold text-sm text-brand-dark-green">App Format</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 mb-2">
                    Pattern: <span className="font-mono bg-gray-100 px-1 rounded">PZ-{subCategoryShortMap[selectedDatabase?.subCategory || ""] || "CRS"}-{idFormatCategoryNo || "No"}-001</span>
                  </p>
                  {idFormat === "app" && (
                    <div>
                      <label className="block text-xs font-bold text-brand-grass-green uppercase mb-1">Category Number</label>
                      <input
                        type="text"
                        value={idFormatCategoryNo}
                        onChange={e => setIdFormatCategoryNo(e.target.value)}
                        placeholder="e.g. 11"
                        maxLength={6}
                        className="w-full bg-surface-container-low border border-green-100 rounded-lg p-2 text-sm font-mono outline-none focus:border-brand-vivid-green"
                      />
                      <p className="text-xs text-on-surface-variant mt-1">
                        Preview: <span className="font-mono">PZ-{subCategoryShortMap[selectedDatabase?.subCategory || ""] || "CRS"}-{idFormatCategoryNo || "No"}-001</span>
                      </p>
                    </div>
                  )}
                </div>
              </label>
              <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${idFormat === "name" ? "border-brand-vivid-green bg-green-50" : "border-gray-100 hover:border-green-200"}`}>
                <input type="radio" className="mt-1 accent-green-700" checked={idFormat === "name"} onChange={() => setIdFormat("name")} />
                <div className="flex-1">
                  <p className="font-bold text-sm text-brand-dark-green">Name-Based Format</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 mb-2">
                    Pattern: <span className="font-mono bg-gray-100 px-1 rounded">FirstName-CODE-001</span>
                  </p>
                  {idFormat === "name" && (
                    <div>
                      <label className="block text-xs font-bold text-brand-grass-green uppercase mb-1">Middle Code</label>
                      <input
                        type="text"
                        value={idFormatCode}
                        onChange={e => setIdFormatCode(e.target.value.toUpperCase())}
                        placeholder="e.g. MDC"
                        maxLength={6}
                        className="w-full bg-surface-container-low border border-green-100 rounded-lg p-2 text-sm font-mono outline-none focus:border-brand-vivid-green"
                      />
                      <p className="text-xs text-on-surface-variant mt-1">
                        Preview: <span className="font-mono">{participants.filter(p => !p.certificateId)[0]?.name.split(" ")[0] || "Name"}-{idFormatCode || "CODE"}-001</span>
                      </p>
                    </div>
                  )}
                </div>
              </label>
            </div>
            <div className="p-6 border-t border-green-50 flex justify-end gap-3">
              <button onClick={() => setShowIdFormatModal(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl">
                Cancel
              </button>
              <button onClick={handleConfirmGenerateIds} disabled={(idFormat === "name" && !idFormatCode.trim()) || (idFormat === "app" && !idFormatCategoryNo.trim())} className="px-5 py-2.5 vivid-gradient-cta text-white rounded-xl font-bold text-sm disabled:opacity-50">
                Generate IDs
              </button>
            </div>
          </div>
        </div>
      )}
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

      {/* Database Cards */}
      {databases.length === 0 ? (
        <div className="bg-white rounded-xl border border-green-100 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">database</span>
          <h3 className="text-xl font-headline font-bold text-brand-dark-green mb-2">No Databases Yet</h3>
          <p className="text-on-surface-variant mb-6">Create your first database to start issuing certificates</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold"
          >
            Create First Database
          </button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {databases.map((db) => (
              <div
                key={db.id}
                onClick={() => setSelectedDatabase(db)}
                className={`bg-white rounded-xl border-2 p-6 cursor-pointer transition-all ${
                  selectedDatabase?.id === db.id
                    ? "border-brand-vivid-green shadow-lg"
                    : "border-green-100 hover:border-brand-vivid-green/50"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-brand-green text-2xl">folder</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-100 text-brand-green text-xs font-bold rounded-full uppercase">
                      {db.category}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDatabase(db);
                      }}
                      className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                      title="Delete database"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-headline font-bold text-brand-dark-green mb-1">{db.name}</h3>
                <p className="text-sm text-on-surface-variant mb-4">
                  {db.subCategory} • {db.topic}
                </p>
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
                  <a
                    href={`https://drive.google.com/drive/folders/${(db as any).driveFolderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 mt-1 text-xs text-blue-600 font-medium hover:text-blue-800 hover:underline"
                  >
                    <span className="material-symbols-outlined text-sm">folder_open</span>
                    Drive Folder
                    <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Database Detail View */}
      {selectedDatabase && (
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          {/* Database Header */}
          <div className="p-6 border-b border-green-50 bg-green-50/30">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-2xl font-headline font-bold text-brand-dark-green">{selectedDatabase.name}</h3>
                <p className="text-on-surface-variant">
                  {selectedDatabase.category} • {selectedDatabase.subCategory} • {selectedDatabase.topic}
                </p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {selectedDatabase.linkedSheet && selectedDatabase.sheetId && (
                      <>
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${selectedDatabase.sheetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium hover:text-emerald-800 hover:underline"
                        >
                          <span className="material-symbols-outlined text-sm">table_chart</span>
                          Open Sheet
                          <span className="material-symbols-outlined text-xs">open_in_new</span>
                        </a>
                        <button
                          onClick={handleSyncFromSheet}
                          disabled={isSyncingSheet}
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">sync</span>
                          Refresh from Sheet
                        </button>
                        <button
                          onClick={handlePushToSheet}
                          disabled={isSyncingSheet}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-medium bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">upload</span>
                          Push to Sheet
                        </button>
                      </>
                    )}
                    {selectedDatabase.driveFolderId ? (
                      <>
                        <a
                          href={`https://drive.google.com/drive/folders/${selectedDatabase.driveFolderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:text-blue-800 hover:underline"
                        >
                          <span className="material-symbols-outlined text-sm">folder_open</span>
                          Open Drive Folder
                          <span className="material-symbols-outlined text-xs">open_in_new</span>
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`https://drive.google.com/drive/folders/${selectedDatabase.driveFolderId}`);
                            toast.success("Drive folder link copied!");
                          }}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-medium bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">content_copy</span>
                          Copy Link
                        </button>
                        <button
                          onClick={handleFindDriveFolder}
                          disabled={isFindingFolder}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-medium bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          <span className={`material-symbols-outlined text-sm ${isFindingFolder ? "animate-spin" : ""}`}>
                            {isFindingFolder ? "progress_activity" : "sync"}
                          </span>
                          {isFindingFolder ? "Updating..." : "Update"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleFindDriveFolder}
                        disabled={isFindingFolder}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-medium bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        <span className={`material-symbols-outlined text-sm ${isFindingFolder ? "animate-spin" : ""}`}>
                          {isFindingFolder ? "progress_activity" : "folder_open"}
                        </span>
                        {isFindingFolder ? "Finding..." : "Link Drive Folder"}
                      </button>
                    )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowParticipantModal(true)}
                  className="px-4 py-2 bg-white border border-green-200 text-brand-grass-green rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-green-50 transition-colors"
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
                {/* Actions */}
                <div className="flex flex-wrap gap-3 mb-6">
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
                <div className="mb-3">
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
                                  // Delete Drive files in parallel
                                  await Promise.all(selectedParticipants.map(id => {
                                    const p = participants.find(x => x.id === id);
                                    return p?.driveFileId ? fetch(`/api/drive-upload?fileId=${p.driveFileId}`, { method: "DELETE" }) : Promise.resolve();
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

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-green-50/50 text-brand-grass-green uppercase text-[10px] tracking-widest font-bold">
                        <th className="px-4 py-3 w-8">
                          <input
                            type="checkbox"
                            checked={selectedParticipants.length === participants.length && participants.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedParticipants(participants.map(p => p.id || ""));
                              } else {
                                setSelectedParticipants([]);
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
                    <tbody className="divide-y divide-green-50">
                      {(() => {
                        const q = participantSearch.toLowerCase();
                        const filtered = q
                          ? participants.filter(p =>
                              (p.name || "").toLowerCase().includes(q) ||
                              (p.email || "").toLowerCase().includes(q) ||
                              (p.certificateId || "").toLowerCase().includes(q)
                            )
                          : participants;
                        const sorted = [...filtered].sort((a, b) => {
                          let aVal = "", bVal = "";
                          if (sortBy === "certId") {
                            aVal = a.certificateId || "";
                            bVal = b.certificateId || "";
                            // Extract numeric part for MDC-001, MDC-194 etc
                            const aNum = parseInt(aVal.split("-").pop() || "0");
                            const bNum = parseInt(bVal.split("-").pop() || "0");
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
                        return sorted.map((participant, index) => (
                        <tr key={participant.id || index} className="hover:bg-green-50/30">
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedParticipants.includes(participant.id || "")}
                              onChange={(e) => {
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
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto my-8">
            <div className="p-6 border-b border-green-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-headline font-bold text-brand-dark-green">Create New Database</h3>
                <p className="text-sm text-on-surface-variant">Set up category, subcategory, and topic</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-green-50 rounded-lg">
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
                    onChange={(e) => setNewDatabase({ ...newDatabase, category: e.target.value as "General" | "Official", subCategory: Object.keys(categoryStructure[e.target.value as keyof typeof categoryStructure])[0] })}
                    className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Official">Official</option>
                  </select>
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
              <button onClick={() => setShowCreateModal(false)} className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl">
                Cancel
              </button>
              <button
                onClick={handleCreateDatabase}
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
      )}

      {/* Add Participant Modal */}
      {showParticipantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-green-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-headline font-bold text-brand-dark-green">Add Participant</h3>
                <p className="text-sm text-on-surface-variant">Add a single participant to {selectedDatabase?.name}</p>
              </div>
              <button onClick={() => setShowParticipantModal(false)} className="p-2 hover:bg-green-50 rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Full Name *</label>
                <input
                  type="text"
                  value={newParticipant.name}
                  onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                  placeholder="Enter full name"
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Email Address *</label>
                <input
                  type="email"
                  value={newParticipant.email}
                  onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-green-50 flex justify-end gap-3">
              <button onClick={() => setShowParticipantModal(false)} disabled={isAddingParticipant} className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleAddParticipant} disabled={isAddingParticipant} className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold disabled:opacity-70 flex items-center gap-2">
                {isAddingParticipant ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    Adding...
                  </>
                ) : "Add Participant"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-green-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-headline font-bold text-brand-dark-green">Import Participants</h3>
                <p className="text-sm text-on-surface-variant">Upload Excel/CSV file or paste data</p>
              </div>
              <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); setBulkParticipants(""); }} className="p-2 hover:bg-green-50 rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* File Upload */}
              <div className="border-2 border-dashed border-green-200 rounded-xl p-8 text-center hover:border-brand-vivid-green hover:bg-green-50/30 transition-all cursor-pointer"
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
                onClick={() => document.getElementById("fileInput")?.click()}
              >
                <input
                  id="fileInput"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
                <span className="material-symbols-outlined text-5xl text-brand-grass-green/40 mb-4 block">
                  upload_file
                </span>
                <p className="text-sm text-on-surface-variant mb-2">
                  Drag and drop Excel or CSV file here, or <span className="text-brand-vivid-green font-bold">browse</span>
                </p>
                <p className="text-[10px] text-outline uppercase tracking-wider">
                  Supports: .xlsx, .xls, .csv (Google Sheets export supported)
                </p>
              </div>

              {/* Selected File */}
              {importFile && (
                <div className="p-4 bg-green-50/50 rounded-xl border border-green-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-brand-vivid-green">description</span>
                    <div>
                      <p className="text-sm font-medium text-brand-dark-green">{importFile.name}</p>
                      <p className="text-xs text-on-surface-variant">{importPreview.length} participants found</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setImportFile(null); setImportPreview([]); }}
                    className="p-2 hover:bg-green-100 rounded-lg text-error"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              )}

              {/* Preview */}
              {importPreview.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-brand-dark-green mb-3">Preview ({Math.min(importPreview.length, 5)} of {importPreview.length})</h4>
                  <div className="overflow-x-auto border border-green-100 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-green-50/50">
                        <tr>
                          <th className="px-4 py-3 font-bold text-brand-grass-green">#</th>
                          <th className="px-4 py-3 font-bold text-brand-grass-green">Name</th>
                          <th className="px-4 py-3 font-bold text-brand-grass-green">Email</th>
                          <th className="px-4 py-3 font-bold text-brand-grass-green">Certificate ID</th>
                          <th className="px-4 py-3 font-bold text-brand-grass-green">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-green-50">
                        {importPreview.slice(0, 5).map((p, i) => (
                          <tr key={i} className="hover:bg-green-50/30">
                            <td className="px-4 py-3">{i + 1}</td>
                            <td className="px-4 py-3">{p.name}</td>
                            <td className="px-4 py-3">{p.email}</td>
                            <td className="px-4 py-3 font-mono text-xs">{p.certificateId || "-"}</td>
                            <td className="px-4 py-3">
                              {p.status?.toLowerCase() === "issued" || p.status?.toLowerCase() === "sent" ? (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">Issued</span>
                              ) : p.certificateId ? (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">Generated</span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-green-100"></div>
                <span className="text-xs text-on-surface-variant font-bold">OR</span>
                <div className="flex-1 h-px bg-green-100"></div>
              </div>

              {/* Paste Data */}
              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Paste Data</label>
                <textarea
                  value={bulkParticipants}
                  onChange={(e) => { setBulkParticipants(e.target.value); setImportFile(null); setImportPreview([]); }}
                  placeholder="John Doe, john@email.com
Jane Smith, jane@email.com
Ahmed Khan, ahmed@email.com"
                  rows={6}
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none resize-none font-mono"
                />
              </div>

              <div className="bg-green-50 rounded-xl p-4 text-sm">
                <p className="font-bold text-brand-dark-green mb-2">Supported Column Names (file headers or paste):</p>
                <code className="text-xs text-on-surface-variant block whitespace-pre-line">
                  {'Name: name, full name, recipient name, participant name, Name\n'}
                  {'Email: email, email address, mail, Active Email Address\n'}
                  {'Certificate ID: certificate id, certificate, Certificate ID\n'}
                  {'Course: course/workshop/webinar, course, Course/Workshop/Webinar\n'}
                  {'(Google Sheets: Export as .xlsx or copy as CSV)'}
                </code>
              </div>
            </div>
            <div className="p-6 border-t border-green-50 flex justify-end gap-3">
              <button 
                onClick={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); setBulkParticipants(""); }}
                className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkImport} 
                disabled={isImporting || (importPreview.length === 0 && !bulkParticipants.trim())}
                className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    Importing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">upload</span>
                    Import {importPreview.length > 0 ? importPreview.length : bulkParticipants.split("\n").filter(l => l.trim()).length} Participants
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  if (selectedDatabase?.id) {
                    fetchParticipants(selectedDatabase.id!);
                  }
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
      {showBulkTargetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-green-50">
              <h3 className="text-lg font-headline font-bold text-brand-dark-green">
                {bulkTargetAction === "generate" ? "Generate PDFs" : "Send Emails"}
              </h3>
              <p className="text-sm text-on-surface-variant mt-1">Choose which participants to target</p>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={() => {
                  setSelectedParticipants([]);
                  setShowBulkTargetModal(false);
                  if (bulkTargetAction === "generate") setShowGeneratorModal(true);
                  else openEmailModal();
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-green-100 hover:border-brand-vivid-green hover:bg-green-50 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-brand-grass-green">group</span>
                </div>
                <div>
                  <p className="font-bold text-brand-dark-green text-sm">All Participants</p>
                  <p className="text-xs text-on-surface-variant">{participants.length} participants</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowBulkTargetModal(false);
                  if (bulkTargetAction === "generate") setShowGeneratorModal(true);
                  else openEmailModal();
                }}
                disabled={selectedParticipants.length === 0}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-blue-100 hover:border-blue-400 hover:bg-blue-50 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-blue-600">checklist</span>
                </div>
                <div>
                  <p className="font-bold text-brand-dark-green text-sm">Selected Only</p>
                  <p className="text-xs text-on-surface-variant">
                    {selectedParticipants.length === 0 ? "No participants selected" : `${selectedParticipants.length} selected`}
                  </p>
                </div>
              </button>
            </div>
            <div className="p-4 border-t border-green-50 flex justify-end">
              <button onClick={() => setShowBulkTargetModal(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:bg-green-50 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-green-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-headline font-bold text-brand-dark-green">Send Certificates via Email</h3>
                <p className="text-sm text-on-surface-variant">
                  Send certificates to {selectedParticipants.length > 0 ? `${selectedParticipants.length} selected` : `${participants.length} participants`}
                </p>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-green-50 rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Daily limit banner — per-account */}
            <div className="px-6 pt-5 space-y-2">
              {emailStats.accounts
                ? Object.values(emailStats.accounts).map(acct => (
                    <div key={acct.email} className={`rounded-xl p-3 border ${acct.remaining <= 10 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-brand-dark-green flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
                          {acct.label}
                          <span className="text-[9px] font-normal text-on-surface-variant font-mono">{acct.email}</span>
                        </span>
                        <span className={`text-xs font-bold ${acct.remaining <= 10 ? "text-red-600" : "text-brand-vivid-green"}`}>
                          {acct.sent} / {acct.limit} used
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${acct.remaining <= 10 ? "bg-red-500" : "bg-brand-vivid-green"}`}
                          style={{ width: `${Math.min(100, (acct.sent / acct.limit) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                : (
                  <div className={`rounded-xl p-3 border ${emailStats.remaining <= 10 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-brand-dark-green flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
                        Daily Email Limit
                        <span className="text-[9px] font-normal text-on-surface-variant">
                          {emailStats.source === "resend" ? "· live from Resend" : "· app-tracked"}
                        </span>
                      </span>
                      <span className={`text-xs font-bold ${emailStats.remaining <= 10 ? "text-red-600" : "text-brand-vivid-green"}`}>
                        {emailStats.sent} / {emailStats.limit} used
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${emailStats.remaining <= 10 ? "bg-red-500" : "bg-brand-vivid-green"}`}
                        style={{ width: `${(emailStats.remaining / emailStats.limit) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              }
            </div>

            <div className="p-6 space-y-6">
              {/* Send mode toggle */}
              <div className="flex rounded-xl overflow-hidden border border-green-100">
                <button
                  onClick={() => setScheduleMode(false)}
                  className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${!scheduleMode ? "bg-brand-vivid-green text-white" : "bg-white text-on-surface-variant hover:bg-green-50"}`}
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  Send Now
                </button>
                <button
                  onClick={() => setScheduleMode(true)}
                  className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${scheduleMode ? "bg-brand-vivid-green text-white" : "bg-white text-on-surface-variant hover:bg-green-50"}`}
                >
                  <span className="material-symbols-outlined text-sm">schedule_send</span>
                  Schedule
                </button>
              </div>

              {scheduleMode && (
                <div>
                  <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Send Date & Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Send As</label>
                <select
                  value={selectedSenderIndex}
                  onChange={(e) => setSelectedSenderIndex(Number(e.target.value))}
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
                >
                  {SENDER_IDENTITIES.map((s, i) => (
                    <option key={i} value={i}>{s.name}{s.email ? ` (${s.email})` : " (default)"}</option>
                  ))}
                </select>
                <p className="text-xs text-on-surface-variant mt-1">
                  {SENDER_IDENTITIES[selectedSenderIndex].email
                    ? <>Sends directly from <span className="font-mono">{SENDER_IDENTITIES[selectedSenderIndex].email}</span> via Gmail.</>
                    : <>Sends via Resend from <span className="font-mono">noreply@certs.pharmacozyme.com</span>.</>
                  }
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Message</label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={8}
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none resize-none"
                />
                <p className="text-xs text-on-surface-variant mt-2">
                  Available placeholders: [Name], [VerificationLink]
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-green-50 flex justify-end gap-3">
              <button onClick={() => setShowEmailModal(false)} className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl">
                Cancel
              </button>
              <button
                onClick={scheduleMode ? handleScheduleEmails : handleSendEmails}
                disabled={isSending || (scheduleMode && !scheduledAt)}
                className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    {scheduleMode ? "Scheduling..." : "Sending..."}
                  </>
                ) : scheduleMode ? (
                  <>
                    <span className="material-symbols-outlined">schedule_send</span>
                    Schedule for {scheduledAt ? new Date(scheduledAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "..."}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">send</span>
                    Send to {selectedParticipants.length > 0 ? selectedParticipants.length : participants.length} Recipients
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-green-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-headline font-bold text-brand-dark-green">Export Database</h3>
                <p className="text-sm text-on-surface-variant">
                  Export {selectedParticipants.length > 0 ? `${selectedParticipants.length} selected` : `${participants.length} participants`} to file
                </p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-green-50 rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={() => {
                  const exportData = selectedParticipants.length > 0
                    ? participants.filter(p => selectedParticipants.includes(p.id || ""))
                    : participants;
                  const ws = XLSX.utils.json_to_sheet(exportData.map(p => ({
                    Name: p.name,
                    Email: p.email,
                    CertificateID: p.certificateId || "",
                    Status: p.certificateId ? "Generated" : "Pending",
                  })));
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Participants");
                  XLSX.writeFile(wb, `${selectedDatabase?.name.replace(/\s+/g, "_")}_participants.xlsx`);
                  setShowExportModal(false);
                }}
                className="w-full p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4 hover:bg-green-100 transition-colors"
              >
                <span className="material-symbols-outlined text-2xl text-brand-vivid-green">table_chart</span>
                <div className="text-left">
                  <p className="font-bold text-brand-dark-green">Export as XLSX</p>
                  <p className="text-xs text-on-surface-variant">Microsoft Excel format</p>
                </div>
              </button>

              <button
                onClick={() => {
                  const exportData = selectedParticipants.length > 0
                    ? participants.filter(p => selectedParticipants.includes(p.id || ""))
                    : participants;
                  const csvContent = "Name,Email,CertificateID,Status\n" + exportData.map(p => 
                    `"${p.name}","${p.email}","${p.certificateId || ""}","${p.certificateId ? "Generated" : "Pending"}"`
                  ).join("\n");
                  const blob = new Blob([csvContent], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${selectedDatabase?.name.replace(/\s+/g, "_")}_participants.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setShowExportModal(false);
                }}
                className="w-full p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4 hover:bg-green-100 transition-colors"
              >
                <span className="material-symbols-outlined text-2xl text-brand-vivid-green">description</span>
                <div className="text-left">
                  <p className="font-bold text-brand-dark-green">Export as CSV</p>
                  <p className="text-xs text-on-surface-variant">Comma-separated values</p>
                </div>
              </button>

              <button
                onClick={() => {
                  toast.info("PDF export requires certificate generation. Generate certificates first.");
                  sfx.notify();
                  setShowExportModal(false);
                }}
                className="w-full p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-4 hover:bg-green-100 transition-colors"
              >
                <span className="material-symbols-outlined text-2xl text-brand-vivid-green">picture_as_pdf</span>
                <div className="text-left">
                  <p className="font-bold text-brand-dark-green">Export as PDF</p>
                  <p className="text-xs text-on-surface-variant">Print-ready format</p>
                </div>
              </button>
            </div>
            <div className="p-6 border-t border-green-50">
              <button onClick={() => setShowExportModal(false)} className="w-full px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
