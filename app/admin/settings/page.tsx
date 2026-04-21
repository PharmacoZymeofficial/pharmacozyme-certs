"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/components/Toast";
import { useAdminUser } from "@/lib/auth-context";

interface AdminRecord {
  uid: string;
  email: string;
  displayName: string;
  role: "super_admin" | "admin";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export default function SettingsPage() {
  const { adminUser } = useAdminUser();
  const toast = useToast();
  const isSuperAdmin = adminUser?.role === "super_admin";

  const [senderName, setSenderName] = useState("PharmacoZyme Certificates");
  const [senderEmail, setSenderEmail] = useState("noreply@certs.pharmacozyme.com");
  const [orgName, setOrgName] = useState("PharmacoZyme");
  const [saving, setSaving] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "global"));
      if (snap.exists()) {
        const data = snap.data();
        if (data.senderName) setSenderName(data.senderName);
        if (data.senderEmail) setSenderEmail(data.senderEmail);
        if (data.orgName) setOrgName(data.orgName);
      }
    } catch { /* non-fatal */ } finally {
      setLoadingSettings(false);
    }
  }, []);

  const loadAdmins = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoadingAdmins(true);
    try {
      const snap = await getDocs(collection(db, "admins"));
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() })) as AdminRecord[];
      list.sort((a, b) => {
        const order = { pending: 0, approved: 1, rejected: 2 };
        return (order[a.status] ?? 1) - (order[b.status] ?? 1);
      });
      setAdmins(list);
    } catch { /* non-fatal */ } finally {
      setLoadingAdmins(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { if (isSuperAdmin) loadAdmins(); }, [isSuperAdmin, loadAdmins]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "global"), {
        senderName: senderName.trim(),
        senderEmail: senderEmail.trim(),
        orgName: orgName.trim(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAdminAction = async (uid: string, action: "approve" | "reject" | "reactivate" | "delete") => {
    setApprovingId(uid);
    try {
      if (action === "delete") {
        await deleteDoc(doc(db, "admins", uid));
        setAdmins(prev => prev.filter(a => a.uid !== uid));
        toast.success("Admin deleted");
      } else if (action === "reactivate") {
        await updateDoc(doc(db, "admins", uid), { status: "pending", updatedAt: new Date().toISOString() });
        setAdmins(prev => prev.map(a => a.uid === uid ? { ...a, status: "pending" } : a));
        toast.success("Admin reactivated — pending approval");
      } else {
        const newStatus = action === "approve" ? "approved" : "rejected";
        await updateDoc(doc(db, "admins", uid), { status: newStatus, updatedAt: new Date().toISOString() });
        setAdmins(prev => prev.map(a => a.uid === uid ? { ...a, status: newStatus } : a));
        toast.success(`Admin ${newStatus}`);
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setApprovingId(null);
    }
  };

  const statusBadge: Record<string, string> = {
    approved: "bg-green-50 text-brand-vivid-green border border-green-200",
    pending: "bg-amber-50 text-amber-600 border border-amber-200",
    rejected: "bg-red-50 text-red-600 border border-red-200",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      <header className="mb-6 lg:mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
          Settings
        </h2>
        <p className="text-on-surface-variant font-body text-sm sm:text-base">
          Configure your certificate verification system.
        </p>
      </header>

      <div className="max-w-3xl space-y-6">
        {/* Organisation Settings */}
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-green-50">
            <h3 className="text-lg font-headline font-bold text-brand-dark-green">Organisation</h3>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-brand-grass-green uppercase">Organisation Name</label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                disabled={loadingSettings}
                className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
              />
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-green-50">
            <h3 className="text-lg font-headline font-bold text-brand-dark-green">Email Settings</h3>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-brand-grass-green uppercase">Sender Name</label>
              <input
                type="text"
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                disabled={loadingSettings}
                className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-brand-grass-green uppercase">Sender Email</label>
              <input
                type="email"
                value={senderEmail}
                onChange={e => setSenderEmail(e.target.value)}
                disabled={loadingSettings}
                className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
              />
              <p className="text-xs text-on-surface-variant">Must be a verified domain in your Resend account.</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving || loadingSettings}
            className="px-8 py-3 vivid-gradient-cta text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Saving...</>
            ) : (
              <><span className="material-symbols-outlined text-sm">save</span>Save Changes</>
            )}
          </button>
        </div>

        {/* Admin Management — super admin only */}
        {isSuperAdmin && (
          <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-green-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-headline font-bold text-brand-dark-green">Admin Management</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Approve or reject admin access requests.</p>
              </div>
              <button
                onClick={loadAdmins}
                disabled={loadingAdmins}
                className="flex items-center gap-1 text-xs text-brand-green hover:underline"
              >
                <span className={`material-symbols-outlined text-sm ${loadingAdmins ? "animate-spin" : ""}`}>refresh</span>
                Refresh
              </button>
            </div>

            <div className="divide-y divide-green-50">
              {loadingAdmins ? (
                <div className="p-8 flex justify-center">
                  <span className="material-symbols-outlined animate-spin text-brand-vivid-green">progress_activity</span>
                </div>
              ) : admins.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant text-sm">No admin accounts yet.</div>
              ) : (
                admins.map(admin => (
                  <div key={admin.uid} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-sm text-brand-green">
                          {admin.role === "super_admin" ? "admin_panel_settings" : "person"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-brand-dark-green">{admin.displayName}</p>
                        <p className="text-xs text-on-surface-variant">{admin.email}</p>
                        <p className="text-[10px] text-on-surface-variant capitalize">{admin.role === "super_admin" ? "Super Admin" : "Admin"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusBadge[admin.status] ?? ""}`}>
                        {admin.status}
                      </span>
                      {admin.status === "pending" && admin.uid !== adminUser?.uid && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAdminAction(admin.uid, "approve")}
                            disabled={approvingId === admin.uid}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAdminAction(admin.uid, "reject")}
                            disabled={approvingId === admin.uid}
                            className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {admin.status === "approved" && admin.uid !== adminUser?.uid && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAdminAction(admin.uid, "reject")}
                            disabled={approvingId === admin.uid}
                            className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors disabled:opacity-50"
                          >
                            Revoke
                          </button>
                          <button
                            onClick={() => handleAdminAction(admin.uid, "delete")}
                            disabled={approvingId === admin.uid}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      {admin.status === "rejected" && admin.uid !== adminUser?.uid && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAdminAction(admin.uid, "reactivate")}
                            disabled={approvingId === admin.uid}
                            className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            Make Admin
                          </button>
                          <button
                            onClick={() => handleAdminAction(admin.uid, "delete")}
                            disabled={approvingId === admin.uid}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
