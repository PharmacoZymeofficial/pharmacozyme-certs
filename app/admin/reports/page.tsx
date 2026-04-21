"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { useToast } from "@/components/Toast";

interface Certificate {
  id: string;
  recipientName?: string;
  status?: string;
  issueDate?: string;
  subCategory?: string;
  category?: string;
  uniqueCertId?: string;
}

export default function ReportsPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "certificates"));
      const certs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Certificate[];
      setCertificates(certs);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const total = certificates.length;
  const verified = certificates.filter(c => c.status === "generated").length;
  const pending = certificates.filter(c => c.status === "pending").length;
  const revoked = certificates.filter(c => c.status === "revoked").length;

  const stats = [
    { label: "Total Issued", value: total.toLocaleString(), icon: "workspace_premium", color: "text-brand-vivid-green" },
    { label: "Verified", value: verified.toLocaleString(), icon: "verified", color: "text-blue-500" },
    { label: "Pending", value: pending.toLocaleString(), icon: "pending", color: "text-amber-500" },
    { label: "Revoked", value: revoked.toLocaleString(), icon: "cancel", color: "text-red-500" },
  ];

  // Last 5 certificates as activity
  const recentActivity = [...certificates]
    .sort((a, b) => {
      const da = a.issueDate ? new Date(a.issueDate).getTime() : 0;
      const db2 = b.issueDate ? new Date(b.issueDate).getTime() : 0;
      return db2 - da;
    })
    .slice(0, 5);

  const exportCSV = () => {
    if (!certificates.length) { toast.error("No data to export"); return; }
    const headers = ["ID", "Certificate ID", "Recipient", "Category", "Sub-Category", "Issue Date", "Status"];
    const rows = certificates.map(c => [
      c.id,
      c.uniqueCertId || "",
      c.recipientName || "",
      c.category || "",
      c.subCategory || "",
      c.issueDate || "",
      c.status || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    triggerDownload(csv, "certificates.csv", "text/csv");
  };

  const exportJSON = () => {
    if (!certificates.length) { toast.error("No data to export"); return; }
    triggerDownload(JSON.stringify(certificates, null, 2), "certificates.json", "application/json");
  };

  const triggerDownload = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} downloaded`);
  };

  const activityIcon: Record<string, { icon: string; color: string }> = {
    generated: { icon: "verified", color: "bg-green-100 text-brand-green" },
    pending: { icon: "pending", color: "bg-amber-100 text-amber-600" },
    revoked: { icon: "cancel", color: "bg-red-100 text-error" },
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      <header className="mb-6 lg:mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
            Reports & Analytics
          </h2>
          <p className="text-on-surface-variant font-body text-sm sm:text-base">
            Live certificate metrics from Firestore.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-brand-green rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-sm ${loading ? "animate-spin" : ""}`}>
            {loading ? "progress_activity" : "refresh"}
          </span>
          Refresh
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-4 sm:p-6 rounded-xl border border-green-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-lg ${stat.color}`}>{stat.icon}</span>
              <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">{stat.label}</p>
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
            ) : (
              <p className="text-2xl sm:text-3xl font-headline font-bold text-brand-dark-green">{stat.value}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Log */}
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-green-50">
            <h3 className="text-lg font-headline font-bold text-brand-dark-green">Recent Certificates</h3>
          </div>
          <div className="divide-y divide-green-50">
            {loading ? (
              <div className="p-8 flex justify-center">
                <span className="material-symbols-outlined animate-spin text-brand-vivid-green">progress_activity</span>
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm">No certificates yet.</div>
            ) : (
              recentActivity.map((cert) => {
                const meta = activityIcon[cert.status || ""] || { icon: "description", color: "bg-gray-100 text-gray-500" };
                return (
                  <div key={cert.id} className="p-4 flex items-start gap-4 hover:bg-green-50/30 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      <span className="material-symbols-outlined text-lg">{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-dark-green truncate">
                        {cert.recipientName || "Unknown"} — {cert.uniqueCertId || cert.id}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {cert.subCategory || cert.category || "No category"} · {cert.issueDate || "No date"} · <span className="capitalize">{cert.status || "unknown"}</span>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Export Options */}
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-green-50">
            <h3 className="text-lg font-headline font-bold text-brand-dark-green">Export Data</h3>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <p className="text-sm text-on-surface-variant">
              Download {total > 0 ? `${total} certificates` : "certificate data"} for backup or analysis.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={exportCSV}
                className="flex items-center justify-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl text-brand-green transition-colors"
              >
                <span className="material-symbols-outlined">table_chart</span>
                <span className="font-medium">Export CSV</span>
              </button>
              <button
                onClick={exportJSON}
                className="flex items-center justify-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl text-brand-green transition-colors"
              >
                <span className="material-symbols-outlined">description</span>
                <span className="font-medium">Export JSON</span>
              </button>
              <button
                onClick={() => toast.info("Use CSV export for spreadsheet-compatible format")}
                className="flex items-center justify-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl text-brand-green transition-colors"
              >
                <span className="material-symbols-outlined">picture_as_pdf</span>
                <span className="font-medium">Export PDF</span>
              </button>
              <button
                onClick={exportJSON}
                className="flex items-center justify-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl text-brand-green transition-colors"
              >
                <span className="material-symbols-outlined">download</span>
                <span className="font-medium">Full Backup</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
