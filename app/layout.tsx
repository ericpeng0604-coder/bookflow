import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "虎科書流 | 校園二手書",
  description: "讓用過的課本，找到下一位需要它的人。",
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
