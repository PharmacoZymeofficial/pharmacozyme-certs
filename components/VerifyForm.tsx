"use client";

import { useState } from "react";

interface VerifyFormProps {
  onVerify: (certId: string) => void;
  isLoading: boolean;
  defaultValue?: string;
}

export default function VerifyForm({ onVerify, isLoading, defaultValue = "" }: VerifyFormProps) {
  const [certId, setCertId] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (certId.trim()) {
      onVerify(certId.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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
