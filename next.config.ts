import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

function supabaseStorageHostnames() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [] as string[];
  try {
    return [new URL(url).hostname];
  } catch {
    return [] as string[];
  }
}

function supabaseOrigins() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [] as string[];
  try {
    const parsed = new URL(url);
    return [parsed.origin, `wss://${parsed.hostname}`];
  } catch {
    return [] as string[];
  }
}

function sentryBrowserOrigin() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return [] as string[];
  try {
    return [new URL(dsn).origin];
  } catch {
    return [] as string[];
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  `connect-src 'self' ${[
    ...supabaseOrigins(),
    ...sentryBrowserOrigin(),
    "https://tessdata.projectnaptha.com",
  ].join(" ")}`,
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...supabaseStorageHostnames().map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/storage/v1/object/public/**",
      })),
    ],
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "Cross-Origin-Resource-Policy", value: "same-site" },
      ],
    }];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: Boolean(process.env.SENTRY_AUTH_TOKEN),
});
