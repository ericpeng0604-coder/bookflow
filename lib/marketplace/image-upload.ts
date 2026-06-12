const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.82;

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

export async function compressBookImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("圖片僅支援 JPG、PNG 或 WebP");
  }

  if (file.size <= MAX_UPLOAD_BYTES && file.type === "image/jpeg") {
    return file;
  }

  const image = await loadImage(file);
  const scale = image.width > MAX_WIDTH ? MAX_WIDTH / image.width : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("無法處理圖片");
  context.drawImage(image, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/webp" : file.type;
  let blob = await canvasToBlob(canvas, outputType, JPEG_QUALITY);

  if (blob.size > MAX_UPLOAD_BYTES && outputType !== "image/jpeg") {
    blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  }

  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("圖片大小不能超過 5MB");
  }

  const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "book-cover";
  return new File([blob], `${baseName}.${extension}`, { type: blob.type });
}

export function extractStoragePath(publicUrl: string, bucket = "book-images") {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

export const BOOK_IMAGE_CACHE_CONTROL = "86400";
