"use client";

import { useEffect, useRef } from "react";

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileOptions = {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  language?: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __bookflowTurnstileScript?: Promise<void>;
  }
}

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("Turnstile requires a browser"));
  if (window.turnstile) return Promise.resolve();
  if (window.__bookflowTurnstileScript) return window.__bookflowTurnstileScript;

  window.__bookflowTurnstileScript = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${TURNSTILE_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
  }).catch((error) => {
    window.__bookflowTurnstileScript = undefined;
    throw error;
  });

  return window.__bookflowTurnstileScript;
}

export function TurnstileWidget({
  siteKey,
  action,
  resetKey = 0,
  onToken,
  onError,
}: {
  siteKey: string;
  action: string;
  resetKey?: number;
  onToken: (token: string) => void;
  onError?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onError, onToken]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let active = true;

    void loadTurnstileScript()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: "light",
          language: "zh-tw",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => {
            onTokenRef.current("");
            onErrorRef.current?.();
          },
        });
      })
      .catch(() => {
        if (active) {
          onTokenRef.current("");
          onErrorRef.current?.();
        }
      });

    return () => {
      active = false;
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetIdRef.current = null;
    };
  }, [action, resetKey, siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="turnstile-widget" aria-label="Cloudflare 安全驗證" />;
}
