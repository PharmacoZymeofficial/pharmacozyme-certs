"use client";

import { useState } from "react";
import { sfx } from "@/lib/sfx";

const categoryStructure: Record<string, string[]> = {
  General: ["Courses", "Workshops", "Webinars", "MED-Q"],
  Official: ["Central Team", "Sub Team", "Ambassadors", "Affiliates", "Mentors"],
};

interface VerifyFormProps {
  onVerify: (certId: string, category?: string, subCategory?: string) => void;
  isLoading: boolean;
  defaultValue?: string;
  dark?: boolean;
}

export default function VerifyForm({ onVerify, isLoading, defaultValue = "", dark }: VerifyFormProps) {
  const [certId, setCertId] = useState(defaultValue);
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (certId.trim()) {
      sfx.click();
      onVerify(certId.trim(), category || undefined, subCategory || undefined);
    }
  };

  const subCategories = category ? (categoryStructure[category] || []) : [];

  const inputClass = dark
    ? "w-full h-12 sm:h-14 px-4 sm:px-5 bg-white/6 rounded-xl border border-white/10 focus:border-[#52b788]/40 focus:bg-white/8 font-mono text-white placeholder:text-white/25 transition-all text-xs sm:text-sm outline-none"
    : "w-full h-12 sm:h-14 px-4 sm:px-6 bg-surface-container-low rounded-xl border-2 border-transparent focus:border-vivid-green/30 focus:ring-0 font-mono text-dark-green placeholder:text-outline/40 transition-all text-xs sm:text-sm outline-none";

  const filterToggleClass = dark
    ? "flex items-center gap-1.5 text-[10px] text-[#52b788]/40 hover:text-[#52b788] transition-colors font-medium uppercase tracking-wider cursor-pointer"
    : "flex items-center gap-1.5 text-[10px] text-outline hover:text-vivid-green transition-colors font-medium uppercase tracking-wider cursor-pointer";

  const selectClass = dark
    ? "w-full h-10 px-3 bg-white/6 rounded-xl border border-white/10 focus:border-[#52b788]/40 text-white text-xs appearance-none cursor-pointer outline-none"
    : "w-full h-10 px-3 bg-surface-container-low rounded-xl border-2 border-transparent focus:border-vivid-green/30 text-dark-green text-xs appearance-none cursor-pointer outline-none";

  const labelClass = dark
    ? "block text-[9px] font-bold uppercase tracking-[0.15em] text-[#52b788]/40 mb-1.5 px-1"
    : "block text-[9px] font-bold uppercase tracking-[0.15em] text-outline mb-1.5 px-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div>
        <label className={dark
          ? "block text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-[#52b788]/40 mb-1.5 sm:mb-2"
          : "block text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-1.5 sm:mb-2 px-1"
        }>
          Certificate ID Number
        </label>
        <input
          type="text"
          value={certId}
          onChange={(e) => setCertId(e.target.value)}
          placeholder="e.g. PZ-2024-XXXX-9821"
          className={inputClass}
          disabled={isLoading}
        />
      </div>

      <button
        type="button"
        onClick={() => { setShowFilters(v => !v); if (showFilters) { setCategory(""); setSubCategory(""); } }}
        className={filterToggleClass}
      >
        <span className="material-symbols-outlined text-sm">{showFilters ? "expand_less" : "tune"}</span>
        {showFilters ? "Hide Filters" : "Filter by Category (optional)"}
      </button>

      {showFilters && (
        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <label className={labelClass}>Category</label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setSubCategory(""); }}
              disabled={isLoading}
              className={selectClass}
            >
              <option value="">Any</option>
              {Object.keys(categoryStructure).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Sub-Category</label>
            <select
              value={subCategory}
              onChange={e => setSubCategory(e.target.value)}
              disabled={isLoading || !category}
              className={`${selectClass} disabled:opacity-40`}
            >
              <option value="">Any</option>
              {subCategories.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !certId.trim()}
        className={`
          w-full h-12 sm:h-14 rounded-xl font-bold uppercase tracking-widest text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer
          ${isLoading || !certId.trim()
            ? "opacity-40 cursor-not-allowed"
            : "active:scale-[0.98]"
          }
        `}
        style={{
          background: (isLoading || !certId.trim())
            ? (dark ? "rgba(255,255,255,0.08)" : "#e5e7eb")
            : "linear-gradient(135deg, #52b788 0%, #2d6a4f 100%)",
          color: (isLoading || !certId.trim()) ? (dark ? "rgba(255,255,255,0.3)" : "#9ca3af") : "white",
        }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
            Verifying...
          </span>
        ) : (
          <>
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
            Verify Now
          </>
        )}
      </button>
    </form>
  );
}
