import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rune — AI-native artifact workspace",
  description: "Create documents, data views, and presentations from readable source with an agent-native workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
