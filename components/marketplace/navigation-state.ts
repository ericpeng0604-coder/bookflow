import { useCallback, useEffect, useRef, useState } from "react";

import type { ListingType, Profile } from "@/lib/types";

export type MarketplaceView = "home" | "book" | "seller" | "dashboard" | "chat" | "admin";
export type DashboardTab = "listings" | "chats" | "requests" | "received" | "confirmedOrders" | "favorites" | "studentVerification";
export type AdminWorkspace = "overview" | "listings" | "reports" | "feedback" | "studentVerification" | "risk" | "hiddenListings" | "permissions";

const dashboardTabs = new Set<DashboardTab>(["listings", "chats", "requests", "received", "confirmedOrders", "favorites", "studentVerification"]);
const adminWorkspaces = new Set<AdminWorkspace>(["overview", "listings", "reports", "feedback", "studentVerification", "risk", "hiddenListings", "permissions"]);

type RouteHandlers = {
  onListingTypeChange: (listingType: ListingType) => void;
  onBookRouteChange: () => void;
  onSellerRouteChange: (sellerId: string | null) => void;
  onConversationRoute: (conversationId: string) => void | Promise<void>;
};

type UseMarketplaceNavigationOptions = RouteHandlers & {
  ready: boolean;
  listingType: ListingType;
  currentUser: Profile | null;
  expandedConversationId: string | null;
  lastConversationId: string | null;
  onExpandedConversationChange: (conversationId: string | null) => void;
  initialView?: MarketplaceView;
  initialDashboardTab?: DashboardTab;
};

type BuildMarketplaceUrlOptions = {
  listingType: ListingType;
  view: MarketplaceView;
  selectedId: string | null;
  sellerId: string | null;
  currentUser: Profile | null;
  dashboardTab: DashboardTab;
  adminWorkspace: AdminWorkspace;
  expandedConversationId: string | null;
};

export function isDashboardTab(value: string | null): value is DashboardTab {
  return dashboardTabs.has(value as DashboardTab);
}

export function isAdminWorkspace(value: string | null): value is AdminWorkspace {
  return adminWorkspaces.has(value as AdminWorkspace);
}

export function buildChatUrl(listingType: ListingType, conversationId?: string | null) {
  const params = new URLSearchParams();
  params.set("market", listingType);
  params.set("view", "chat");
  params.set("tab", "chats");
  if (conversationId) params.set("conversation", conversationId);
  return "/?" + params.toString();
}

export function buildMarketplaceUrl({
  listingType,
  view,
  selectedId,
  sellerId,
  currentUser,
  dashboardTab,
  adminWorkspace,
  expandedConversationId,
}: BuildMarketplaceUrlOptions) {
  const params = new URLSearchParams();
  params.set("market", listingType);
  if (view === "seller" && sellerId) {
    params.set("view", "seller");
    params.set("seller", sellerId);
  } else if (view === "book" && selectedId) {
    params.set("view", "book");
    params.set("book", selectedId);
  } else if (view === "chat" && currentUser) {
    return buildChatUrl(listingType, expandedConversationId);
  } else if (view === "dashboard" && currentUser) {
    params.set("view", "dashboard");
    params.set("tab", dashboardTab);
  } else if (view === "admin" && currentUser) {
    params.set("view", "admin");
    params.set("adminTab", adminWorkspace);
  }
  return "/?" + params.toString();
}

export function useMarketplaceNavigation({
  ready,
  listingType,
  currentUser,
  expandedConversationId,
  lastConversationId,
  onExpandedConversationChange,
  initialView = "home",
  initialDashboardTab = "listings",
  onListingTypeChange,
  onBookRouteChange,
  onSellerRouteChange,
  onConversationRoute,
}: UseMarketplaceNavigationOptions) {
  const [view, setView] = useState<MarketplaceView>(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>(initialDashboardTab);
  const [adminWorkspace, setAdminWorkspace] = useState<AdminWorkspace>("overview");
  const skipNextUrlWriteRef = useRef(false);
  const handlersRef = useRef<RouteHandlers>({
    onListingTypeChange,
    onBookRouteChange,
    onSellerRouteChange,
    onConversationRoute,
  });

  useEffect(() => {
    handlersRef.current = {
      onListingTypeChange,
      onBookRouteChange,
      onSellerRouteChange,
      onConversationRoute,
    };
  }, [onBookRouteChange, onConversationRoute, onListingTypeChange, onSellerRouteChange]);

  const clearSellerRoute = useCallback(() => {
    setSellerId(null);
    handlersRef.current.onSellerRouteChange(null);
  }, []);

  const applyCurrentRoute = useCallback((options?: { openConversation?: boolean }) => {
    const params = new URLSearchParams(window.location.search);
    const targetMarket = params.get("market");
    if (targetMarket === "book" || targetMarket === "secondhand" || targetMarket === "giveaway") {
      handlersRef.current.onListingTypeChange(targetMarket);
    }

    const targetView = params.get("view");
    const targetSeller = params.get("seller");
    if (targetView === "seller" && targetSeller) {
      setSelectedId(null);
      setSellerId(targetSeller);
      handlersRef.current.onBookRouteChange();
      handlersRef.current.onSellerRouteChange(targetSeller);
      setView("seller");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
      return;
    }

    const targetBook = params.get("book");
    if (targetView === "book" && targetBook) {
      clearSellerRoute();
      setSelectedId(targetBook);
      handlersRef.current.onBookRouteChange();
      setView("book");
      return;
    }

    if (targetView === "chat") {
      clearSellerRoute();
      if (!currentUser) return;
      setDashboardTab("chats");
      onExpandedConversationChange(params.get("conversation"));
      setView("chat");
      const targetConversation = params.get("conversation");
      if (targetConversation && options?.openConversation) {
        void handlersRef.current.onConversationRoute(targetConversation);
      }
      return;
    }

    if (targetView === "dashboard") {
      clearSellerRoute();
      if (!currentUser) return;
      const targetTab = params.get("tab");
      if (targetTab === "chats") {
        setDashboardTab("chats");
        onExpandedConversationChange(params.get("conversation"));
        setView("chat");
        const targetConversation = params.get("conversation");
        if (targetConversation && options?.openConversation) {
          void handlersRef.current.onConversationRoute(targetConversation);
        }
        return;
      }
      setView("dashboard");
      if (isDashboardTab(targetTab)) setDashboardTab(targetTab);
      onExpandedConversationChange(null);
      return;
    }

    if (targetView === "admin") {
      clearSellerRoute();
      if (!currentUser || !["admin", "moderator"].includes(currentUser.role)) return;
      setView("admin");
      const targetWorkspace = params.get("adminTab");
      if (isAdminWorkspace(targetWorkspace)) setAdminWorkspace(targetWorkspace);
      return;
    }

    clearSellerRoute();
    setSelectedId(null);
    onExpandedConversationChange(null);
    handlersRef.current.onBookRouteChange();
    setView("home");
  }, [clearSellerRoute, currentUser, onExpandedConversationChange]);

  useEffect(() => {
    if (!ready) return;
    skipNextUrlWriteRef.current = true;
    applyCurrentRoute({ openConversation: true });
  }, [applyCurrentRoute, ready]);

  useEffect(() => {
    if (!ready) return;
    const restorePublicNavigation = () => applyCurrentRoute();
    window.addEventListener("popstate", restorePublicNavigation);
    return () => window.removeEventListener("popstate", restorePublicNavigation);
  }, [applyCurrentRoute, ready]);

  useEffect(() => {
    if (!ready) return;
    if (skipNextUrlWriteRef.current) {
      skipNextUrlWriteRef.current = false;
      return;
    }
    const nextUrl = buildMarketplaceUrl({
      listingType,
      view,
      selectedId,
      sellerId,
      currentUser,
      dashboardTab,
      adminWorkspace,
      expandedConversationId,
    });
    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [adminWorkspace, currentUser, dashboardTab, expandedConversationId, listingType, ready, selectedId, sellerId, view]);

  useEffect(() => {
    if (view !== "dashboard" || dashboardTab !== "chats" || expandedConversationId || !lastConversationId) return;
    onExpandedConversationChange(lastConversationId);
  }, [dashboardTab, expandedConversationId, lastConversationId, onExpandedConversationChange, view]);

  const openBookRoute = useCallback((bookId: string, market: ListingType) => {
    clearSellerRoute();
    setSelectedId(bookId);
    handlersRef.current.onBookRouteChange();
    setView("book");
    window.history.pushState({}, "", buildMarketplaceUrl({
      listingType: market,
      view: "book",
      selectedId: bookId,
      sellerId: null,
      currentUser,
      dashboardTab,
      adminWorkspace,
      expandedConversationId,
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [adminWorkspace, clearSellerRoute, currentUser, dashboardTab, expandedConversationId]);

  const openSellerRoute = useCallback((nextSellerId: string) => {
    const marketScrollY = window.scrollY;
    setSelectedId(null);
    setSellerId(nextSellerId);
    handlersRef.current.onBookRouteChange();
    handlersRef.current.onSellerRouteChange(nextSellerId);
    setView("seller");
    window.history.pushState(
      { marketScrollY },
      "",
      buildMarketplaceUrl({
        listingType,
        view: "seller",
        selectedId: null,
        sellerId: nextSellerId,
        currentUser,
        dashboardTab,
        adminWorkspace,
        expandedConversationId,
      }),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [adminWorkspace, currentUser, dashboardTab, expandedConversationId, listingType]);

  const returnToMarketRoute = useCallback(() => {
    clearSellerRoute();
    setSelectedId(null);
    handlersRef.current.onBookRouteChange();
    setView("home");
    window.history.pushState({}, "", buildMarketplaceUrl({
      listingType,
      view: "home",
      selectedId: null,
      sellerId: null,
      currentUser,
      dashboardTab,
      adminWorkspace,
      expandedConversationId,
    }));
  }, [adminWorkspace, clearSellerRoute, currentUser, dashboardTab, expandedConversationId, listingType]);

  const openDashboard = useCallback(() => {
    clearSellerRoute();
    setView("dashboard");
    setDashboardTab("listings");
    onExpandedConversationChange(null);
  }, [clearSellerRoute, onExpandedConversationChange]);

  const returnToChatListRoute = useCallback(() => {
    clearSellerRoute();
    setDashboardTab("chats");
    onExpandedConversationChange(null);
    setView("chat");
    const params = new URLSearchParams(window.location.search);
    params.set("market", listingType);
    params.set("view", "chat");
    params.set("tab", "chats");
    params.delete("conversation");
    window.history.replaceState({}, "", "/?" + params.toString());
  }, [clearSellerRoute, listingType, onExpandedConversationChange]);

  return {
    adminWorkspace,
    dashboardTab,
    expandedConversationId,
    openBookRoute,
    openDashboard,
    openSellerRoute,
    returnToChatListRoute,
    returnToMarketRoute,
    selectedId,
    sellerId,
    setDashboardTab,
    setAdminWorkspace,
    setExpandedConversationId: onExpandedConversationChange,
    setSelectedId,
    setView,
    view,
  };
}