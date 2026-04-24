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
  // Actual PDF page dimensions — drives the correct aspect ratio for the preview canvas
  const [templateDimensions, setTemplateDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const previewRef = useRef<HTMLDivElement>(null);
  // Tracks the initial state when a resize drag starts (delta-based resize)
  const resizeStartRef = useRef<{ clientX: number; clientY: number; startSize: number } | null>(null);
  // Tracks rendered pixel size of the preview container for accurate marker scaling
  const containerSizeRef = useRef<{ width: number; height: number }>({ width: 500, height: 707 });

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
          templateId: editingTemplate.id,
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
    const startSize = type === 'qr' ? (positions.qr.size ?? 12)
      : type === 'name' ? (positions.name.size ?? 48)
      : (positions.certId.size ?? 12);
    resizeStartRef.current = { clientX: e.clientX, clientY: e.clientY, startSize };
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
    
    // Handle resizing — delta from drag-start position (drag right/down = bigger, left/up = smaller)
    if (activeResize && resizeStartRef.current) {
      const { clientX: startX, clientY: startY, startSize } = resizeStartRef.current;
      const delta = ((e.clientX - startX) + (e.clientY - startY)) / 2;
      let newSize: number;
      if (activeResize === 'qr') {
        newSize = Math.max(1, Math.min(25, Math.round(startSize + delta * 0.08)));
      } else if (activeResize === 'name') {
        newSize = Math.max(8, Math.min(80, Math.round(startSize + delta * 0.25)));
      } else {
        newSize = Math.max(6, Math.min(24, Math.round(startSize + delta * 0.08)));
      }
      setPositions(prev => ({ ...prev, [activeResize]: { ...prev[activeResize], size: newSize } }));
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

  // Fetch actual PDF page dimensions whenever a template is opened for editing
  useEffect(() => {
    if (!editingTemplate) return;
    setTemplateDimensions({ width: 595, height: 842 }); // reset to portrait default
    fetch(`/api/templates/${editingTemplate.id}/dimensions`)
      .then(r => r.json())
      .then(({ width, height }) => {
        if (width > 0 && height > 0) setTemplateDimensions({ width, height });
      })
      .catch(() => {});
  }, [editingTemplate?.id]);

  // Track the preview container's rendered pixel size for marker scaling
  useEffect(() => {
    if (!previewRef.current || !editingTemplate) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerSizeRef.current = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
      }
    });
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, [editingTemplate]);

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
              <div className="h-40 bg-gray-50 relative overflow-hidden">
                <iframe
                  src={`/api/templates/${template.id}/pdf#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                  className="w-full h-full border-0 pointer-events-none"
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
                  href={`/api/templates/${template.id}/pdf`}
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

              {/* Position Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Name Position */}
                <div className="bg-green-50 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-brand-green text-base">person</span>
                    <span className="font-bold text-brand-dark-green text-sm">Name</span>
                  </div>
                  <SliderField label="Horizontal (%)" min={0} max={100} step={0.5}
                    value={positions.name.x}
                    onChange={v => setPositions({ ...positions, name: { ...positions.name, x: v } })} />
                  <SliderField label="Vertical (%)" min={0} max={100} step={0.5}
                    value={positions.name.y}
                    onChange={v => setPositions({ ...positions, name: { ...positions.name, y: v } })} />
                  <SliderField label="Font Size (pt)" min={8} max={80} step={1}
                    value={positions.name.size ?? 48}
                    onChange={v => setPositions({ ...positions, name: { ...positions.name, size: v } })} />
                  <div>
                    <label className="text-xs text-on-surface-variant">Color</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" value={positions.name.color || "#1b4332"}
                        onChange={e => setPositions({ ...positions, name: { ...positions.name, color: e.target.value } })}
                        className="w-8 h-8 rounded cursor-pointer border-0" />
                      <span className="text-xs font-mono">{positions.name.color || "#1b4332"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setPositions({ ...positions, name: { ...positions.name, x: 50 } })}
                      className="flex-1 py-1 text-[11px] bg-white border border-green-200 rounded-lg text-brand-grass-green hover:bg-green-100 transition-colors cursor-pointer">
                      Center H
                    </button>
                    <button onClick={() => setPositions({ ...positions, name: { ...positions.name, y: 50 } })}
                      className="flex-1 py-1 text-[11px] bg-white border border-green-200 rounded-lg text-brand-grass-green hover:bg-green-100 transition-colors cursor-pointer">
                      Center V
                    </button>
                  </div>
                </div>

                {/* Certificate ID Position */}
                <div className="bg-green-50 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-brand-green text-base">badge</span>
                    <span className="font-bold text-brand-dark-green text-sm">Certificate ID</span>
                  </div>
                  <SliderField label="Horizontal (%)" min={0} max={100} step={0.5}
                    value={positions.certId.x}
                    onChange={v => setPositions({ ...positions, certId: { ...positions.certId, x: v } })} />
                  <SliderField label="Vertical (%)" min={0} max={100} step={0.5}
                    value={positions.certId.y}
                    onChange={v => setPositions({ ...positions, certId: { ...positions.certId, y: v } })} />
                  <SliderField label="Font Size (pt)" min={6} max={24} step={0.5}
                    value={positions.certId.size ?? 12}
                    onChange={v => setPositions({ ...positions, certId: { ...positions.certId, size: v } })} />
                  <div>
                    <label className="text-xs text-on-surface-variant">Color</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" value={positions.certId.color || "#333333"}
                        onChange={e => setPositions({ ...positions, certId: { ...positions.certId, color: e.target.value } })}
                        className="w-8 h-8 rounded cursor-pointer border-0" />
                      <span className="text-xs font-mono">{positions.certId.color || "#333333"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setPositions({ ...positions, certId: { ...positions.certId, x: 50 } })}
                      className="flex-1 py-1 text-[11px] bg-white border border-green-200 rounded-lg text-brand-grass-green hover:bg-green-100 transition-colors cursor-pointer">
                      Center H
                    </button>
                    <button onClick={() => setPositions({ ...positions, certId: { ...positions.certId, y: 50 } })}
                      className="flex-1 py-1 text-[11px] bg-white border border-green-200 rounded-lg text-brand-grass-green hover:bg-green-100 transition-colors cursor-pointer">
                      Center V
                    </button>
                  </div>
                </div>

                {/* QR Code Position */}
                <div className="bg-green-50 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-brand-green text-base">qr_code_2</span>
                    <span className="font-bold text-brand-dark-green text-sm">QR Code</span>
                  </div>
                  <SliderField label="Horizontal (%)" min={0} max={100} step={0.5}
                    value={positions.qr.x}
                    onChange={v => setPositions({ ...positions, qr: { ...positions.qr, x: v } })} />
                  <SliderField label="Vertical (%)" min={0} max={100} step={0.5}
                    value={positions.qr.y}
                    onChange={v => setPositions({ ...positions, qr: { ...positions.qr, y: v } })} />
                  <SliderField label="Size (%)" min={1} max={25} step={0.5}
                    value={positions.qr.size ?? 12}
                    onChange={v => setPositions({ ...positions, qr: { ...positions.qr, size: v } })} />
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setPositions({ ...positions, qr: { ...positions.qr, x: 50 } })}
                      className="flex-1 py-1 text-[11px] bg-white border border-green-200 rounded-lg text-brand-grass-green hover:bg-green-100 transition-colors cursor-pointer">
                      Center H
                    </button>
                    <button onClick={() => setPositions({ ...positions, qr: { ...positions.qr, y: 50 } })}
                      className="flex-1 py-1 text-[11px] bg-white border border-green-200 rounded-lg text-brand-grass-green hover:bg-green-100 transition-colors cursor-pointer">
                      Center V
                    </button>
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
                
                {/* Aspect ratio now matches the actual PDF page — portrait or landscape */}
                <div
                  className="relative w-full bg-white rounded-xl overflow-hidden border-2 border-green-200 cursor-crosshair select-none"
                  style={{ aspectRatio: `${templateDimensions.width} / ${templateDimensions.height}` }}
                  ref={previewRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {/* Crosshair guides visible while dragging */}
                  {activeDrag && (() => {
                    const pos = activeDrag === 'name' ? positions.name : activeDrag === 'certId' ? positions.certId : positions.qr;
                    return (
                      <>
                        <div className="absolute inset-y-0 pointer-events-none z-40 border-l border-dashed border-brand-vivid-green/40" style={{ left: `${pos.x}%` }} />
                        <div className="absolute inset-x-0 pointer-events-none z-40 border-t border-dashed border-brand-vivid-green/40" style={{ top: `${pos.y}%` }} />
                      </>
                    );
                  })()}
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
                    src={`/api/templates/${editingTemplate.id}/pdf#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                    className="w-full h-full border-0"
                    title="Template Preview"
                    onLoad={() => setLoadingTemplate(false)}
                  />
                )}
                  
                  {/* Draggable Name marker */}
                  <DraggableMarker
                    x={positions.name.x} y={positions.name.y}
                    color={positions.name.color || "#1b4332"}
                    label={testData.name}
                    fontSize={positions.name.size ?? 48}
                    isActive={activeDrag === 'name' || activeResize === 'name'}
                    onMouseDown={(e) => startDrag(e, 'name')}
                    onResize={(e) => startResize(e, 'name')}
                    pdfWidth={templateDimensions.width}
                    containerWidth={containerSizeRef.current.width}
                  />

                  {/* Draggable Cert ID marker */}
                  <DraggableMarker
                    x={positions.certId.x} y={positions.certId.y}
                    color={positions.certId.color || "#333333"}
                    label={testData.certId}
                    fontSize={positions.certId.size ?? 12}
                    isActive={activeDrag === 'certId' || activeResize === 'certId'}
                    onMouseDown={(e) => startDrag(e, 'certId')}
                    onResize={(e) => startResize(e, 'certId')}
                    pdfWidth={templateDimensions.width}
                    containerWidth={containerSizeRef.current.width}
                  />

                  {/* Draggable QR marker */}
                  <DraggableMarker
                    x={positions.qr.x} y={positions.qr.y}
                    color="#3b82f6"
                    isQR size={positions.qr.size ?? 12}
                    isActive={activeDrag === 'qr' || activeResize === 'qr'}
                    onMouseDown={(e) => startDrag(e, 'qr')}
                    onResize={(e) => startResize(e, 'qr')}
                    pdfWidth={templateDimensions.width}
                    containerWidth={containerSizeRef.current.width}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-green-50 flex justify-between items-center">
              <button
                onClick={() => setEditingTemplate(null)}
                className="px-6 py-3 text-sm font-bold text-on-surface-variant hover:bg-green-50 rounded-xl"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={generatePreview}
                  disabled={generatingPreview}
                  className="px-5 py-3 text-sm font-bold border border-brand-vivid-green text-brand-vivid-green rounded-xl flex items-center gap-2 hover:bg-green-50 disabled:opacity-50"
                >
                  {generatingPreview ? (
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm">visibility</span>
                  )}
                  {generatingPreview ? "Generating..." : "Generate Preview"}
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

// ── SliderField: slider + number input combined ──────────────────────────────
function SliderField({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-on-surface-variant">{label}</label>
        <input
          type="number" min={min} max={max} step={step}
          value={Math.round(value * 10) / 10}
          onChange={e => {
            const v = Number(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-16 text-xs font-mono text-right border border-green-200 rounded px-1.5 py-0.5 outline-none focus:border-brand-vivid-green bg-white"
        />
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-brand-vivid-green"
      />
    </div>
  );
}

// ── Contrast helper ──────────────────────────────────────────────────────────
function getContrastColor(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#1b4332' : '#ffffff';
}

// ── DraggableMarker: visually scaled to match PDF output ────────────────────
function DraggableMarker({
  x, y, color, label, isActive, onMouseDown, onResize, isQR, size, fontSize,
  pdfWidth, containerWidth,
}: {
  x: number; y: number; color: string; label?: string; isActive: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResize?: (e: React.MouseEvent) => void;
  isQR?: boolean; size?: number; fontSize?: number;
  pdfWidth: number; containerWidth: number;
}) {
  // scale = rendered px per PDF point — makes markers visually match PDF output
  const scale = containerWidth > 0 ? containerWidth / pdfWidth : 1;

  const markerColor = color || "#1b4332";
  const textColor = getContrastColor(markerColor);

  // QR: size is % of min(pdfW, pdfH) → convert to px in the preview
  const qrPx = Math.max(24, ((size ?? 12) / 100) * pdfWidth * scale);
  // Text: fontSize is in PDF points → convert to preview px
  const textPx = Math.max(10, (fontSize ?? 14) * scale);

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${isActive ? 'z-50' : 'z-10'}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onMouseDown={onMouseDown}
    >
      {isQR ? (
        <div className="relative" style={{ width: qrPx, height: qrPx }}>
          <div
            className="w-full h-full rounded-lg flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: '#3b82f6',
              border: isActive ? '2px solid #22c55e' : '2px solid white',
              opacity: isActive ? 1 : 0.85,
            }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: Math.max(12, qrPx * 0.4) }}>qr_code_2</span>
          </div>
          {onResize && (
            <div
              className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-brand-vivid-green border-2 border-white rounded-full cursor-se-resize flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              onMouseDown={e => { e.stopPropagation(); onResize(e); }}
              title="Drag ↘ to resize"
            >
              <span className="text-white text-[9px] font-bold leading-none">⤡</span>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex flex-col items-center">
          <div
            className="rounded-lg shadow-lg whitespace-nowrap font-bold"
            style={{
              padding: `${Math.max(2, textPx * 0.15)}px ${Math.max(6, textPx * 0.4)}px`,
              fontSize: textPx,
              backgroundColor: markerColor,
              color: textColor,
              border: isActive ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.8)',
              opacity: isActive ? 1 : 0.85,
            }}
          >
            {label}
          </div>
          {onResize && (
            <div
              className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-brand-vivid-green border-2 border-white rounded-full cursor-se-resize flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              onMouseDown={e => { e.stopPropagation(); onResize(e); }}
              title="Drag ↘ to resize"
            >
              <span className="text-white text-[9px] font-bold leading-none">⤡</span>
            </div>
          )}
          {/* Center dot */}
          <div className="w-2 h-2 rounded-full mt-1 shadow border border-white/80" style={{ backgroundColor: markerColor }} />
        </div>
      )}
    </div>
  );
}
