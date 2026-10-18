/*
 * Fotos: se procesan en el móvil antes de subirlas. Al volver a dibujarlas en un canvas y
 * comprimirlas, se pierden TODOS los metadatos EXIF (incluida la ubicación GPS).
 */

export const MAX_SIDE = 1600;
/** Original de hasta 20 MB (fotos de iPhone o Android); tras comprimir ocupan ~200–400 KB. */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif)$/;

export class ImageError extends Error {}

export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Comprueba tipo y tamaño antes de procesar (mensajes claros). */
export function validateImageFile(file: { type: string; size: number }): void {
  if (!ACCEPTED.test(file.type)) throw new ImageError("Elige una foto (JPG, PNG o HEIC).");
  if (file.size > MAX_SOURCE_BYTES)
    throw new ImageError("La foto es demasiado grande (máx. 20 MB).");
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Redimensiona, respeta la orientación, quita EXIF/GPS y comprime (WebP o, si no, JPEG). */
export async function processImage(file: File, maxSide = MAX_SIDE): Promise<Blob> {
  validateImageFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("No se pudo leer la foto. Prueba con otra.");
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("No se pudo procesar la foto.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    let blob = await encode(canvas, "image/webp", 0.8);
    if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", 0.8);
    if (!blob) throw new ImageError("No se pudo comprimir la foto.");
    return blob;
  } finally {
    bitmap.close();
  }
}
