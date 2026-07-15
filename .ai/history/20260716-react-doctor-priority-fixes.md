# AI Handoff Archive

- Task: fix priority React Doctor findings
- Actor: codex
- Status: handoff
- Base commit: `db75c82f243bf704c30e80d1238cefbd6e74927a`
- Archived at: 2026-07-16T01:25:00+08:00

---

## 修正摘要

- localStorage 草稿與科系偏好改在 client mount 後讀取。
- ModalShell 與兩個圖片 lightbox 改用原生 dialog。
- 回歸檢查同步驗證 SSR-safe storage 與 dialog 結構。

## 驗證

- TypeScript、ESLint、project checks 27/27、production build 均通過。
- Browser 驗證首頁、dialog 開啟、Escape 關閉及無錯誤狀態均通過。
- React Doctor 目標項目 browser-global 與 prefer-html-dialog 均降至 0。
