import {
  canonicalPublisher,
  normalizeIsbn13,
} from "../marketplace/taiwan-textbook.ts";

export const BOOK_OCR_AI_DEFAULT_MODEL = "gemini-2.5-flash";
export const BOOK_OCR_AI_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const BOOK_OCR_AI_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type AiBookOcrDraft = {
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

type StructuredBookCover = {
  is_book_cover: boolean;
  confidence: number;
  title: string | null;
  author: string | null;
  edition: string | null;
  publisher: string | null;
  education_level: string | null;
  grade: string | null;
  semester: string | null;
  subject: string | null;
  volume: string | null;
  curriculum: string | null;
  book_type: string | null;
  isbn13: string | null;
  approval_number: string | null;
};

const FIELD_LIMITS = {
  title: 160,
  author: 160,
  edition: 120,
  publisher: 120,
  educationLevel: 40,
  grade: 20,
  semester: 20,
  subject: 80,
  volume: 40,
  curriculum: 40,
  bookType: 40,
  isbn13: 13,
  approvalNumber: 100,
} as const;

function cleanField(value: unknown, limit: number) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, limit);
}

function cleanEnum(value: unknown, allowed: readonly string[]) {
  const cleaned = cleanField(value, 40);
  return cleaned && allowed.includes(cleaned) ? cleaned : undefined;
}

function mergeEditionAndVolume(edition?: string, volume?: string) {
  const parts = [volume, edition].filter(Boolean) as string[];
  const seen = new Set<string>();
  const unique = parts.filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.length > 0 ? unique.join(" / ").slice(0, FIELD_LIMITS.edition) : undefined;
}

export function normalizeAiBookCover(value: unknown) {
  if (!value || typeof value !== "object") {
    return { usable: false, confidence: 0, draft: {} as AiBookOcrDraft };
  }
  const parsed = value as Partial<StructuredBookCover>;
  const confidence = Number.isFinite(parsed.confidence)
    ? Math.max(0, Math.min(100, Math.round(Number(parsed.confidence))))
    : 0;
  const draftEntries = {
    title: cleanField(parsed.title, FIELD_LIMITS.title),
    author: cleanField(parsed.author, FIELD_LIMITS.author),
    edition: cleanField(parsed.edition, FIELD_LIMITS.edition),
    publisher: cleanField(parsed.publisher, FIELD_LIMITS.publisher),
    educationLevel: cleanEnum(parsed.education_level, [
      "elementary",
      "junior_high",
      "senior_high",
      "vocational_high",
      "university",
    ]),
    grade: cleanField(parsed.grade, FIELD_LIMITS.grade),
    semester: cleanEnum(parsed.semester, ["first", "second"]),
    subject: cleanField(parsed.subject, FIELD_LIMITS.subject),
    volume: cleanField(parsed.volume, FIELD_LIMITS.volume),
    curriculum: cleanField(parsed.curriculum, FIELD_LIMITS.curriculum),
    bookType: cleanEnum(parsed.book_type, [
      "textbook",
      "workbook",
      "teacher_guide",
      "reference",
      "assessment",
      "other",
    ]),
    isbn13: typeof parsed.isbn13 === "string" ? normalizeIsbn13(parsed.isbn13) : undefined,
    approvalNumber: cleanField(parsed.approval_number, FIELD_LIMITS.approvalNumber),
  };
  draftEntries.publisher = draftEntries.publisher
    ? canonicalPublisher(draftEntries.publisher) || draftEntries.publisher
    : undefined;
  draftEntries.edition = mergeEditionAndVolume(draftEntries.edition, draftEntries.volume);
  const draft = Object.fromEntries(
    Object.entries(draftEntries).filter(([, field]) => Boolean(field)),
  ) as AiBookOcrDraft;
  const usable = parsed.is_book_cover === true
    && confidence >= 45
    && Boolean(draft.title);
  return { usable, confidence, draft: usable ? draft : {} };
}

export function buildBookCoverPrompt(localOcrText: string) {
  const localHint = localOcrText.replace(/\s+/g, " ").trim().slice(0, 2000);
  return [
    "Read this textbook cover and extract only text that is visibly supported by the image.",
    "Return visible Taiwan textbook metadata when present: title, author, edition, publisher, education level, grade, semester, subject, volume, curriculum, book type, ISBN-13, and approval number.",
    "If a cover visibly says [上冊], 【上冊】, (上冊), 上冊, 下冊, 第一冊, or 第二冊, return that marker in volume and include it in edition when edition is otherwise present.",
    "Use education_level values elementary, junior_high, senior_high, vocational_high, or university.",
    "Use semester values first or second. Use book_type values textbook, workbook, teacher_guide, reference, assessment, or other.",
    "Do not infer missing values from general knowledge, similar books, cover art, or the OCR hint.",
    "Inspect large stylized Traditional Chinese title text directly even when it has shadows, outlines, gradients, or a photographic background.",
    "Use null for any field that is not clearly visible.",
    "Set is_book_cover to false for unrelated, unreadable, or non-book images.",
    "Confidence must reflect the visible evidence, not familiarity with the book.",
    "Return only one JSON object with exactly these keys: is_book_cover, confidence, title, author, edition, publisher, education_level, grade, semester, subject, volume, curriculum, book_type, isbn13, approval_number.",
    localHint
      ? `Untrusted local OCR hint (may be wrong or contain garbage): ${localHint}`
      : "The local OCR produced no usable hint.",
  ].join("\n");
}

function bookCoverSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      is_book_cover: { type: "boolean" },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
      title: { type: ["string", "null"] },
      author: { type: ["string", "null"] },
      edition: { type: ["string", "null"] },
      publisher: { type: ["string", "null"] },
      education_level: { type: ["string", "null"] },
      grade: { type: ["string", "null"] },
      semester: { type: ["string", "null"] },
      subject: { type: ["string", "null"] },
      volume: { type: ["string", "null"] },
      curriculum: { type: ["string", "null"] },
      book_type: { type: ["string", "null"] },
      isbn13: { type: ["string", "null"] },
      approval_number: { type: ["string", "null"] },
    },
    required: [
      "is_book_cover",
      "confidence",
      "title",
      "author",
      "edition",
      "publisher",
      "education_level",
      "grade",
      "semester",
      "subject",
      "volume",
      "curriculum",
      "book_type",
      "isbn13",
      "approval_number",
    ],
  };
}

export function buildGeminiBookCoverRequest(params: {
  model: string;
  imageMimeType: string;
  imageBase64: string;
  localOcrText: string;
}) {
  return {
    contents: [{
      role: "user",
      parts: [
        { text: buildBookCoverPrompt(params.localOcrText) },
        {
          inlineData: {
            mimeType: params.imageMimeType,
            data: params.imageBase64,
          },
        },
      ],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: bookCoverSchema(),
      maxOutputTokens: 1200,
      temperature: 0.1,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  };
}

export function extractGeminiOutputText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const response = value as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  };
  return response.candidates?.[0]?.content?.parts
    ?.map((part) => typeof part.text === "string" ? part.text : "")
    .join("")
    .trim() || "";
}

export function parseBookCoverOutputText(value: string) {
  const trimmed = value.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(withoutFence) as unknown;
  } catch {
    const start = withoutFence.indexOf("{");
    if (start < 0) throw new SyntaxError("Gemini response did not contain JSON");
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < withoutFence.length; index += 1) {
      const character = withoutFence[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === "\"") {
          inString = false;
        }
        continue;
      }
      if (character === "\"") {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(withoutFence.slice(start, index + 1)) as unknown;
        }
      }
    }
    throw new SyntaxError("Gemini response contained incomplete JSON");
  }
}

export function extractSafeProviderErrorCode(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const payload = value as {
    code?: unknown;
    status?: unknown;
    type?: unknown;
    error?: { code?: unknown; status?: unknown; type?: unknown };
  };
  const candidate = payload.error?.code
    ?? payload.error?.status
    ?? payload.error?.type
    ?? payload.code
    ?? payload.status
    ?? payload.type;
  if (typeof candidate !== "string") return "";
  return /^[a-zA-Z0-9_.-]{1,80}$/.test(candidate) ? candidate : "";
}
