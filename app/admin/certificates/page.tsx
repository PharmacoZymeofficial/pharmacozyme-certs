"use client";

import { useState, useEffect, useCallback } from "react";
import CertificateTable from "@/components/CertificateTable";
import { Certificate } from "@/lib/types";

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCertificates = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/certificates");
      const data = await response.json();
      
      if (response.ok) {
        setCertificates(data.certificates || []);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch certificates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded-xl w-1/3"></div>
          <div className="h-96 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-5xl text-red-400 mb-4 block">error</span>
          <h3 className="text-lg font-bold text-red-700 mb-2">Error Loading Certificates</h3>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchCertificates}
            className="px-6 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      {/* Header */}
      <header className="mb-6 lg:mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
          All Certificates
        </h2>
        <p className="text-on-surface-variant font-body text-sm sm:text-base">
          Manage, edit, and track all issued certificates across your organization.
        </p>
      </header>

      {/* Certificate Table */}
      <CertificateTable 
        certificates={certificates} 
        onDataChange={fetchCertificates}
      />
    </div>
  );
}
