const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH = 1000;
const TARGET_BYTES = 400 * 1024;
const INITIAL_QUALITY = 0.8;
const MIN_QUALITY = 0.55;
const MAX_IMAGE_PIXELS = 40_000_000;

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

async function detectImageMimeType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return "image/png";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

export async function compressImage(
  file: File,
  options?: { maxWidth?: number; targetBytes?: number; outputName?: string },
) {
  const detectedMimeType = await detectImageMimeType(file);
  if (!detectedMimeType) {
    throw new Error("無法辨識圖片格式，請改用 JPG、PNG 或 WebP");
  }
  if (file.type && file.type !== detectedMimeType) {
    throw new Error("圖片內容與檔案格式不一致，請重新匯出圖片後再試");
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("原始圖片大小不能超過 5MB");

  const image = await loadImage(file);
  if (image.width < 1 || image.height < 1) throw new Error("無法讀取圖片");
  if (image.width * image.height > MAX_IMAGE_PIXELS) {
    throw new Error("圖片像素過大，請先縮小到 4,000 萬像素以下");
  }
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

  let outputType = "image/webp";
  let quality = INITIAL_QUALITY;
  let blob: Blob;
  try {
    blob = await canvasToBlob(canvas, outputType, quality);
  } catch {
    outputType = "image/jpeg";
    blob = await canvasToBlob(canvas, outputType, quality);
  }
  while (blob.size > targetBytes && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.08);
    blob = await canvasToBlob(canvas, outputType, quality);
  }

  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("圖片大小不能超過 5MB");
  }

  const baseName = options?.outputName || file.name.replace(/\.[^.]+$/, "") || "image";
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${baseName}.${extension}`, { type: blob.type });
}

export function compressBookImage(file: File) {
  return compressImage(file, { maxWidth: MAX_WIDTH, targetBytes: TARGET_BYTES, outputName: "book-cover" });
}

export function compressBookOcrImage(file: File) {
  return compressImage(file, { maxWidth: 1400, targetBytes: 1_200 * 1024, outputName: "book-ocr" });
}

export function extractStoragePath(publicUrl: string, bucket = "book-images") {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

export const BOOK_IMAGE_CACHE_CONTROL = "31536000";
