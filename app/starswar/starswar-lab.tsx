"use client";

// 스타즈워 실험실: 원하는 시각·병력·연구로 경기를 바로 세워 교전을 시험하는 테스트용 메뉴.
import { useState } from "react";
import { withKoreanDirection, withKoreanObject } from "../korean-particles.js";
import { STW_BUILDINGS, STW_ECONOMY, STW_RACES, STW_RESEARCH, STW_UNITS } from "./starswar-data.js";
import type { StwRaceId } from "./starswar-types";

export type LabSide = { workers: number; minerals: number; gas: number; natural: boolean; units: Record<string, number>; research: string[] };
export type LabConfig = {
  time: number;
  placement: "clash" | "home";
  enemyAi: "fight" | "full";
  races: { player: StwRaceId; enemy: StwRaceId };
  sides: { player: LabSide; enemy: LabSide };
};

const RACE_IDS: StwRaceId[] = ["protoss", "terran", "zerg"];
const TIMES = [0, 5, 10, 15, 20];
const SUPPLY_LIMIT = STW_ECONOMY.supplyLimit as number;

type UnitDef = { id: string; name: string; supply: number; race?: string; worker?: boolean };
type ResearchDef = { id: string; name: string; at: string };

/** 그 종족이 실험실에서 고를 수 있는 전투 유닛(일꾼, 브루들링, 오버로드 제외). */
function raceUnits(race: StwRaceId) {
  return (Object.values(STW_UNITS) as UnitDef[]).filter((def) => (def.race ?? "protoss") === race && !def.worker && def.id !== "broodling" && def.id !== "overlord");
}

/** 그 종족의 연구·업그레이드(연구 건물의 종족 기준). */
function raceResearch(race: StwRaceId) {
  return (Object.values(STW_RESEARCH) as ResearchDef[]).filter((item) => ((STW_BUILDINGS as Record<string, { race?: string }>)[item.at]?.race ?? "protoss") === race);
}

function emptySide(): LabSide {
  return { workers: 20, minerals: 500, gas: 300, natural: true, units: {}, research: [] };
}

export const LAB_PRESETS: { id: string; name: string; note: string; config: LabConfig }[] = [
  {
    id: "carrier-hydra",
    name: "캐리어 8 대 히드라 인구 꽉",
    note: "15분, 캐리어 수용량(인터셉터 8) · 히드라 사거리·속도·원거리 2단계",
    config: {
      time: 900,
      placement: "clash",
      enemyAi: "fight",
      races: { player: "protoss", enemy: "zerg" },
      sides: {
        player: { ...emptySide(), units: { carrier: 8 }, research: ["carrierCapacity", "weapons1", "shields1"] },
        enemy: { ...emptySide(), units: { hydra: 80 }, research: ["spines", "augments", "zMissile2", "zCarapace1"] },
      },
    },
  },
  {
    id: "storm-ling",
    name: "스톰 템플러 대 저글링 떼",
    note: "12분, 하이템플러 6 · 질럿 12 대 아드레날린 저글링 인구 꽉",
    config: {
      time: 720,
      placement: "clash",
      enemyAi: "fight",
      races: { player: "protoss", enemy: "zerg" },
      sides: {
        player: { ...emptySide(), units: { templar: 6, zealot: 12 }, research: ["storm", "charge", "weapons1"] },
        enemy: { ...emptySide(), units: { zergling: 160 }, research: ["metabolic", "adrenal", "zMelee2", "zCarapace1"] },
      },
    },
  },
  {
    id: "tank-dragoon",
    name: "시즈 탱크 대 드라군",
    note: "10분, 시즈 탱크 10 · 해병 12 대 드라군 24(사거리 업)",
    config: {
      time: 600,
      placement: "clash",
      enemyAi: "fight",
      races: { player: "terran", enemy: "protoss" },
      sides: {
        player: { ...emptySide(), units: { tank: 10, marine: 12 }, research: ["siege", "u238", "infWeapons1"] },
        enemy: { ...emptySide(), units: { dragoon: 24 }, research: ["range", "weapons1"] },
      },
    },
  },
  {
    id: "blank",
    name: "빈 설정",
    note: "프로토스 대 저그, 병력 없이 시작",
    config: { time: 600, placement: "clash", enemyAi: "fight", races: { player: "protoss", enemy: "zerg" }, sides: { player: emptySide(), enemy: emptySide() } },
  },
];

export function labSupply(side: LabSide) {
  const units = Object.entries(side.units).reduce((sum, [type, count]) => sum + ((STW_UNITS as Record<string, UnitDef>)[type]?.supply ?? 0) * count, 0);
  return Math.ceil(side.workers + units - 1e-9);
}

function SideEditor({ title, race, side, onRace, onChange }: { title: string; race: StwRaceId; side: LabSide; onRace: (race: StwRaceId) => void; onChange: (side: LabSide) => void }) {
  const units = raceUnits(race);
  const research = raceResearch(race);
  const supply = labSupply(side);
  const setCount = (type: string, count: number) => onChange({ ...side, units: { ...side.units, [type]: Math.max(0, Math.min(200, Math.round(count))) } });
  const fill = (def: UnitDef) => {
    const others = supply - (side.units[def.id] ?? 0) * def.supply;
    setCount(def.id, Math.floor((SUPPLY_LIMIT - others) / def.supply + 1e-9));
  };
  const toggle = (id: string) => onChange({ ...side, research: side.research.includes(id) ? side.research.filter((item) => item !== id) : [...side.research, id] });
  return (
    <section className="stw-lab-side" aria-label={title}>
      <h3 className="stw-section">{title} · 인구 <b className={supply > SUPPLY_LIMIT ? "over" : undefined}>{supply}/{SUPPLY_LIMIT}</b></h3>
      <div className="stw-segment" role="radiogroup" aria-label={`${title} 종족`}>
        {RACE_IDS.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={race === id} className={race === id ? "active" : ""} onClick={() => onRace(id)}>{STW_RACES[id].name}</button>
        ))}
      </div>
      <div className="stw-lab-economy">
        <label>일꾼<input type="number" min={0} max={60} value={side.workers} onChange={(event) => onChange({ ...side, workers: Math.max(0, Math.min(60, Number(event.target.value) || 0)) })} /></label>
        <label>광물<input type="number" min={0} step={100} value={side.minerals} onChange={(event) => onChange({ ...side, minerals: Math.max(0, Number(event.target.value) || 0) })} /></label>
        <label>가스<input type="number" min={0} step={100} value={side.gas} onChange={(event) => onChange({ ...side, gas: Math.max(0, Number(event.target.value) || 0) })} /></label>
        <label className="check"><input type="checkbox" checked={side.natural} onChange={(event) => onChange({ ...side, natural: event.target.checked })} />앞마당</label>
      </div>
      <ul className="stw-lab-units">
        {units.map((def) => {
          const count = side.units[def.id] ?? 0;
          return (
            <li key={def.id} className={count ? "picked" : undefined}>
              <span>{def.name}<small>인구 {def.supply}</small></span>
              <button type="button" aria-label={`${def.name} 1기 빼기`} onClick={() => setCount(def.id, count - 1)} disabled={!count}>−</button>
              <input type="number" min={0} max={200} value={count} aria-label={`${def.name} 수`} onChange={(event) => setCount(def.id, Number(event.target.value) || 0)} />
              <button type="button" aria-label={`${def.name} 1기 더하기`} onClick={() => setCount(def.id, count + 1)}>+</button>
              <button type="button" className="fill" onClick={() => fill(def)}>인구 채우기</button>
            </li>
          );
        })}
      </ul>
      <h3 className="stw-section">연구·업그레이드 <button type="button" className="stw-lab-all" onClick={() => onChange({ ...side, research: side.research.length === research.length ? [] : research.map((item) => item.id) })}>{side.research.length === research.length ? "모두 끄기" : "모두 켜기"}</button></h3>
      <div className="stw-lab-chips">
        {research.map((item) => (
          <button key={item.id} type="button" aria-pressed={side.research.includes(item.id)} className={side.research.includes(item.id) ? "active" : ""} onClick={() => toggle(item.id)}>{item.name}</button>
        ))}
      </div>
    </section>
  );
}

export function LabScreen({ initial, onStart, onBack }: { initial: LabConfig; onStart: (config: LabConfig) => void; onBack: () => void }) {
  const [config, setConfig] = useState<LabConfig>(initial);
  const setSide = (key: "player" | "enemy", side: LabSide) => setConfig((current) => ({ ...current, sides: { ...current.sides, [key]: side } }));
  // 종족을 바꾸면 그 쪽의 병력과 연구를 비운다(다른 종족 유닛은 쓸 수 없다).
  const setRace = (key: "player" | "enemy", race: StwRaceId) => setConfig((current) => ({ ...current, races: { ...current.races, [key]: race }, sides: { ...current.sides, [key]: { ...current.sides[key], units: {}, research: [] } } }));
  const over = (["player", "enemy"] as const).filter((key) => labSupply(config.sides[key]) > SUPPLY_LIMIT);
  return (
    <main className="stw-shell stw-menu-shell" data-game-menu="true">
      <header className="stw-topbar">
        <button type="button" onClick={onBack} aria-label="전투 설정으로">←</button>
        <div><span className="stw-brand">스타즈워</span><strong>실험실</strong></div>
      </header>
      <section className="stw-menu stw-lab">
        <p className="stw-hint">원하는 시각·병력·연구로 경기를 바로 세워 교전을 시험합니다. 필요한 생산·테크 건물과 선행 연구는 자동으로 갖추고, 인구 상한은 {withKoreanDirection(String(SUPPLY_LIMIT))} 채웁니다. 실험 경기는 전적과 이어하기에 남지 않습니다.</p>
        <h3 className="stw-section">미리 만든 상황</h3>
        <div className="stw-lab-presets">
          {LAB_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => setConfig(structuredClone(preset.config))}>
              <b>{preset.name}</b>
              <span>{preset.note}</span>
            </button>
          ))}
        </div>
        <h3 className="stw-section">시작 시각</h3>
        <div className="stw-segment" role="radiogroup" aria-label="시작 시각">
          {TIMES.map((minutes) => (
            <button key={minutes} type="button" role="radio" aria-checked={config.time === minutes * 60} className={config.time === minutes * 60 ? "active" : ""} onClick={() => setConfig({ ...config, time: minutes * 60 })}>{minutes}분</button>
          ))}
        </div>
        <h3 className="stw-section">배치</h3>
        <div className="stw-segment two" role="radiogroup" aria-label="배치">
          <button type="button" role="radio" aria-checked={config.placement === "clash"} className={config.placement === "clash" ? "active" : ""} onClick={() => setConfig({ ...config, placement: "clash" })}>정면 교전</button>
          <button type="button" role="radio" aria-checked={config.placement === "home"} className={config.placement === "home" ? "active" : ""} onClick={() => setConfig({ ...config, placement: "home" })}>각자 기지</button>
        </div>
        <p className="stw-hint">{config.placement === "clash" ? "두 병력이 맵 가운데에서 마주 본 채 공격 병력으로 시작합니다." : "두 병력이 각자 집결지에서 대기합니다. 출격은 직접 정합니다."}</p>
        <h3 className="stw-section">적 운영</h3>
        <div className="stw-segment two" role="radiogroup" aria-label="적 운영">
          <button type="button" role="radio" aria-checked={config.enemyAi === "fight"} className={config.enemyAi === "fight" ? "active" : ""} onClick={() => setConfig({ ...config, enemyAi: "fight" })}>교전만</button>
          <button type="button" role="radio" aria-checked={config.enemyAi === "full"} className={config.enemyAi === "full" ? "active" : ""} onClick={() => setConfig({ ...config, enemyAi: "full" })}>AI 계속 운영</button>
        </div>
        <p className="stw-hint">{config.enemyAi === "fight" ? "적은 새로 짓거나 뽑지 않고 주어진 병력으로만 싸웁니다." : "적 AI가 이 상황에서부터 생산·연구·출격을 계속합니다."}</p>
        <SideEditor title="아군" race={config.races.player} side={config.sides.player} onRace={(race) => setRace("player", race)} onChange={(side) => setSide("player", side)} />
        <SideEditor title="적" race={config.races.enemy} side={config.sides.enemy} onRace={(race) => setRace("enemy", race)} onChange={(side) => setSide("enemy", side)} />
        {over.length ? <p className="stw-hint stw-hold">인구가 {withKoreanObject(String(SUPPLY_LIMIT))} 넘었습니다. 넘는 만큼도 나오지만 그쪽은 더 생산할 수 없습니다.</p> : null}
        <button type="button" className="stw-start" onClick={() => onStart(config)}>이 상황으로 시작</button>
      </section>
    </main>
  );
}
