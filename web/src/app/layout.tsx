import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { NoteButton } from "../components/trial/NoteButton";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const noto = Noto_Sans_JP({ variable: "--font-noto", weight: ["400", "500", "700", "900"], preload: false, display: "swap" });

export const metadata: Metadata = {
  title: "葬儀の打合せ支援（仮称）",
  description: "遺族が数日のうちに迫られる難しい決定を、ベテランの判断と実データで支える",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${inter.variable} ${noto.variable}`}>
      <body>
        {children}
        {/* 試用で公開するときだけ出す（発表の録画には出さない） */}
        {process.env.NEXT_PUBLIC_TRIAL_MODE === "1" && <NoteButton />}
      </body>
    </html>
  );
}
