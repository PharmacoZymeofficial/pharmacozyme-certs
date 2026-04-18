"use client";

import { useState } from "react";
import { Certificate } from "@/lib/types";
import AddCertificateModal from "./AddCertificateModal";
import ImportModal from "./ImportModal";

interface CertificateTableProps {
  certificates: Certificate[];
  onDataChange: () => void;
}

export default function CertificateTable({ certificates, onDataChange }: CertificateTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editCertificate, setEditCertificate] = useState<Certificate | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const filteredCertificates = certificates.filter((cert) => {
    const searchableText = `
      ${cert.recipientName || ""} 
      ${cert.uniqueCertId || ""} 
      ${cert.recipientEmail || ""} 
      ${cert.certType || ""}
      ${cert.subCategory || ""}
      ${cert.category || ""}
    `.toLowerCase();
    
    const matchesSearch = searchableText.includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || cert.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || cert.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <div className="flex items-center gap-2 text-brand-vivid-green font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-brand-vivid-green"></span>
            Verified
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center gap-2 text-yellow-600 font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            Pending
          </div>
        );
      case "revoked":
        return (
          <div className="flex items-center gap-2 text-error font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-error"></span>
            Revoked
          </div>
        );
      case "expired":
        return (
          <div className="flex items-center gap-2 text-gray-500 font-bold text-xs">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            Expired
          </div>
        );
      default:
        return null;
    }
  };

  const handleDelete = async (cert: Certificate) => {
    if (!confirm(`Are you sure you want to delete the certificate for ${cert.recipientName}?`)) return;
    
    setIsDeleting(cert.id || cert.uniqueCertId);
    try {
      const response = await fetch(`/api/certificates?id=${cert.id}`, { method: "DELETE" });
      if (response.ok) {
        onDataChange();
      } else {
        alert("Failed to delete certificate");
      }
    } catch (err) {
      alert("Error deleting certificate");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSuccess = () => {
    onDataChange();
    setEditCertificate(null);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 lg:p-8 border-b border-green-50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h3 className="text-lg sm:text-xl font-headline font-bold text-brand-dark-green">Certificate Management</h3>
            <p className="text-sm text-on-surface-variant hidden sm:block">
              {filteredCertificates.length} of {certificates.length} certificates
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 lg:flex-initial lg:w-56">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, ID, topic..."
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-green-100 rounded-xl text-sm focus:ring-2 focus:ring-brand-vivid-green/50 outline-none"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-white text-brand-grass-green border border-green-200 rounded-xl text-sm font-semibold cursor-pointer hover:bg-green-50 transition-colors"
            >
              <option value="all">All Categories</option>
              <option value="General">General</option>
              <option value="Official">Official</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white text-brand-grass-green border border-green-200 rounded-xl text-sm font-semibold cursor-pointer hover:bg-green-50 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="generated">Verified</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="revoked">Revoked</option>
            </select>

            {/* Import Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-2 bg-white text-brand-grass-green border border-green-200 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-green-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">upload</span>
              <span className="hidden sm:inline">Import</span>
            </button>

            {/* New Entry Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 vivid-gradient-cta text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span className="hidden sm:inline">New Entry</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-green-50/50 text-brand-grass-green uppercase text-[10px] tracking-widest font-bold">
              <tr>
                <th className="px-4 sm:px-8 py-4">Recipient</th>
                <th className="px-4 sm:px-8 py-4">Certificate ID</th>
                <th className="px-4 sm:px-8 py-4">Topic / Certificate Type</th>
                <th className="px-4 sm:px-8 py-4 hidden lg:table-cell">Category</th>
                <th className="px-4 sm:px-8 py-4">Status</th>
                <th className="px-4 sm:px-8 py-4 hidden md:table-cell">Issue Date</th>
                <th className="px-4 sm:px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-50">
              {filteredCertificates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">search_off</span>
                    <p>No certificates found matching your filters</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredCertificates.map((cert, index) => (
                  <tr key={cert.id || index} className="hover:bg-green-50/30 transition-colors">
                    <td className="px-4 sm:px-8 py-4 sm:py-5">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 rounded-xl bg-brand-dark-green text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {getInitials(cert.recipientName)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-brand-dark-green text-sm truncate">{cert.recipientName}</p>
                          <p className="text-xs text-on-surface-variant truncate hidden sm:block">{cert.recipientEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5 font-mono text-xs text-brand-grass-green">{cert.uniqueCertId}</td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5">
                      <div className="max-w-[200px]">
                        <p className="text-sm font-bold text-brand-dark-green truncate">
                          {cert.certType || cert.subCategory}
                        </p>
                        <p className="text-[10px] text-primary truncate">
                          {cert.category} - {cert.subCategory}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5 hidden lg:table-cell">
                      <span className="px-2 py-1 bg-green-100 text-brand-green rounded text-[10px] font-bold uppercase">{cert.category}</span>
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5">
                      {getStatusBadge(cert.status)}
                    </td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5 text-sm text-on-surface-variant hidden md:table-cell">{cert.issueDate}</td>
                    <td className="px-4 sm:px-8 py-4 sm:py-5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditCertificate(cert)}
                          className="p-2 hover:bg-green-100 rounded-xl text-brand-grass-green transition-colors"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => alert("Email feature coming soon!")}
                          className="p-2 hover:bg-green-100 rounded-xl text-brand-grass-green transition-colors"
                          title="Send Email"
                        >
                          <span className="material-symbols-outlined text-lg">mail</span>
                        </button>
                        <button
                          onClick={() => handleDelete(cert)}
                          disabled={isDeleting === (cert.id || cert.uniqueCertId)}
                          className="p-2 hover:bg-red-50 text-error rounded-xl transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {isDeleting === (cert.id || cert.uniqueCertId) ? "hourglass_empty" : "delete"}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filteredCertificates.length > 0 && (
          <div className="p-4 bg-green-50/30 flex justify-between items-center">
            <p className="text-xs text-on-surface-variant">
              Showing {filteredCertificates.length} of {certificates.length} certificates
            </p>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs font-bold text-brand-grass-green uppercase tracking-widest hover:underline"
            >
              + Add New Certificate
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddCertificateModal
        isOpen={isAddModalOpen || !!editCertificate}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditCertificate(null);
        }}
        onSuccess={handleSuccess}
        editCertificate={editCertificate}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(count) => {
          onDataChange();
          setIsImportModalOpen(false);
        }}
      />
    </>
  );
}
