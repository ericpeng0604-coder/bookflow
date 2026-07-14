export type StudentIdDetails = {
  value: string;
  programType: "two_year" | "four_year";
  programLabel: string;
  admissionYear: number;
  departmentCode: string;
  classCode: string;
  classLabel: string;
  seatNumber: string;
};

const FULL_WIDTH_DIGIT_OFFSET = "０".charCodeAt(0) - "0".charCodeAt(0);

export function normalizeStudentIdOcrText(value: string) {
  return value.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - FULL_WIDTH_DIGIT_OFFSET),
  );
}

export function currentTaiwanYear(now = new Date()) {
  const taiwanCalendarYear = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", year: "numeric" }).format(now),
  );
  return taiwanCalendarYear - 1911;
}

export function isStudentIdYearEligible(admissionYear: number, now = new Date()) {
  const currentYear = currentTaiwanYear(now);
  return admissionYear >= currentYear - 4 && admissionYear <= currentYear;
}

export function parseStudentId(value: string, now = new Date()): StudentIdDetails | null {
  const candidate = normalizeStudentIdOcrText(value).replace(/\s/g, "");
  if (!/^[34]\d{7}$/.test(candidate)) return null;

  const admissionYear = 100 + Number(candidate.slice(1, 3));
  if (!isStudentIdYearEligible(admissionYear, now)) return null;

  const classCode = candidate.slice(5, 6);
  return {
    value: candidate,
    programType: candidate[0] === "4" ? "four_year" : "two_year",
    programLabel: candidate[0] === "4" ? "四技" : "二技",
    admissionYear,
    departmentCode: candidate.slice(3, 5),
    classCode,
    classLabel: classCode === "1" ? "甲班" : classCode === "2" ? "乙班" : classCode === "3" ? "丙班" : `${classCode} 班`,
    seatNumber: candidate.slice(6, 8),
  };
}

export function findStudentIdCandidates(ocrText: string, now = new Date()) {
  const normalized = normalizeStudentIdOcrText(ocrText);
  const candidates = new Set<string>();

  for (const match of normalized.matchAll(/(?<!\d)[34]\d{7}(?!\d)/g)) {
    candidates.add(match[0]);
  }

  for (const line of normalized.split(/\r?\n/)) {
    const compact = line.replace(/[^\d]/g, "");
    if (/^[34]\d{7}$/.test(compact)) candidates.add(compact);
  }

  return [...candidates]
    .map((candidate) => parseStudentId(candidate, now))
    .filter((details): details is StudentIdDetails => details !== null);
}
