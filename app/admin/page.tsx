"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { StatsGrid } from "@/components/StatsCard";
import CertificateTable from "@/components/CertificateTable";
import BulkEmailForm from "@/components/BulkEmailForm";
import SystemIntegrity from "@/components/SystemIntegrity";
import { Certificate } from "@/lib/types";

const categories = [
  "All Certificates",
  "General - courses (PPC)",
  "General - Workshops",
  "General - Webinars",
  "General - MED-Q",
  "Official - Central Team",
  "Official - Sub Team",
  "Official - Ambassadors",
  "Official - Affiliates",
  "Official - Mentors",
];

const templates = [
  "Official Certification - Standard",
  "Official Certification - Premium",
  "Renewal Notification",
  "Credential Revoked",
  "Welcome Message",
  "Quarterly Report",
];

export default function AdminDashboard() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState("");

  const fetchCertificates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      setErrorDetails("");
      
      const response = await fetch("/api/certificates");
      const data = await response.json();
      
      if (response.ok) {
        setCertificates(data.certificates || []);
      } else {
        setError(data.error || "Failed to fetch certificates");
        setErrorDetails(data.details || data.code || "");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch certificates");
      setErrorDetails(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  // Calculate stats
  const totalCertificates = certificates.length;
  const verifiedToday = certificates.filter(c => {
    if (!c.issueDate) return false;
    const today = new Date().toDateString();
    const issueDate = new Date(c.issueDate).toDateString();
    return today === issueDate && c.status === "generated";
  }).length;
  const pendingCertificates = certificates.filter(c => c.status === "pending").length;
  const activeCategories = [...new Set(certificates.map(c => c.subCategory))].length || 9;

  const stats = [
    {
      title: "Total Certificates",
      value: totalCertificates.toLocaleString(),
      subtitle: totalCertificates > 0 ? "Currently in database" : "No certificates yet",
      icon: "workspace_premium",
      trend: "up" as const,
      trendText: totalCertificates > 0 ? "+12% from last month" : "Add your first certificate",
      trendColor: totalCertificates > 0 ? "green" as const : "green" as const,
    },
    {
      title: "Verified Today",
      value: verifiedToday.toString(),
      subtitle: "Active Processing",
      icon: "task_alt",
      trend: "neutral" as const,
      trendText: verifiedToday > 0 ? `${verifiedToday} verified today` : "No verifications today",
      trendColor: "orange" as const,
    },
    {
      title: "Pending",
      value: pendingCertificates.toString(),
      subtitle: "Requires Attention",
      icon: "forward_to_inbox",
      trend: pendingCertificates > 0 ? ("down" as const) : ("neutral" as const),
      trendText: pendingCertificates > 0 ? "Requires Attention" : "All clear",
      trendColor: pendingCertificates > 0 ? ("red" as const) : ("green" as const),
    },
    {
      title: "Active Categories",
      value: activeCategories.toString(),
      subtitle: "Updated just now",
      icon: "clinical_notes",
      trend: "neutral" as const,
      trendText: "All categories active",
      trendColor: "green" as const,
    },
  ];

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-gray-200 rounded-xl w-1/3"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <span className="material-symbols-outlined text-5xl text-red-400 mb-4 block">cloud_off</span>
            <h3 className="text-lg font-bold text-red-700 mb-2">Unable to Connect to Database</h3>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            
            {errorDetails && (
              <div className="bg-white/50 rounded-lg p-4 mb-4 text-left">
                <p className="text-xs text-red-500 font-mono">{errorDetails}</p>
              </div>
            )}
            
            <div className="bg-white/50 rounded-lg p-4 mb-4 text-left text-sm text-red-600">
              <p className="font-bold mb-2">Please check:</p>
              <ul className="list-disc list-inside text-left space-y-1">
                <li>Firestore Database is created in Firebase Console</li>
                <li>Security rules allow read/write access</li>
                <li>You have added test data to the certificates collection</li>
              </ul>
            </div>
            
            <button
              onClick={fetchCertificates}
              className="px-6 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors mr-2"
            >
              Try Again
            </button>
            
            <button
              onClick={() => {
                // Show sample data for demo
                setCertificates([
                  {
                    id: "demo1",
                    databaseId: "demo-db",
                    participantId: "demo-participant",
                    uniqueCertId: "PZ-2024-DEMO001",
                    recipientName: "John Doe (Demo)",
                    recipientEmail: "john@example.com",
                    category: "General",
                    subCategory: "Courses",
                    topic: "Demo Certificate",
                    certType: "Demo Certificate",
                    issueDate: new Date().toLocaleDateString(),
                    status: "generated" as const,
                    blockchainHash: "0xDEMO123",
                  }
                ]);
                setError("");
              }}
              className="px-6 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
            >
              Load Demo Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      {/* Header */}
      <header className="mb-8 lg:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
            Systems Overview
          </h2>
          <p className="text-on-surface-variant font-body text-sm sm:text-base">
            Welcome back, Administrator. {certificates.length > 0 ? `You have ${certificates.length} certificates in the system.` : "Add your first certificate to get started."}
          </p>
        </div>

        {/* Admin Profile */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-brand-dark-green">Dr. Julian Thorne</p>
            <p className="text-[10px] text-brand-grass-green font-bold uppercase tracking-widest">Chief Registrar</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden ring-2 ring-brand-vivid-green/20 shadow-md flex-shrink-0">
            <Image 
              src="/pharmacozyme-logo.png" 
              alt="Admin Profile" 
              width={48}
              height={48}
              className="object-cover"
            />
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <StatsGrid stats={stats} />

      {/* Certificate Management Table */}
      <div className="mb-8 lg:mb-12">
        <CertificateTable 
          certificates={certificates} 
          onDataChange={fetchCertificates}
        />
      </div>

      {/* Bottom Grid - Bulk Email & System Integrity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Bulk Email Form */}
        <div className="lg:col-span-2">
          <BulkEmailForm categories={categories} templates={templates} />
        </div>

        {/* System Integrity */}
        <div className="lg:col-span-1 min-h-[300px] lg:min-h-0">
          <SystemIntegrity />
        </div>
      </div>
    </div>
  );
}
