import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findStudentIdCandidates,
  isStudentIdYearEligible,
  parseStudentId,
} from "../lib/marketplace/student-id.ts";

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

const app = fs.readFileSync(path.join(root, "components/marketplace-app.tsx"), "utf8");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260714164420_student_verification_priority.sql"),
  "utf8",
);
assert.match(app, /studentVerification/, "the dashboard must expose the student verification tab");
assert.match(app, /findStudentIdCandidates/, "the UI must use OCR candidates");
assert.match(app, /找不到有效學號時不能送出/, "OCR failure must require a new upload");
assert.match(migration, /student_number text/, "the submission RPC must accept server-validated OCR output");
assert.match(migration, /normalized_ocr/, "the server must cross-check the OCR text");
assert.match(migration, /seller_verified boolean/, "public listing output must expose only the verification boolean");
assert.match(migration, /p_cursor_verified boolean/, "the cursor must include verification state");
assert.match(migration, /grant execute on function public\.list_books_page[\s\S]*to anon, authenticated/, "catalog RPC must remain public");

console.log("student verification checks passed");
