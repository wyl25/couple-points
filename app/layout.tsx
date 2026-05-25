import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Couple Points",
  description: "A shared points system for couples and small groups."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
