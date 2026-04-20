"use client";

import { useState, useEffect } from "react";
import { Database, Participant } from "@/lib/types";
import CertificateGenerator from "@/components/CertificateGenerator";
import * as XLSX from "xlsx";

interface BulkEmailFormProps {
  categories: string[];
  templates: string[];
}

export default function BulkEmailForm({ categories, templates }: BulkEmailFormProps) {
  const [step, setStep] = useState<"select" | "template" | "generate" | "send">("select");
  const [databases, setDatabases] = useState<Database[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [uploadedTemplates, setUploadedTemplates] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [emailStats, setEmailStats] = useState({ sent: 0, limit: 100, remaining: 100 });
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [subject, setSubject] = useState("Your Certificate from PharmacoZyme");
  const [message, setMessage] = useState("Dear [Name],\n\nCongratulations! Your certificate is now ready.\n\nYou can verify your certificate at: [VerificationLink]\n\nBest regards,\nPharmacoZyme Team");

  useEffect(() => {
    fetchDatabases();
    fetchTemplates();
    fetch("/api/email-stats").then(r => r.json()).then(d => setEmailStats({ sent: d.sent ?? 0, limit: d.limit ?? 100, remaining: d.remaining ?? 100 })).catch(() => {});
  }, []);

  const fetchDatabases = async () => {
    try {
      const res = await fetch("/api/databases");
      const data = await res.json();
      if (data.databases) {
        setDatabases(data.databases);
      }
    } catch (err) {
      console.error("Error fetching databases:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.templates) {
        setUploadedTemplates(data.templates);
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
    }
  };

  const fetchParticipants = async (databaseId: string) => {
    try {
      const res = await fetch(`/api/participants?databaseId=${databaseId}`);
      const data = await res.json();
      if (data.participants) {
        setParticipants(data.participants);
      }
    } catch (err) {
      console.error("Error fetching participants:", err);
    }
  };

  const handleDatabaseSelect = (db: Database) => {
    setSelectedDatabase(db);
    setSelectedParticipants([]);
    fetchParticipants(db.id!);
    setStep("template");
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    setStep("generate");
  };

  const handleParticipantsChange = (ids: string[]) => {
    setSelectedParticipants(ids);
  };

  const handleSend = async () => {
    const targets = selectedParticipants.length > 0
      ? participants.filter(p => selectedParticipants.includes(p.id || ""))
      : participants;
    if (!targets.length) { setError("No recipients selected."); return; }
    setIsSending(true);
    setError("");
    try {
      const emailRecipients = targets.map(p => ({
        email: p.email, name: p.name, certificateId: p.certificateId || "", driveLink: p.driveLink || "",
      }));

      if (scheduleMode) {
        if (!scheduledAt) { setError("Please pick a date and time."); setIsSending(false); return; }
        const res = await fetch("/api/scheduled-emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipients: emailRecipients, subject, message, scheduledAt }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setSuccess(`Emails scheduled for ${new Date(scheduledAt).toLocaleString()}!`);
      } else {
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipients: emailRecipients, subject, message }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setSuccess(`Emails sent! ${result.sent} delivered${result.failed ? `, ${result.failed} failed` : ""}.`);
        setEmailStats(prev => ({ ...prev, sent: prev.sent + (result.sent ?? 0), remaining: prev.remaining - (result.sent ?? 0) }));
      }

      setStep("select");
      setSelectedDatabase(null);
      setParticipants([]);
      setSelectedParticipants([]);
    } catch (err: any) {
      setError(err.message || "Failed to send emails. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleExport = (format: "xlsx" | "csv") => {
    const exportData = selectedParticipants.length > 0
      ? participants.filter(p => selectedParticipants.includes(p.id || ""))
      : participants;

    if (format === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(exportData.map(p => ({
        Name: p.name,
        Email: p.email,
        CertificateID: p.certificateId || "",
        Status: p.certificateId ? "Generated" : "Pending",
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Participants");
      XLSX.writeFile(wb, `${selectedDatabase?.name.replace(/\s+/g, "_")}_participants.xlsx`);
    } else {
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
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <span className="material-symbols-outlined animate-spin text-4xl text-brand-vivid-green">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-green-100 shadow-sm p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-100 flex items-center justify-center text-brand-green flex-shrink-0">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>forward_to_inbox</span>
        </div>
        <div>
          <h4 className="text-lg font-headline font-bold text-brand-dark-green">Bulk Email Workflow</h4>
          <p className="text-sm text-on-surface-variant hidden sm:block">
            Select database → Choose template → Generate PDFs → Send emails
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {["select", "template", "generate", "send"].map((s, idx) => (
          <div key={s} className="flex items-center">
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              step === s 
                ? "bg-brand-vivid-green text-white" 
                : ["select", "template", "generate", "send"].indexOf(step) > idx
                  ? "bg-green-100 text-brand-vivid-green"
                  : "bg-gray-100 text-gray-400"
            }`}>
              {idx + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
            {idx < 3 && <span className="material-symbols-outlined text-gray-300 mx-1">chevron_right</span>}
          </div>
        ))}
      </div>

      {/* Messages */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          {success}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Select Database */}
      {step === "select" && (
        <div className="space-y-4">
          <h5 className="font-bold text-brand-dark-green">Select Database</h5>
          {databases.length === 0 ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-4xl text-gray-300">folder_off</span>
              <p className="text-on-surface-variant mt-2">No databases found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {databases.map((db) => (
                <button
                  key={db.id}
                  onClick={() => handleDatabaseSelect(db)}
                  className="p-4 border-2 border-green-100 rounded-xl text-left hover:border-brand-vivid-green hover:bg-green-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-brand-green">folder</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-brand-dark-green truncate">{db.name}</p>
                      <p className="text-xs text-on-surface-variant">{db.category} - {db.subCategory}</p>
                      <p className="text-xs text-on-surface-variant truncate">{db.topic}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Template */}
      {step === "template" && selectedDatabase && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-brand-dark-green">Select Certificate Template</h5>
            <button onClick={() => setStep("select")} className="text-sm text-brand-grass-green hover:underline">
              ← Back
            </button>
          </div>
          
          <p className="text-sm text-on-surface-variant">
            Database: <span className="font-bold">{selectedDatabase.name}</span> ({participants.length} participants)
          </p>

          <div className="grid grid-cols-2 gap-4">
            {uploadedTemplates.length > 0 ? (
              uploadedTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className="p-4 border-2 border-green-100 rounded-xl text-left hover:border-brand-vivid-green hover:bg-green-50 transition-all"
                >
                  <div className="w-full h-20 bg-gradient-to-br from-green-50 to-green-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                    {template.fileUrl ? (
                      <iframe 
                        src={`${template.fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitV`}
                        className="w-full h-full object-cover"
                        title={`${template.name} preview`}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-3xl text-brand-green/40">picture_as_pdf</span>
                    )}
                  </div>
                  <p className="font-bold text-brand-dark-green">{template.name}</p>
                </button>
              ))
            ) : (
              <div className="col-span-2 text-center py-8">
                <span className="material-symbols-outlined text-4xl text-gray-300">style</span>
                <p className="text-on-surface-variant mt-2">No custom templates uploaded</p>
                <p className="text-xs text-on-surface-variant">Go to Templates page to upload templates</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Generate & Select Participants */}
      {step === "generate" && selectedDatabase && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-brand-dark-green">Select Participants</h5>
            <button onClick={() => setStep("template")} className="text-sm text-brand-grass-green hover:underline">
              ← Back
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSelectedParticipants(participants.map(p => p.id || ""))}
              className="px-3 py-1 text-xs bg-green-100 text-brand-vivid-green rounded-full hover:bg-green-200"
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedParticipants([])}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
            >
              Clear
            </button>
            <span className="px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded-full">
              {selectedParticipants.length > 0 ? `${selectedParticipants.length} selected` : `${participants.length} total`}
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto border border-green-100 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-green-50 sticky top-0">
                <tr>
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.length === participants.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedParticipants(participants.map(p => p.id || ""));
                        } else {
                          setSelectedParticipants([]);
                        }
                      }}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-50">
                {participants.map((p) => (
                  <tr key={p.id} className="hover:bg-green-50/30">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(p.id || "")}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedParticipants([...selectedParticipants, p.id || ""]);
                          } else {
                            setSelectedParticipants(selectedParticipants.filter(id => id !== p.id));
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="p-3">{p.name}</td>
                    <td className="p-3 text-on-surface-variant">{p.email}</td>
                    <td className="p-3">
                      {p.certificateId ? (
                        <span className="text-xs text-green-600 font-bold">✓ Generated</span>
                      ) : (
                        <span className="text-xs text-gray-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Export options */}
          <div className="flex gap-2 pt-4 border-t border-green-50">
            <button
              onClick={() => handleExport("xlsx")}
              className="px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-100"
            >
              <span className="material-symbols-outlined text-sm">table_chart</span>
              Export XLSX
            </button>
            <button
              onClick={() => handleExport("csv")}
              className="px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-100"
            >
              <span className="material-symbols-outlined text-sm">description</span>
              Export CSV
            </button>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setStep("send")}
              disabled={participants.length === 0}
              className="flex-1 px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined">send</span>
              Continue to Send ({selectedParticipants.length > 0 ? selectedParticipants.length : participants.length})
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Send */}
      {step === "send" && selectedDatabase && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-brand-dark-green">Send Certificates</h5>
            <button onClick={() => setStep("generate")} className="text-sm text-brand-grass-green hover:underline">
              ← Back
            </button>
          </div>

          {/* Daily limit bar */}
          <div className={`rounded-xl p-3 border ${emailStats.remaining <= 10 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold text-brand-dark-green flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
                Daily Limit (Resend Free)
              </span>
              <span className={`text-xs font-bold ${emailStats.remaining <= 10 ? "text-red-600" : "text-brand-vivid-green"}`}>
                {emailStats.remaining} / {emailStats.limit} remaining
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${emailStats.remaining <= 10 ? "bg-red-500" : "bg-brand-vivid-green"}`}
                style={{ width: `${(emailStats.remaining / emailStats.limit) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-green-50 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-on-surface-variant">Database</p>
                <p className="font-bold text-brand-dark-green">{selectedDatabase.name}</p>
              </div>
              <div>
                <p className="text-on-surface-variant">Recipients</p>
                <p className="font-bold text-brand-dark-green">{selectedParticipants.length > 0 ? selectedParticipants.length : participants.length}</p>
              </div>
              <div>
                <p className="text-on-surface-variant">Template</p>
                <p className="font-bold text-brand-dark-green">{uploadedTemplates.find(t => t.id === selectedTemplate)?.name || "Standard"}</p>
              </div>
              <div>
                <p className="text-on-surface-variant">Status</p>
                <p className="font-bold text-brand-vivid-green">Ready to send</p>
              </div>
            </div>
          </div>

          {/* Send / Schedule toggle */}
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
            <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Email Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm resize-none outline-none"
            />
            <p className="text-xs text-on-surface-variant mt-2">Placeholders: [Name], [VerificationLink]</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSend}
              disabled={isSending || (scheduleMode && !scheduledAt)}
              className="flex-1 px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
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
      )}
    </div>
  );
}