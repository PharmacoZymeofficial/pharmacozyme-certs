import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { parseCategoryParam } from "@/lib/category";

// Public by design: powers the course cards on the verify page. Returns only a
// hand-picked subset of fields, and only for databases explicitly marked isLive.
export async function GET(request: NextRequest) {
  try {
    const category = parseCategoryParam(new URL(request.url).searchParams.get("category"));
    let query = getAdminDb().collection("databases").where("isLive", "==", true);
    if (category) query = query.where("category", "==", category);
    const snap = await query.get();
    const live = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: (data.name as string) || "",
          category: (data.category as string) || "",
          subCategory: (data.subCategory as string) || "",
          topic: (data.topic as string) || "",
          description: (data.description as string) || "",
          participantCount: (data.participantCount as number) || 0,
          createdAt: (data.createdAt as string) || "",
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return NextResponse.json({ databases: live });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to fetch", details: msg }, { status: 500 });
  }
}
