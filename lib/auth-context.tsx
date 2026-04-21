"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: "super_admin" | "admin";
}

interface AuthContextType {
  adminUser: AdminUser | null;
  loading: boolean;
  revoked: boolean;
  revokedReason: "rejected" | "deleted" | null;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  adminUser: null,
  loading: true,
  revoked: false,
  revokedReason: null,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoked, setRevoked] = useState(false);
  const [revokedReason, setRevokedReason] = useState<"rejected" | "deleted" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/me");
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.user || null);
      } else {
        setAdminUser(null);
      }
    } catch {
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Real-time listener — fires instantly when super admin revokes or deletes this account
  useEffect(() => {
    if (!adminUser?.uid || adminUser.uid === "legacy") return;

    const unsub = onSnapshot(
      doc(db, "admins", adminUser.uid),
      (snap) => {
        if (!snap.exists()) {
          setRevoked(true);
          setRevokedReason("deleted");
          fetch("/api/admin/auth", { method: "DELETE" }).catch(() => {});
        } else {
          const status = snap.data()?.status;
          if (status === "rejected" || status === "pending") {
            setRevoked(true);
            setRevokedReason("rejected");
            fetch("/api/admin/auth", { method: "DELETE" }).catch(() => {});
          }
        }
      },
      () => {} // silently ignore listener errors
    );

    return unsub;
  }, [adminUser?.uid]);

  return (
    <AuthContext.Provider value={{ adminUser, loading, revoked, revokedReason, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminUser() {
  return useContext(AuthContext);
}
