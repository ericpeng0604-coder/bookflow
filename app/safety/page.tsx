import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "交易安全",
  description: "虎科書流校園面交、版本確認、防詐與檢舉建議。",
  alternates: { canonical: "/safety" },
};

export default function SafetyPage() {
  return (
    <main className="policy-page">
      <Link className="policy-back" href="/">← 返回虎科書流</Link>
      <h1>交易與社群安全</h1>
      <section>
        <h2>面交前</h2>
        <ul>
          <li>再次確認課本出版社、版本、冊次、ISBN、書況及價格。</li>
          <li>優先使用站內聊聊保留紀錄，不要提供密碼或驗證碼。</li>
          <li>不要因對方催促而先行匯款或點擊不明付款連結。</li>
        </ul>
      </section>
      <section>
        <h2>面交時</h2>
        <ul>
          <li>選擇校內明亮、有人流的公共場所。</li>
          <li>當場檢查商品內容與功能，確認後再完成付款。</li>
          <li>若實物與刊登不符，可以取消交易並保留聊聊紀錄。</li>
        </ul>
      </section>
      <section>
        <h2>遇到問題</h2>
        <p>可從商品或交易頁檢舉不實內容、詐騙、騷擾或失約；一般網站問題可使用頁尾「問題回報」。若涉及立即人身安全或犯罪風險，請直接聯絡校方或警方。</p>
      </section>
    </main>
  );
}
