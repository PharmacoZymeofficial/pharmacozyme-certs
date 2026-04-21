"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: "super_admin" | "admin";
}

interface AuthContextType {
  adminUser: AdminUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  adminUser: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <AuthContext.Provider value={{ adminUser, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminUser() {
  return useContext(AuthContext);
}
