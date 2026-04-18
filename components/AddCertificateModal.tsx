"use client";

import { useState, useEffect } from "react";
import { Certificate, Database, Participant } from "@/lib/types";

interface AddCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (certificate: Certificate) => void;
  editCertificate?: Certificate | null;
}

const categoryStructure = {
  General: {
    Courses: {
      description: "Professional Practice Courses (PPC)",
      types: [
        { id: "module-1", name: "Module 1", description: "First Module Certificate" },
        { id: "module-2", name: "Module 2", description: "Second Module Certificate" },
        { id: "module-3", name: "Module 3", description: "Third Module Certificate" },
        { id: "module-4", name: "Module 4", description: "Fourth Module Certificate" },
        { id: "course-completion", name: "Course Completion", description: "Full Course Completion Certificate" },
      ],
    },
    Workshops: {
      description: "Hands-on Workshop Sessions",
      types: "custom",
    },
    Webinars: {
      description: "Online Webinar Recordings",
      types: "custom",
    },
    "MED-Q": {
      description: "MED-Q Assessment Program",
      types: "custom",
    },
  },
  Official: {
    "Central Team": {
      description: "Core Team Members",
      types: "custom",
    },
    "Sub Team": {
      description: "Sub-Team Members",
      types: "custom",
    },
    Ambassadors: {
      description: "Brand Ambassadors",
      types: "custom",
    },
    Affiliates: {
      description: "Affiliate Partners",
      types: "custom",
    },
    Mentors: {
      description: "Program Mentors",
      types: "custom",
    },
  },
};

export default function AddCertificateModal({ isOpen, onClose, onSuccess, editCertificate }: AddCertificateModalProps) {
  const [step, setStep] = useState<"select" | "existing" | "new">("select");
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState<Database | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  
  const [formData, setFormData] = useState({
    recipientName: "",
    recipientEmail: "",
    category: "General",
    subCategory: "Courses",
    certificateType: "module-1",
    customTopic: "",
    issueDate: new Date().toISOString().split("T")[0],
    expiryDate: "",
    status: "active",
    databaseName: "",
    databaseCategory: "General",
    databaseSubCategory: "Courses",
    databaseTopic: "",
    databaseDescription: "",
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editCertificate) {
      const subCat = editCertificate.subCategory || "Courses";
      const certType = editCertificate.certType || "";
      
      const subCatConfig = (categoryStructure[formData.category as keyof typeof categoryStructure] as any)?.[subCat];
      const predefinedTypes = subCatConfig?.types;
      
      let certificateType = certType;
      let customTopic = "";
      
      if (predefinedTypes === "custom") {
        customTopic = certType;
      } else if (predefinedTypes) {
        const foundType = predefinedTypes.find((t: any) => t.name === certType || t.id === certType);
        certificateType = foundType?.id || "other";
        if (!foundType) customTopic = certType;
      }

      setFormData({
        recipientName: editCertificate.recipientName || "",
        recipientEmail: editCertificate.recipientEmail || "",
        category: editCertificate.category || "General",
        subCategory: subCat,
        certificateType: certificateType,
        customTopic: customTopic,
        issueDate: editCertificate.issueDate || new Date().toISOString().split("T")[0],
        expiryDate: (editCertificate as any).expiryDate || "",
        status: editCertificate.status || "pending",
        databaseName: "",
        databaseCategory: "General",
        databaseSubCategory: "Courses",
        databaseTopic: "",
        databaseDescription: "",
      });
    } else {
      setFormData({
        recipientName: "",
        recipientEmail: "",
        category: "General",
        subCategory: "Courses",
        certificateType: "module-1",
        customTopic: "",
        issueDate: new Date().toISOString().split("T")[0],
        expiryDate: "",
        status: "pending",
        databaseName: "",
        databaseCategory: "General",
        databaseSubCategory: "Courses",
        databaseTopic: "",
        databaseDescription: "",
      });
    }
    setStep("select");
    setSelectedDb(null);
    setSelectedParticipants([]);
  }, [editCertificate, isOpen]);

  const fetchDatabases = async () => {
    setLoadingDatabases(true);
    try {
      const response = await fetch("/api/databases");
      const data = await response.json();
      if (response.ok) {
        setDatabases(data.databases || []);
      }
    } catch (err) {
      console.error("Error fetching databases:", err);
    } finally {
      setLoadingDatabases(false);
    }
  };

  const fetchParticipants = async (dbId: string) => {
    try {
      const response = await fetch(`/api/participants?databaseId=${dbId}`);
      const data = await response.json();
      if (response.ok) {
        setParticipants(data.participants || []);
      }
    } catch (err) {
      console.error("Error fetching participants:", err);
    }
  };

  const handleSelectExisting = () => {
    fetchDatabases();
    setStep("existing");
  };

  const handleSelectNew = () => {
    setStep("new");
  };

  const handleDatabaseSelect = (db: Database) => {
    setSelectedDb(db);
    if (db.id) {
      fetchParticipants(db.id);
    }
  };

  const toggleParticipant = (id: string | undefined) => {
    if (!id) return;
    setSelectedParticipants(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedParticipants.length === participants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(participants.map(p => p.id).filter((id): id is string => !!id));
    }
  };

  const handleCreateDatabase = async () => {
    if (!formData.databaseName.trim()) {
      setError("Database name is required");
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.databaseName,
          category: formData.databaseCategory,
          subCategory: formData.databaseSubCategory,
          topic: formData.databaseTopic || formData.databaseName,
          description: formData.databaseDescription,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create database");

      setSelectedDb(data.database);
      setStep("existing");
      setParticipants([]);
      setSelectedParticipants([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create database");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIssueCertificates = async () => {
    setIsSubmitting(true);
    setError("");

    try {
    const selectedPaticipantsData = participants.filter(p => p.id && selectedParticipants.includes(p.id));
      
      for (const participant of selectedPaticipantsData) {
        const isCustomType = (categoryStructure[formData.category as keyof typeof categoryStructure] as any)?.[formData.subCategory]?.types === "custom";
        let certTypeDisplay = formData.certificateType;
        
        if (isCustomType) {
          certTypeDisplay = formData.customTopic || "Certificate";
        } else {
          const certTypes = (categoryStructure[formData.category as keyof typeof categoryStructure] as any)?.[formData.subCategory]?.types;
          const selectedType = certTypes?.find((t: any) => t.id === formData.certificateType);
          certTypeDisplay = selectedType?.name || formData.certificateType;
        }

        const response = await fetch("/api/certificates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientName: participant.name,
            recipientEmail: participant.email,
            category: selectedDb?.category || formData.category,
            subCategory: selectedDb?.subCategory || formData.subCategory,
            certType: certTypeDisplay,
            topic: selectedDb?.topic || certTypeDisplay,
            databaseId: selectedDb?.id,
            participantId: participant.id || "",
            issueDate: formData.issueDate,
            status: formData.status,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to issue certificate");
        }
      }

      onSuccess({} as Certificate);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue certificates");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategoryData = categoryStructure[formData.category as keyof typeof categoryStructure];
  const selectedSubCategoryData = selectedCategoryData?.[formData.subCategory as keyof typeof selectedCategoryData] as any;
  const isCustomType = selectedSubCategoryData?.types === "custom";
  const certificateTypes = selectedSubCategoryData?.types;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto my-8">
        {/* Header */}
        <div className="sticky top-0 bg-green-50/50 p-4 sm:p-6 border-b border-green-100 flex justify-between items-center z-10">
          <div>
            <h3 className="text-xl font-headline font-bold text-brand-dark-green">
              Issue Certificates
            </h3>
            <p className="text-sm text-on-surface-variant">
              {step === "select" && "Choose to use existing database or create new"}
              {step === "existing" && selectedDb && `Issuing from: ${selectedDb.name}`}
              {step === "new" && "Create a new database"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-green-100 rounded-xl transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Step 1: Select Database or Create New */}
        {step === "select" && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={handleSelectExisting}
                className="p-6 rounded-xl border-2 border-green-200 hover:border-brand-vivid-green hover:bg-green-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-vivid-green/20 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-brand-vivid-green text-2xl">folder_open</span>
                </div>
                <h4 className="font-bold text-brand-dark-green mb-2">Use Existing Database</h4>
                <p className="text-sm text-on-surface-variant">
                  Select from previously created databases and issue certificates to existing participants
                </p>
              </button>

              <button
                onClick={handleSelectNew}
                className="p-6 rounded-xl border-2 border-green-200 hover:border-brand-vivid-green hover:bg-green-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-blue-500 text-2xl">add_circle</span>
                </div>
                <h4 className="font-bold text-brand-dark-green mb-2">Create New Database</h4>
                <p className="text-sm text-on-surface-variant">
                  Create a new database with custom settings and add participants
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2a: Select Existing Database */}
        {step === "existing" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => { setStep("select"); setSelectedDb(null); }}
                className="text-sm text-brand-vivid-green hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back
              </button>
              <button
                onClick={handleSelectNew}
                className="text-sm text-blue-500 hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Create New
              </button>
            </div>

            {!selectedDb ? (
              <div>
                <h4 className="font-bold text-brand-dark-green mb-4">Select Database</h4>
                {loadingDatabases ? (
                  <div className="text-center py-8 text-on-surface-variant">Loading databases...</div>
                ) : databases.length === 0 ? (
                  <div className="text-center py-8 text-on-surface-variant">
                    No databases found. Create a new one instead.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto">
                    {databases.map((db) => (
                      <button
                        key={db.id}
                        onClick={() => handleDatabaseSelect(db)}
                        className="p-4 rounded-xl border-2 border-green-100 hover:border-brand-vivid-green transition-all text-left"
                      >
                        <div className="font-bold text-brand-dark-green">{db.name}</div>
                        <div className="text-sm text-on-surface-variant">
                          {db.category} • {db.subCategory} • {db.participantCount || 0} participants
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-4 p-4 bg-green-50 rounded-xl">
                  <div className="font-bold text-brand-dark-green">{selectedDb.name}</div>
                  <div className="text-sm text-on-surface-variant">
                    {selectedDb.category} • {selectedDb.subCategory} • {participants.length} participants
                  </div>
                </div>

                {participants.length === 0 ? (
                  <div className="text-center py-8 text-on-surface-variant">
                    No participants in this database yet.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-brand-dark-green">
                        Select Participants ({selectedParticipants.length}/{participants.length})
                      </h4>
                      <button
                        onClick={toggleSelectAll}
                        className="text-sm text-brand-vivid-green hover:underline"
                      >
                        {selectedParticipants.length === participants.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto mb-6">
                      {participants.map((p) => p.id && (
                        <label
                          key={p.id}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                            selectedParticipants.includes(p.id)
                              ? "border-brand-vivid-green bg-green-50"
                              : "border-green-100 hover:border-brand-vivid-green/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedParticipants.includes(p.id)}
                            onChange={() => toggleParticipant(p.id)}
                            className="w-4 h-4 text-brand-vivid-green"
                          />
                          <div>
                            <div className="font-medium text-brand-dark-green text-sm">{p.name}</div>
                            <div className="text-xs text-on-surface-variant">{p.email}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleIssueCertificates}
                  disabled={isSubmitting || selectedParticipants.length === 0}
                  className="w-full py-3 vivid-gradient-cta text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {isSubmitting ? "Issuing..." : `Issue ${selectedParticipants.length} Certificate(s)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2b: Create New Database */}
        {step === "new" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setStep("select")}
                className="text-sm text-brand-vivid-green hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">
                  Database Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.databaseName}
                  onChange={(e) => setFormData({ ...formData, databaseName: e.target.value })}
                  placeholder="e.g., MED-Q Sat Night Certificates"
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">
                    Category
                  </label>
                  <select
                    value={formData.databaseCategory}
                    onChange={(e) => setFormData({ ...formData, databaseCategory: e.target.value })}
                    className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
                  >
                    {Object.keys(categoryStructure).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">
                    Sub-Category
                  </label>
                  <select
                    value={formData.databaseSubCategory}
                    onChange={(e) => setFormData({ ...formData, databaseSubCategory: e.target.value })}
                    className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none"
                  >
                    {Object.keys(categoryStructure[formData.databaseCategory as keyof typeof categoryStructure] || {}).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">
                  Topic/Event Name
                </label>
                <input
                  type="text"
                  value={formData.databaseTopic}
                  onChange={(e) => setFormData({ ...formData, databaseTopic: e.target.value })}
                  placeholder="e.g., MED-Q Sat Night"
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">
                  Description
                </label>
                <textarea
                  value={formData.databaseDescription}
                  onChange={(e) => setFormData({ ...formData, databaseDescription: e.target.value })}
                  placeholder="Optional description for this database"
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
                  rows={2}
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleCreateDatabase}
                disabled={isSubmitting || !formData.databaseName.trim()}
                className="w-full py-3 vivid-gradient-cta text-white rounded-xl font-bold disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create & Continue"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}