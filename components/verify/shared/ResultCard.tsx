"use client";

import { useState } from "react";
import { avatarGradient, initials, fmtDate } from "./format";

export interface SearchResult {
  id: string;
  uniqueCertId: string;
  recipientName: string;
  category: string;
  subCategory: string;
  topic: string;
  certType: string;
  issueDate: string;
  status: string;
}

export default function ResultCard({
  result,
  index,
  onSelect,
}: {
  result: SearchResult;
  index: number;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const label = result.topic || result.certType || result.subCategory || result.category;
  const isActive = result.status === "generated" || result.status === "sent";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(result.uniqueCertId)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(result.uniqueCertId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl p-5 flex flex-col gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-grass-green/50"
      style={{
        background: "#ffffff",
        border: hovered ? "1px solid #52b788" : "1px solid #e5ebe5",
        boxShadow: hovered
          ? "0 12px 32px rgba(27,67,50,0.10),0 0 0 1px rgba(82,183,136,0.20)"
          : "0 1px 4px rgba(15,46,28,0.04)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)",
        animation: `slideUpFade 0.4s cubic-bezier(0.16,1,0.3,1) ${index * 65}ms both`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
          style={{ background: avatarGradient(result.recipientName), boxShadow: "0 2px 6px rgba(27,67,50,0.20)" }}
        >
          {initials(result.recipientName)}
        </div>
        <div className="min-w-0">
          <p className="text-brand-dark-green font-semibold text-sm leading-tight truncate">{result.recipientName}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {label || "Certificate"}
          </p>
        </div>
      </div>

      <div className="px-3 py-2 rounded-xl bg-green-50 border border-green-100">
        <p className="text-[9px] uppercase tracking-widest mb-0.5 text-brand-grass-green/70 font-bold">
          Certificate ID
        </p>
        <p className="text-xs font-mono truncate text-brand-dark-green">
          {result.uniqueCertId || "—"}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Issued</p>
          <p className="text-xs text-gray-600">{fmtDate(result.issueDate)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isActive ? "#22c55e" : "#94a3b8", boxShadow: isActive ? "0 0 6px rgba(34,197,94,0.6)" : "none" }}
          />
          <span className="text-[10px] font-medium" style={{ color: isActive ? "#16a34a" : "#94a3b8" }}>
            {isActive ? "Issued" : result.status}
          </span>
        </div>
      </div>

      <div
        className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
        style={{
          background: hovered ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#f3f7f3",
          color: hovered ? "#fff" : "#1b4332",
          border: hovered ? "1px solid #16a34a" : "1px solid #e5ebe5",
          boxShadow: hovered ? "0 4px 14px rgba(34,197,94,0.30)" : "none",
          transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        Verify Certificate
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </div>
    </div>
  );
}
