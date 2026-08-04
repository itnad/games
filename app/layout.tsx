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
import "./clocktowers.css";
import "./game-readability.css";
import "./casual-games.css";
import "./paper-dungeon.css";
import "./ten-seconds.css";
import "./mudflat-survivor.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://games.itnadcom.chatgpt.site"),
  title: "paperoid — AI 보드게임 아지트",
  description: "오목, 장기, 시계탑, 종이 던전, 10.00, 갯벌 한탕 등 마흔 가지 보드게임·캐주얼 게임·RPG를 즐기는 paperoid 게임 아지트",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "paperoid — AI 보드게임 아지트",
    description: "마흔 가지 보드게임과 캐주얼 게임, RPG를 바로 즐겨보세요.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "paperoid AI Board Game Club" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "paperoid — AI 보드게임 아지트",
    description: "마흔 가지 보드게임과 캐주얼 게임, RPG를 바로 즐겨보세요.",
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
