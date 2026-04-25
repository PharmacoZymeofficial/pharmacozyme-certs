"use client";

import { useState, useEffect } from "react";

interface ActivityLog {
  id: string;
  type: "cert_generated" | "email_sent" | "email_scheduled";
  adminName: string;
  adminEmail: string;
  databaseId?: string;
  databaseName?: string;
  count: number;
  details: string;
  timestamp: string;
}

const TYPE_CONFIG = {
  cert_generated: { icon: "auto_awesome", label: "Certificates Generated", color: "text-brand-vivid-green bg-green-50 border-green-200" },
  email_sent: { icon: "send", label: "Emails Sent", color: "text-blue-600 bg-blue-50 border-blue-200" },
  email_scheduled: { icon: "schedule_send", label: "Emails Scheduled", color: "text-amber-600 bg-amber-50 border-amber-200" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/activity-logs?limit=200")
      .then(r => r.json())
      .then(data => setLogs(data.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setIsLoading(false));
  }, []);

  const admins = [...new Set(logs.map(l => l.adminName))];

  const filtered = logs.filter(l => {
    if (typeFilter !== "all" && l.type !== typeFilter) return false;
    if (adminFilter !== "all" && l.adminName !== adminFilter) return false;
    return true;
  });

  const stats = {
    certs: logs.filter(l => l.type === "cert_generated").reduce((s, l) => s + l.count, 0),
    emails: logs.filter(l => l.type === "email_sent").reduce((s, l) => s + l.count, 0),
    total: logs.length,
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-green-100 rounded-xl w-1/3" />
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-green-50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      <header className="mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
          Activity History
        </h2>
        <p className="text-on-surface-variant text-sm">Complete log of certificate generation and email activity</p>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs font-bold text-brand-grass-green uppercase mb-1">Total Certs Generated</p>
          <p className="text-3xl font-bold text-brand-dark-green">{stats.certs.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs font-bold text-brand-grass-green uppercase mb-1">Total Emails Sent</p>
          <p className="text-3xl font-bold text-brand-dark-green">{stats.emails.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4">
          <p className="text-xs font-bold text-brand-grass-green uppercase mb-1">Total Actions Logged</p>
          <p className="text-3xl font-bold text-brand-dark-green">{stats.total.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-white border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-vivid-green"
        >
          <option value="all">All Types</option>
          <option value="cert_generated">Certificates Generated</option>
          <option value="email_sent">Emails Sent</option>
          <option value="email_scheduled">Emails Scheduled</option>
        </select>
        <select
          value={adminFilter}
          onChange={e => setAdminFilter(e.target.value)}
          className="bg-white border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-vivid-green"
        >
          <option value="all">All Admins</option>
          {admins.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="ml-auto text-sm text-on-surface-variant self-center">{filtered.length} entries</span>
      </div>

      {/* Log table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-green-100 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">history</span>
          <p className="text-on-surface-variant">No activity logged yet. Generate certificates or send emails to see history.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-green-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-green-50/50 text-brand-grass-green uppercase text-[10px] tracking-widest font-bold">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Database</th>
                  <th className="px-4 py-3">Count</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-50">
                {filtered.map(log => {
                  const cfg = TYPE_CONFIG[log.type] || { icon: "info", label: log.type, color: "text-gray-600 bg-gray-50 border-gray-200" };
                  return (
                    <tr key={log.id} className="hover:bg-green-50/30">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-bold ${cfg.color}`}>
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-brand-dark-green">{log.adminName}</p>
                        <p className="text-[11px] text-on-surface-variant font-mono">{log.adminEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{log.databaseName || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-brand-dark-green">{log.count}</span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant max-w-xs truncate">{log.details}</td>
                      <td className="px-4 py-3">
                        <p className="text-brand-dark-green font-medium">{timeAgo(log.timestamp)}</p>
                        <p className="text-[11px] text-on-surface-variant">{formatDate(log.timestamp)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
