"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AddCertificateModal from "@/components/AddCertificateModal";
import { Certificate } from "@/lib/types";

export default function IssueCertificatePage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  const fetchCertificates = async () => {
    try {
      const response = await fetch("/api/certificates");
      const data = await response.json();
      if (response.ok) {
        setCertificates(data.certificates || []);
      }
    } catch (err) {
      console.error("Error fetching certificates:", err);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const handleSuccess = () => {
    fetchCertificates();
    setIsModalOpen(false);
    router.push("/admin/certificates");
  };

  const handleClose = () => {
    setIsModalOpen(false);
    router.push("/admin/certificates");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      {/* Header */}
      <header className="mb-6 lg:mb-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
          Issue Certificate
        </h2>
        <p className="text-on-surface-variant font-body text-sm sm:text-base">
          Create and issue a new verification certificate.
        </p>
      </header>

      {/* Info Card */}
      <div className="max-w-3xl mb-8">
        <div className="bg-green-50 border border-green-100 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-vivid-green/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-brand-vivid-green text-2xl">info</span>
            </div>
            <div>
              <h3 className="font-bold text-brand-dark-green mb-1">Quick Tips</h3>
              <ul className="text-sm text-on-surface-variant space-y-1">
                <li>• Fill in the recipient details and select category/subcategory</li>
                <li>• Add a Batch/Event name for easier searching (e.g., "Dr Mehwish Webinar")</li>
                <li>• Set the certificate status to "Active" for verified certificates</li>
                <li>• You can also import multiple certificates using CSV from the Certificates page</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-3xl mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-green-100">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Total</p>
            <p className="text-2xl font-bold text-brand-dark-green">{certificates.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-green-100">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Generated</p>
            <p className="text-2xl font-bold text-brand-vivid-green">
              {certificates.filter(c => c.status === "generated").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-green-100">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Pending</p>
            <p className="text-2xl font-bold text-yellow-500">
              {certificates.filter(c => c.status === "pending").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-green-100">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Sent</p>
            <p className="text-2xl font-bold text-error">
              {certificates.filter(c => c.status === "sent").length}
            </p>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AddCertificateModal
        isOpen={isModalOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
        editCertificate={null}
      />
    </div>
  );
}
