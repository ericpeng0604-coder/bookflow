type TesseractLike = {
  recognize: (
    image: File | Blob | string,
    language?: string,
  ) => Promise<{ data?: { text?: string } }>;
};

declare global {
  interface Window {
    Tesseract?: TesseractLike;
  }
}

const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

let tesseractLoadPromise: Promise<TesseractLike> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (window.Tesseract) resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("OCR 載入失敗，請稍後再試或改用手動填寫"));
    document.head.appendChild(script);
  });
}

async function loadTesseract() {
  if (typeof window === "undefined") throw new Error("OCR 只能在瀏覽器中執行");
  if (window.Tesseract) return window.Tesseract;
  tesseractLoadPromise ??= loadScript(TESSERACT_CDN).then(() => {
    if (!window.Tesseract) throw new Error("OCR 尚未準備完成，請稍後再試");
    return window.Tesseract;
  });
  return tesseractLoadPromise;
}

export async function recognizeImageText(file: File) {
  const tesseract = await loadTesseract();
  const result = await tesseract.recognize(file, "eng+chi_tra");
  return String(result.data?.text || "").replace(/\s+\n/g, "\n").trim();
}

export type BookOcrDraft = {
  title?: string;
  author?: string;
  edition?: string;
  publisher?: string;
};

type KnownBookCoverHint = {
  patterns: RegExp[];
  draft: BookOcrDraft;
};

const KNOWN_BOOK_COVER_HINTS: KnownBookCoverHint[] = [
  {
    patterns: [/普通\s*物理\s*學|Essential\s+University\s+Physics/i, /Richard\s+Wolfson/i],
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
  const chinese = line.match(/(?:上|下|第一|第二)\s*冊/);
  if (chinese) return chinese[0].replace(/\s+/g, "");
  const english = line.match(/(?:Volume|Vol\.?)\s*[12]\b/i);
  return english?.[0];
}

function findKnownBookCoverHint(rawText: string) {
  const normalized = rawText.replace(/\s+/g, " ");
  return KNOWN_BOOK_COVER_HINTS.find((hint) =>
    hint.patterns.every((pattern) => pattern.test(normalized)),
  )?.draft;
}

function mergeDrafts(base: BookOcrDraft, override?: BookOcrDraft) {
  if (!override) return base;
  return {
    ...base,
    ...override,
    edition: mergeEditionParts(cleanVolumeCandidate(base.edition), override.edition ?? base.edition),
  };
}

export function extractBookDraftFromOcr(rawText: string): BookOcrDraft {
  const lines = rawText
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter((line) => line.length >= 2);
  const authorLine = lines.find((line) => /(作者|編著|主編|譯者|Author|Edited by|Written by)/i.test(line))
    ?? lines.find((line) => /(著|編|譯)/.test(line) && line.length <= 80);
  const editionLine = lines.find((line) => /(第\s*\d+\s*版|edition|版次)/i.test(line));
  const volumeLine = lines.find((line) => /(?:^|[\s:：])(?:上|下|第一|第二)\s*冊(?:$|[\s:：])|(?:Volume|Vol\.?)\s*[12]\b/i.test(line));
  const publisherLine = lines.find((line) => /(出版社|出版|書局|Press|Publishing|Publisher)/i.test(line));
  const titleCandidates = lines
    .filter((line) => line.length >= 3 && line.length <= 56 && hasUsefulText(line))
    .filter((line) => line !== authorLine && line !== editionLine && line !== publisherLine)
    .map((line) => cleanTitleCandidate(line))
    .filter((line) => line.length >= 3)
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
  };
  return mergeDrafts(genericDraft, findKnownBookCoverHint(rawText));
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

  const normalized = ocrText.replace(/\s/g, "");
  return {
    schoolMatched: /虎尾科技大學|國立虎尾科技大學|NFU|NationalFormosaUniversity/i.test(normalized),
    textTooShort: normalized.length < 12,
    imageTooSmall,
  };
}

export function studentVerificationFlagLabels(flags: StudentVerificationFlags) {
  const labels: string[] = [];
  labels.push(flags.schoolMatched ? "校名疑似符合" : "未辨識到虎科校名");
  if (flags.textTooShort) labels.push("可讀文字偏少");
  if (flags.imageTooSmall) labels.push("圖片尺寸偏小");
  return labels;
}
