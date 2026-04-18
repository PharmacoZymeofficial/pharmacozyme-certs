"use client";

import { ReactNode } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import AdminMobileNav from "@/components/AdminMobileNav";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmModal";

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  return (
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
  );
}
