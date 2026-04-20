"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmModal";

const navItems = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/certificates", icon: "verified", label: "Certificates" },
  { href: "/admin/databases", icon: "database", label: "Databases" },
  { href: "/admin/templates", icon: "style", label: "Templates" },
  { href: "/admin/categories", icon: "category", label: "Categories" },
  { href: "/admin/bulk-email", icon: "forward_to_inbox", label: "Bulk Email" },
  { href: "/admin/reports", icon: "analytics", label: "Reports" },
  { href: "/admin/settings", icon: "settings", label: "Settings" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();

  const handleLogout = async () => {
    const ok = await confirm({ title: "Sign Out", message: "Sign out of the admin portal?", confirmText: "Sign Out", danger: true });
    if (!ok) return;
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 dark-nav-gradient flex flex-col py-6 gap-2 font-body text-sm tracking-wide z-40 hidden lg:flex overflow-y-auto">
      {/* Logo */}
      <Link href="/admin" className="px-6 mb-8 flex items-center gap-3 hover:opacity-90 transition-opacity">
        <div className="relative w-10 h-10">
          <Image 
            src="/pharmacozyme-logo.png" 
            alt="PharmacoZyme Logo" 
            fill
            className="object-contain"
          />
        </div>
        <div>
          <h1 className="text-xl font-headline font-bold text-white leading-tight">Admin Portal</h1>
          <p className="text-[10px] text-green-300/70 uppercase tracking-[0.1em]">Pharmaceutical Education</p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:translate-x-1 ${
                isActive
                  ? "bg-white/10 text-brand-vivid-green font-semibold"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="px-4 pt-4 mt-auto border-t border-white/10">
        {/* Issue Certificate Button - Links to Issue page */}
        <Link 
          href="/admin/issue" 
          className="w-full py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 mb-6 transition-transform active:scale-95 hover:scale-[1.02]"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Issue Certificate
        </Link>

        {/* Help & Sign Out */}
        <div className="space-y-1">
          <Link href="/admin/help" className="flex items-center gap-3 px-4 py-2 text-white/50 hover:text-white transition-all">
            <span className="material-symbols-outlined">help_outline</span>
            <span>Help</span>
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-white/50 hover:text-red-400 transition-all">
            <span className="material-symbols-outlined">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
