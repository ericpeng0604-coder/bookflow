import {
  extractTaiwanTextbookMetadata,
  normalizeIsbn13,
} from "./taiwan-textbook.ts";
import { findStudentIdCandidates } from "./student-id.ts";

type OcrProgress = {
  status?: string;
  progress?: number;
};

type OcrWorkerLike = {
  recognize: (
    image: File | Blob | HTMLCanvasElement | string,
  ) => Promise<{ data?: { text?: string; confidence?: number } }>;
  setParameters: (parameters: Record<string, string>) => Promise<unknown>;
};

type TesseractLike = {
  createWorker: (
    languages: string,
    oem?: number,
    options?: { logger?: (message: OcrProgress) => void },
  ) => Promise<OcrWorkerLike>;
};

export const BOOK_OCR_MAX_SIDE = 1400;
export const STUDENT_OCR_MAX_SIDE = 1800;

let tesseractLoadPromise: Promise<TesseractLike> | null = null;
let englishWorkerPromise: Promise<OcrWorkerLike> | null = null;
let combinedWorkerPromise: Promise<OcrWorkerLike> | null = null;
let studentNumericWorkerPromise: Promise<OcrWorkerLike> | null = null;
let activeProgress: ((message: OcrProgress) => void) | null = null;

async function loadTesseract() {
  if (typeof window === "undefined") throw new Error("OCR 只能在瀏覽器中執行");
  tesseractLoadPromise ??= import("tesseract.js")
    .then((module) => ({
      createWorker: module.createWorker as unknown as TesseractLike["createWorker"],
    }))
    .catch(() => {
      tesseractLoadPromise = null;
      throw new Error("本機 OCR 載入失敗，將改用 AI 補強或手動填寫");
    });
  return tesseractLoadPromise;
}

function getWorker(languages: "eng" | "eng+chi_tra") {
  const current = languages === "eng" ? englishWorkerPromise : combinedWorkerPromise;
  if (current) return current;

  const workerPromise = loadTesseract()
    .then(async (tesseract) => {
      const worker = await tesseract.createWorker(languages, undefined, {
        logger: (message) => activeProgress?.(message),
      });
      await worker.setParameters({
        tessedit_pageseg_mode: "11",
        preserve_interword_spaces: "1",
      });
      return worker;
    })
    .catch((error) => {
      if (languages === "eng") englishWorkerPromise = null;
      else combinedWorkerPromise = null;
      throw error;
    });

  if (languages === "eng") englishWorkerPromise = workerPromise;
  else combinedWorkerPromise = workerPromise;
  return workerPromise;
}

function getStudentNumericWorker() {
  if (studentNumericWorkerPromise) return studentNumericWorkerPromise;

  const workerPromise = loadTesseract()
    .then(async (tesseract) => {
      const worker = await tesseract.createWorker("eng", undefined, {
        logger: (message) => activeProgress?.(message),
      });
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: "11",
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      return worker;
    })
    .catch((error) => {
      studentNumericWorkerPromise = null;
      throw error;
    });

  studentNumericWorkerPromise = workerPromise;
  return workerPromise;
}

export function warmBookOcr() {
  if (typeof window === "undefined") return;
  void getWorker("eng").catch(() => undefined);
}

function loadOcrImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("無法讀取封面圖片，請重新選擇照片"));
    };
    image.src = objectUrl;
  });
}

async function prepareBookCoverForOcr(file: File) {
  const image = await loadOcrImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, BOOK_OCR_MAX_SIDE / Math.max(longestSide, 1));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("瀏覽器無法準備 OCR 圖片");
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const gray = red * 0.299 + green * 0.587 + blue * 0.114;
    const enhanced = Math.max(0, Math.min(255, (gray - 128) * 1.22 + 138));
    pixels.data[index] = enhanced;
    pixels.data[index + 1] = enhanced;
    pixels.data[index + 2] = enhanced;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

type StudentOcrRotation = 0 | 90 | 180 | 270;

async function prepareStudentCardForOcr(file: File, rotation: StudentOcrRotation) {
  const image = await loadOcrImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, STUDENT_OCR_MAX_SIDE / Math.max(longestSide, 1));
  const sourceWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const sourceHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = rotation === 90 || rotation === 270 ? sourceHeight : sourceWidth;
  canvas.height = rotation === 90 || rotation === 270 ? sourceWidth : sourceHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("瀏覽器無法準備學生證 OCR 圖片");

  context.save();
  if (rotation === 90) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  } else if (rotation === 270) {
    context.translate(0, canvas.height);
    context.rotate(-Math.PI / 2);
  }
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  context.restore();

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const gray = red * 0.299 + green * 0.587 + blue * 0.114;
    const enhanced = Math.max(0, Math.min(255, (gray - 112) * 1.45 + 128));
    pixels.data[index] = enhanced;
    pixels.data[index + 1] = enhanced;
    pixels.data[index + 2] = enhanced;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

async function recognizeWithWorker(
  worker: OcrWorkerLike,
  image: HTMLCanvasElement,
  onProgress?: (progress: number) => void,
) {
  activeProgress = (message) => {
    if (message.status === "recognizing text" && typeof message.progress === "number") {
      onProgress?.(message.progress);
    }
  };
  try {
    const result = await worker.recognize(image);
    return {
      text: String(result.data?.text || "").replace(/\s+\n/g, "\n").trim(),
      confidence: Number(result.data?.confidence || 0),
    };
  } finally {
    activeProgress = null;
  }
}

export async function recognizeImageText(file: File) {
  const worker = await getWorker("eng+chi_tra");
  const result = await worker.recognize(file);
  return String(result.data?.text || "").replace(/\s+\n/g, "\n").trim();
}

export type StudentCardOcrResult = {
  text: string;
  confidence: number;
  rotation: StudentOcrRotation;
};

/**
 * Student cards are commonly photographed sideways or upside down. Run a
 * small numeric-only pass in all four orientations first, then use the best
 * orientation for the readable bilingual OCR text shown to moderators.
 */
export async function recognizeStudentCardText(file: File): Promise<StudentCardOcrResult> {
  const numericWorker = await getStudentNumericWorker();
  const rotations: StudentOcrRotation[] = [0, 90, 180, 270];
  const attempts: Array<{
    canvas: HTMLCanvasElement;
    text: string;
    confidence: number;
    rotation: StudentOcrRotation;
    candidateCount: number;
  }> = [];

  for (const rotation of rotations) {
    const canvas = await prepareStudentCardForOcr(file, rotation);
    const result = await recognizeWithWorker(numericWorker, canvas);
    const attempt = {
      canvas,
      text: result.text,
      confidence: result.confidence,
      rotation,
      candidateCount: findStudentIdCandidates(result.text).length,
    };
    attempts.push(attempt);
    if (attempt.candidateCount > 0) break;
  }

  const bestAttempt = [...attempts].sort((left, right) =>
    (right.candidateCount - left.candidateCount) * 1000
      + right.confidence - left.confidence,
  )[0];
  if (!bestAttempt) throw new Error("學生證 OCR 沒有可用結果");

  let readableText = bestAttempt.text;
  try {
    const bilingualWorker = await getWorker("eng+chi_tra");
    const bilingual = await Promise.race([
      recognizeWithWorker(bilingualWorker, bestAttempt.canvas),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("bilingual OCR timeout")), 7000)),
    ]);
    readableText = [bestAttempt.text, bilingual.text].filter(Boolean).join("\n");
  } catch {
    // The numeric pass is sufficient for submission when bilingual OCR is slow.
  }

  return {
    text: readableText,
    confidence: bestAttempt.confidence,
    rotation: bestAttempt.rotation,
  };
}

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmap) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export async function detectIsbnBarcode(file: File) {
  if (typeof window === "undefined") return undefined;
  const Detector = (window as typeof window & {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }).BarcodeDetector;
  if (!Detector || typeof createImageBitmap !== "function") return undefined;
  const bitmap = await createImageBitmap(file);
  try {
    const detector = new Detector({ formats: ["ean_13"] });
    const results = await detector.detect(bitmap);
    return results
      .map((result) => normalizeIsbn13(result.rawValue || ""))
      .find(Boolean);
  } catch {
    return undefined;
  } finally {
    bitmap.close();
  }
}

export type BookOcrDraft = {
  title?: string;
  author?: string;
  edition?: string;
  publisher?: string;
  educationLevel?: string;
  grade?: string;
  semester?: string;
  subject?: string;
  volume?: string;
  curriculum?: string;
  bookType?: string;
  isbn13?: string;
  approvalNumber?: string;
};

type KnownBookCoverHint = {
  patterns: RegExp[];
  fuzzyPhrases?: string[][];
  minimumMatches?: number;
  draft: BookOcrDraft;
};

const KNOWN_BOOK_COVER_HINTS: KnownBookCoverHint[] = [
  {
    patterns: [/普通\s*物理\s*學/i, /Richard\s+Wolfson/i],
    fuzzyPhrases: [["essential", "university", "physics"]],
    minimumMatches: 1,
    draft: {
      title: "普通物理學",
      author: "Richard Wolfson",
      edition: "Essential University Physics, 4e",
      publisher: "Pearson、高立圖書",
    },
  },
  {
    patterns: [/Live\s*Escalate/i, /Trekking|LiveABC|CEFR/i],
    draft: {
      title: "Live Escalate Trekking",
      edition: "Student's Book 3 / CEFR B1",
      publisher: "LiveABC",
    },
  },
  {
    patterns: [/基本\s*電\s*學/i, /第\s*5\s*版|精華版|賴柏洲/i],
    draft: {
      title: "基本電學",
      author: "賴柏洲",
      edition: "精華版 第5版",
      publisher: "全華",
    },
  },
  {
    patterns: [/電工\s*實習/i, /交直流\s*電路|鄧榮斌/i],
    draft: {
      title: "電工實習：交直流電路",
      author: "鄧榮斌",
      publisher: "全華",
    },
  },
  {
    patterns: [/機械\s*製造|Manufacturing\s+Engineering/i, /Kalpakjian|Schmid/i],
    draft: {
      title: "機械製造概論",
      author: "Serope Kalpakjian、Steven R. Schmid",
      edition: "SI制 / 7e",
      publisher: "Pearson、高立圖書",
    },
  },
  {
    patterns: [/國文\s*新\s*視野|Chinese\s+New\s+Vision/i, /五南/i],
    draft: {
      title: "國文新視野",
      author: "王妙純、周玉珠、莊美淑、王文仁、烏寧萍",
      publisher: "五南出版",
    },
  },
  {
    patterns: [/電腦\s*輔助\s*繪圖|AutoCAD\s*2020/i, /王雪娥|陳進煌|全華/i],
    draft: {
      title: "電腦輔助繪圖 AutoCAD 2020",
      author: "王雪娥、陳進煌",
      publisher: "全華",
    },
  },
];

const COVER_NOISE = [
  /ISBN/i,
  /定價|售價|price/i,
  /barcode|條碼/i,
  /copyright|版權/i,
  /目錄|contents/i,
  /推薦|暢銷|考試|用書|教材/i,
  /作者|著|編著|主編|譯者|總校閱|校閱|Author|Edited by|Written by/i,
  /www\.|http/i,
  /^\d+$/,
];

function cleanOcrLine(line: string) {
  return line
    .replace(/[|｜＿_~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasUsefulText(line: string) {
  return /[\p{Script=Han}A-Za-z]/u.test(line) && !COVER_NOISE.some((pattern) => pattern.test(line));
}

function cleanTitleCandidate(line: string) {
  const mostlyHan = (line.match(/\p{Script=Han}/gu)?.length ?? 0) >= 2;
  if (!mostlyHan) return line;
  return line
    .replace(/\s+/g, "")
    .replace(/[^\p{Script=Han}A-Za-z0-9：:（）()]+/gu, "")
    .replace(/\d+$/g, "");
}

function cleanAuthorCandidate(line: string) {
  return line
    .replace(/^(作者|Author|Edited by|Written by)[:：]?\s*/i, "")
    .replace(/\s*(著|編著|主編|編|譯者|譯)$/, "")
    .replace(/\s*[+＋]\s*/g, "、")
    .trim();
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function fuzzyWordMatches(actual: string, expected: string) {
  const distance = levenshteinDistance(actual, expected);
  return distance <= Math.max(1, Math.floor(expected.length * 0.45));
}

function fuzzyPhraseMatches(rawText: string, expectedWords: string[]) {
  const actualWords = rawText.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  let cursor = 0;
  return expectedWords.every((expected) => {
    const matchIndex = actualWords.findIndex((actual, index) =>
      index >= cursor && fuzzyWordMatches(actual, expected),
    );
    if (matchIndex === -1) return false;
    cursor = matchIndex + 1;
    return true;
  });
}

function cleanEditionPart(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function mergeEditionParts(...parts: Array<string | undefined>) {
  const seen = new Set<string>();
  const cleanParts = parts
    .map((part) => part ? cleanEditionPart(part) : "")
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return cleanParts.length > 0 ? cleanParts.join(" / ") : undefined;
}

function cleanVolumeCandidate(line?: string) {
  if (!line) return undefined;
  const chinese = line.match(/[\[【（(「『]?\s*(?:上|下|第一|第二)\s*[冊册]\s*[\]】）)」』]?/);
  if (chinese) return chinese[0].replace(/[\s[\]【】（）()「」『』]/g, "").replace("册", "冊");
  const english = line.match(/(?:Volume|Vol\.?)\s*[12]\b/i);
  return english?.[0];
}

function findKnownBookCoverHint(rawText: string) {
  const normalized = rawText.replace(/\s+/g, " ");
  return KNOWN_BOOK_COVER_HINTS.find((hint) => {
    const patternMatches = hint.patterns.filter((pattern) => pattern.test(normalized)).length;
    const fuzzyMatches = (hint.fuzzyPhrases ?? [])
      .filter((phrase) => fuzzyPhraseMatches(normalized, phrase))
      .length;
    const expectedMatches = hint.patterns.length + (hint.fuzzyPhrases?.length ?? 0);
    return patternMatches + fuzzyMatches >= (hint.minimumMatches ?? expectedMatches);
  })?.draft;
}

function mergeDrafts(base: BookOcrDraft, override?: BookOcrDraft) {
  if (!override) return base;
  return {
    ...base,
    ...override,
    edition: mergeEditionParts(cleanVolumeCandidate(base.edition), override.edition ?? base.edition),
  };
}

function isPlausibleTitle(title: string) {
  const compact = title.replace(/\s/g, "");
  const hanCount = compact.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latinCount = compact.match(/[A-Za-z]/g)?.length ?? 0;
  const latinWords = title.match(/[A-Za-z]{3,}/g) ?? [];
  if (compact.length < 3 || compact.length > 72) return false;
  if (!/\s/.test(title) && latinCount > 12 && hanCount > 0) return false;
  if (hanCount >= 3 && hanCount / compact.length >= 0.28) return true;
  if (latinWords.length >= 2 && latinWords.some((word) => /[aeiou]/i.test(word))) return true;
  return latinCount >= 3 && latinCount <= 12 && hanCount >= 2;
}

export function isReliableBookOcrResult(
  rawText: string,
  draft: BookOcrDraft,
  confidence = 0,
) {
  if (findKnownBookCoverHint(rawText)) return true;
  if (!draft.title || !isPlausibleTitle(draft.title) || confidence < 42) return false;
  const supportingFields = [draft.author, draft.edition, draft.publisher].filter(Boolean).length;
  const hanCount = draft.title.match(/\p{Script=Han}/gu)?.length ?? 0;
  return supportingFields >= 1 || hanCount >= 4;
}

export function extractBookDraftFromOcr(rawText: string): BookOcrDraft {
  const lines = rawText
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter((line) => line.length >= 2);
  const authorLine = lines.find((line) => /(作者|編著|主編|譯者|Author|Edited by|Written by)/i.test(line))
    ?? lines.find((line) => /(著|編|譯)/.test(line) && line.length <= 80);
  const editionLine = lines.find((line) => /(第\s*\d+\s*版|edition|版次)/i.test(line));
  const volumeLine = lines.find((line) => /(?:^|[\s:：\[{【（(「『])(?:上|下|第一|第二)\s*[冊册](?:$|[\s:：\]}】）)」』])|(?:Volume|Vol\.?)\s*[12]\b/i.test(line));
  const publisherLine = lines.find((line) => /(出版社|出版|書局|Press|Publishing|Publisher)/i.test(line));
  const titleCandidates = lines
    .filter((line) => line.length >= 3 && line.length <= 56 && hasUsefulText(line))
    .filter((line) => line !== authorLine && line !== editionLine && line !== publisherLine)
    .map((line) => cleanTitleCandidate(line))
    .filter((line) => isPlausibleTitle(line))
    .sort((a, b) => {
      const aHan = (a.match(/\p{Script=Han}/gu)?.length ?? 0);
      const bHan = (b.match(/\p{Script=Han}/gu)?.length ?? 0);
      const aHanRatio = aHan / Math.max(a.length, 1);
      const bHanRatio = bHan / Math.max(b.length, 1);
      const aScore = (aHan >= 2 ? 40 : 0)
        + (aHanRatio >= 0.65 ? 20 : 0)
        + (/(學|論|法|導論|原理|概論|管理|經濟|會計|統計)/.test(a) ? 15 : 0)
        + (/[：:]/.test(a) ? 3 : 0)
        + Math.min(a.length, 28);
      const bScore = (bHan >= 2 ? 40 : 0)
        + (bHanRatio >= 0.65 ? 20 : 0)
        + (/(學|論|法|導論|原理|概論|管理|經濟|會計|統計)/.test(b) ? 15 : 0)
        + (/[：:]/.test(b) ? 3 : 0)
        + Math.min(b.length, 28);
      return bScore - aScore;
    });
  const title = titleCandidates[0];
  const publisher = publisherLine?.replace(/^(出版社|Publisher)[:：]?\s*/i, "")
    || (/Pearson/i.test(rawText) ? "Pearson" : undefined);

  const genericDraft = {
    title,
    author: authorLine ? cleanAuthorCandidate(authorLine) : undefined,
    edition: mergeEditionParts(cleanVolumeCandidate(volumeLine), editionLine),
    publisher,
    ...extractTaiwanTextbookMetadata(rawText),
  };
  return mergeDrafts(genericDraft, findKnownBookCoverHint(rawText));
}

export type BookOcrResult = {
  text: string;
  confidence: number;
  draft: BookOcrDraft;
  usedChineseFallback: boolean;
  needsAiFallback: boolean;
};

const recognitionCache = new WeakMap<File, Promise<BookOcrResult>>();

function hasEnoughBookFields(draft: BookOcrDraft) {
  return [draft.title, draft.author, draft.edition, draft.publisher].filter(Boolean).length >= 2;
}

export function recognizeBookCover(
  file: File,
  onStage?: (stage: "preparing" | "english" | "chinese", progress?: number) => void,
) {
  const cached = recognitionCache.get(file);
  if (cached) return cached;

  const recognition = (async (): Promise<BookOcrResult> => {
    onStage?.("preparing");
    const image = await prepareBookCoverForOcr(file);

    onStage?.("english", 0);
    const englishWorker = await getWorker("eng");
    const english = await recognizeWithWorker(
      englishWorker,
      image,
      (progress) => onStage?.("english", progress),
    );
    const englishDraft = extractBookDraftFromOcr(english.text);
    const englishReliable = isReliableBookOcrResult(
      english.text,
      englishDraft,
      english.confidence,
    );
    if (englishReliable && hasEnoughBookFields(englishDraft)) {
      return {
        ...english,
        draft: englishDraft,
        usedChineseFallback: false,
        needsAiFallback: false,
      };
    }

    onStage?.("chinese", 0);
    const combinedWorker = await getWorker("eng+chi_tra");
    const combined = await recognizeWithWorker(
      combinedWorker,
      image,
      (progress) => onStage?.("chinese", progress),
    );
    const combinedDraft = extractBookDraftFromOcr(combined.text);
    const combinedReliable = isReliableBookOcrResult(
      combined.text,
      combinedDraft,
      combined.confidence,
    );
    return {
      ...combined,
      draft: combinedReliable ? combinedDraft : {},
      usedChineseFallback: true,
      needsAiFallback: !combinedReliable || !hasEnoughBookFields(combinedDraft),
    };
  })().catch(() => {
    return {
      text: "",
      confidence: 0,
      draft: {},
      usedChineseFallback: false,
      needsAiFallback: true,
    };
  });

  recognitionCache.set(file, recognition);
  return recognition;
}

export type StudentVerificationFlags = {
  schoolMatched: boolean;
  textTooShort: boolean;
  imageTooSmall: boolean;
};

export async function imageQualityFlags(file: File, ocrText: string): Promise<StudentVerificationFlags> {
  const imageTooSmall = await new Promise<boolean>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image.naturalWidth < 700 || image.naturalHeight < 420);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(true);
    };
    image.src = url;
  });

  const schoolNameMatched = /\u864e\u5c3e\u79d1\u6280\u5927\u5b78|\u570b\u7acb\u864e\u5c3e\u79d1\u6280\u5927\u5b78|\u864e\u5c3e\u79d1\u5927|NFU|NationalFormosaUniversity/i.test(ocrText.normalize("NFKC"));
  const normalized = `${ocrText}${schoolNameMatched ? " NFU" : ""}`
    .normalize("NFKC")
    .replace(/[\s.,:：、/\\()[\]{}_-]/g, "");
  return {
    schoolMatched: /虎尾科技大學|國立虎尾科技大學|NFU|NationalFormosaUniversity/i.test(normalized),
    textTooShort: normalized.length < 12,
    imageTooSmall,
  };
}

export function studentVerificationFlagLabels(flags: StudentVerificationFlags) {
  const labels: string[] = [];
  labels.push(flags.schoolMatched ? "校名疑似符合" : "未辨識到虎科校名");
  if (flags.imageTooSmall) labels.push("圖片尺寸偏小");
  return labels;
}
