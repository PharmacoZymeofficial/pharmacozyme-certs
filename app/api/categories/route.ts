import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const snap = await getAdminDb().collection("categories").orderBy("order", "asc").get();
    const categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const newCategory = {
      ...body,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const docRef = await getAdminDb().collection("categories").add(newCategory);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      category: { id: docRef.id, ...newCategory },
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
