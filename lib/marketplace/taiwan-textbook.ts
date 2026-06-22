export const TAIWAN_TEXTBOOK_CATALOG_VERSION = "2026-06-22";

export const TAIWAN_PUBLISHERS = [
  { name: "翰林", aliases: ["翰林版", "翰林出版", "翰林文教"] },
  { name: "康軒", aliases: ["康軒版", "康軒文教", "康軒文教事業"] },
  { name: "南一", aliases: ["南一版", "南一書局", "南一出版"] },
  { name: "龍騰", aliases: ["龍騰版", "龍騰文化"] },
  { name: "泰宇", aliases: ["泰宇版", "泰宇出版"] },
  { name: "三民", aliases: ["三民版", "三民書局"] },
  { name: "全華", aliases: ["全華版", "全華圖書"] },
  { name: "東大", aliases: ["東大圖書"] },
  { name: "育達", aliases: ["育達版", "育達文化"] },
] as const;

export type TaiwanTextbookMetadata = {
  educationLevel?: "elementary" | "junior_high" | "senior_high" | "vocational_high" | "university";
  grade?: string;
  semester?: "first" | "second";
  subject?: string;
  volume?: string;
  curriculum?: string;
  bookType?: "textbook" | "workbook" | "teacher_guide" | "reference" | "assessment" | "other";
  isbn13?: string;
  approvalNumber?: string;
  publisher?: string;
};

export type TaiwanTextbookCandidate = {
  source: "front_ocr" | "back_ocr" | "barcode" | "ai";
  confidence: number;
  draft: Partial<Record<
    keyof TaiwanTextbookMetadata | "title" | "author" | "edition",
    string
  >>;
};

const CHINESE_NUMBERS: Record<string, string> = {
  一: "1",
  二: "2",
  三: "3",
  四: "4",
  五: "5",
  六: "6",
  七: "7",
  八: "8",
  九: "9",
};

const SUBJECTS = [
  "國文",
  "英語",
  "英文",
  "數學",
  "自然科學",
  "自然",
  "社會",
  "物理",
  "化學",
  "生物",
  "地球科學",
  "歷史",
  "地理",
  "公民",
  "生活科技",
  "資訊科技",
  "基本電學",
  "電子學",
  "電路學",
  "機械製造",
] as const;

export function normalizeTextbookText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalPublisher(value: string) {
  const compact = normalizeTextbookText(value).replace(/\s/g, "");
  return TAIWAN_PUBLISHERS.find((publisher) =>
    [publisher.name, ...publisher.aliases].some((alias) => compact.includes(alias.replace(/\s/g, ""))),
  )?.name;
}

export function normalizeIsbn13(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 13) return undefined;
  const sum = digits
    .slice(0, 12)
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  const expected = (10 - (sum % 10)) % 10;
  return expected === Number(digits[12]) ? digits : undefined;
}

function parseGrade(text: string, level?: TaiwanTextbookMetadata["educationLevel"]) {
  const direct = text.match(/([一二三四五六七八九1-9])\s*年級/);
  if (direct) return CHINESE_NUMBERS[direct[1]] || direct[1];
  const junior = text.match(/國\s*([一二三123])/);
  if (junior) return String(Number(CHINESE_NUMBERS[junior[1]] || junior[1]) + 6);
  const senior = text.match(/高\s*([一二三123])/);
  if (senior) return `高${CHINESE_NUMBERS[senior[1]] || senior[1]}`;
  const compact = text.match(/([一二三四五六七八九1-9])\s*[上下]/);
  if (compact && level !== "university") return CHINESE_NUMBERS[compact[1]] || compact[1];
  return undefined;
}

function parseVolume(text: string) {
  const numbered = text.match(/第\s*([一二三四五六七八九1-9])\s*冊/);
  if (numbered) return `第${CHINESE_NUMBERS[numbered[1]] || numbered[1]}冊`;
  const compact = text.match(/(?:^|\s)([一二三四五六七八九1-9])\s*([上下])(?:\s|$)/);
  if (compact) return `${CHINESE_NUMBERS[compact[1]] || compact[1]}${compact[2]}`;
  const required = text.match(/(必修|選修)\s*([一二三四五六七八九1-9IVXⅢⅡⅠ]+)/i);
  if (required) return `${required[1]}${required[2].toUpperCase()}`;
  const volume = text.match(/(?:Volume|Vol\.?|Book)\s*([1-9])\b/i);
  return volume ? `Book ${volume[1]}` : undefined;
}

export function extractTaiwanTextbookMetadata(rawText: string): TaiwanTextbookMetadata {
  const text = normalizeTextbookText(rawText);
  const compact = text.replace(/\s/g, "");
  const educationLevel: TaiwanTextbookMetadata["educationLevel"] =
    /技術型高級中等學校|技高|高職/.test(compact) ? "vocational_high"
      : /普通型高級中等學校|高級中學|高中/.test(compact) ? "senior_high"
        : /國民中學|國中/.test(compact) ? "junior_high"
          : /國民小學|國小/.test(compact) ? "elementary"
            : /大學|專科|University|College/i.test(text) ? "university"
              : undefined;
  const semester = /下學期|下冊|[一二三四五六七八九1-9]下/.test(compact)
    ? "second"
    : /上學期|上冊|[一二三四五六七八九1-9]上/.test(compact)
      ? "first"
      : undefined;
  const subject = SUBJECTS.find((item) => compact.includes(item.replace(/\s/g, "")));
  const bookType: TaiwanTextbookMetadata["bookType"] =
    /教師手冊|教師用書/.test(compact) ? "teacher_guide"
      : /習作/.test(compact) ? "workbook"
        : /自修|講義|參考書/.test(compact) ? "reference"
          : /評量|題庫|測驗卷/.test(compact) ? "assessment"
            : /教科書|課本|教材|國民小學|國民中學|高級中等學校/.test(compact) ? "textbook"
              : undefined;
  const isbnMatch = text.match(/(?:ISBN(?:-13)?[:：]?\s*)?((?:97[89][-\s]?)?\d[-\d\s]{10,20}\d)/i);
  const approval = text.match(/(?:審定字號|審字|審定)[:：]?\s*([A-Za-z0-9\u4e00-\u9fff字第號()（）-]{4,80})/);

  return {
    educationLevel,
    grade: parseGrade(text, educationLevel),
    semester,
    subject,
    volume: parseVolume(text),
    curriculum: /108\s*課綱|十二年國教/.test(compact) ? "108課綱" : undefined,
    bookType,
    isbn13: isbnMatch ? normalizeIsbn13(isbnMatch[1]) : undefined,
    approvalNumber: approval?.[1]?.trim(),
    publisher: canonicalPublisher(text),
  };
}

export function normalizeTaiwanTextbookQuery(value: string) {
  const publisher = canonicalPublisher(value);
  let normalized = normalizeTextbookText(value)
    .replace(/國一/g, "7年級")
    .replace(/國二/g, "8年級")
    .replace(/國三/g, "9年級")
    .replace(/小一/g, "1年級")
    .replace(/小二/g, "2年級")
    .replace(/小三/g, "3年級")
    .replace(/小四/g, "4年級")
    .replace(/小五/g, "5年級")
    .replace(/小六/g, "6年級")
    .replace(/高一/g, "高1")
    .replace(/高二/g, "高2")
    .replace(/高三/g, "高3")
    .replace(/([一二三四五六七八九1-9])上/g, "$1年級 上學期")
    .replace(/([一二三四五六七八九1-9])下/g, "$1年級 下學期");
  for (const [chinese, arabic] of Object.entries(CHINESE_NUMBERS)) {
    normalized = normalized.replace(new RegExp(`${chinese}年級`, "g"), `${arabic}年級`);
  }
  if (publisher) {
    const matched = TAIWAN_PUBLISHERS.find((item) => item.name === publisher);
    for (const alias of matched?.aliases ?? []) {
      normalized = normalized.replaceAll(alias, publisher);
    }
  }
  return normalized
    .replace(/([0-9])年級/g, "$1年級 ")
    .replace(/(上學期|下學期|上冊|下冊)/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export function rankTaiwanTextbookCandidates(candidates: TaiwanTextbookCandidate[]) {
  return [...candidates].sort((left, right) => {
    const score = (candidate: TaiwanTextbookCandidate) => {
      const fields = Object.values(candidate.draft).filter(Boolean).length;
      const strongIdentifiers =
        (candidate.draft.isbn13 ? 35 : 0)
        + (candidate.draft.approvalNumber ? 20 : 0)
        + (candidate.draft.publisher ? 8 : 0);
      const sourceWeight = candidate.source === "barcode"
        ? 25
        : candidate.source === "ai"
          ? 6
          : candidate.source === "front_ocr"
            ? 4
            : 2;
      return Math.max(0, Math.min(100, candidate.confidence))
        + fields * 3
        + strongIdentifiers
        + sourceWeight;
    };
    return score(right) - score(left);
  });
}
