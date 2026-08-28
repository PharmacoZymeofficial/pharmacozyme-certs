"use client";

import type { JSX } from "react";
import { SENDER_IDENTITIES } from "@/components/admin/databases/constants";

interface EmailModalProps {
  open: boolean;
  onClose: () => void;
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  emailMessage: string;
  setEmailMessage: (v: string) => void;
  isSending: boolean;
  sendProgress: { current: number; total: number };
  emailStats: {
    sent: number; limit: number; remaining: number; source: string;
    accounts?: Record<string, { sent: number; limit: number; remaining: number; label: string; email: string }>;
  };
  scheduleMode: boolean;
  setScheduleMode: (v: boolean) => void;
  scheduledAt: string;
  setScheduledAt: (v: string) => void;
  selectedSenderIndex: number;
  setSelectedSenderIndex: (v: number) => void;
  onSend: () => void;
  onSchedule: () => void;
  emailResult: { sent: number; failed: number; queued: number; failures: { email: string; name: string; error: string }[] } | null;
  onRetryFailed: () => void;
  selectedCount: number;
  totalCount: number;
}

export default function EmailModal({
  open,
  onClose,
  emailSubject,
  setEmailSubject,
  emailMessage,
  setEmailMessage,
  isSending,
  sendProgress,
  emailStats,
  scheduleMode,
  setScheduleMode,
  scheduledAt,
  setScheduledAt,
  selectedSenderIndex,
  setSelectedSenderIndex,
  onSend,
  onSchedule,
  emailResult,
  onRetryFailed,
  selectedCount,
  totalCount,
}: EmailModalProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-green-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">Send Certificates via Email</h3>
            <p className="text-sm text-on-surface-variant">
              Send certificates to {selectedCount > 0 ? `${selectedCount} selected` : `${totalCount} participants`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-green-50 rounded-lg">
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
                ? <>Sends from <span className="font-mono">{SENDER_IDENTITIES[selectedSenderIndex].email}</span> via Brevo.</>
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

        {emailResult && (
          <div className="mx-6 mb-4 rounded-xl border border-green-100 p-4">
            <p className="text-sm font-semibold text-brand-dark-green">
              {emailResult.sent} sent
              {emailResult.failed > 0 && <span className="text-red-600"> · {emailResult.failed} failed</span>}
              {emailResult.queued > 0 && <span className="text-amber-600"> · {emailResult.queued} queued</span>}
            </p>
            {emailResult.failures.length > 0 && (
              <>
                <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-on-surface-variant space-y-1">
                  {emailResult.failures.map((f) => (
                    <li key={f.email}><span className="font-medium">{f.name}</span> ({f.email}) — {f.error}</li>
                  ))}
                </ul>
                <button
                  onClick={onRetryFailed}
                  disabled={isSending}
                  className="mt-3 px-4 py-2 vivid-gradient-cta rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  Retry failed ({emailResult.failures.length})
                </button>
              </>
            )}
          </div>
        )}

        <div className="p-6 border-t border-green-50 flex justify-end gap-3">
          {emailResult ? (
            <button
              onClick={onClose}
              className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center gap-2"
            >
              Close
            </button>
          ) : (
            <>
              <button onClick={onClose} className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl">
                Cancel
              </button>
              <button
                onClick={scheduleMode ? onSchedule : onSend}
                disabled={isSending || (scheduleMode && !scheduledAt)}
                className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    {scheduleMode ? "Scheduling..." : sendProgress.total > 0 ? `Sending ${sendProgress.current}/${sendProgress.total}...` : "Sending..."}
                  </>
                ) : scheduleMode ? (
                  <>
                    <span className="material-symbols-outlined">schedule_send</span>
                    Schedule for {scheduledAt ? new Date(scheduledAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "..."}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">send</span>
                    Send to {selectedCount > 0 ? selectedCount : totalCount} Recipients
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
