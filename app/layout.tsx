import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  description: "오목, 장기, 나인 멘스 모리스, 고누, 도미노, 백개먼, 차이니즈 체커, 다이아몬드 게임 등 열다섯 가지 게임을 AI와 즐기는 온라인 보드게임 플레이룸",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "PLAYROOM — AI 보드게임 아지트",
    description: "열다섯 가지 보드게임을 AI와 바로 즐겨보세요.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "PLAYROOM AI Board Game Club" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PLAYROOM — AI 보드게임 아지트",
    description: "열다섯 가지 보드게임을 AI와 바로 즐겨보세요.",
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
