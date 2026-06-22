#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  extractTaiwanTextbookMetadata,
  rankTaiwanTextbookCandidates,
} from "../lib/marketplace/taiwan-textbook.ts";

const holdout = [
  ["康 軒 文教 國民中學 數學 七年級 上冊 108 課綱", { publisher: "康軒", educationLevel: "junior_high", grade: "7", semester: "first", subject: "數學", curriculum: "108課綱" }],
  ["南一書局 國小 五下 自然 習作", { publisher: "南一", educationLevel: "elementary", grade: "5", semester: "second", subject: "自然", bookType: "workbook" }],
  ["龍騰文化 普通型高級中等學校 英文 必修 I", { publisher: "龍騰", educationLevel: "senior_high", subject: "英文", volume: "必修I" }],
  ["泰宇出版 技術型高級中等學校 基本電學 高二 下冊", { publisher: "泰宇", educationLevel: "vocational_high", grade: "高2", semester: "second", subject: "基本電學" }],
  ["三民書局 高中 歷史 高一 上學期", { publisher: "三民", educationLevel: "senior_high", grade: "高1", semester: "first", subject: "歷史" }],
  ["全華圖書 高職 電子學 高三 上冊", { publisher: "全華", educationLevel: "vocational_high", grade: "高3", semester: "first", subject: "電子學" }],
  ["東大圖書 大學 國文", { publisher: "東大", educationLevel: "university", subject: "國文" }],
  ["育達文化 技高 電路學 高一 下學期", { publisher: "育達", educationLevel: "vocational_high", grade: "高1", semester: "second", subject: "電路學" }],
  ["翰林文教 國民小學 社會 第三冊", { publisher: "翰林", educationLevel: "elementary", subject: "社會", volume: "第3冊" }],
  ["康軒版 國中 地球科學 八年級 下冊", { publisher: "康軒", educationLevel: "junior_high", grade: "8", semester: "second", subject: "地球科學" }],
  ["南一出版 國民中學 公民 九年級 上學期", { publisher: "南一", educationLevel: "junior_high", grade: "9", semester: "first", subject: "公民" }],
  ["龍騰 高中 化學 選修 Ⅱ 108課綱", { publisher: "龍騰", educationLevel: "senior_high", subject: "化學", volume: "選修II", curriculum: "108課綱" }],
  ["泰宇版 高級中學 生物 教師用書", { publisher: "泰宇", educationLevel: "senior_high", subject: "生物", bookType: "teacher_guide" }],
  ["三民版 高中 地理 自修", { publisher: "三民", educationLevel: "senior_high", subject: "地理", bookType: "reference" }],
  ["全華版 高職 機械製造 題庫", { publisher: "全華", educationLevel: "vocational_high", subject: "機械製造", bookType: "assessment" }],
  ["國一數學 翰林版 上冊", { publisher: "翰林", grade: "7", semester: "first", subject: "數學" }],
  ["國二自然 康軒 下學期", { publisher: "康軒", grade: "8", semester: "second", subject: "自然" }],
  ["國三英文 南一 上冊", { publisher: "南一", grade: "9", semester: "first", subject: "英文" }],
  ["高中 資訊科技 必修 2", { educationLevel: "senior_high", subject: "資訊科技", volume: "必修2" }],
  ["十二年國教 國民小學 六年級 數學 下冊", { educationLevel: "elementary", grade: "6", semester: "second", subject: "數學", curriculum: "108課綱" }],
];

let expectedFields = 0;
let matchedFields = 0;
let unexpectedFields = 0;

for (const [text, expected] of holdout) {
  const actual = extractTaiwanTextbookMetadata(text);
  for (const [field, value] of Object.entries(expected)) {
    expectedFields += 1;
    if (actual[field] === value) matchedFields += 1;
  }
  for (const [field, value] of Object.entries(actual)) {
    if (value && !(field in expected)) unexpectedFields += 1;
  }
}

const recall = matchedFields / expectedFields;
const precision = matchedFields / Math.max(matchedFields + unexpectedFields, 1);
assert.ok(recall >= 0.95, `holdout recall ${recall.toFixed(3)} is below 0.95`);
assert.ok(precision >= 0.9, `holdout precision ${precision.toFixed(3)} is below 0.90`);

const ranked = rankTaiwanTextbookCandidates([
  { source: "front_ocr", confidence: 90, draft: { publisher: "翰林", subject: "數學" } },
  { source: "barcode", confidence: 80, draft: { isbn13: "9789570000018" } },
  { source: "back_ocr", confidence: 95, draft: { subject: "數學" } },
]);
assert.equal(ranked[0].source, "barcode", "strong ISBN evidence should rank first");

console.log(JSON.stringify({
  benchmark: "taiwan-textbook-holdout",
  cases: holdout.length,
  expectedFields,
  matchedFields,
  unexpectedFields,
  recall: Number(recall.toFixed(3)),
  precision: Number(precision.toFixed(3)),
}));
