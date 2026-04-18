"use client";

import { useState } from "react";
import { Certificate } from "@/lib/types";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

const categoryStructure = {
  General: {
    Courses: {
      types: [
        { id: "module-1", name: "Module 1" },
        { id: "module-2", name: "Module 2" },
        { id: "module-3", name: "Module 3" },
        { id: "module-4", name: "Module 4" },
        { id: "course-completion", name: "Course Completion" },
      ],
    },
    Workshops: { types: "custom" },
    Webinars: { types: "custom" },
    "MED-Q": { types: "custom" },
  },
  Official: {
    "Central Team": { types: "custom" },
    "Sub Team": { types: "custom" },
    Ambassadors: { types: "custom" },
    Affiliates: { types: "custom" },
    Mentors: { types: "custom" },
  },
};

export default function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Certificate[]>([]);
  const [category, setCategory] = useState("General");
  const [subCategory, setSubCategory] = useState("Courses");
  const [certificateType, setCertificateType] = useState("module-1");
  const [customTopic, setCustomTopic] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCategoryData = categoryStructure[category as keyof typeof categoryStructure];
  const selectedSubCategoryData = (selectedCategoryData as any)?.[subCategory];
  const isCustomType = selectedSubCategoryData?.types === "custom";
  const certificateTypes = selectedSubCategoryData?.types;
  const subCategories = Object.keys(selectedCategoryData || {});

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const parseCSV = (text: string): Certificate[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    
    const certificates: Certificate[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const cert: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        cert[header] = values[index] || "";
      });
      
      const mappedCert: Certificate = {
        databaseId: "imported",
        participantId: `participant-${i}`,
        uniqueCertId: cert["certificate id"] || cert["certid"] || cert["id"] || `PZ-${new Date().getFullYear()}-${String(i).padStart(4, "0")}`,
        recipientName: cert["name"] || cert["recipient name"] || cert["recipientname"] || cert["recipient"] || "",
        recipientEmail: cert["email"] || cert["email address"] || cert["emailaddress"] || cert["recipient email"] || "",
        category: cert["category"] || category,
        subCategory: cert["subcategory"] || cert["sub category"] || cert["subcategory"] || subCategory,
        topic: cert["topic"] || cert["certificate type"] || cert["certificatetype"] || cert["type"] || cert["cert type"] || "",
        certType: cert["certificate type"] || cert["certificatetype"] || cert["type"] || cert["cert type"] || cert["topic"] || "",
        issueDate: cert["issue date"] || cert["issuedate"] || cert["date"] || new Date().toLocaleDateString(),
        status: (cert["status"] as any) || "generated",
        blockchainHash: cert["hash"] || cert["blockchain"] || `0x${Math.random().toString(16).substr(2, 16)}`,
      };
      
      if (mappedCert.recipientName && mappedCert.recipientEmail) {
        certificates.push(mappedCert);
      }
    }
    
    return certificates;
  };

  const handleFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError("");
    setSuccess("");
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        setPreviewData(data);
      } catch (err) {
        setError("Failed to parse file. Please check the format.");
        setPreviewData([]);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;
    
    setIsImporting(true);
    setError("");
    
    try {
      // Apply the selected type to all certificates
      let certTypeDisplay = certificateType;
      if (isCustomType) {
        certTypeDisplay = customTopic || subCategory;
      } else if (certificateTypes) {
        const selectedType = (certificateTypes as any[]).find((t: any) => t.id === certificateType);
        certTypeDisplay = selectedType?.name || certificateType;
      }

      const certificatesWithType = previewData.map(cert => ({
        ...cert,
        category,
        subCategory,
        certType: cert.certType || certTypeDisplay,
      }));

      const response = await fetch("/api/certificates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificates: certificatesWithType,
          category,
          subCategory,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }
      
      setSuccess(`Successfully imported ${data.results.success} certificates!`);
      onSuccess(data.results.success);
      
      setTimeout(() => {
        onClose();
        setFile(null);
        setPreviewData([]);
        setSuccess("");
        setCustomTopic("");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="sticky top-0 bg-green-50/50 p-4 sm:p-6 border-b border-green-100 flex justify-between items-center z-10">
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">
              Import Certificates
            </h3>
            <p className="text-sm text-on-surface-variant">
              Upload CSV file to bulk import certificates
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-green-100 rounded-xl transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm">
              {success}
            </div>
          )}

          {/* Category & SubCategory Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-brand-grass-green uppercase">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const newCategory = e.target.value;
                  const newSubCategories = Object.keys(categoryStructure[newCategory as keyof typeof categoryStructure]);
                  const newSubCatData = (categoryStructure[newCategory as keyof typeof categoryStructure] as any)[newSubCategories[0]];
                  const defaultType = newSubCatData?.types === "custom" ? "certificate" : newSubCatData?.types?.[0]?.id || "certificate";
                  
                  setCategory(newCategory);
                  setSubCategory(newSubCategories[0]);
                  setCertificateType(defaultType);
                  setCustomTopic("");
                }}
                className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50 cursor-pointer"
              >
                {Object.keys(categoryStructure).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-brand-grass-green uppercase">
                Sub-Category *
              </label>
              <select
                value={subCategory}
                onChange={(e) => {
                  const newSubCat = e.target.value;
                  const subCatData = (selectedCategoryData as any)[newSubCat];
                  const defaultType = subCatData?.types === "custom" ? "certificate" : subCatData?.types?.[0]?.id || "certificate";
                  
                  setSubCategory(newSubCat);
                  setCertificateType(defaultType);
                  setCustomTopic("");
                }}
                className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50 cursor-pointer"
              >
                {subCategories.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {isCustomType ? (
                <>
                  <label className="block text-xs font-bold text-brand-grass-green uppercase">
                    Topic / Batch Name *
                  </label>
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="e.g., Dr Mehwish Webinar"
                    className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
                  />
                </>
              ) : (
                <>
                  <label className="block text-xs font-bold text-brand-grass-green uppercase">
                    Certificate Type *
                  </label>
                  <select
                    value={certificateType}
                    onChange={(e) => setCertificateType(e.target.value)}
                    className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50 cursor-pointer"
                  >
                    {(certificateTypes as any[])?.map((type: any) => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* File Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive
                ? "border-brand-vivid-green bg-green-50"
                : "border-green-200 hover:border-brand-vivid-green hover:bg-green-50/30"
            }`}
          >
            <span className="material-symbols-outlined text-5xl text-brand-grass-green/40 mb-4 block">
              upload_file
            </span>
            <p className="text-sm text-on-surface-variant mb-2">
              Drag and drop your CSV file here, or{" "}
              <label className="text-brand-vivid-green font-bold cursor-pointer hover:underline">
                browse
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </p>
            <p className="text-[10px] text-outline uppercase tracking-wider">
              Supported format: CSV (max 1000 rows)
            </p>
          </div>

          {/* Selected File */}
          {file && (
            <div className="mt-4 p-4 bg-green-50/50 rounded-xl border border-green-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-vivid-green">description</span>
                <div>
                  <p className="text-sm font-medium text-brand-dark-green">{file.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {(file.size / 1024).toFixed(1)} KB • {previewData.length} records found
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setPreviewData([]);
                }}
                className="p-2 hover:bg-green-100 rounded-lg text-error transition-colors"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          )}

          {/* Preview Table */}
          {previewData.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-bold text-brand-dark-green mb-3">
                Preview ({Math.min(previewData.length, 5)} of {previewData.length} records)
              </h4>
              <div className="overflow-x-auto border border-green-100 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-green-50/50">
                    <tr>
                      <th className="px-4 py-3 font-bold text-brand-grass-green">Name</th>
                      <th className="px-4 py-3 font-bold text-brand-grass-green">Email</th>
                      <th className="px-4 py-3 font-bold text-brand-grass-green">Certificate Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-50">
                    {previewData.slice(0, 5).map((cert, index) => (
                      <tr key={index} className="hover:bg-green-50/30">
                        <td className="px-4 py-3">{cert.recipientName}</td>
                        <td className="px-4 py-3">{cert.recipientEmail}</td>
                        <td className="px-4 py-3">{cert.certType || (isCustomType ? customTopic : certificateType)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sample CSV Format */}
          <div className="mt-6 p-4 bg-surface-container-low rounded-xl">
            <h4 className="text-xs font-bold text-brand-grass-green uppercase mb-2">Expected CSV Format</h4>
            <code className="text-xs text-on-surface-variant block overflow-x-auto">
              name,email,certificate type,issue date,status<br />
              John Doe,john@email.com,Module 1,Oct 15 2024,active<br />
              Jane Smith,jane@email.com,Dr Mehwish Webinar,Oct 16 2024,active
            </code>
          </div>

          {/* Actions */}
          <div className="mt-8 pt-6 border-t border-green-50 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={previewData.length === 0 || isImporting || (isCustomType && !customTopic)}
              className="px-8 py-3 vivid-gradient-cta text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isImporting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  Importing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">upload</span>
                  Import {previewData.length} Certificates
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
