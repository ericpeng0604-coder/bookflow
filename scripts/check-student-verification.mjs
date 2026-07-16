import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findStudentIdCandidates,
  isStudentIdYearEligible,
  parseStudentId,
} from "../lib/marketplace/student-id.ts";
import {
  buildGeminiStudentCardRequest,
  extractGeminiStudentCard,
  STUDENT_CARD_AI_DEFAULT_MODEL,
} from "../lib/server/student-card-ai.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const now = new Date("2026-07-15T12:00:00+08:00");

const example = parseStudentId("41427130", now);
assert.deepEqual(
  {
    programType: example?.programType,
    admissionYear: example?.admissionYear,
    departmentCode: example?.departmentCode,
    classCode: example?.classCode,
  },
  { programType: "four_year", admissionYear: 114, departmentCode: "27", classCode: "1" },
  "the example student ID must parse into derived fields",
);

for (const classCode of ["1", "2", "3", "9"]) {
  assert.ok(parseStudentId(`41427${classCode}30`, now), `class code ${classCode} should be accepted`);
}

for (const studentId of ["21427130", "4142713", "414271300", "41027130", "41627130", "41A27130"]) {
  assert.equal(parseStudentId(studentId, now), null, `${studentId} should be rejected`);
}

assert.equal(isStudentIdYearEligible(111, now), true);
assert.equal(isStudentIdYearEligible(110, now), false);
assert.equal(isStudentIdYearEligible(115, now), true);
assert.equal(isStudentIdYearEligible(116, now), false);

const spacedCandidates = findStudentIdCandidates("學生證號：4 1 4 2 7 1 3 0", now);
assert.equal(spacedCandidates[0]?.value, "41427130", "OCR spacing should be normalized");

assert.deepEqual(
  extractGeminiStudentCard({ is_student_card: true, confidence: 88, student_number: "41427130" }, now),
  { usable: true, confidence: 88, studentNumber: "41427130" },
  "a high-confidence valid card result should be usable internally",
);
assert.equal(
  extractGeminiStudentCard({ is_student_card: true, confidence: 44, student_number: "41427130" }, now).usable,
  false,
  "low-confidence results must not be accepted",
);
assert.equal(
  extractGeminiStudentCard({ is_student_card: false, confidence: 99, student_number: "41427130" }, now).usable,
  false,
  "non-card results must not be accepted",
);
assert.equal(
  extractGeminiStudentCard({ is_student_card: true, confidence: 99, student_number: "21427130" }, now).studentNumber,
  undefined,
  "invalid student IDs must be discarded",
);
assert.equal(
  extractGeminiStudentCard({ is_student_card: true, confidence: 150, student_number: "41427130" }, now).confidence,
  100,
  "confidence must be clamped to the public range internally",
);
assert.equal(
  extractGeminiStudentCard({ is_student_card: true, confidence: -10, student_number: "41427130" }, now).confidence,
  0,
  "negative confidence must be clamped internally",
);
assert.deepEqual(
  extractGeminiStudentCard(null, now),
  { usable: false, confidence: 0, studentNumber: undefined },
  "malformed provider output must fail closed",
);

const aiRequest = buildGeminiStudentCardRequest({
  model: STUDENT_CARD_AI_DEFAULT_MODEL,
  imageMimeType: "image/jpeg",
  imageBase64: "AA==",
  localOcrText: "x".repeat(600),
});
const aiPrompt = aiRequest.contents[0].parts[0].text;
assert.equal(aiPrompt.includes("x".repeat(500)), true, "the local OCR hint may include a bounded prefix");
assert.equal(aiPrompt.includes("x".repeat(501)), false, "the local OCR hint must be truncated");
assert.equal(aiRequest.generationConfig.responseJsonSchema.additionalProperties, false);
assert.equal(aiRequest.generationConfig.responseMimeType, "application/json");

const app = fs.readFileSync(path.join(root, "components/marketplace-app.tsx"), "utf8");
const studentPanel = app.slice(
  app.indexOf("function StudentVerificationPanel"),
  app.indexOf("function StudentVerificationCardWithZoom"),
);
const studentCardRoute = fs.readFileSync(path.join(root, "app/api/ai/student-card/route.ts"), "utf8");
const studentCardClient = fs.readFileSync(path.join(root, "lib/marketplace/student-card-ai.ts"), "utf8");
const projectChecks = fs.readFileSync(path.join(root, "scripts/run-project-checks.mjs"), "utf8");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260714164420_student_verification_priority.sql"),
  "utf8",
);
const storageRoute = fs.readFileSync(
  path.join(root, "app/api/admin/student-verifications/review/route.ts"),
  "utf8",
);
const storageMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260715100000_student_verification_storage_api.sql"),
  "utf8",
);
assert.match(app, /studentVerification/, "the dashboard must expose the student verification tab");
assert.match(app, /findStudentIdCandidates/, "the UI must use OCR candidates");
assert.match(app, /照片暫時無法辨識，請重新上傳清晰的學生證照片/, "photo failures must use a simple user-facing message");
assert.match(app, /學生證資料已讀取/, "successful OCR must use a simple confirmation");
assert.doesNotMatch(studentPanel, /AI 找不到|AI 候選學號|OCR 已辨識學號|<textarea className="ocr-text"/, "technical OCR details must stay out of the user-facing panel");
assert.match(studentCardRoute, /return NextResponse\.json\(\{ studentNumber: normalized\.usable \? normalized\.studentNumber : "" \}\)/, "the AI route must return only the usable student number");
assert.doesNotMatch(studentCardRoute, /studentNumber:[^\n]*confidence/, "the AI route must not expose confidence");
assert.doesNotMatch(studentCardClient, /confidence/, "the browser client must not model or return confidence");
assert.match(projectChecks, /check-student-verification\.mjs.*stripTypes: true/, "student verification checks must run in the project suite");
assert.match(migration, /student_number text/, "the submission RPC must accept server-validated OCR output");
assert.match(migration, /normalized_ocr/, "the server must cross-check the OCR text");
assert.match(migration, /seller_verified boolean/, "public listing output must expose only the verification boolean");
assert.match(migration, /p_cursor_verified boolean/, "the cursor must include verification state");
assert.match(migration, /grant execute on function public\.list_books_page[\s\S]*to anon, authenticated/, "catalog RPC must remain public");
assert.match(app, /student-card-lightbox/, "moderators must be able to enlarge student card images");
assert.match(app, /reviewStudentVerificationWithStorage/, "student review must use the server storage cleanup flow");
assert.match(storageRoute, /storage[\s\S]*\.remove\(\[verification\.image_path\]\)/, "review route must use the Storage API");
assert.doesNotMatch(storageMigration, /delete\s+from\s+storage\.objects/i, "student verification migration must not delete storage tables directly");

console.log("student verification checks passed");
