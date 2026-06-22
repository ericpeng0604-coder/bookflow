import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "隱私權政策",
  description: "虎科書流如何處理帳號、交易、圖片、推播及 AI 封面辨識資料。",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="policy-page">
      <Link className="policy-back" href="/">← 返回虎科書流</Link>
      <h1>隱私權政策</h1>
      <p className="policy-updated">最後更新：2026 年 6 月 22 日</p>
      <section>
        <h2>我們處理哪些資料</h2>
        <p>帳號登入由 Supabase Auth 處理。平台會保存姓名、Email、系所、刊登、交易、聊聊、檢舉及必要的操作紀錄。聯絡方式只會在賣家接受交易後，依賣家的選擇提供給被選定的買家。</p>
      </section>
      <section>
        <h2>圖片與 AI</h2>
        <p>刊登圖片會保存於 Supabase Storage。課本本機辨識不足時，封面會短暫傳送至 Google Gemini 進行欄位辨識；BookFlow 不保存該次 AI 請求的圖片或模型原始回覆。學生證圖片只供人工資格審核，審核完成後立即刪除圖片與 OCR 文字，審核紀錄最多保留 30 天。</p>
      </section>
      <section>
        <h2>第三方服務</h2>
        <p>網站使用 Vercel 提供網頁服務、Supabase 提供帳號與資料庫、Google 提供 OAuth 與 Gemini、Resend 或設定的郵件服務提供通知信，以及瀏覽器 Web Push 提供裝置通知。</p>
      </section>
      <section>
        <h2>保存與刪除</h2>
        <p>推播訂閱可隨時關閉。下架刊登及交易紀錄依平台保留政策處理；非必要的敏感驗證資料會自動清除。登入後可從「個人資料」執行帳號刪除：平台會移除登入帳號、公開個資、非必要圖片與推播訂閱，並以匿名方式保留必要的交易、防詐與管理稽核紀錄。</p>
      </section>
      <section>
        <h2>安全提醒</h2>
        <p>請勿在商品說明、聊聊或問題回報中提供密碼、驗證碼、付款卡號或身分證字號。平台不會透過聊聊要求你提供登入密碼或一次性驗證碼。</p>
      </section>
    </main>
  );
}
