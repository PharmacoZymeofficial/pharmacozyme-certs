export interface Database {
  id?: string;
  name: string;
  category: "General" | "Official";
  subCategory: string;
  topic: string;
  description?: string;
  participantCount?: number;
  certificateCount?: number;
  isLive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  linkedSheet?: boolean;
  sheetId?: string;
  sheetTabName?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
}

export interface Participant {
  id?: string;
  databaseId: string;
  name: string;
  email: string;
  certificateId?: string;
  certificateUrl?: string;
  driveLink?: string;
  driveFileId?: string;
  status?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  emailError?: string;
  createdAt?: string;
  // Arbitrary extra Sheet/CSV columns (e.g. Designation, Start Date, Department),
  // keyed by the original column header. Bound to template custom-text elements
  // via CustomElement.sourceField so certificates can print per-participant values
  // beyond name/certId.
  customFields?: Record<string, string>;
}

export interface Certificate {
  id?: string;
  databaseId: string;
  participantId: string;
  uniqueCertId: string;
  recipientName: string;
  recipientEmail: string;
  category: string;
  subCategory: string;
  topic: string;
  certType: string;
  issueDate: string;
  expiryDate?: string;
  status: "pending" | "generated" | "sent" | "revoked";
  qrCode?: string;
  pdfUrl?: string;
  driveLink?: string;
  verificationUrl?: string;
  blockchainHash?: string;
  createdAt?: string;
}

export interface SubCategory {
  id: string;
  name: string;
  topics?: Topic[];
}

export interface Topic {
  id: string;
  name: string;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  subCategories: (string | SubCategory)[];
  isActive: boolean;
  order: number;
}

export interface GenerationJob {
  databaseId: string;
  total: number;
  completedParticipantIds: string[];
  phase: "rendering" | "drive-upload" | "sheet-sync";
  /** Template the run started with — a resumed run is locked to it. */
  templateId?: string;
  startedAt: string;
  updatedAt: string;
  startedBy: string;
}
