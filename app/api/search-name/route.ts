import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";
import { rateLimit } from "@/lib/rateLimit";

//  is a high Unicode sentinel used to match all strings with a given prefix in Firestore range queries
const RANGE_SENTINEL = "";

function nameVariants(name: string): string[] {
  const title = name.replace(/\b\w/g, (c) => c.toUpperCase());
  return [...new Set([name, name.toLowerCase(), name.toUpperCase(), title])];
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { ok, retryAfter } = rateLimit(ip);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before searching again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "").trim();
  const databaseId = (searchParams.get("databaseId") || "").trim();
  const subCategory = (searchParams.get("subCategory") || "").trim();

  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "Name must be at least 2 characters" },
      { status: 400 }
    );
  }

  const results: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  // ── Search 1: certificates collection by recipientName prefix ──────────────
  if (!databaseId) {
    try {
      const certRef = collection(db, "certificates");
      for (const variant of nameVariants(name)) {
        if (results.length >= 20) break;
        let q = query(
          certRef,
          where("recipientName", ">=", variant),
          where("recipientName", "<=", variant + RANGE_SENTINEL),
          limit(15)
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          if (subCategory && data.subCategory !== subCategory) continue;
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
  }

  // ── Search 2: participants subcollections ──────────────────────────────────
  if (results.length < 20) {
    try {
      // If databaseId provided, scope to that one DB; otherwise scan all live DBs
      let dbDocs: { id: string; data: () => Record<string, unknown> }[];
      if (databaseId) {
        const dbSnap = await getDoc(doc(db, "databases", databaseId));
        if (!dbSnap.exists()) {
          return NextResponse.json({ results: [] });
        }
        dbDocs = [{ id: dbSnap.id, data: () => dbSnap.data() as Record<string, unknown> }];
      } else {
        const snap = await getDocs(collection(db, "databases"));
        dbDocs = snap.docs.map((d) => ({ id: d.id, data: () => d.data() as Record<string, unknown> }));
      }

      for (const dbDoc of dbDocs) {
        if (results.length >= 20) break;
        const dbData = dbDoc.data();
        if (subCategory && dbData.subCategory !== subCategory) continue;

        const participantsRef = collection(db, "databases", dbDoc.id, "participants");
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
