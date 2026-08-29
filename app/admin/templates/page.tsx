"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AVAILABLE_FONTS, getGoogleFontsUrl } from "@/lib/fonts";

interface PositionConfig {
  x: number;
  y: number;
  size?: number;
  color?: string;
  font?: string;
  bg?: string;           // background box color behind the text, if set
  bgPadding?: number;    // pt of padding around the text inside the background box
  letterSpacing?: number; // extra pt added between characters
}

interface CustomElement {
  id: string;
  label: string; // display name in editor
  text: string;  // static text drawn on the certificate (ignored when sourceField is set)
  x: number;
  y: number;
  size?: number;
  color?: string;
  font?: string;
  bg?: string;
  bgPadding?: number;
  letterSpacing?: number;
  // When set, the printed value comes from this participant column (e.g. "Designation")
  // instead of the literal `text` — populated via Google Sheets sync or CSV/Excel import.
  sourceField?: string;
}

interface Positions {
  name: PositionConfig;
  certId: PositionConfig;
  qr: PositionConfig & { darkColor?: string; lightColor?: string; transparentBg?: boolean };
  customElements?: CustomElement[];
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
    qr: { x: 85, y: 60, size: 12, darkColor: "#000000", lightColor: "#ffffff", transparentBg: false },
  });
  const [savingPositions, setSavingPositions] = useState(false);
  const [testData, setTestData] = useState({
    name: "Dr John Doe Wright",
    certId: "2026-PZ-CRS-0001",
  });
  // Sample values for bound custom-text elements (keyed by column name), used only
  // to preview what a real Sheet/CSV value would look like on the certificate.
  const [testFieldValues, setTestFieldValues] = useState<Record<string, string>>({});
  const isFixedElement = (id: string | null): id is 'name' | 'certId' | 'qr' => id === 'name' || id === 'certId' || id === 'qr';
  const [activeDrag, setActiveDrag] = useState<'name' | 'certId' | 'qr' | string | null>(null);
  const [activeResize, setActiveResize] = useState<'name' | 'certId' | 'qr' | string | null>(null);
  const [selectedElement, setSelectedElement] = useState<'name' | 'certId' | 'qr' | string | null>(null);
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

  // ── Undo/redo ────────────────────────────────────────────────────────────
  // A drag or slider fires many rapid updates — each burst collapses into ONE
  // undo step (committed after a short quiet period) rather than one per pixel.
  const positionsRef = useRef(positions);
  useEffect(() => { positionsRef.current = positions; }, [positions]);
  const undoStackRef = useRef<Positions[]>([]);
  const redoStackRef = useRef<Positions[]>([]);
  const pendingSnapshotRef = useRef<Positions | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Suppresses the auto-preview round-trip until the admin actually changes something
  // (avoids re-rendering a preview PDF the instant a template is opened for editing).
  const hasEditedRef = useRef(false);

  const resetHistory = () => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    undoStackRef.current = [];
    redoStackRef.current = [];
    pendingSnapshotRef.current = null;
    hasEditedRef.current = false;
    setCanUndo(false);
    setCanRedo(false);
  };

  const updatePositions = useCallback((updater: Positions | ((prev: Positions) => Positions)) => {
    hasEditedRef.current = true;
    if (pendingSnapshotRef.current === null) pendingSnapshotRef.current = positionsRef.current;
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      if (pendingSnapshotRef.current) {
        undoStackRef.current.push(pendingSnapshotRef.current);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
        setCanUndo(true);
        setCanRedo(false);
      }
      pendingSnapshotRef.current = null;
    }, 500);
    setPositions(updater);
  }, []);

  const undo = useCallback(() => {
    if (commitTimerRef.current) { clearTimeout(commitTimerRef.current); commitTimerRef.current = null; }
    const snapshot = pendingSnapshotRef.current ?? undoStackRef.current.pop();
    if (!snapshot) return;
    pendingSnapshotRef.current = null;
    redoStackRef.current.push(positionsRef.current);
    setPositions(snapshot);
    setCanRedo(true);
    setCanUndo(undoStackRef.current.length > 0);
  }, []);

  const redo = useCallback(() => {
    const snapshot = redoStackRef.current.pop();
    if (!snapshot) return;
    undoStackRef.current.push(positionsRef.current);
    setPositions(snapshot);
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

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

  const generatePreview = async (silent = false) => {
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
          testFieldValues,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewPdfUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
      } else if (!silent) {
        alert("Failed to generate preview");
      }
    } catch (err) {
      console.error("Error generating preview:", err);
      if (!silent) alert("Error generating preview");
    } finally {
      setGeneratingPreview(false);
    }
  };

  // Auto-refresh the preview a moment after the admin stops editing, so the "Preview
  // PDF" button becomes an on-demand refresh rather than the only way to see changes.
  const autoPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!editingTemplate || !previewPdfUrl || !hasEditedRef.current) return;
    if (autoPreviewTimerRef.current) clearTimeout(autoPreviewTimerRef.current);
    autoPreviewTimerRef.current = setTimeout(() => { generatePreview(true); }, 1200);
    return () => { if (autoPreviewTimerRef.current) clearTimeout(autoPreviewTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, testData, testFieldValues, editingTemplate?.id]);

  const addCustomElement = () => {
    const id = `custom-${Date.now()}`;
    updatePositions(prev => ({
      ...prev,
      customElements: [...(prev.customElements || []), {
        id, label: `Text ${(prev.customElements?.length ?? 0) + 1}`,
        text: "Custom Text", x: 50, y: 70, size: 18, color: "#333333",
      }],
    }));
    setSelectedElement(id);
  };

  const deleteCustomElement = (id: string) => {
    updatePositions(prev => ({ ...prev, customElements: (prev.customElements || []).filter(el => el.id !== id) }));
    if (selectedElement === id) setSelectedElement(null);
  };

  const updateCustomElement = (id: string, patch: Partial<CustomElement>) => {
    updatePositions(prev => ({
      ...prev,
      customElements: (prev.customElements || []).map(el => el.id === id ? { ...el, ...patch } : el),
    }));
  };

  const startDrag = (e: React.MouseEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedElement(type);
    setActiveDrag(type);
  };

  const startResize = (e: React.MouseEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    const customEl = (positions.customElements || []).find(el => el.id === type);
    const startSize = type === 'qr' ? (positions.qr.size ?? 12)
      : type === 'name' ? (positions.name.size ?? 48)
      : type === 'certId' ? (positions.certId.size ?? 12)
      : (customEl?.size ?? 18);
    resizeStartRef.current = { clientX: e.clientX, clientY: e.clientY, startSize };
    setActiveResize(type);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!previewRef.current) return;

    const rect = previewRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const threshold = 8;
    const dist = (ax: number, ay: number) => Math.sqrt((x - ax) ** 2 + (y - ay) ** 2);

    const nameDist = dist(positions.name.x, positions.name.y);
    const certIdDist = dist(positions.certId.x, positions.certId.y);
    const qrDist = dist(positions.qr.x, positions.qr.y);

    let best: string | null = null;
    let bestD = threshold;
    if (nameDist < bestD) { best = 'name'; bestD = nameDist; }
    if (certIdDist < bestD) { best = 'certId'; bestD = certIdDist; }
    if (qrDist < bestD) { best = 'qr'; bestD = qrDist; }
    for (const cel of positions.customElements || []) {
      const d = dist(cel.x, cel.y);
      if (d < bestD) { best = cel.id; bestD = d; }
    }
    if (best) { setSelectedElement(best); setActiveDrag(best); }
    else setSelectedElement(null);
  };

  // Snap-to-center and snap-to-other-elements while dragging (within 1.5% of canvas size).
  const SNAP_THRESHOLD = 1.5;
  const snapDragCoord = (value: number, otherValues: number[]): number => {
    if (Math.abs(value - 50) < SNAP_THRESHOLD) return 50;
    for (const v of otherValues) {
      if (Math.abs(value - v) < SNAP_THRESHOLD) return v;
    }
    return value;
  };
  const otherElementCoords = (excludeId: string) => {
    const xs: number[] = [];
    const ys: number[] = [];
    if (excludeId !== 'name') { xs.push(positions.name.x); ys.push(positions.name.y); }
    if (excludeId !== 'certId') { xs.push(positions.certId.x); ys.push(positions.certId.y); }
    if (excludeId !== 'qr') { xs.push(positions.qr.x); ys.push(positions.qr.y); }
    for (const cel of positions.customElements || []) {
      if (cel.id === excludeId) continue;
      xs.push(cel.x); ys.push(cel.y);
    }
    return { xs, ys };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!previewRef.current) return;

    const rect = previewRef.current.getBoundingClientRect();
    const rawX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const rawY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    if (activeDrag) {
      const { xs, ys } = otherElementCoords(activeDrag);
      const x = snapDragCoord(rawX, xs);
      const y = snapDragCoord(rawY, ys);
      if (activeDrag === 'name') updatePositions(prev => ({ ...prev, name: { ...prev.name, x, y } }));
      else if (activeDrag === 'certId') updatePositions(prev => ({ ...prev, certId: { ...prev.certId, x, y } }));
      else if (activeDrag === 'qr') updatePositions(prev => ({ ...prev, qr: { ...prev.qr, x, y } }));
      else updatePositions(prev => ({ ...prev, customElements: (prev.customElements || []).map(el => el.id === activeDrag ? { ...el, x, y } : el) }));
    }

    if (activeResize && resizeStartRef.current) {
      const { clientX: startX, clientY: startY, startSize } = resizeStartRef.current;
      const delta = ((e.clientX - startX) + (e.clientY - startY)) / 2;
      if (activeResize === 'qr') {
        const s = Math.max(1, Math.min(25, Math.round(startSize + delta * 0.08)));
        updatePositions(prev => ({ ...prev, qr: { ...prev.qr, size: s } }));
      } else if (activeResize === 'name') {
        const s = Math.max(8, Math.min(80, Math.round(startSize + delta * 0.25)));
        updatePositions(prev => ({ ...prev, name: { ...prev.name, size: s } }));
      } else if (activeResize === 'certId') {
        const s = Math.max(6, Math.min(24, Math.round(startSize + delta * 0.08)));
        updatePositions(prev => ({ ...prev, certId: { ...prev.certId, size: s } }));
      } else {
        const s = Math.max(6, Math.min(72, Math.round(startSize + delta * 0.15)));
        updatePositions(prev => ({ ...prev, customElements: (prev.customElements || []).map(el => el.id === activeResize ? { ...el, size: s } : el) }));
      }
    }
  };

  const handleMouseUp = () => {
    setActiveDrag(null);
    setActiveResize(null);
  };

  // Sync sliders with drag (optional - when slider changes, update position)
  const updatePositionFromSlider = (type: 'name' | 'certId' | 'qr', axis: 'x' | 'y', value: number) => {
    updatePositions(prev => ({
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

  // Keyboard navigation for selected element
  useEffect(() => {
    if (!editingTemplate) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (!selectedElement) return;
      if (e.key === 'Escape') { setSelectedElement(null); return; }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const step = e.shiftKey ? 5 : 0.5;
      const isFixed = selectedElement === 'name' || selectedElement === 'certId' || selectedElement === 'qr';
      updatePositions(prev => {
        if (isFixed) {
          const el = prev[selectedElement as 'name' | 'certId' | 'qr'];
          if (e.key === 'ArrowLeft')  return { ...prev, [selectedElement]: { ...el, x: Math.max(0, el.x - step) } };
          if (e.key === 'ArrowRight') return { ...prev, [selectedElement]: { ...el, x: Math.min(100, el.x + step) } };
          if (e.key === 'ArrowUp')    return { ...prev, [selectedElement]: { ...el, y: Math.max(0, el.y - step) } };
          if (e.key === 'ArrowDown')  return { ...prev, [selectedElement]: { ...el, y: Math.min(100, el.y + step) } };
          return prev;
        }
        return {
          ...prev,
          customElements: (prev.customElements || []).map(el => {
            if (el.id !== selectedElement) return el;
            if (e.key === 'ArrowLeft')  return { ...el, x: Math.max(0, el.x - step) };
            if (e.key === 'ArrowRight') return { ...el, x: Math.min(100, el.x + step) };
            if (e.key === 'ArrowUp')    return { ...el, y: Math.max(0, el.y - step) };
            if (e.key === 'ArrowDown')  return { ...el, y: Math.min(100, el.y + step) };
            return el;
          }),
        };
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTemplate, selectedElement]);

  const handleSavePositions = async () => {
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
  };

  // Dynamically load selected Google Fonts for live preview
  useEffect(() => {
    const customFonts = (positions.customElements || []).map(el => el.font).filter(Boolean) as string[];
    const fonts = [positions.name.font, positions.certId.font, ...customFonts].filter(Boolean) as string[];
    const url = getGoogleFontsUrl(fonts);
    if (!url) return;
    const id = "pz-template-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = url;
  }, [positions.name.font, positions.certId.font]);

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
        if (data.sharingFailed && data.template?.driveFileId) {
          if (confirm("Template uploaded, but it is not publicly shareable yet. Make it public now?")) {
            try {
              const r = await fetch("/api/drive/ensure-public", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileId: data.template.driveFileId }),
              });
              const j = await r.json().catch(() => ({}));
              alert(j.shared ? "Template is now public." : "Could not make it public — the bridge account may block link sharing.");
            } catch {
              alert("Could not reach the sharing service.");
            }
          }
        }
      } else {
        alert((data.error || "Failed to upload template") + (data.details ? `\n\nDetails: ${data.details}` : ""));
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
                    resetHistory();
                    setPositions(template.positions ? {
                      name: { ...{ x: 50, y: 45, size: 48 }, ...template.positions.name },
                      certId: { ...{ x: 50, y: 30, size: 12, color: "#333333" }, ...template.positions.certId },
                      qr: { ...{ x: 85, y: 60, size: 12, darkColor: "#000000", lightColor: "#ffffff", transparentBg: false }, ...template.positions.qr },
                      customElements: template.positions.customElements || [],
                    } : {
                      name: { x: 50, y: 45, size: 48 },
                      certId: { x: 50, y: 30, size: 12, color: "#333333" },
                      qr: { x: 85, y: 60, size: 12, darkColor: "#000000", lightColor: "#ffffff", transparentBg: false },
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

      {/* Canva-like Full-Screen Template Editor */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f3f4f6' }}>

          {/* ── Top Bar ── */}
          <div className="h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 flex-shrink-0 shadow-sm">
            <button onClick={() => setEditingTemplate(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Close editor">
              <span className="material-symbols-outlined text-gray-600">arrow_back</span>
            </button>
            <div className="border-l border-gray-200 pl-3 mr-2">
              <p className="font-bold text-brand-dark-green text-sm leading-tight">{editingTemplate.name}</p>
              <p className="text-[10px] text-gray-400 leading-tight">Template Editor</p>
            </div>

            {/* Context toolbar — shows quick controls for fixed elements only */}
            <div className="flex-1 flex items-center justify-center">
              {isFixedElement(selectedElement) && (() => {
                const fk = selectedElement;
                return (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                  <span className="font-bold text-gray-600 uppercase text-[10px] mr-1">
                    {fk === 'name' ? 'Name' : fk === 'certId' ? 'ID' : 'QR'}
                  </span>
                  <div className="w-px h-4 bg-gray-300" />
                  <span className="text-gray-400">X:</span>
                  <input type="number" min={0} max={100} step={0.5}
                    value={Math.round(positions[fk].x * 10) / 10}
                    onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) updatePositions(prev => ({ ...prev, [fk]: { ...prev[fk], x: Math.max(0, Math.min(100, v)) } })); }}
                    className="w-14 text-center border border-gray-200 rounded px-1 py-0.5 font-mono bg-white outline-none focus:border-brand-vivid-green" />
                  <span className="text-gray-400">Y:</span>
                  <input type="number" min={0} max={100} step={0.5}
                    value={Math.round(positions[fk].y * 10) / 10}
                    onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) updatePositions(prev => ({ ...prev, [fk]: { ...prev[fk], y: Math.max(0, Math.min(100, v)) } })); }}
                    className="w-14 text-center border border-gray-200 rounded px-1 py-0.5 font-mono bg-white outline-none focus:border-brand-vivid-green" />
                  {fk !== 'qr' && (
                    <>
                      <div className="w-px h-4 bg-gray-300" />
                      <span className="text-gray-400">Size:</span>
                      <input type="number" min={fk === 'name' ? 8 : 6} max={fk === 'name' ? 80 : 24} step={0.5}
                        value={positions[fk].size ?? (fk === 'name' ? 48 : 12)}
                        onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) updatePositions(prev => ({ ...prev, [fk]: { ...prev[fk], size: v } })); }}
                        className="w-14 text-center border border-gray-200 rounded px-1 py-0.5 font-mono bg-white outline-none focus:border-brand-vivid-green" />
                      <span className="text-gray-400 text-[10px]">pt</span>
                      <div className="w-px h-4 bg-gray-300" />
                      <input type="color"
                        value={(positions[fk] as PositionConfig).color || (fk === 'name' ? '#1b4332' : '#333333')}
                        onChange={e => updatePositions(prev => ({ ...prev, [fk]: { ...prev[fk], color: e.target.value } }))}
                        className="w-6 h-6 rounded cursor-pointer border border-gray-200" title="Text color" />
                    </>
                  )}
                </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <span className="material-symbols-outlined text-lg">undo</span>
              </button>
              <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <span className="material-symbols-outlined text-lg">redo</span>
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button onClick={() => generatePreview()} disabled={generatingPreview}
                className="px-3 py-1.5 text-xs font-bold bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1.5 text-gray-700 border border-gray-200 transition-colors disabled:opacity-50">
                {generatingPreview
                  ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  : <span className="material-symbols-outlined text-sm">preview</span>}
                {generatingPreview ? "Generating..." : "Preview PDF"}
              </button>
              <button onClick={handleSavePositions} disabled={savingPositions}
                className="px-4 py-1.5 vivid-gradient-cta text-white rounded-lg font-bold text-sm flex items-center gap-1.5 disabled:opacity-50">
                {savingPositions
                  ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  : <span className="material-symbols-outlined text-sm">save</span>}
                {savingPositions ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 flex overflow-hidden min-h-0">

            {/* Left panel — test data + elements list */}
            <div className="w-52 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-y-auto">
              <div className="p-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Test Data</p>
                <div className="space-y-1.5">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Name</label>
                    <input type="text" value={testData.name}
                      onChange={(e) => setTestData({ ...testData, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-vivid-green" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Certificate ID</label>
                    <input type="text" value={testData.certId}
                      onChange={(e) => setTestData({ ...testData, certId: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-vivid-green" />
                  </div>
                  {[...new Set((positions.customElements || []).map(el => el.sourceField).filter((f): f is string => !!f))].map(field => (
                    <div key={field}>
                      <label className="block text-[10px] text-gray-400 mb-0.5">{field} (bound column)</label>
                      <input type="text" value={testFieldValues[field] || ""}
                        placeholder={`Sample ${field} value`}
                        onChange={(e) => setTestFieldValues(prev => ({ ...prev, [field]: e.target.value }))}
                        className="w-full bg-purple-50 border border-purple-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-400" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Elements</p>
                <div className="space-y-1">
                  {([
                    { key: 'name', label: 'Recipient Name', icon: 'person', color: positions.name.color || '#1b4332' },
                    { key: 'certId', label: 'Certificate ID', icon: 'badge', color: positions.certId.color || '#333333' },
                    { key: 'qr', label: 'QR Code', icon: 'qr_code_2', color: '#3b82f6' },
                  ]).map(el => (
                    <button key={el.key}
                      onClick={() => setSelectedElement(selectedElement === el.key ? null : el.key)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-all ${
                        selectedElement === el.key
                          ? 'bg-green-50 border border-brand-vivid-green text-brand-dark-green shadow-sm'
                          : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm" style={{ color: el.color }}>{el.icon}</span>
                      <span>{el.label}</span>
                      {selectedElement === el.key && (
                        <span className="ml-auto material-symbols-outlined text-brand-vivid-green text-sm">check_circle</span>
                      )}
                    </button>
                  ))}
                  {(positions.customElements || []).map(cel => (
                    <div key={cel.id} className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedElement(selectedElement === cel.id ? null : cel.id)}
                        className={`flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-all min-w-0 ${
                          selectedElement === cel.id
                            ? 'bg-purple-50 border border-purple-400 text-purple-900 shadow-sm'
                            : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ color: cel.color || '#6b7280' }}>text_fields</span>
                        <span className="truncate">{cel.label}</span>
                        {selectedElement === cel.id && <span className="ml-auto material-symbols-outlined text-purple-500 text-sm flex-shrink-0">check_circle</span>}
                      </button>
                      <button onClick={() => deleteCustomElement(cel.id)} title="Remove element"
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                  <button onClick={addCustomElement}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-purple-600 hover:bg-purple-50 border border-dashed border-purple-200 transition-all mt-1">
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Custom Text
                  </button>
                </div>
                {selectedElement && (
                  <div className="mt-3 p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-500 uppercase mb-1.5">Keyboard Shortcuts</p>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-blue-400">Arrow keys → move ±0.5%</p>
                      <p className="text-[10px] text-blue-400">Shift+Arrow → move ±5%</p>
                      <p className="text-[10px] text-blue-400">Esc → deselect</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Center — canvas */}
            <div className="flex-1 flex items-start justify-center p-6 overflow-auto">
              <div className="w-full" style={{ maxWidth: Math.round((templateDimensions.width / templateDimensions.height) * 620) }}>
                {previewPdfUrl && (
                  <div className="mb-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-brand-dark-green font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-brand-vivid-green">check_circle</span>
                      Preview ready
                    </span>
                    <a href={previewPdfUrl} target="_blank" rel="noopener noreferrer"
                      className="text-brand-vivid-green hover:underline flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">open_in_new</span>Open
                    </a>
                  </div>
                )}
                <div
                  className="relative bg-white shadow-xl overflow-hidden select-none border border-gray-300"
                  style={{ aspectRatio: `${templateDimensions.width} / ${templateDimensions.height}`, cursor: activeDrag ? 'grabbing' : 'default' }}
                  ref={previewRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {activeDrag && (() => {
                    const dragPos = activeDrag === 'name' ? positions.name
                      : activeDrag === 'certId' ? positions.certId
                      : activeDrag === 'qr' ? positions.qr
                      : (positions.customElements || []).find(el => el.id === activeDrag) || positions.name;
                    return (
                      <>
                        <div className="absolute inset-y-0 pointer-events-none z-40 border-l border-dashed border-brand-vivid-green/60" style={{ left: `${dragPos.x}%` }} />
                        <div className="absolute inset-x-0 pointer-events-none z-40 border-t border-dashed border-brand-vivid-green/60" style={{ top: `${dragPos.y}%` }} />
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
                    <iframe src={`${previewPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                      className="w-full h-full pointer-events-none" title="Generated Preview" />
                  ) : (
                    <iframe src={`/api/templates/${editingTemplate.id}/pdf#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                      className="w-full h-full border-0 pointer-events-none" title="Template Preview"
                      onLoad={() => setLoadingTemplate(false)} />
                  )}
                  <DraggableMarker x={positions.name.x} y={positions.name.y}
                    color={positions.name.color || "#1b4332"} label={testData.name}
                    fontSize={positions.name.size ?? 48} fontFamily={positions.name.font}
                    isActive={activeDrag === 'name' || activeResize === 'name'}
                    isSelected={selectedElement === 'name'}
                    onMouseDown={(e) => startDrag(e, 'name')} onResize={(e) => startResize(e, 'name')}
                    pdfWidth={templateDimensions.width} containerWidth={containerSizeRef.current.width} />
                  <DraggableMarker x={positions.certId.x} y={positions.certId.y}
                    color={positions.certId.color || "#333333"} label={testData.certId}
                    fontSize={positions.certId.size ?? 12} fontFamily={positions.certId.font}
                    isActive={activeDrag === 'certId' || activeResize === 'certId'}
                    isSelected={selectedElement === 'certId'}
                    onMouseDown={(e) => startDrag(e, 'certId')} onResize={(e) => startResize(e, 'certId')}
                    pdfWidth={templateDimensions.width} containerWidth={containerSizeRef.current.width} />
                  <DraggableMarker x={positions.qr.x} y={positions.qr.y}
                    color="#3b82f6" isQR size={positions.qr.size ?? 12}
                    isActive={activeDrag === 'qr' || activeResize === 'qr'}
                    isSelected={selectedElement === 'qr'}
                    onMouseDown={(e) => startDrag(e, 'qr')} onResize={(e) => startResize(e, 'qr')}
                    pdfWidth={templateDimensions.width} containerWidth={containerSizeRef.current.width} />
                  {(positions.customElements || []).map(cel => (
                    <DraggableMarker key={cel.id}
                      x={cel.x} y={cel.y}
                      color={cel.color || "#6b7280"} label={cel.text}
                      fontSize={cel.size ?? 18} fontFamily={cel.font}
                      isActive={activeDrag === cel.id || activeResize === cel.id}
                      isSelected={selectedElement === cel.id}
                      onMouseDown={(e) => startDrag(e, cel.id)} onResize={(e) => startResize(e, cel.id)}
                      pdfWidth={templateDimensions.width} containerWidth={containerSizeRef.current.width} />
                  ))}
                </div>
                <p className="text-center text-[10px] text-gray-400 mt-2">Drag placeholders · ↘ handle to resize · Click to select · Arrow keys for precision</p>
              </div>
            </div>

            {/* Right panel — properties of selected element */}
            <div className="w-64 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto">
              {!selectedElement ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <span className="material-symbols-outlined text-5xl mb-3 text-gray-300">ads_click</span>
                  <p className="text-sm font-medium text-gray-500">Select an element</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">Click a placeholder on the canvas or choose from the Elements list on the left</p>
                </div>
              ) : (() => {
                const isFixed = selectedElement === 'name' || selectedElement === 'certId' || selectedElement === 'qr';
                const customEl = !isFixed ? (positions.customElements || []).find(el => el.id === selectedElement) : null;
                if (!isFixed && !customEl) return null;

                if (!isFixed && customEl) {
                  // ── Custom element properties ──
                  return (
                    <div className="p-4 space-y-5">
                      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                        <span className="material-symbols-outlined text-base text-purple-500">text_fields</span>
                        <p className="font-bold text-purple-900 text-sm truncate">{customEl.label}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Element Name</p>
                        <input type="text" value={customEl.label}
                          onChange={e => updateCustomElement(customEl.id, { label: e.target.value })}
                          placeholder="Label (editor only)"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-400" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bind to Column (optional)</p>
                        <input type="text" value={customEl.sourceField || ""}
                          onChange={e => updateCustomElement(customEl.id, { sourceField: e.target.value || undefined })}
                          placeholder="e.g. Designation"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-400 font-mono" />
                        <p className="text-[10px] text-gray-400">
                          Must exactly match a column header in the linked Sheet or import file. When set, this
                          prints that participant's value instead of the text below.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {customEl.sourceField ? "Preview Text (this field is bound)" : "Text on Certificate"}
                        </p>
                        <input type="text" value={customEl.text}
                          onChange={e => updateCustomElement(customEl.id, { text: e.target.value })}
                          placeholder="e.g. Issued: 2026-05-01"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-400" />
                        <p className="text-[10px] text-gray-400">
                          {customEl.sourceField
                            ? "Only used for the canvas preview here — real certificates print the column value."
                            : "This exact text will be printed on the certificate"}
                        </p>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Position</p>
                        <SliderField label="Horizontal (%)" min={0} max={100} step={0.5} value={customEl.x}
                          onChange={v => updateCustomElement(customEl.id, { x: v })} />
                        <SliderField label="Vertical (%)" min={0} max={100} step={0.5} value={customEl.y}
                          onChange={v => updateCustomElement(customEl.id, { y: v })} />
                        <div className="flex gap-2">
                          <button onClick={() => updateCustomElement(customEl.id, { x: 50 })}
                            className="flex-1 py-1.5 text-[11px] bg-purple-50 border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors font-medium">Center H</button>
                          <button onClick={() => updateCustomElement(customEl.id, { y: 50 })}
                            className="flex-1 py-1.5 text-[11px] bg-purple-50 border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors font-medium">Center V</button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Size</p>
                        <SliderField label="Font Size (pt)" min={6} max={72} step={1} value={customEl.size ?? 18}
                          onChange={v => updateCustomElement(customEl.id, { size: v })} />
                        <SliderField label="Letter Spacing (pt)" min={0} max={20} step={0.5} value={customEl.letterSpacing ?? 0}
                          onChange={v => updateCustomElement(customEl.id, { letterSpacing: v })} />
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Appearance</p>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1.5">Text Color</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={customEl.color || "#333333"}
                              onChange={e => updateCustomElement(customEl.id, { color: e.target.value })}
                              className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                            <span className="text-xs font-mono text-gray-500">{customEl.color || "#333333"}</span>
                          </div>
                        </div>
                        <FontSelect value={customEl.font || ""}
                          onChange={v => updateCustomElement(customEl.id, { font: v })} />
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <input type="checkbox" id={`bg-toggle-${customEl.id}`} checked={!!customEl.bg}
                              onChange={e => updateCustomElement(customEl.id, { bg: e.target.checked ? (customEl.bg || "#ffffff") : undefined })}
                              className="w-4 h-4 accent-purple-500" />
                            <label htmlFor={`bg-toggle-${customEl.id}`} className="text-xs text-gray-500 cursor-pointer">Background box</label>
                          </div>
                          {customEl.bg && (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <input type="color" value={customEl.bg}
                                  onChange={e => updateCustomElement(customEl.id, { bg: e.target.value })}
                                  className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                                <span className="text-xs font-mono text-gray-500">{customEl.bg}</span>
                              </div>
                              <SliderField label="Box Padding (pt)" min={0} max={30} step={1} value={customEl.bgPadding ?? 6}
                                onChange={v => updateCustomElement(customEl.id, { bgPadding: v })} />
                            </>
                          )}
                        </div>
                      </div>
                      <button onClick={() => deleteCustomElement(customEl.id)}
                        className="w-full py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg border border-red-200 transition-colors flex items-center justify-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">delete</span>Remove Element
                      </button>
                    </div>
                  );
                }

                const fixedKey = selectedElement as 'name' | 'certId' | 'qr';
                return (
                <div className="p-4 space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                    <span className="material-symbols-outlined text-base" style={{ color: fixedKey === 'qr' ? '#3b82f6' : fixedKey === 'name' ? (positions.name.color || '#1b4332') : (positions.certId.color || '#333333') }}>
                      {selectedElement === 'name' ? 'person' : selectedElement === 'certId' ? 'badge' : 'qr_code_2'}
                    </span>
                    <p className="font-bold text-brand-dark-green text-sm">
                      {selectedElement === 'name' ? 'Recipient Name' : selectedElement === 'certId' ? 'Certificate ID' : 'QR Code'}
                    </p>
                  </div>

                  {/* Preview Text — custom placeholder for live canvas */}
                  {selectedElement !== 'qr' && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Preview Text</p>
                      <input
                        type="text"
                        value={selectedElement === 'name' ? testData.name : testData.certId}
                        onChange={e => setTestData(prev => ({
                          ...prev,
                          [selectedElement === 'name' ? 'name' : 'certId']: e.target.value,
                        }))}
                        placeholder={selectedElement === 'name' ? "e.g. Ahmad Bilal Saeed" : "e.g. 2026-PZ-CRS-0001"}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-vivid-green"
                      />
                      <p className="text-[10px] text-gray-400">Updates marker on canvas in real time</p>
                    </div>
                  )}

                  {/* Position */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Position</p>
                    <SliderField label="Horizontal (%)" min={0} max={100} step={0.5}
                      value={positions[fixedKey].x}
                      onChange={v => updatePositions(prev => ({ ...prev, [fixedKey]: { ...prev[fixedKey], x: v } }))} />
                    <SliderField label="Vertical (%)" min={0} max={100} step={0.5}
                      value={positions[fixedKey].y}
                      onChange={v => updatePositions(prev => ({ ...prev, [fixedKey]: { ...prev[fixedKey], y: v } }))} />
                    <div className="flex gap-2">
                      <button onClick={() => updatePositions(prev => ({ ...prev, [fixedKey]: { ...prev[fixedKey], x: 50 } }))}
                        className="flex-1 py-1.5 text-[11px] bg-green-50 border border-green-200 rounded-lg text-brand-grass-green hover:bg-green-100 transition-colors font-medium">Center H</button>
                      <button onClick={() => updatePositions(prev => ({ ...prev, [fixedKey]: { ...prev[fixedKey], y: 50 } }))}
                        className="flex-1 py-1.5 text-[11px] bg-green-50 border border-green-200 rounded-lg text-brand-grass-green hover:bg-green-100 transition-colors font-medium">Center V</button>
                    </div>
                  </div>

                  {/* Size */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Size</p>
                    {selectedElement === 'qr' ? (
                      <SliderField label="Size (%)" min={1} max={25} step={0.5}
                        value={positions.qr.size ?? 12}
                        onChange={v => updatePositions(prev => ({ ...prev, qr: { ...prev.qr, size: v } }))} />
                    ) : selectedElement === 'name' ? (
                      <>
                        <SliderField label="Font Size (pt)" min={8} max={80} step={1}
                          value={positions.name.size ?? 48}
                          onChange={v => updatePositions(prev => ({ ...prev, name: { ...prev.name, size: v } }))} />
                        <SliderField label="Letter Spacing (pt)" min={0} max={20} step={0.5}
                          value={positions.name.letterSpacing ?? 0}
                          onChange={v => updatePositions(prev => ({ ...prev, name: { ...prev.name, letterSpacing: v } }))} />
                      </>
                    ) : (
                      <>
                        <SliderField label="Font Size (pt)" min={6} max={24} step={0.5}
                          value={positions.certId.size ?? 12}
                          onChange={v => updatePositions(prev => ({ ...prev, certId: { ...prev.certId, size: v } }))} />
                        <SliderField label="Letter Spacing (pt)" min={0} max={20} step={0.5}
                          value={positions.certId.letterSpacing ?? 0}
                          onChange={v => updatePositions(prev => ({ ...prev, certId: { ...prev.certId, letterSpacing: v } }))} />
                      </>
                    )}
                  </div>

                  {/* Appearance */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Appearance</p>
                    {selectedElement === 'qr' ? (
                      <>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1.5">Dot Color</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={positions.qr.darkColor || "#000000"}
                              onChange={e => updatePositions(prev => ({ ...prev, qr: { ...prev.qr, darkColor: e.target.value } }))}
                              className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                            <span className="text-xs font-mono text-gray-500">{positions.qr.darkColor || "#000000"}</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <input type="checkbox" id="qr-transparent-rp" checked={positions.qr.transparentBg ?? false}
                              onChange={e => updatePositions(prev => ({ ...prev, qr: { ...prev.qr, transparentBg: e.target.checked } }))}
                              className="w-4 h-4 accent-brand-vivid-green" />
                            <label htmlFor="qr-transparent-rp" className="text-xs text-gray-500 cursor-pointer">Transparent background</label>
                          </div>
                          {!positions.qr.transparentBg && (
                            <div className="flex items-center gap-2">
                              <input type="color" value={positions.qr.lightColor || "#ffffff"}
                                onChange={e => updatePositions(prev => ({ ...prev, qr: { ...prev.qr, lightColor: e.target.value } }))}
                                className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                              <span className="text-xs font-mono text-gray-500">{positions.qr.lightColor || "#ffffff"}</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1.5">Text Color</label>
                          <div className="flex items-center gap-2">
                            <input type="color"
                              value={selectedElement === 'name' ? (positions.name.color || "#1b4332") : (positions.certId.color || "#333333")}
                              onChange={e => updatePositions(prev => ({ ...prev, [fixedKey]: { ...prev[fixedKey], color: e.target.value } }))}
                              className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                            <span className="text-xs font-mono text-gray-500">
                              {fixedKey === 'name' ? (positions.name.color || "#1b4332") : (positions.certId.color || "#333333")}
                            </span>
                          </div>
                        </div>
                        <FontSelect
                          value={fixedKey === 'name' ? (positions.name.font || "") : (positions.certId.font || "")}
                          onChange={v => updatePositions(prev => ({ ...prev, [fixedKey]: { ...prev[fixedKey], font: v } }))} />
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <input type="checkbox" id={`bg-toggle-${fixedKey}`} checked={!!positions[fixedKey].bg}
                              onChange={e => updatePositions(prev => ({ ...prev, [fixedKey]: { ...prev[fixedKey], bg: e.target.checked ? (prev[fixedKey].bg || "#ffffff") : undefined } }))}
                              className="w-4 h-4 accent-brand-vivid-green" />
                            <label htmlFor={`bg-toggle-${fixedKey}`} className="text-xs text-gray-500 cursor-pointer">Background box</label>
                          </div>
                          {positions[fixedKey].bg && (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <input type="color" value={positions[fixedKey].bg}
                                  onChange={e => updatePositions(prev => ({ ...prev, [fixedKey]: { ...prev[fixedKey], bg: e.target.value } }))}
                                  className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                                <span className="text-xs font-mono text-gray-500">{positions[fixedKey].bg}</span>
                              </div>
                              <SliderField label="Box Padding (pt)" min={0} max={30} step={1} value={positions[fixedKey].bgPadding ?? 6}
                                onChange={v => updatePositions(prev => ({ ...prev, [fixedKey]: { ...prev[fixedKey], bgPadding: v } }))} />
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                );
              })()}
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

// ── FontSelect: font family dropdown with live preview ───────────────────────
function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-on-surface-variant block mb-1">Font</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white border border-green-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-vivid-green cursor-pointer"
      >
        {AVAILABLE_FONTS.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      {value && (
        <p className="mt-1 text-[11px] text-on-surface-variant truncate" style={{ fontFamily: value }}>
          Preview: {value}
        </p>
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
  x, y, color, label, isActive, isSelected, onMouseDown, onResize, isQR, size, fontSize,
  fontFamily, pdfWidth, containerWidth,
}: {
  x: number; y: number; color: string; label?: string; isActive: boolean; isSelected?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResize?: (e: React.MouseEvent) => void;
  isQR?: boolean; size?: number; fontSize?: number; fontFamily?: string;
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
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${isActive ? 'z-50' : isSelected ? 'z-30' : 'z-10'}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onMouseDown={onMouseDown}
    >
      {isQR ? (
        <div className="relative" style={{ width: qrPx, height: qrPx }}>
          <div
            className="w-full h-full rounded-lg flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: '#3b82f6',
              border: isActive ? '2px solid #22c55e' : isSelected ? '2.5px solid #22c55e' : '2px solid white',
              opacity: isActive || isSelected ? 1 : 0.85,
              boxShadow: isSelected && !isActive ? '0 0 0 3px rgba(34,197,94,0.25)' : undefined,
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
              fontFamily: fontFamily || "inherit",
              backgroundColor: markerColor,
              color: textColor,
              border: isActive ? '2px solid #22c55e' : isSelected ? '2.5px solid #22c55e' : '2px solid rgba(255,255,255,0.8)',
              opacity: isActive || isSelected ? 1 : 0.85,
              boxShadow: isSelected && !isActive ? '0 0 0 3px rgba(34,197,94,0.25)' : undefined,
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
