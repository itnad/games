import type { Metadata } from "next";
import { DevelopmentPreview } from "../stark-rift/ui/development-preview";

export const metadata: Metadata = {
  title: "스타크 리프트 개발 테스트 | paperoid",
  description: "스타크 리프트의 채취·건설·생산을 직접 확인하는 세로 화면 개발 테스트입니다.",
  robots: { index: false, follow: false },
};

export default function StarkRiftDevPage() {
  return <DevelopmentPreview />;
}
