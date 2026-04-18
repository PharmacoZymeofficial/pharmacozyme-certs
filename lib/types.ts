export interface Database {
  id?: string;
  name: string;
  category: "General" | "Official";
  subCategory: string;
  topic: string;
  description?: string;
  participantCount?: number;
  certificateCount?: number;
  createdAt?: string;
  updatedAt?: string;
  linkedSheet?: boolean;
  sheetId?: string;
  sheetTabName?: string;
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
  createdAt?: string;
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
