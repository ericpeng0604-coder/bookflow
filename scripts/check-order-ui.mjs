import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("components/marketplace-app.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");
const source = `${app}\n${css}`;

for (const marker of [
  "cartConfirmationOpen",
  "確認送出訂單",
  "送出 ${groups.length} 筆賣家訂單",
  "希望面交地點",
  "希望面交時間",
  "chat-context-link",
  "bottom: calc(100% + 6px)",
  "seller-row .trust-badge",
  "order-confirmation-summary",
  "RequestOrderConfirmationModal",
  "requestFormRef",
  "confirmationOpen",
]) {
  assert.ok(source.includes(marker), `missing order/UI marker: ${marker}`);
}

console.log("Order/UI annotation checks passed (12/12)");
