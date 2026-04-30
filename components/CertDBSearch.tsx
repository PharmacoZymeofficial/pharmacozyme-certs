"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { sfx } from "@/lib/sfx";

interface SearchResult {
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

interface Props {
  onSelectCert: (certId: string) => void;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#52b788,#1b4332)",
  "linear-gradient(135deg,#40916c,#081c15)",
  "linear-gradient(135deg,#22c55e,#166534)",
  "linear-gradient(135deg,#4ade80,#15803d)",
  "linear-gradient(135deg,#86efac,#166534)",
  "linear-gradient(135deg,#34d399,#065f46)",
];

function avatarGradient(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(d: string) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

// ── Skeleton card shown while loading ────────────────────────────
function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: "rgba(10,26,16,0.5)",
        border: "1px solid rgba(82,183,136,0.08)",
        animation: `slideUpFade 0.35s ease ${delay}ms both`,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl animate-pulse flex-shrink-0"
          style={{ background: "rgba(82,183,136,0.1)" }}
        />
        <div className="flex-1 space-y-2">
          <div
            className="h-3 rounded-full animate-pulse w-3/4"
            style={{ background: "rgba(82,183,136,0.1)" }}
          />
          <div
            className="h-2 rounded-full animate-pulse w-1/2"
            style={{ background: "rgba(82,183,136,0.07)" }}
          />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div
          className="h-8 rounded-lg animate-pulse"
          style={{ background: "rgba(82,183,136,0.06)" }}
        />
      </div>
      <div
        className="h-8 rounded-xl animate-pulse"
        style={{ background: "rgba(82,183,136,0.06)" }}
      />
      {/* shimmer sweep */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg,transparent,rgba(82,183,136,0.05),transparent)",
          animation: "shimmerSlide 1.6s ease infinite",
        }}
      />
    </div>
  );
}

// ── Individual result card ────────────────────────────────────────
function ResultCard({
  result,
  index,
  onSelect,
}: {
  result: SearchResult;
  index: number;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const label =
    result.topic || result.certType || result.subCategory || result.category;
  const isActive =
    result.status === "generated" || result.status === "sent";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(result.uniqueCertId)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(result.uniqueCertId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl p-5 flex flex-col gap-3 cursor-pointer focus:outline-none"
      style={{
        background: hovered ? "rgba(16,42,26,0.95)" : "rgba(10,26,16,0.55)",
        border: hovered
          ? "1px solid rgba(82,183,136,0.4)"
          : "1px solid rgba(82,183,136,0.1)",
        boxShadow: hovered
          ? "0 12px 40px rgba(0,0,0,0.35),0 0 0 1px rgba(82,183,136,0.12)"
          : "0 2px 12px rgba(0,0,0,0.15)",
        backdropFilter: "blur(14px)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        animation: `slideUpFade 0.4s cubic-bezier(0.16,1,0.3,1) ${index * 65}ms both`,
      }}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
          style={{
            background: avatarGradient(result.recipientName),
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {initials(result.recipientName)}
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">
            {result.recipientName}
          </p>
          <p
            className="text-xs truncate mt-0.5"
            style={{ color: "rgba(82,183,136,0.55)" }}
          >
            {label || "Certificate"}
          </p>
        </div>
      </div>

      {/* Cert ID chip */}
      <div
        className="px-3 py-2 rounded-xl"
        style={{
          background: "rgba(82,183,136,0.06)",
          border: "1px solid rgba(82,183,136,0.09)",
        }}
      >
        <p
          className="text-[9px] uppercase tracking-widest mb-0.5"
          style={{ color: "rgba(82,183,136,0.4)" }}
        >
          Certificate ID
        </p>
        <p
          className="text-xs font-mono truncate"
          style={{ color: "rgba(82,183,136,0.8)" }}
        >
          {result.uniqueCertId || "—"}
        </p>
      </div>

      {/* Date + status */}
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-[9px] uppercase tracking-widest"
            style={{ color: "rgba(82,183,136,0.3)" }}
          >
            Issued
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            {fmtDate(result.issueDate)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isActive ? "#22c55e" : "#94a3b8",
              boxShadow: isActive ? "0 0 6px #22c55e" : "none",
            }}
          />
          <span
            className="text-[10px] font-medium"
            style={{ color: isActive ? "#22c55e" : "#94a3b8" }}
          >
            {isActive ? "Issued" : result.status}
          </span>
        </div>
      </div>

      {/* Verify button */}
      <div
        className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
        style={{
          background: hovered
            ? "linear-gradient(135deg,#22c55e,#16a34a)"
            : "rgba(82,183,136,0.1)",
          color: hovered ? "#fff" : "#52b788",
          border: hovered ? "none" : "1px solid rgba(82,183,136,0.18)",
          transition: "all 0.18s ease",
        }}
      >
        <span
          className="material-symbols-outlined text-sm"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          verified
        </span>
        Verify Certificate
        <span className="material-symbols-outlined text-sm">
          arrow_forward
        </span>
      </div>
    </div>
  );
}

// ── Empty / idle placeholder ──────────────────────────────────────
function IdlePlaceholder() {
  return (
    <div className="text-center py-10">
      <div className="flex justify-center items-end gap-2 mb-5 h-14">
        {["AK", "BM", "JD", "RS", "TL"].map((init, i) => (
          <div
            key={i}
            className="rounded-xl flex items-center justify-center text-xs font-bold text-white"
            style={{
              background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
              opacity: 0.18 + i * 0.12,
              width: 32 + i * 4,
              height: 32 + i * 4,
              transform: `translateY(${i % 2 === 0 ? -4 : 4}px)`,
              filter: `blur(${i === 2 ? 0 : 0.6}px)`,
              animation: `orbFloat ${5 + i * 1.5}s ease-in-out ${i * 300}ms infinite`,
            }}
          >
            {init}
          </div>
        ))}
      </div>
      <p style={{ color: "rgba(82,183,136,0.22)" }} className="text-sm">
        Your certificate records live here
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function CertDBSearch({ onSelectCert }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Section entrance via IntersectionObserver
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.07 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const search = useCallback(async (name: string) => {
    if (name.length < 2) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search-name?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      const items: SearchResult[] = data.results || [];
      setResults(items);
      setHasSearched(true);
      if (items.length > 0) sfx.pop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 450);
  };

  const handleClear = () => {
    setInputValue("");
    setResults([]);
    setHasSearched(false);
    setError(null);
    inputRef.current?.focus();
  };

  const handleSelect = (certId: string) => {
    sfx.click();
    onSelectCert(certId);
  };

  const showIdle = !isLoading && !hasSearched && !error;
  const showEmpty = !isLoading && !error && hasSearched && results.length === 0;
  const showResults = !isLoading && !error && results.length > 0;

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg,#060f08 0%,#081c15 45%,#0a1e12 100%)",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(36px)",
        transition:
          "opacity 0.75s cubic-bezier(0.16,1,0.3,1), transform 0.75s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(82,183,136,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(82,183,136,0.035) 1px,transparent 1px)`,
          backgroundSize: "42px 42px",
        }}
      />

      {/* Decorative glow orbs */}
      <div
        className="absolute -top-32 -left-32 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle,rgba(34,197,94,0.07) 0%,transparent 70%)",
          animation: "orbFloat 9s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle,rgba(82,183,136,0.06) 0%,transparent 70%)",
          animation: "orbFloat 12s ease-in-out infinite reverse",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* ── Header ── */}
        <div
          className="text-center mb-10"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(18px)",
            transition: "opacity 0.6s 0.12s ease, transform 0.6s 0.12s ease",
          }}
        >
          <div
            className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full"
            style={{
              background: "rgba(82,183,136,0.1)",
              border: "1px solid rgba(82,183,136,0.2)",
            }}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{
                color: "#52b788",
                fontVariationSettings: "'FILL' 1",
              }}
            >
              database
            </span>
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "#52b788" }}
            >
              Database Search
            </span>
          </div>

          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3"
            style={{ fontFamily: "Fredoka, sans-serif" }}
          >
            Find Your Certificate
          </h2>
          <p
            className="text-sm sm:text-base max-w-sm mx-auto"
            style={{ color: "rgba(82,183,136,0.55)" }}
          >
            Search across all PharmacoZyme databases by your full name
          </p>
        </div>

        {/* ── Search bar ── */}
        <div
          className="max-w-2xl mx-auto mb-8"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(18px)",
            transition: "opacity 0.6s 0.22s ease, transform 0.6s 0.22s ease",
          }}
        >
          <div
            className="relative"
            style={{
              borderRadius: "1rem",
              background: "rgba(8,22,14,0.75)",
              border: isFocused
                ? "1.5px solid rgba(82,183,136,0.55)"
                : "1.5px solid rgba(82,183,136,0.15)",
              boxShadow: isFocused
                ? "0 0 0 4px rgba(82,183,136,0.09),0 8px 32px rgba(0,0,0,0.3)"
                : "0 4px 24px rgba(0,0,0,0.2)",
              backdropFilter: "blur(18px)",
              transition: "border-color 0.2s ease,box-shadow 0.2s ease",
            }}
          >
            {/* Left icon */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              {isLoading ? (
                <div
                  className="w-5 h-5 rounded-full border-2 border-t-[#52b788] animate-spin"
                  style={{ borderColor: "rgba(82,183,136,0.25)", borderTopColor: "#52b788" }}
                />
              ) : (
                <span
                  className="material-symbols-outlined text-xl"
                  style={{ color: "rgba(82,183,136,0.55)" }}
                >
                  person_search
                </span>
              )}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInput}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Type a name to search..."
              className="w-full bg-transparent text-white outline-none px-12 py-4 text-base"
              style={{
                fontFamily: "Poppins, sans-serif",
                caretColor: "#52b788",
              }}
              aria-label="Search certificate by recipient name"
            />

            {/* Clear button */}
            {inputValue && (
              <button
                onClick={handleClear}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                style={{ background: "rgba(82,183,136,0.1)", color: "#52b788" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(82,183,136,0.22)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(82,183,136,0.1)")
                }
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Status hint below input */}
          <div className="text-center mt-2.5 h-4">
            {!hasSearched && !isLoading && (
              <span
                className="text-xs"
                style={{ color: "rgba(82,183,136,0.3)" }}
              >
                Enter at least 2 characters to search
              </span>
            )}
            {hasSearched && results.length > 0 && !isLoading && (
              <span
                className="text-xs"
                style={{ color: "rgba(82,183,136,0.45)" }}
              >
                {results.length} result{results.length !== 1 ? "s" : ""} found
                &middot; click a card to verify
              </span>
            )}
          </div>
        </div>

        {/* ── Results area ── */}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} delay={i * 90} />
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="text-center py-12">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <span
                className="material-symbols-outlined text-red-400"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
            </div>
            <p className="text-red-400/80 text-sm">{error}</p>
          </div>
        )}

        {/* No results */}
        {showEmpty && (
          <div
            className="text-center py-14"
            style={{ animation: "slideUpFade 0.35s ease both" }}
          >
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{
                background: "rgba(82,183,136,0.08)",
                border: "1px solid rgba(82,183,136,0.14)",
              }}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={{ color: "#52b788" }}
              >
                search_off
              </span>
            </div>
            <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.55)" }}>
              No certificates found for{" "}
              <span style={{ color: "#52b788" }}>"{inputValue}"</span>
            </p>
            <p className="text-xs" style={{ color: "rgba(82,183,136,0.3)" }}>
              Try a different name or check the spelling
            </p>
          </div>
        )}

        {/* Result cards */}
        {showResults && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((r, i) => (
              <ResultCard
                key={r.id}
                result={r}
                index={i}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}

        {/* Idle placeholder */}
        {showIdle && <IdlePlaceholder />}
      </div>
    </section>
  );
}
