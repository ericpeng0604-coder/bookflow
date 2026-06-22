#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  canonicalPublisher,
  extractTaiwanTextbookMetadata,
  normalizeIsbn13,
  normalizeTaiwanTextbookQuery,
} from "../lib/marketplace/taiwan-textbook.ts";

const cases = [];

function add(name, text, expected) {
  cases.push({ name, text, expected });
}

function expectSubset(actual, expected, name) {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, `${name}: expected ${key}=${value}, received ${actual[key]}`);
  }
}

[
  ["翰林版", "翰林"],
  ["翰林文教", "翰林"],
  ["康軒文教事業", "康軒"],
  ["康軒版", "康軒"],
  ["南一書局", "南一"],
  ["龍騰文化", "龍騰"],
  ["泰宇出版", "泰宇"],
  ["三民書局", "三民"],
  ["全華圖書", "全華"],
  ["東大圖書", "東大"],
  ["育達文化", "育達"],
].forEach(([label, publisher]) => {
  add(`publisher-${label}`, `${label} 國民中學 數學 七年級 上冊`, { publisher });
});

[
  ["國民小學 一年級 上冊 國語 教科書", "elementary", "1", "first"],
  ["國小 二年級 下學期 數學 課本", "elementary", "2", "second"],
  ["國民小學 三上 自然科學", "elementary", "3", "first"],
  ["國小 四下 社會 習作", "elementary", "4", "second"],
  ["國民小學 五年級 上學期 英語", "elementary", "5", "first"],
  ["國小 六年級 下冊 國文", "elementary", "6", "second"],
  ["國民中學 七年級 上冊 數學", "junior_high", "7", "first"],
  ["國中 八年級 下學期 自然", "junior_high", "8", "second"],
  ["國中 九年級 上冊 社會", "junior_high", "9", "first"],
  ["普通型高級中等學校 高一 上學期 物理", "senior_high", "高1", "first"],
  ["高中 高二 下冊 化學", "senior_high", "高2", "second"],
  ["高級中學 高三 上冊 生物", "senior_high", "高3", "first"],
  ["技術型高級中等學校 高一 上冊 基本電學", "vocational_high", "高1", "first"],
  ["高職 高二 下學期 電子學", "vocational_high", "高2", "second"],
  ["技高 高三 上冊 機械製造", "vocational_high", "高3", "first"],
  ["University Physics College Textbook", "university", undefined, undefined],
].forEach(([text, educationLevel, grade, semester], index) => {
  add(`level-${index + 1}`, text, {
    educationLevel,
    ...(grade ? { grade } : {}),
    ...(semester ? { semester } : {}),
  });
});

[
  "國文",
  "英語",
  "英文",
  "數學",
  "自然科學",
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
].forEach((subject) => {
  add(`subject-${subject}`, `翰林 國民中學 七年級 ${subject} 教科書`, { subject });
});

[
  ["國民中學 數學 教科書", "textbook"],
  ["國民小學 國語 課本", "textbook"],
  ["國中 英語 習作", "workbook"],
  ["數學 教師手冊", "teacher_guide"],
  ["自然科學 教師用書", "teacher_guide"],
  ["高中物理 自修", "reference"],
  ["國文 講義", "reference"],
  ["英文 參考書", "reference"],
  ["數學 評量", "assessment"],
  ["自然 題庫", "assessment"],
  ["社會 測驗卷", "assessment"],
].forEach(([text, bookType], index) => {
  add(`type-${index + 1}`, text, { bookType });
});

[
  ["數學 第一冊", "第1冊"],
  ["自然 第 2 冊", "第2冊"],
  ["高中物理 必修 I", "必修I"],
  ["高中化學 選修 Ⅱ", "選修II"],
  ["English Book 3", "Book 3"],
  ["國中數學 108課綱 第一冊", "第1冊"],
].forEach(([text, volume], index) => {
  add(`volume-${index + 1}`, text, {
    volume,
    ...(text.includes("108課綱") ? { curriculum: "108課綱" } : {}),
  });
});

function makeIsbn(prefix12) {
  const sum = prefix12
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${prefix12}${(10 - (sum % 10)) % 10}`;
}

[
  "978957000001",
  "978986000002",
  "978957000003",
  "979957000004",
  "978626000005",
].forEach((prefix, index) => {
  const isbn13 = makeIsbn(prefix);
  const formatted = `${isbn13.slice(0, 3)}-${isbn13.slice(3, 6)}-${isbn13.slice(6, 12)}-${isbn13.slice(12)}`;
  add(`isbn-${index + 1}`, `國中數學 ISBN-13: ${formatted}`, { isbn13 });
});

[
  "國審字第113001號",
  "教審字第112-A-008號",
  "審定字號 普審字第111023號",
  "審字 技審字第110-17號",
  "審定 高審字第109009號",
].forEach((approvalNumber, index) => {
  const text = index < 2 ? `審定字號：${approvalNumber}` : approvalNumber;
  add(`approval-${index + 1}`, text, {
    approvalNumber: approvalNumber
      .replace(/^審定字號\s*/, "")
      .replace(/^審字\s*/, "")
      .replace(/^審定\s*/, ""),
  });
});

assert.ok(cases.length >= 60, `expected at least 60 Taiwan textbook cases, received ${cases.length}`);

for (const testCase of cases) {
  expectSubset(
    extractTaiwanTextbookMetadata(testCase.text),
    testCase.expected,
    testCase.name,
  );
}

assert.equal(canonicalPublisher("康軒文教事業股份有限公司"), "康軒");
assert.equal(canonicalPublisher("未知出版社"), undefined);
assert.equal(normalizeIsbn13("978-957-000001-9"), undefined);
assert.equal(normalizeTaiwanTextbookQuery("國一翰林版數學7上"), "7年級 翰林數學7年級 上學期");
assert.deepEqual(
  extractTaiwanTextbookMetadata("漂亮筆記本與桌燈，適合宿舍使用"),
  {
    educationLevel: undefined,
    grade: undefined,
    semester: undefined,
    subject: undefined,
    volume: undefined,
    curriculum: undefined,
    bookType: undefined,
    isbn13: undefined,
    approvalNumber: undefined,
    publisher: undefined,
  },
);

console.log(`Taiwan textbook recognition checks passed (${cases.length} cover-text cases plus negative checks).`);
