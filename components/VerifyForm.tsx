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
}

export default function VerifyForm({ onVerify, isLoading, defaultValue = "" }: VerifyFormProps) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div className="relative">
        <label className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-1.5 sm:mb-2 px-1">
          Certificate ID Number
        </label>
        <input
          type="text"
          value={certId}
          onChange={(e) => setCertId(e.target.value)}
          placeholder="e.g. PZ-2024-XXXX-9821"
          className="w-full h-12 sm:h-14 px-4 sm:px-6 bg-surface-container-low rounded-xl border-2 border-transparent focus:border-vivid-green/30 focus:ring-0 font-mono text-dark-green placeholder:text-outline/40 transition-all text-xs sm:text-sm"
          disabled={isLoading}
        />
      </div>

      {/* Optional filters toggle */}
      <button
        type="button"
        onClick={() => { setShowFilters(v => !v); if (showFilters) { setCategory(""); setSubCategory(""); } }}
        className="flex items-center gap-1.5 text-[10px] text-outline hover:text-vivid-green transition-colors font-medium uppercase tracking-wider"
      >
        <span className="material-symbols-outlined text-sm">{showFilters ? "expand_less" : "tune"}</span>
        {showFilters ? "Hide Filters" : "Filter by Category (optional)"}
      </button>

      {showFilters && (
        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-outline mb-1.5 px-1">Category</label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setSubCategory(""); }}
              disabled={isLoading}
              className="w-full h-10 px-3 bg-surface-container-low rounded-xl border-2 border-transparent focus:border-vivid-green/30 text-dark-green text-xs appearance-none cursor-pointer"
            >
              <option value="">Any</option>
              {Object.keys(categoryStructure).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-[0.15em] text-outline mb-1.5 px-1">Sub-Category</label>
            <select
              value={subCategory}
              onChange={e => setSubCategory(e.target.value)}
              disabled={isLoading || !category}
              className="w-full h-10 px-3 bg-surface-container-low rounded-xl border-2 border-transparent focus:border-vivid-green/30 text-dark-green text-xs appearance-none cursor-pointer disabled:opacity-40"
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
          w-full h-12 sm:h-14 rounded-full font-bold uppercase tracking-widest text-xs sm:text-sm transition-all flex items-center justify-center gap-2
          ${isLoading || !certId.trim()
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-vivid-green text-white hover:bg-dark-green active:scale-[0.98] shadow-[0_0_20px_rgba(45,106,79,0.15)]"
          }
        `}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
            Verifying...
          </span>
        ) : (
          "Verify Now"
        )}
      </button>
    </form>
  );
}
