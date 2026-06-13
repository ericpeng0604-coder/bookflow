const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH = 1200;
const TARGET_BYTES = 700 * 1024;
const INITIAL_QUALITY = 0.8;
const MIN_QUALITY = 0.55;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("無法讀取圖片"));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("圖片壓縮失敗"))),
      type,
      quality,
    );
  });
}

export async function compressImage(
  file: File,
  options?: { maxWidth?: number; targetBytes?: number; outputName?: string },
) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("圖片僅支援 JPG、PNG 或 WebP");
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("原始圖片大小不能超過 5MB");

  const image = await loadImage(file);
  const maxWidth = options?.maxWidth ?? MAX_WIDTH;
  const targetBytes = options?.targetBytes ?? TARGET_BYTES;
  const scale = image.width > maxWidth ? maxWidth / image.width : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("無法處理圖片");
  context.drawImage(image, 0, 0, width, height);

  const outputType = "image/webp";
  let quality = INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, outputType, quality);
  while (blob.size > targetBytes && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.08);
    blob = await canvasToBlob(canvas, outputType, quality);
  }

  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("圖片大小不能超過 5MB");
  }

  const baseName = options?.outputName || file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.webp`, { type: blob.type });
}

export function compressBookImage(file: File) {
  return compressImage(file, { maxWidth: MAX_WIDTH, targetBytes: TARGET_BYTES, outputName: "book-cover" });
}

export function extractStoragePath(publicUrl: string, bucket = "book-images") {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

export const BOOK_IMAGE_CACHE_CONTROL = "31536000";
