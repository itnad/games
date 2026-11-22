"use client";

// 스타드래프트 AI vs AI 설정: 양쪽 종족·맵과 모드(전략 선택 / 정찰 대응)를 고르고, AI끼리 처음부터 겨루는 경기를 세운다.
import { useState } from "react";
import { STW_AI_PERSONAS, STW_MAPS, STW_MAP_IDS, STW_RACES } from "./starswar-data.js";
import type { StwMapId, StwRaceId } from "./starswar-types";
import { ThemeFonts, themeProps, type ThemeId } from "./starswar-theme";

export type WatchRace = StwRaceId | "random";
/** pick: 양쪽 전략을 고르거나 무작위로 둔다. react: 양쪽 AI가 정찰로 상대 전략을 읽고 맞대응 전략으로 갈아탄다. */
export type WatchMode = "pick" | "react";
export type WatchSide = "player" | "enemy";
export type WatchConfig = {
  mode: WatchMode;
  races: Record<WatchSide, WatchRace>;
  /** 전략 선택 모드에서 고른 전략(null이면 무작위). 종족이 무작위면 쓰지 않는다. */
  personas: Record<WatchSide, string | null>;
  map: StwMapId | "random";
};

export const DEFAULT_WATCH: WatchConfig = { mode: "pick", races: { player: "random", enemy: "random" }, personas: { player: null, enemy: null }, map: "plain" };

type PersonaDef = { id: string; race: StwRaceId; name: string; note: string };
const RACE_CHOICES: WatchRace[] = ["protoss", "terran", "zerg", "random"];
const MAP_CHOICES: WatchConfig["map"][] = [...(STW_MAP_IDS as StwMapId[]), "random"];
const SIDES: { id: WatchSide; title: string; where: string }[] = [
  { id: "player", title: "파랑", where: "아래" },
  { id: "enemy", title: "빨강", where: "위" },
];
const MODES: { id: WatchMode; name: string; note: string }[] = [
  { id: "pick", name: "전략 선택", note: "양쪽 전략을 직접 고르거나 무작위로 둡니다. AI는 고른 전략의 빌드 순서로 시작합니다." },
  { id: "react", name: "정찰 대응", note: "양쪽 모두 무작위 전략으로 시작해, 정찰로 상대 전략을 읽고 그에 강한 전략으로 갈아탑니다. 읽은 전략과 갈아탄 시각은 관전 화면에 나옵니다." },
];

function racePersonas(race: StwRaceId) {
  return (Object.values(STW_AI_PERSONAS) as PersonaDef[]).filter((persona) => persona.race === race);
}

export function WatchScreen({ initial, onStart, onBack, theme }: { initial: WatchConfig; onStart: (config: WatchConfig) => void; onBack: () => void; theme: ThemeId }) {
  const [config, setConfig] = useState<WatchConfig>(initial);
  // 종족을 바꾸면 그 쪽의 전략 선택을 비운다(다른 종족의 전략은 쓸 수 없다).
  const setRace = (side: WatchSide, race: WatchRace) => setConfig((current) => ({ ...current, races: { ...current.races, [side]: race }, personas: { ...current.personas, [side]: null } }));
  const setPersona = (side: WatchSide, persona: string | null) => setConfig((current) => ({ ...current, personas: { ...current.personas, [side]: persona } }));
  const mode = MODES.find((item) => item.id === config.mode) ?? MODES[0];
  return (
    <main className="stw-shell stw-menu-shell" data-game-menu="true" {...themeProps(theme)}>
      <ThemeFonts theme={theme} />
      <header className="stw-topbar">
        <button type="button" onClick={onBack} aria-label="메인 화면으로">←</button>
        <div><span className="stw-brand">스타드래프트</span><strong>AI vs AI</strong></div>
      </header>
      <section className="stw-menu stw-watch-setup">
        <p className="stw-hint">양쪽 모두 AI가 처음부터(일꾼 4기, 광물 50) 운영하는 경기를 지켜봅니다. 조작할 수 없고 전장 전체가 보입니다. 전적과 이어하기에는 남지 않습니다.</p>
        <h3 className="stw-section">모드</h3>
        <div className="stw-segment two" role="radiogroup" aria-label="모드">
          {MODES.map((item) => (
            <button key={item.id} type="button" role="radio" aria-checked={config.mode === item.id} className={config.mode === item.id ? "active" : ""} onClick={() => setConfig((current) => ({ ...current, mode: item.id }))}>{item.name}</button>
          ))}
        </div>
        <p className="stw-hint">{mode.note}</p>
        {SIDES.map((side) => {
          const race = config.races[side.id];
          const picked = config.personas[side.id];
          const persona = race !== "random" && picked ? racePersonas(race).find((item) => item.id === picked) ?? null : null;
          return (
            <div key={side.id} className={`stw-watch-pick ${side.id}`}>
              <h3 className="stw-section"><i aria-hidden="true" />{side.title} 진영 ({side.where})</h3>
              <div className="stw-segment" role="radiogroup" aria-label={`${side.title} 종족`}>
                {RACE_CHOICES.map((id) => (
                  <button key={id} type="button" role="radio" aria-checked={race === id} className={race === id ? "active" : ""} onClick={() => setRace(side.id, id)}>{id === "random" ? "무작위" : STW_RACES[id].name}</button>
                ))}
              </div>
              {config.mode === "pick" ? (
                race === "random" ? <p className="stw-hint">종족이 무작위면 전략도 그 종족의 전략 중 하나로 무작위로 정해집니다.</p> : (
                  <>
                    <div className="stw-lab-chips" role="radiogroup" aria-label={`${side.title} 전략`}>
                      <button type="button" role="radio" aria-checked={!persona} className={!persona ? "active" : ""} onClick={() => setPersona(side.id, null)}>무작위</button>
                      {racePersonas(race).map((item) => (
                        <button key={item.id} type="button" role="radio" aria-checked={persona?.id === item.id} className={persona?.id === item.id ? "active" : ""} onClick={() => setPersona(side.id, item.id)}>{item.name}</button>
                      ))}
                    </div>
                    <p className="stw-hint">{persona ? persona.note : "시작할 때 이 종족의 전략 하나를 무작위로 고릅니다."}</p>
                  </>
                )
              ) : null}
            </div>
          );
        })}
        <h3 className="stw-section">맵</h3>
        <div className="stw-segment" role="radiogroup" aria-label="맵">
          {MAP_CHOICES.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={config.map === id} className={config.map === id ? "active" : ""} onClick={() => setConfig((current) => ({ ...current, map: id }))}>{id === "random" ? "무작위" : STW_MAPS[id].name}</button>
          ))}
        </div>
        <p className="stw-hint">{config.map === "random" ? "시작할 때 맵 하나가 정해집니다." : STW_MAPS[config.map].note}</p>
        <button type="button" className="stw-start" onClick={() => onStart(config)}>AI vs AI 시작</button>
      </section>
    </main>
  );
}
