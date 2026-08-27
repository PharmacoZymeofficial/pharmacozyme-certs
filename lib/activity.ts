import { getAdminDb } from "@/lib/firebase.admin";

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
    await getAdminDb()
      .collection("activity_logs")
      .add({ ...params, timestamp: new Date().toISOString() });
  } catch { /* non-fatal — never block the primary action */ }
}
