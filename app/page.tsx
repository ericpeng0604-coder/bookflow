import "./home-a11y.css";
import { MarketplaceApp } from "@/components/marketplace-app";
import type { DashboardTab, MarketplaceView } from "@/components/marketplace/navigation-state";

const DASHBOARD_TABS = new Set<DashboardTab>(["listings", "chats", "requests", "received", "confirmedOrders", "favorites", "studentVerification"]);

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const initialView: MarketplaceView = firstParam(params.view) === "dashboard" ? "dashboard" : "home";
  const tab = firstParam(params.tab);
  const initialDashboardTab: DashboardTab = tab && DASHBOARD_TABS.has(tab as DashboardTab) ? tab as DashboardTab : "listings";

  return (
    <>
      <a className="skip-link" href="#market">
        跳到市場列表
      </a>
      <MarketplaceApp initialView={initialView} initialDashboardTab={initialDashboardTab} />
    </>
  );
}
