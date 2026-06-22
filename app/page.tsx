import "./home-a11y.css";
import { MarketplaceApp } from "@/components/marketplace-app";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#market">
        跳到市場列表
      </a>
      <MarketplaceApp />
    </>
  );
}
