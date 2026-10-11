import type { Metadata } from "next";
import { MudflatDevTools } from "../mudflat-dev-tools";

export const metadata: Metadata = {
  title: "해루질럿 개발용 도구",
  robots: { index: false, follow: false },
};

export default function HaeruDevPage() {
  return <MudflatDevTools />;
}
