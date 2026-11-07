import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const noto = Noto_Sans_JP({ variable: "--font-noto", weight: ["400", "500", "700", "900"], preload: false, display: "swap" });

export const metadata: Metadata = {
  title: "sou-buddy",
  description: "決めることと、覚えておくことは、sou-buddy に。担当者とご遺族の意思決定と認知負荷を支え、悔いのないお別れに気持ちを向けられるように",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${inter.variable} ${noto.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
