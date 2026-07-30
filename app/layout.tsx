import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./confrontation.css";
import "./love-letter.css";
import "./miniville.css";
import "./pick-picnic.css";
import "./epic-duels.css";
import "./sd-gundam-deluxe.css";
import "./scotland-yard.css";
import "./whitechapel.css";
import "./seven-wonders.css";
import "./camel-up.css";
import "./tichu.css";
import "./cashflow-escape.css";
import "./baccarat.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://playroom-ai-boardgames.itnadcom.chatgpt.site"),
  title: "PLAYROOM — AI 보드게임 아지트",
  description: "오목, 장기, 7원더스, 카멜 업, 티츄, 바카라, 현금흐름 탈출, 스코틀랜드 야드, 화이트채플, 러브레터, 미니빌 등 서른 가지 게임을 AI와 즐기는 온라인 보드게임 플레이룸",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "PLAYROOM — AI 보드게임 아지트",
    description: "서른 가지 보드게임을 AI와 바로 즐겨보세요.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "PLAYROOM AI Board Game Club" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PLAYROOM — AI 보드게임 아지트",
    description: "서른 가지 보드게임을 AI와 바로 즐겨보세요.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
