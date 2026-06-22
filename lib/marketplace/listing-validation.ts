import {
  canonicalPublisher,
  normalizeIsbn13,
} from "./taiwan-textbook.ts";

export const LISTING_FIELD_LIMITS = {
  title: 160,
  author: 160,
  edition: 120,
  publisher: 120,
  course: 120,
  teacher: 80,
  meetup: 160,
  description: 2000,
  educationLevel: 40,
  grade: 20,
  semester: 20,
  subject: 80,
  volume: 40,
  curriculum: 40,
  bookType: 40,
  isbn13: 32,
  approvalNumber: 100,
  price: 1_000_000,
} as const;

type ListingFields = {
  title: string;
  author: string;
  edition: string;
  publisher: string;
  course: string;
  teacher: string;
  meetup: string;
  description: string;
  educationLevel: string;
  grade: string;
  semester: string;
  subject: string;
  volume: string;
  curriculum: string;
  bookType: string;
  isbn13: string;
  approvalNumber: string;
  price: number;
};

export function normalizeAndValidateListingFields(
  fields: ListingFields,
): { error: string } | { value: ListingFields } {
  const normalized = {
    ...fields,
    title: fields.title.trim(),
    author: fields.author.trim(),
    edition: fields.edition.trim(),
    publisher: fields.publisher.trim(),
    course: fields.course.trim(),
    teacher: fields.teacher.trim(),
    meetup: fields.meetup.trim(),
    description: fields.description.trim(),
    educationLevel: fields.educationLevel.trim(),
    grade: fields.grade.trim(),
    semester: fields.semester.trim(),
    subject: fields.subject.trim(),
    volume: fields.volume.trim(),
    curriculum: fields.curriculum.trim(),
    bookType: fields.bookType.trim(),
    isbn13: fields.isbn13.trim(),
    approvalNumber: fields.approvalNumber.trim(),
  };
  normalized.publisher = canonicalPublisher(normalized.publisher) || normalized.publisher;

  if (!normalized.title) return { error: "請填寫名稱" };
  if (!normalized.meetup) return { error: "請填寫面交地點" };
  if (!normalized.description) return { error: "請填寫商品說明" };
  if (!Number.isInteger(normalized.price) || normalized.price < 0 || normalized.price > LISTING_FIELD_LIMITS.price) {
    return { error: `價格必須是 0 到 ${LISTING_FIELD_LIMITS.price.toLocaleString("zh-TW")} 之間的整數` };
  }
  if (normalized.isbn13) {
    const isbn13 = normalizeIsbn13(normalized.isbn13);
    if (!isbn13) return { error: "ISBN-13 格式或檢查碼不正確" };
    normalized.isbn13 = isbn13;
  }
  if (normalized.educationLevel && ![
    "elementary",
    "junior_high",
    "senior_high",
    "vocational_high",
    "university",
  ].includes(normalized.educationLevel)) {
    return { error: "教育階段不正確" };
  }
  if (normalized.semester && !["first", "second"].includes(normalized.semester)) {
    return { error: "學期不正確" };
  }
  if (normalized.bookType && ![
    "textbook",
    "workbook",
    "teacher_guide",
    "reference",
    "assessment",
    "other",
  ].includes(normalized.bookType)) {
    return { error: "書籍類型不正確" };
  }

  for (const field of [
    "title",
    "author",
    "edition",
    "publisher",
    "course",
    "teacher",
    "meetup",
    "description",
    "educationLevel",
    "grade",
    "semester",
    "subject",
    "volume",
    "curriculum",
    "bookType",
    "isbn13",
    "approvalNumber",
  ] as const) {
    if (normalized[field].length > LISTING_FIELD_LIMITS[field]) {
      return { error: `${field} 欄位內容過長` };
    }
  }

  return { value: normalized };
}
