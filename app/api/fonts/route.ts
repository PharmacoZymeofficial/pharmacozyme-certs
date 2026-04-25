import { NextRequest, NextResponse } from "next/server";
import { loadFontBytes } from "@/lib/fonts";

export async function GET(request: NextRequest) {
  const fontName = request.nextUrl.searchParams.get("name");
  if (!fontName) return NextResponse.json({ error: "name required" }, { status: 400 });

  const bytes = await loadFontBytes(fontName);
  if (!bytes) return NextResponse.json({ error: "Font not found or not in TTF format" }, { status: 404 });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "font/ttf",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
