import { parseStudentId } from "../marketplace/student-id.ts";

export const STUDENT_CARD_AI_DEFAULT_MODEL = "gemini-2.5-flash";
export const STUDENT_CARD_AI_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const STUDENT_CARD_AI_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function buildGeminiStudentCardRequest(params: {
  model: string;
  imageMimeType: string;
  imageBase64: string;
  localOcrText: string;
}) {
  return {
    contents: [{
      role: "user",
      parts: [{
        text: [
          "這是一張國立虎尾科技大學學生證。只讀取學生證上清楚可見的 8 碼學號，不要讀取或回傳姓名、照片、條碼內容或其他個資。",
          "學號格式必須是第一碼 3 或 4，後面七碼為數字；若看不清楚請回傳 null，不要猜測。",
          "只回傳 JSON，不要附加說明。",
          params.localOcrText.trim() ? `不可信的本機 OCR 提示：${params.localOcrText.trim().slice(0, 500)}` : "本機 OCR 沒有結果。",
        ].join("\n"),
      }, { inlineData: { mimeType: params.imageMimeType, data: params.imageBase64 } }],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          is_student_card: { type: "boolean" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          student_number: { type: ["string", "null"] },
        },
        required: ["is_student_card", "confidence", "student_number"],
      },
      maxOutputTokens: 120,
      temperature: 0,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
}

export function extractGeminiStudentCard(value: unknown, now = new Date()) {
  if (!value || typeof value !== "object") return { usable: false, confidence: 0, studentNumber: undefined };
  const parsed = value as { is_student_card?: unknown; confidence?: unknown; student_number?: unknown };
  const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));
  const studentNumber = typeof parsed.student_number === "string"
    ? parseStudentId(parsed.student_number, now)?.value
    : undefined;
  return {
    usable: parsed.is_student_card === true && confidence >= 45 && Boolean(studentNumber),
    confidence,
    studentNumber,
  };
}
