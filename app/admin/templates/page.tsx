"use client";

import { useState, useEffect, useRef } from "react";

interface PositionConfig {
  x: number;
  y: number;
  size?: number;
  color?: string;
}

interface Positions {
  name: PositionConfig;
  certId: PositionConfig;
  qr: PositionConfig;
}

interface CertificateTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  isActive: boolean;
  usageCount: number;
  positions?: Positions;
  createdAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "General",
  });
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [positions, setPositions] = useState<Positions>({
    name: { x: 50, y: 45, size: 48, color: "#1b4332" },
    certId: { x: 50, y: 30, size: 12, color: "#333333" },
    qr: { x: 85, y: 60, size: 12 },
  });
  const [savingPositions, setSavingPositions] = useState(false);
  const [testData, setTestData] = useState({
    name: "John Doe",
    certId: "2026-PZ-CRS-0001",
  });
  const [activeDrag, setActiveDrag] = useState<'name' | 'certId' | 'qr' | null>(null);
  const [activeResize, setActiveResize] = useState<'name' | 'certId' | 'qr' | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (previewPdfUrl || editingTemplate) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [previewPdfUrl, editingTemplate]);

  const generatePreview = async () => {
    if (!editingTemplate) return;
    setGeneratingPreview(true);
    
    try {
      const response = await fetch("/api/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateUrl: editingTemplate.fileUrl,
          templatePositions: positions,
          testData: { name: testData.name, certId: testData.certId },
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewPdfUrl(url);
      } else {
        alert("Failed to generate preview");
      }
    } catch (err) {
      console.error("Error generating preview:", err);
      alert("Error generating preview");
    } finally {
      setGeneratingPreview(false);
    }
  };

  const startDrag = (e: React.MouseEvent, type: 'name' | 'certId' | 'qr') => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDrag(type);
  };

  const startResize = (e: React.MouseEvent, type: 'name' | 'certId' | 'qr') => {
    e.preventDefault();
    e.stopPropagation();
    setActiveResize(type);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!previewRef.current) return;
    
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Check which marker is closest to click
    const threshold = 8;
    const nameDist = Math.sqrt(Math.pow(x - positions.name.x, 2) + Math.pow(y - positions.name.y, 2));
    const certIdDist = Math.sqrt(Math.pow(x - positions.certId.x, 2) + Math.pow(y - positions.certId.y, 2));
    const qrDist = Math.sqrt(Math.pow(x - positions.qr.x, 2) + Math.pow(y - positions.qr.y, 2));
    
    if (nameDist < threshold) setActiveDrag('name');
    else if (certIdDist < threshold) setActiveDrag('certId');
    else if (qrDist < threshold) setActiveDrag('qr');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!previewRef.current) return;
    
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    
    // Handle dragging
    if (activeDrag) {
      if (activeDrag === 'name') {
        setPositions(prev => ({ ...prev, name: { ...prev.name, x, y } }));
      } else if (activeDrag === 'certId') {
        setPositions(prev => ({ ...prev, certId: { ...prev.certId, x, y } }));
      } else if (activeDrag === 'qr') {
        setPositions(prev => ({ ...prev, qr: { ...prev.qr, x, y } }));
      }
    }
    
    // Handle resizing - calculate size based on distance from marker center
    if (activeResize && previewRef.current) {
      let centerX: number, centerY: number;
      
      if (activeResize === 'qr') {
        centerX = positions.qr.x;
        centerY = positions.qr.y;
      } else if (activeResize === 'name') {
        centerX = positions.name.x;
        centerY = positions.name.y;
      } else {
        centerX = positions.certId.x;
        centerY = positions.certId.y;
      }
      
      // Calculate distance from center to cursor
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      
      // Map distance to size - scale it properly
      let newSize: number;
      if (activeResize === 'qr') {
        newSize = Math.max(1, Math.min(25, Math.round(distance * 0.8)));
      } else if (activeResize === 'name') {
        newSize = Math.max(1, Math.min(80, Math.round(distance * 1.5)));
      } else {
        newSize = Math.max(1, Math.min(24, Math.round(distance * 0.6)));
      }
      
      if (activeResize === 'qr') {
        setPositions(prev => ({ ...prev, qr: { ...prev.qr, size: newSize } }));
      } else if (activeResize === 'name') {
        setPositions(prev => ({ ...prev, name: { ...prev.name, size: newSize } }));
      } else if (activeResize === 'certId') {
        setPositions(prev => ({ ...prev, certId: { ...prev.certId, size: newSize } }));
      }
    }
  };

  const handleMouseUp = () => {
    setActiveDrag(null);
    setActiveResize(null);
  };

  // Sync sliders with drag (optional - when slider changes, update position)
  const updatePositionFromSlider = (type: 'name' | 'certId' | 'qr', axis: 'x' | 'y', value: number) => {
    setPositions(prev => ({
      ...prev,
      [type]: { ...prev[type], [axis]: value }
    }));
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/templates");
      const data = await response.json();
      if (response.ok) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        alert("Please select a PDF file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !formData.name) {
      alert("Please select a file and enter a name");
      return;
    }

    setIsUploading(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", selectedFile);
      uploadFormData.append("name", formData.name);
      uploadFormData.append("description", formData.description);
      uploadFormData.append("category", formData.category);

      const response = await fetch("/api/templates", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShowUploadModal(false);
        setSelectedFile(null);
        setFormData({ name: "", description: "", category: "General" });
        fetchTemplates();
        alert("Template uploaded successfully!");
      } else {
        alert(data.error || "Failed to upload template");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error uploading template");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (template: CertificateTemplate) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      const url = `/api/templates/${template.id}${template.fileName ? `?fileName=${encodeURIComponent(template.fileName)}` : ''}`;
      console.log("Delete URL:", url);
      
      const response = await fetch(url, {
        method: "DELETE",
      });
      
      const data = await response.json();
      console.log("Delete response:", data);

      if (response.ok) {
        fetchTemplates();
        alert("Template deleted");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete template");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error deleting template");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-gray-200 rounded-xl w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      {/* Header */}
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-headline font-bold text-brand-dark-green tracking-tight mb-2">
            Certificate Templates
          </h2>
          <p className="text-on-surface-variant text-sm sm:text-base">
            Upload and manage certificate design templates (PDF format)
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          Upload Template
        </button>
      </header>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-green-100 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">description</span>
          <h3 className="text-xl font-headline font-bold text-brand-dark-green mb-2">No Templates Yet</h3>
          <p className="text-on-surface-variant mb-6">Upload your first certificate template to get started</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold"
          >
            Upload First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-xl border border-green-100 overflow-hidden hover:shadow-lg transition-all"
            >
              {/* Preview Area */}
              <div className="h-40 bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center relative overflow-hidden">
                <iframe 
                  src={`${template.fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitV`}
                  className="w-full h-full object-cover"
                  title={`${template.name} preview`}
                />
                <span className={`absolute top-3 right-3 px-2 py-1 text-xs font-bold rounded-full ${
                  template.isActive ? "bg-green-100 text-brand-green" : "bg-gray-100 text-gray-500"
                }`}>
                  {template.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-headline font-bold text-brand-dark-green">{template.name}</h3>
                    <span className="text-xs text-on-surface-variant">{template.category}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(template)}
                    className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Delete template"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
                
                {template.description && (
                  <p className="text-sm text-on-surface-variant mb-3 line-clamp-2">{template.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <span>{formatFileSize(template.fileSize)}</span>
                  <span>{formatDate(template.createdAt)}</span>
                </div>

                <a
                  href={template.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-brand-green rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  View Template
                </a>
                
                <button
                  onClick={() => {
                    setLoadingTemplate(true);
                    setEditingTemplate(template);
                    setPositions(template.positions || {
                      name: { x: 50, y: 45, size: 48 },
                      certId: { x: 50, y: 30, size: 12, color: "#333333" },
                      qr: { x: 85, y: 60, size: 12 },
                    });
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 border border-green-200 text-brand-grass-green rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">tune</span>
                  Edit Positions
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ overflow: 'auto' }}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto my-8">
            <div className="p-6 border-b border-green-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-headline font-bold text-brand-dark-green">Upload Certificate Template</h3>
                <p className="text-sm text-on-surface-variant">Upload a PDF certificate design</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-green-50 rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">PDF File *</label>
                <div className="border-2 border-dashed border-green-200 rounded-xl p-6 text-center hover:border-brand-vivid-green hover:bg-green-50/30 transition-all cursor-pointer"
                  onClick={() => document.getElementById("templateFile")?.click()}
                >
                  <input
                    id="templateFile"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <span className="material-symbols-outlined text-brand-vivid-green">description</span>
                      <div className="text-left">
                        <p className="text-sm font-medium text-brand-dark-green">{selectedFile.name}</p>
                        <p className="text-xs text-on-surface-variant">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-4xl text-brand-grass-green/40 mb-2 block">upload_file</span>
                      <p className="text-sm text-on-surface-variant">Click to select PDF file</p>
                      <p className="text-xs text-on-surface-variant mt-1">Max size: 10MB</p>
                    </>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Template Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Standard Certificate, Modern Design"
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-brand-vivid-green/50"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none cursor-pointer"
                >
                  <option value="General">General</option>
                  <option value="Official">Official</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-brand-grass-green uppercase mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full bg-surface-container-low border border-green-100 rounded-xl p-3 text-sm outline-none resize-none focus:ring-2 focus:ring-brand-vivid-green/50"
                />
              </div>
            </div>

            <div className="p-6 border-t border-green-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setFormData({ name: "", description: "", category: "General" });
                }}
                className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || !selectedFile || !formData.name}
                className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">upload</span>
                    Upload Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Position Editor Modal */}
      {editingTemplate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          style={{ overflow: 'auto' }}
        >
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl my-8 max-h-[95vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-green-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-headline font-bold text-brand-dark-green">Edit Overlay Positions</h3>
                <p className="text-sm text-on-surface-variant">{editingTemplate.name}</p>
              </div>
              <button
                onClick={() => setEditingTemplate(null)}
                className="p-2 hover:bg-green-50 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {/* Test Data */}
              <div className="mb-4 p-4 bg-green-50 rounded-xl">
                <p className="text-xs font-bold text-brand-grass-green uppercase mb-3">Test Data</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">Name</label>
                    <input
                      type="text"
                      value={testData.name}
                      onChange={(e) => setTestData({ ...testData, name: e.target.value })}
                      className="w-full bg-white border border-green-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">Certificate ID</label>
                    <input
                      type="text"
                      value={testData.certId}
                      onChange={(e) => setTestData({ ...testData, certId: e.target.value })}
                      className="w-full bg-white border border-green-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Position Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Name Position */}
                <div className="bg-green-50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-brand-green">person</span>
                    <span className="font-bold text-brand-dark-green">Name Position</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-on-surface-variant">Horizontal (%)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={positions.name.x}
                        onChange={(e) => setPositions({ ...positions, name: { ...positions.name, x: Number(e.target.value) } })}
                        className="w-full"
                      />
                      <span className="text-xs font-mono">{positions.name.x}%</span>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant">Vertical (%)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={positions.name.y}
                        onChange={(e) => setPositions({ ...positions, name: { ...positions.name, y: Number(e.target.value) } })}
                        className="w-full"
                      />
                      <span className="text-xs font-mono">{positions.name.y}%</span>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant">Font Size</label>
                      <input
                        type="range"
                        min="1"
                        max="80"
                        value={positions.name.size || 48}
                        onChange={(e) => setPositions({ ...positions, name: { ...positions.name, size: Number(e.target.value) } })}
                        className="w-full"
                      />
                      <span className="text-xs font-mono">{positions.name.size || 48}px</span>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant">Color</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={positions.name.color || "#1b4332"}
                          onChange={(e) => setPositions({ ...positions, name: { ...positions.name, color: e.target.value } })}
                          className="w-8 h-8 rounded cursor-pointer border-0"
                        />
                        <span className="text-xs font-mono">{positions.name.color || "#1b4332"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Certificate ID Position */}
                <div className="bg-green-50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-brand-green">badge</span>
                    <span className="font-bold text-brand-dark-green">Certificate ID</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-on-surface-variant">Horizontal (%)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={positions.certId.x}
                        onChange={(e) => setPositions({ ...positions, certId: { ...positions.certId, x: Number(e.target.value) } })}
                        className="w-full"
                      />
                      <span className="text-xs font-mono">{positions.certId.x}%</span>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant">Vertical (%)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={positions.certId.y}
                        onChange={(e) => setPositions({ ...positions, certId: { ...positions.certId, y: Number(e.target.value) } })}
                        className="w-full"
                      />
                      <span className="text-xs font-mono">{positions.certId.y}%</span>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant">Font Size</label>
                      <input
                        type="range"
                        min="1"
                        max="24"
                        value={positions.certId.size || 12}
                        onChange={(e) => setPositions({ ...positions, certId: { ...positions.certId, size: Number(e.target.value) } })}
                        className="w-full"
                      />
                      <span className="text-xs font-mono">{positions.certId.size || 12}px</span>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant">Color</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={positions.certId.color || "#333333"}
                          onChange={(e) => setPositions({ ...positions, certId: { ...positions.certId, color: e.target.value } })}
                          className="w-8 h-8 rounded cursor-pointer border-0"
                        />
                        <span className="text-xs font-mono">{positions.certId.color || "#333333"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* QR Code Position */}
                <div className="bg-green-50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-brand-green">qr_code_2</span>
                    <span className="font-bold text-brand-dark-green">QR Code</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-on-surface-variant">Horizontal (%)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={positions.qr.x}
                        onChange={(e) => setPositions({ ...positions, qr: { ...positions.qr, x: Number(e.target.value) } })}
                        className="w-full"
                      />
                      <span className="text-xs font-mono">{positions.qr.x}%</span>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant">Vertical (%)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={positions.qr.y}
                        onChange={(e) => setPositions({ ...positions, qr: { ...positions.qr, y: Number(e.target.value) } })}
                        className="w-full"
                      />
                      <span className="text-xs font-mono">{positions.qr.y}%</span>
                    </div>
                    <div>
                      <label className="text-xs text-on-surface-variant">Size (%)</label>
                      <input
                        type="range"
                        min="1"
                        max="25"
                        value={positions.qr.size || 12}
                        onChange={(e) => setPositions({ ...positions, qr: { ...positions.qr, size: Number(e.target.value) } })}
                        className="w-full"
                      />
                      <span className="text-xs font-mono">{positions.qr.size || 12}%</span>
                    </div>
                  </div>
                  <div className="mt-2 w-8 h-8 bg-brand-dark-green rounded flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-sm">qr_code_2</span>
                  </div>
                </div>
              </div>

              {/* Visual Preview - Draggable */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-bold text-brand-grass-green uppercase">Live Preview</p>
                    <button
                      onClick={generatePreview}
                      disabled={generatingPreview}
                      className="px-3 py-1 text-xs bg-brand-vivid-green text-white rounded-lg flex items-center gap-1 hover:bg-green-700 disabled:opacity-50"
                    >
                      {generatingPreview ? (
                        <span className="material-symbols-outlined animate-spin text-xs">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-xs">refresh</span>
                      )}
                      {generatingPreview ? "Generating..." : "Generate Preview"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-vivid-green rounded"></span> Name</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-dark-green rounded"></span> ID</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> QR</span>
                  </div>
                </div>
                
                {previewPdfUrl && (
                  <div className="mb-3 p-2 bg-green-50 rounded-lg flex items-center justify-between">
                    <span className="text-xs text-brand-dark-green">Preview generated!</span>
                    <a
                      href={previewPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-vivid-green hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                      Open Full Preview
                    </a>
                  </div>
                )}
                
                <div 
                  className="relative w-full min-h-[500px] bg-white rounded-xl overflow-hidden border-2 border-green-200 cursor-crosshair"
                  ref={previewRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {loadingTemplate && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-50">
                      <span className="material-symbols-outlined animate-spin text-4xl text-brand-green mb-2">progress_activity</span>
                      <span className="text-sm text-gray-500">Loading template...</span>
                    </div>
                  )}
                {previewPdfUrl ? (
                  <iframe 
                    src={`${previewPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-full"
                    title="Generated Preview"
                  />
                ) : (
                  <iframe 
                    src={`${editingTemplate.fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-full"
                    title="Template Preview"
                    onLoad={() => setLoadingTemplate(false)}
                  />
                )}
                  
                  {/* Draggable Name marker */}
                  <DraggableMarker
                    x={positions.name.x}
                    y={positions.name.y}
                    color={positions.name.color || "#1b4332"}
                    label={testData.name}
                    fontSize={positions.name.size || 48}
                    size={positions.name.size || 48}
                    isActive={activeDrag === 'name' || activeResize === 'name'}
                    onMouseDown={(e) => startDrag(e, 'name')}
                    onResize={(e) => startResize(e, 'name')}
                  />

                  {/* Draggable Cert ID marker */}
                  <DraggableMarker
                    x={positions.certId.x}
                    y={positions.certId.y}
                    color={positions.certId.color || "#333333"}
                    label={testData.certId}
                    fontSize={positions.certId.size || 12}
                    size={positions.certId.size || 12}
                    isActive={activeDrag === 'certId' || activeResize === 'certId'}
                    onMouseDown={(e) => startDrag(e, 'certId')}
                    onResize={(e) => startResize(e, 'certId')}
                  />

                  {/* Draggable QR marker */}
                  <DraggableMarker
                    x={positions.qr.x}
                    y={positions.qr.y}
                    color="bg-blue-500"
                    isQR={true}
                    size={positions.qr.size || 12}
                    isActive={activeDrag === 'qr' || activeResize === 'qr'}
                    onMouseDown={(e) => startDrag(e, 'qr')}
                    onResize={(e) => startResize(e, 'qr')}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-green-50 flex justify-between">
              <button
                onClick={() => setEditingTemplate(null)}
                className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setSavingPositions(true);
                  try {
                    const response = await fetch("/api/templates", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: editingTemplate?.id, positions }),
                    });
                    if (response.ok) {
                      fetchTemplates();
                      setEditingTemplate(null);
                      alert("Positions saved!");
                    } else {
                      alert("Failed to save positions");
                    }
                  } catch (err) {
                    console.error("Error saving positions:", err);
                    alert("Error saving positions");
                  } finally {
                    setSavingPositions(false);
                  }
                }}
                disabled={savingPositions}
                className="px-6 py-3 vivid-gradient-cta text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {savingPositions ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    Save Positions
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewPdfUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          style={{ overflow: 'auto' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewPdfUrl(null);
              URL.revokeObjectURL(previewPdfUrl);
            }
          }}
        >
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl my-8 flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="p-4 border-b border-green-50 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-bold text-brand-dark-green">Certificate Preview</h3>
              <button
                onClick={() => {
                  setPreviewPdfUrl(null);
                  URL.revokeObjectURL(previewPdfUrl);
                }}
                className="p-2 hover:bg-green-50 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe 
                src={`${previewPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full min-h-[600px]"
                title="Certificate Preview"
              />
            </div>
            <div className="p-4 border-t border-green-50 flex justify-end flex-shrink-0">
              <a
                href={previewPdfUrl}
                download="certificate-preview.pdf"
                className="px-4 py-2 vivid-gradient-cta text-white rounded-lg font-medium"
              >
                Download PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to get contrasting color for marker background
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#1b4332' : '#ffffff';
}

// Draggable Marker Component - visual sizes match actual PDF output
function DraggableMarker({ 
  x, y, color, label, isActive, onMouseDown, onResize, isQR, size, fontSize 
}: { 
  x: number; y: number; color: string; label?: string; isActive: boolean; onMouseDown: (e: React.MouseEvent) => void; onResize?: (e: React.MouseEvent) => void; isQR?: boolean; size?: number; fontSize?: number 
}) {
  // For QR: size in UI is in %, we multiply by 3.5 to show approximate visual size
  // For text: fontSize directly maps to px size
  const markerSize = isQR ? (size || 12) * 3.5 : (fontSize || 14);
  const markerColor = color || "#1b4332";
  const textColor = getContrastColor(markerColor);
  
  return (
    <div
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-shadow ${
        isActive ? 'z-50' : 'z-10'
      }`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onMouseDown={onMouseDown}
    >
      {isQR ? (
        <div className="relative">
          <div 
            className="rounded-lg flex items-center justify-center shadow-lg border-2 border-white"
            style={{ 
              width: `${markerSize}px`, 
              height: `${markerSize}px`, 
              backgroundColor: '#3b82f6',
              minWidth: '20px',
              minHeight: '20px'
            }}
          >
            <span className="material-symbols-outlined text-white text-xs">qr_code_2</span>
          </div>
          {onResize && (
            <div 
              className="absolute -bottom-2 -right-2 w-5 h-5 bg-brand-vivid-green border-2 border-white rounded-full cursor-se-resize flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              onMouseDown={onResize}
              title="Drag to resize"
            >
              <span className="text-white text-[10px] font-bold">⤡</span>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex flex-col items-center">
          <div 
            className="rounded-lg shadow-lg border-2 border-white"
            style={{ 
              padding: '4px 12px', 
              fontSize: `${fontSize || 14}px`, 
              minWidth: '60px', 
              backgroundColor: markerColor, 
              color: textColor 
            }}
          >
            <span className="font-bold whitespace-nowrap">{label}</span>
          </div>
          {onResize && (
            <div 
              className="absolute -bottom-2 -right-2 w-5 h-5 bg-brand-vivid-green border-2 border-white rounded-full cursor-se-resize flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              onMouseDown={onResize}
              title="Drag to resize"
            >
              <span className="text-white text-[10px] font-bold">⤡</span>
            </div>
          )}
          <div className="w-3 h-3 rounded-full mt-1 shadow border border-white" style={{ backgroundColor: markerColor }}></div>
        </div>
      )}
    </div>
  );
}
