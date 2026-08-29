import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { parseCategoryParam } from "@/lib/category";

// Public by design: powers the course cards on the verify page. Returns only a
// hand-picked subset of fields, and only for databases explicitly marked isLive.
export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const category = parseCategoryParam(new URL(request.url).searchParams.get("category"));
    let query = adminDb.collection("databases").where("isLive", "==", true);
    if (category) query = query.where("category", "==", category);
    const snap = await query.get();

    const live = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        let participantCount = 0;
        try {
          // Stored data.participantCount drifts; count the subcollection live.
          const countSnap = await adminDb
            .collection("databases")
            .doc(d.id)
            .collection("participants")
            .count()
            .get();
          participantCount = countSnap.data().count || 0;
        } catch {
          participantCount = 0; // per-DB failure must not fail the whole response
        }
        return {
          id: d.id,
          name: (data.name as string) || "",
          category: (data.category as string) || "",
          subCategory: (data.subCategory as string) || "",
          topic: (data.topic as string) || "",
          description: (data.description as string) || "",
          participantCount,
          createdAt: (data.createdAt as string) || "",
        };
      })
    );

    live.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ databases: live });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to fetch", details: msg }, { status: 500 });
  }
}
