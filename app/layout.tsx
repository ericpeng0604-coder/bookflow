import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.APP_URL?.startsWith("https://")
  ? process.env.APP_URL
  : "https://bookflow-green.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "虎科書流｜校園課本與二手好物交流",
    template: "%s｜虎科書流",
  },
  description: "虎尾科大校園課本與二手好物交流平台，支援安全面交、站內聊聊、交易通知與課本封面辨識。",
  applicationName: "虎科書流",
  alternates: { canonical: "/" },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "/",
    siteName: "虎科書流",
    title: "虎科書流｜校園課本與二手好物交流",
    description: "讓課本與校園好物找到下一位需要它的人。",
    images: [{ url: "/icon.svg", width: 512, height: 512, alt: "虎科書流" }],
  },
  twitter: {
    card: "summary",
    title: "虎科書流｜校園課本與二手好物交流",
    description: "讓課本與校園好物找到下一位需要它的人。",
    images: ["/icon.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1d6a57",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
