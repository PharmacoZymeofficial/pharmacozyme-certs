"use client";

import { useState, useEffect, useCallback } from "react";
import BulkEmailForm from "@/components/BulkEmailForm";


interface ScheduledJob {
  id: string;
  recipients: { email: string; name: string }[];
  subject: string;
  scheduledAt: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  autoQueued?: boolean;
  createdAt: string;
  sentAt?: string;
}

export default function BulkEmailPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduled-emails");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch { /* non-fatal */ } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await fetch(`/api/scheduled-emails/${id}`, { method: "DELETE" });
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: "cancelled" } : j));
    } catch { /* non-fatal */ } finally {
      setCancellingId(null);
    }
  };

  const pending = jobs.filter(j => j.status === "pending");
  const history = jobs.filter(j => j.status !== "pending");

  const statusColor: Record<string, string> = {
    sent: "bg-green-50 text-brand-vivid-green",
    failed: "bg-red-50 text-red-600",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      <header className="mb-6 lg:mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
          Bulk Email Dispatch
        </h2>
        <p className="text-on-surface-variant font-body text-sm sm:text-base">
          Send certificates and notifications to multiple recipients at once.
        </p>
      </header>

      <div className="max-w-4xl space-y-8">
        <BulkEmailForm onJobScheduled={fetchJobs} />

        {/* Scheduled (pending) jobs */}
        {(loadingJobs || pending.length > 0) && (
          <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-green-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-headline font-bold text-brand-dark-green">Scheduled Sends</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">{pending.length} pending • processed hourly</p>
              </div>
              <span className="material-symbols-outlined text-brand-vivid-green" style={{ fontVariationSettings: "'FILL' 1" }}>schedule_send</span>
            </div>
            {loadingJobs ? (
              <div className="p-8 flex justify-center">
                <span className="material-symbols-outlined animate-spin text-brand-vivid-green">progress_activity</span>
              </div>
            ) : (
              <div className="divide-y divide-green-50">
                {pending.map(job => (
                  <div key={job.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-brand-dark-green truncate">{job.subject}</p>
                        {job.autoQueued && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold border border-amber-200">
                            Auto-queued (quota)
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-on-surface-variant mt-0.5">
                        {job.recipients?.length ?? 0} recipients • Scheduled for{" "}
                        <span className="font-medium text-brand-dark-green">
                          {new Date(job.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancel(job.id)}
                      disabled={cancellingId === job.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {cancellingId === job.id ? (
                        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">cancel</span>
                      )}
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-green-50">
            <h3 className="text-lg font-headline font-bold text-brand-dark-green">History</h3>
          </div>
          <div className="divide-y divide-green-50">
            {history.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm">No sent or cancelled emails yet.</div>
            ) : (
              history.map(job => (
                <div key={job.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-green-50/30 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-brand-dark-green">{job.subject}</p>
                      {job.autoQueued && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold border border-amber-200">
                          Auto-queued
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-on-surface-variant">
                      {job.recipients?.length ?? 0} recipients •{" "}
                      {job.sentAt
                        ? `Sent ${new Date(job.sentAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
                        : new Date(job.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${statusColor[job.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {job.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
