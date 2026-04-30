import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  try {
    const snap = await getDocs(collection(db, "databases"));
    const live = snap.docs
      .filter((d) => d.data().isLive === true)
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
