"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/certificates", icon: "list_alt", label: "Records" },
  { href: "/admin/bulk-email", icon: "send", label: "Mail" },
  { href: "/admin/settings", icon: "settings", label: "Settings" },
];

export default function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl shadow-sm shadow-green-900/5 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8">
            <Image 
              src="/pharmacozyme-logo.png" 
              alt="PharmacoZyme Logo" 
              fill
              className="object-contain"
            />
          </div>
          <span className="font-headline text-lg font-bold text-green-800">Admin</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-green-100 overflow-hidden">
          <Image 
            src="/pharmacozyme-logo.png" 
            alt="Profile" 
            fill
            className="object-cover"
          />
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-end px-4 pb-4 h-20 bg-white/90 backdrop-blur-md shadow-[0_-8px_30px_rgb(0,0,0,0.04)] rounded-t-2xl">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center pb-2 transition-colors ${
                isActive ? "text-brand-vivid-green" : "text-stone-400"
              }`}
            >
              <span className="material-symbols-outlined text-2xl">
                {item.icon}
              </span>
              <span className="text-[11px] font-body tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
