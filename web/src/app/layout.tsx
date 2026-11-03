import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const noto = Noto_Sans_JP({ variable: "--font-noto", weight: ["400", "500", "700", "900"], preload: false, display: "swap" });

export const metadata: Metadata = {
  title: "葬儀の打合せ支援（仮称）",
  description: "遺族が数日のうちに迫られる難しい決定を、ベテランの判断と実データで支える",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${inter.variable} ${noto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
