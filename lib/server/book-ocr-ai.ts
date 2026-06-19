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
};

type StructuredBookCover = {
  is_book_cover: boolean;
  confidence: number;
  title: string | null;
  author: string | null;
  edition: string | null;
  publisher: string | null;
};

const FIELD_LIMITS = {
  title: 160,
  author: 160,
  edition: 120,
  publisher: 120,
} as const;

function cleanField(value: unknown, limit: number) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, limit);
}

export function normalizeAiBookCover(value: unknown) {
  if (!value || typeof value !== "object") {
    return { usable: false, confidence: 0, draft: {} as AiBookOcrDraft };
  }
  const parsed = value as Partial<StructuredBookCover>;
  const confidence = Number.isFinite(parsed.confidence)
    ? Math.max(0, Math.min(100, Math.round(Number(parsed.confidence))))
    : 0;
  const draft: AiBookOcrDraft = {
    title: cleanField(parsed.title, FIELD_LIMITS.title),
    author: cleanField(parsed.author, FIELD_LIMITS.author),
    edition: cleanField(parsed.edition, FIELD_LIMITS.edition),
    publisher: cleanField(parsed.publisher, FIELD_LIMITS.publisher),
  };
  const usable = parsed.is_book_cover === true
    && confidence >= 45
    && Boolean(draft.title);
  return { usable, confidence, draft: usable ? draft : {} };
}

export function buildBookCoverPrompt(localOcrText: string) {
  const localHint = localOcrText.replace(/\s+/g, " ").trim().slice(0, 2000);
  return [
    "Read this textbook cover and extract only text that is visibly supported by the image.",
    "Return title, author, edition or volume, and publisher.",
    "Do not infer missing values from general knowledge, similar books, cover art, or the OCR hint.",
    "Use null for any field that is not clearly visible.",
    "Set is_book_cover to false for unrelated, unreadable, or non-book images.",
    "Confidence must reflect the visible evidence, not familiarity with the book.",
    "Return only one JSON object with exactly these keys: is_book_cover, confidence, title, author, edition, publisher.",
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
    },
    required: [
      "is_book_cover",
      "confidence",
      "title",
      "author",
      "edition",
      "publisher",
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
      maxOutputTokens: 500,
      temperature: 0.1,
    },
  };
}

export function extractGeminiOutputText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const response = value as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  };
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text : "";
}

export function parseBookCoverOutputText(value: string) {
  const trimmed = value.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(withoutFence) as unknown;
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
