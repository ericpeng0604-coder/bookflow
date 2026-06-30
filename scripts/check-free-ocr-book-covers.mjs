import { strict as assert } from "node:assert";
import {
  extractBookDraftFromOcr,
  isReliableBookOcrResult,
} from "../lib/marketplace/free-ocr.ts";

const examples = [
  {
    name: "普通物理學下冊",
    ocr: "下冊 普通物理學 Essential University Physics, 4e 原著 Richard Wolfson 譯者 林誠孝 羅煜聘 洪耀正 蔡振凱 Pearson 高立圖書",
    expected: {
      title: "普通物理學",
      author: "Richard Wolfson",
      edition: "下冊 / Essential University Physics, 4e",
      publisher: "Pearson、高立圖書",
    },
  },
  {
    name: "普通物理學上冊",
    ocr: "上冊 普通物理學 Essential University Physics, 4e 原著 Richard Wolfson Pearson 高立圖書",
    expected: {
      title: "普通物理學",
      author: "Richard Wolfson",
      edition: "上冊 / Essential University Physics, 4e",
      publisher: "Pearson、高立圖書",
    },
  },
  {
    name: "普通物理學括號上冊",
    ocr: "[上冊]\n普通物理學\nEssential University Physics, 4e\n原著 Richard Wolfson\nPearson 高立圖書",
    expected: {
      title: "普通物理學",
      author: "Richard Wolfson",
      edition: "上冊 / Essential University Physics, 4e",
      publisher: "Pearson、高立圖書",
    },
  },
  {
    name: "Live Escalate Trekking",
    ocr: "Live Escalate Trekking CEFR B1 3 Student's Book LiveABC",
    expected: {
      title: "Live Escalate Trekking",
      edition: "Student's Book 3 / CEFR B1",
      publisher: "LiveABC",
    },
  },
  {
    name: "基本電學",
    ocr: "基本電學 精華版 第5版 賴柏洲 編著 全華",
    expected: {
      title: "基本電學",
      author: "賴柏洲",
      edition: "精華版 第5版",
      publisher: "全華",
    },
  },
  {
    name: "電工實習",
    ocr: "電工實習 交直流電路 鄧榮斌 編著 全華",
    expected: {
      title: "電工實習：交直流電路",
      author: "鄧榮斌",
      publisher: "全華",
    },
  },
  {
    name: "機械製造概論",
    ocr: "Manufacturing Engineering and Technology, 7e 機械製造概論 SI制 Serope Kalpakjian Steven R. Schmid 原著 蘇春燁 譯者 Pearson 高立圖書",
    expected: {
      title: "機械製造概論",
      author: "Serope Kalpakjian、Steven R. Schmid",
      edition: "SI制 / 7e",
      publisher: "Pearson、高立圖書",
    },
  },
  {
    name: "國文新視野",
    ocr: "國文新視野 Chinese New Vision 王妙純 周玉珠 莊美淑 王文仁 烏寧萍 編著 五南出版",
    expected: {
      title: "國文新視野",
      author: "王妙純、周玉珠、莊美淑、王文仁、烏寧萍",
      publisher: "五南出版",
    },
  },
  {
    name: "AutoCAD 2020",
    ocr: "電腦輔助繪圖 AutoCAD 2020 附多媒體光碟 CD-ROM 王雪娥 陳進煌 編著 全華",
    expected: {
      title: "電腦輔助繪圖 AutoCAD 2020",
      author: "王雪娥、陳進煌",
      publisher: "全華",
    },
  },
];

for (const example of examples) {
  const draft = extractBookDraftFromOcr(example.ocr);
  for (const [field, value] of Object.entries(example.expected)) {
    assert.equal(draft[field], value, `${example.name}: expected ${field} to be ${value}, got ${draft[field]}`);
  }
}

const mobilePhysicsText = [
  "Essantinl Umvorstty Physicd de",
  "Pearson",
].join("\n");
const mobilePhysicsDraft = extractBookDraftFromOcr(mobilePhysicsText);
assert.equal(mobilePhysicsDraft.title, "普通物理學", "fuzzy mobile OCR should recover the known physics title");
assert.equal(mobilePhysicsDraft.author, "Richard Wolfson", "known cover hint should recover the author");
assert.equal(
  isReliableBookOcrResult(mobilePhysicsText, mobilePhysicsDraft, 27),
  true,
  "a unique fuzzy known-cover match should remain usable at low OCR confidence",
);

const mobileGarbageText = "ee7讖呈人mmY—VierieNGsewig2RERATSie";
const mobileGarbageDraft = extractBookDraftFromOcr(mobileGarbageText);
assert.equal(mobileGarbageDraft.title, undefined, "mixed-script mobile OCR garbage must not become a title");
assert.equal(
  isReliableBookOcrResult(mobileGarbageText, mobileGarbageDraft, 74),
  false,
  "high engine confidence must not override field plausibility checks",
);

console.log(`Free OCR book cover checks passed (${examples.length + 2}/${examples.length + 2}).`);
