import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

//  is a high Unicode sentinel used to match all strings with a given prefix in Firestore range queries
const RANGE_SENTINEL = "";

function nameVariants(name: string): string[] {
  const title = name.replace(/\b\w/g, (c) => c.toUpperCase());
  return [...new Set([name, name.toLowerCase(), name.toUpperCase(), title])];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "").trim();

  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "Name must be at least 2 characters" },
      { status: 400 }
    );
  }

  const results: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  // Search 1: certificates collection by recipientName prefix
  try {
    const certRef = collection(db, "certificates");
    for (const variant of nameVariants(name)) {
      if (results.length >= 20) break;
      const q = query(
        certRef,
        where("recipientName", ">=", variant),
        where("recipientName", "<=", variant + RANGE_SENTINEL),
        limit(15)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const key = (data.uniqueCertId as string) || d.id;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: d.id,
            uniqueCertId: data.uniqueCertId || "",
            recipientName: data.recipientName || "",
            category: data.category || "",
            subCategory: data.subCategory || "",
            topic: data.topic || "",
            certType: data.certType || "",
            issueDate: (data.issueDate || data.createdAt || "") as string,
            status: data.status || "generated",
            driveLink: data.driveLink || "",
          });
        }
        if (results.length >= 20) break;
      }
    }
  } catch { /* non-fatal */ }

  // Search 2: participants subcollections across all databases
  if (results.length < 20) {
    try {
      const dbsSnap = await getDocs(collection(db, "databases"));
      for (const dbDoc of dbsSnap.docs) {
        if (results.length >= 20) break;
        const dbData = dbDoc.data() as Record<string, unknown>;
        const participantsRef = collection(
          db, "databases", dbDoc.id, "participants"
        );
        for (const variant of nameVariants(name)) {
          if (results.length >= 20) break;
          const q = query(
            participantsRef,
            where("name", ">=", variant),
            where("name", "<=", variant + RANGE_SENTINEL),
            limit(10)
          );
          const snap = await getDocs(q);
          for (const p of snap.docs) {
            const pData = p.data() as Record<string, unknown>;
            const certId = (pData.certificateId as string) || p.id;
            if (!seen.has(certId)) {
              seen.add(certId);
              results.push({
                id: p.id,
                uniqueCertId: certId,
                recipientName: (pData.name as string) || "",
                category: (dbData.category as string) || "",
                subCategory: (dbData.subCategory as string) || "",
                topic: (dbData.topic as string) || "",
                certType:
                  (dbData.topic as string) ||
                  (dbData.subCategory as string) ||
                  "",
                issueDate: ((pData.issueDate || pData.createdAt || "") as string),
                status: (pData.status as string) || "generated",
                driveLink: (pData.driveLink as string) || "",
              });
            }
            if (results.length >= 20) break;
          }
        }
      }
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ results: results.slice(0, 20) });
}
