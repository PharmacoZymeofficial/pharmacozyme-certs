// lib/coverImage.client.ts
// Browser-only: uses <canvas> and Image. Do not import from server code.
import { centerCrop16x9, COVER_W, COVER_H } from "@/lib/coverImage";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export async function cropToCoverBlob(file: File): Promise<Blob> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Image must be under 10 MB");
  }

  const bitmap = await loadImage(file);
  const { sx, sy, sw, sh } = centerCrop16x9(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a canvas context");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, COVER_W, COVER_H);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))),
      "image/webp",
      0.82
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}
