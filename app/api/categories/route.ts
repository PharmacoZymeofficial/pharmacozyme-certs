import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";

export async function GET() {
  try {
    const categoriesRef = collection(db, "categories");
    const q = query(categoriesRef, orderBy("order", "asc"));
    const querySnapshot = await getDocs(q);

    const categories = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const categoriesRef = collection(db, "categories");

    const newCategory = {
      ...body,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(categoriesRef, newCategory);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      category: { id: docRef.id, ...newCategory },
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
