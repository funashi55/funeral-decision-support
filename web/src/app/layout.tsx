import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const noto = Noto_Sans_JP({ variable: "--font-noto", weight: ["400", "500", "700", "900"], preload: false, display: "swap" });

export const metadata: Metadata = {
  title: "sou-buddy",
  description: "葬儀の担当者のそばで、その人の接客のスタイルに合わせて育つバディ",
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
