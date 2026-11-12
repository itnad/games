import type { Metadata } from "next";
import { BaksalPrototype } from "./baksal-prototype";

export const metadata: Metadata = {
  title: "박살: 리듬 AR 퇴마 댄싱 (0단계 검증) | paperoid",
  description: "박자에 맞춰 날아오는 악귀의 화염을 몸으로 피하고, 박자에 맞춰 조준해 쏘는 제자리 리듬 AR 퇴마 런의 0단계 검증 화면입니다.",
  robots: { index: false, follow: false },
};

export default function BaksalPage() {
  return <BaksalPrototype />;
}
