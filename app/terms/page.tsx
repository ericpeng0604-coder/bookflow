import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "使用條款",
  description: "虎科書流的帳號、刊登、交易、內容與管理規範。",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="policy-page">
      <Link className="policy-back" href="/">← 返回虎科書流</Link>
      <h1>使用條款</h1>
      <p className="policy-updated">最後更新：2026 年 6 月 22 日</p>
      <section>
        <h2>平台定位</h2>
        <p>虎科書流提供校園課本與二手物品資訊、聊聊及面交協調工具。平台不是交易款項的收受方，也不保證每筆交易一定完成。</p>
      </section>
      <section>
        <h2>帳號與內容</h2>
        <p>使用者必須提供可用的帳號資料，不得冒用他人身分、刊登違法或侵權物品、散布詐騙資訊、騷擾其他使用者，或使用自動化方式濫用通知、AI、檢舉與聊聊功能。</p>
      </section>
      <section>
        <h2>刊登與交易</h2>
        <p>賣家應如實填寫版本、書況、物況、價格與附件。買賣雙方應在面交前再次確認商品、版本及價格。任何一方取消保留時應填寫真實原因。</p>
      </section>
      <section>
        <h2>管理措施</h2>
        <p>平台可對違規刊登進行拒絕、隱藏或下架，並可對濫用帳號限制功能或停權。使用者可透過「問題回報」提出說明或申訴。</p>
      </section>
      <section>
        <h2>服務變更</h2>
        <p>平台可能因維護、安全、法令或第三方服務狀態調整功能。重大政策變更會更新本頁日期與內容。</p>
      </section>
    </main>
  );
}
