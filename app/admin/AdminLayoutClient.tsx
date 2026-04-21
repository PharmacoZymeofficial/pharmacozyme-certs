"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import AdminMobileNav from "@/components/AdminMobileNav";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmModal";
import { AuthProvider } from "@/lib/auth-context";

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <div className="min-h-screen bg-surface-container-low">
            <AdminSidebar />
            <AdminMobileNav />
            <main className="lg:ml-64 pt-16 lg:pt-0 pb-24 lg:pb-0">
              {children}
            </main>
          </div>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
