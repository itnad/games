/** 스타드래프트 화면 테마 시안(기본 황금 · 전술 단말기 · 종족 색 · 작전 지도 · 보드게임 · 스위스 · 리소 인쇄). 색과 모양은 starswar.css의 data-theme 규칙에 있다. */
/* 화면 테마 시안: 기본(황금) 외에 세 방향을 골라 비교해 본다. 지도(Pixi)는 그대로 두고 화면 틀만 바꾼다. */
export type ThemeId = "gold" | "hud" | "race" | "paper" | "board" | "swiss" | "riso";
export const THEMES: { id: ThemeId; name: string; note: string; light?: boolean }[] = [
  { id: "gold", name: "기본", note: "황금 갑주" },
  { id: "hud", name: "단말기", note: "청록 · 각진" },
  { id: "race", name: "종족 색", note: "종족 따라" },
  { id: "paper", name: "작전 지도", note: "종이 · 연필", light: true },
  { id: "board", name: "보드게임", note: "상자 · 잉크", light: true },
  { id: "swiss", name: "스위스", note: "흑백 · 빨강", light: true },
  { id: "riso", name: "리소 인쇄", note: "분홍 · 청록", light: true },
];
// 시안 글꼴(구글 글꼴). 불러오지 못하면 기기 글꼴로 보인다.
const THEME_FONTS = "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700&family=Do+Hyeon&family=Black+Han+Sans&family=Gowun+Batang:wght@400;700&family=Jua&family=IBM+Plex+Sans+KR:wght@500;700&family=Gugi&display=swap";

/** 테마를 그 화면의 바깥 틀(main)에 붙일 속성. 기본 테마는 속성을 붙이지 않는다. */
export function themeProps(theme: ThemeId, race?: string) {
  const light = THEMES.find((item) => item.id === theme)?.light;
  return theme === "gold" ? {} : { "data-theme": theme, "data-race": race, "data-tone": light ? "light" : undefined };
}

/** 시안 글꼴: 기본이 아닌 테마일 때만 불러온다. */
export function ThemeFonts({ theme }: { theme: ThemeId }) {
  return theme === "gold" ? null : <link rel="stylesheet" href={THEME_FONTS} precedence="default" />;
}

