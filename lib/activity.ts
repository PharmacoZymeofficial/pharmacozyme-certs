import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

export function getAdminFromCookieHeader(cookieHeader: string): { adminName: string; adminEmail: string } {
  let adminName = "Administrator";
  let adminEmail = "admin@pharmacozyme.com";
  try {
    const match = cookieHeader.match(/pz_admin_auth=([^;]+)/);
    if (match) {
      const decoded = Buffer.from(decodeURIComponent(match[1]), "base64").toString("utf-8");
      const user = JSON.parse(decoded);
      if (user.displayName) adminName = user.displayName;
      if (user.email) adminEmail = user.email;
    }
  } catch { /* use defaults */ }
  return { adminName, adminEmail };
}

export async function logActivity(params: {
  type: "cert_generated" | "email_sent" | "email_scheduled";
  adminName: string;
  adminEmail: string;
  databaseId?: string;
  databaseName?: string;
  count: number;
  details: string;
}) {
  try {
    await addDoc(collection(db, "activity_logs"), {
      ...params,
      timestamp: new Date().toISOString(),
    });
  } catch { /* non-fatal — never block the primary action */ }
}
