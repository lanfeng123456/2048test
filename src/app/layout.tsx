import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2048",
  description: "Play 2048 — Next.js + Postgres + Better Auth",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
