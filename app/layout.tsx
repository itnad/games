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
  description: "오목, 장기, 스코틀랜드 야드, 러브레터, 미니빌, 픽 피크닉, SD 간담 디럭스 등 스물네 가지 게임을 AI와 즐기는 온라인 보드게임 플레이룸",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "PLAYROOM — AI 보드게임 아지트",
    description: "스물네 가지 보드게임을 AI와 바로 즐겨보세요.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "PLAYROOM AI Board Game Club" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PLAYROOM — AI 보드게임 아지트",
    description: "스물네 가지 보드게임을 AI와 바로 즐겨보세요.",
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
