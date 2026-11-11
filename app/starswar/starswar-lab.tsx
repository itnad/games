"use client";

// 스타드래프트 실험실: 종족·전략·건물·유닛·연구·시각을 마음대로 정해 경기를 바로 세우고 시험하는 테스트용 메뉴.
import { useState } from "react";
import { withKoreanDirection, withKoreanObject } from "../korean-particles.js";
import { STW_AI_PERSONAS, STW_BUILDINGS, STW_ECONOMY, STW_MAPS, STW_MAP_IDS, STW_RACES, STW_RESEARCH, STW_SPELLS, STW_UNITS } from "./starswar-data.js";
import type { StwMapId, StwRaceId } from "./starswar-types";

/** 아군은 직접 지휘 또는 AI 운영, 적은 교전만(운영하지 않음) 또는 AI 운영. */
export type LabControl = "manual" | "fight" | "ai";
export type LabSide = {
  control: LabControl;
  persona: string | null;
  workers: number;
  minerals: number;
  gas: number;
  natural: boolean;
  /** 마법 유닛 에너지: 가득(기본) 또는 갓 나온 유닛(시작 에너지 50). */
  energy: "full" | "fresh";
  buildings: Record<string, number>;
  units: Record<string, number>;
  research: string[];
};
export type LabConfig = {
  time: number;
  placement: "clash" | "home";
  /** 맵(없으면 평원). */
  map?: StwMapId;
  races: { player: StwRaceId; enemy: StwRaceId };
  sides: { player: LabSide; enemy: LabSide };
};
const MAP_IDS = STW_MAP_IDS as StwMapId[];
type LabPreset = { id: string; name: string; note: string; config: LabConfig; custom?: boolean };

const RACE_IDS: StwRaceId[] = ["protoss", "terran", "zerg"];
const TIMES = [0, 5, 10, 15, 20];
const SUPPLY_LIMIT = STW_ECONOMY.supplyLimit as number;
/** 내가 저장한 실험 설정. */
const CUSTOM_KEY = "paperoid-starswar-lab-presets";

type UnitDef = { id: string; name: string; supply: number; race?: string; worker?: boolean; spells?: string[]; maxEnergy?: number };
type SpellDef = { name: string; energy: number; research?: string };

/** 마법마다 필요한 연구(없으면 null). 하이템플러의 사이오닉 스톰은 연구 "storm". */
function spellsOf(type: string): { name: string; research: string | null }[] {
  if (type === "templar") return [{ name: "사이오닉 스톰", research: "storm" }];
  const def = (STW_UNITS as Record<string, UnitDef>)[type];
  return (def?.spells ?? []).map((id) => {
    const spell = (STW_SPELLS as Record<string, SpellDef>)[id];
    return { name: spell.name, research: spell.research ?? null };
  });
}

/** 고른 마법 유닛 중 쓸 수 있는 마법이 하나도 없는 유닛(필요한 연구가 모두 꺼짐)과 그 연구 이름. */
function idleCasters(side: LabSide) {
  return Object.entries(side.units).flatMap(([type, count]) => {
    const spells = spellsOf(type);
    if (!count || !spells.length || spells.some((spell) => !spell.research || side.research.includes(spell.research))) return [];
    const names = spells.map((spell) => (STW_RESEARCH as Record<string, { name: string }>)[spell.research!]?.name ?? spell.name);
    return [`${(STW_UNITS as Record<string, UnitDef>)[type].name}: ${names.join("·")}`];
  });
}
type BuildingDef = { id: string; name: string; race?: string; base?: boolean; unique?: boolean; note?: string };
type ResearchDef = { id: string; name: string; at: string };
type PersonaDef = { id: string; name: string; note: string; race: string };

/** 그 종족이 실험실에서 고를 수 있는 전투 유닛(일꾼, 브루들링, 오버로드 제외). */
function raceUnits(race: StwRaceId) {
  return (Object.values(STW_UNITS) as UnitDef[]).filter((def) => (def.race ?? "protoss") === race && !def.worker && def.id !== "broodling" && def.id !== "overlord");
}

/** 그 종족의 건물(기지 건물 제외: 본진은 늘 있고 앞마당은 따로 고른다). */
function raceBuildings(race: StwRaceId) {
  return (Object.values(STW_BUILDINGS) as BuildingDef[]).filter((def) => (def.race ?? "protoss") === race && !def.base);
}

/** 그 종족의 연구·업그레이드(연구 건물의 종족 기준). */
function raceResearch(race: StwRaceId) {
  return (Object.values(STW_RESEARCH) as ResearchDef[]).filter((item) => ((STW_BUILDINGS as Record<string, { race?: string }>)[item.at]?.race ?? "protoss") === race);
}

function racePersonas(race: StwRaceId) {
  return (Object.values(STW_AI_PERSONAS) as PersonaDef[]).filter((persona) => persona.race === race);
}

function emptySide(control: LabControl): LabSide {
  return { control, persona: null, workers: 20, minerals: 500, gas: 300, natural: true, energy: "full", buildings: {}, units: {}, research: [] };
}

/** 옛 설정이나 손상된 설정을 지금 모양으로 맞춘다. */
export function normalizeLab(raw: unknown): LabConfig | null {
  const value = raw as Partial<LabConfig> & { enemyAi?: string };
  if (!value || !value.sides?.player || !value.sides?.enemy || !value.races) return null;
  const side = (key: "player" | "enemy"): LabSide => {
    const given = value.sides![key] as Partial<LabSide>;
    const fallback: LabControl = key === "player" ? "manual" : value.enemyAi === "full" ? "ai" : "fight";
    const control = given.control === "ai" ? "ai" : key === "player" ? "manual" : given.control === "fight" ? "fight" : fallback;
    return { ...emptySide(control), ...given, control, energy: given.energy === "fresh" ? "fresh" : "full", buildings: given.buildings ?? {}, units: given.units ?? {}, research: given.research ?? [], persona: given.persona ?? null };
  };
  const race = (id: unknown): StwRaceId => (RACE_IDS.includes(id as StwRaceId) ? (id as StwRaceId) : "protoss");
  return {
    time: Number(value.time) || 0,
    placement: value.placement === "home" ? "home" : "clash",
    map: MAP_IDS.includes(value.map as StwMapId) ? (value.map as StwMapId) : "plain",
    races: { player: race(value.races.player), enemy: race(value.races.enemy) },
    sides: { player: side("player"), enemy: side("enemy") },
  };
}

export const LAB_PRESETS: LabPreset[] = [
  {
    id: "carrier-hydra",
    name: "캐리어 8 대 히드라 인구 꽉",
    note: "15분, 캐리어 수용량(인터셉터 8) · 히드라 사거리·속도·원거리 2단계",
    config: {
      time: 900,
      placement: "clash",
      races: { player: "protoss", enemy: "zerg" },
      sides: {
        player: { ...emptySide("manual"), units: { carrier: 8 }, research: ["carrierCapacity", "weapons1", "shields1"] },
        enemy: { ...emptySide("fight"), units: { hydra: 80 }, research: ["spines", "augments", "zMissile2", "zCarapace1"] },
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
      races: { player: "protoss", enemy: "zerg" },
      sides: {
        player: { ...emptySide("manual"), units: { templar: 6, zealot: 12 }, research: ["storm", "charge", "weapons1"] },
        enemy: { ...emptySide("fight"), units: { zergling: 160 }, research: ["metabolic", "adrenal", "zMelee2", "zCarapace1"] },
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
      races: { player: "terran", enemy: "protoss" },
      sides: {
        player: { ...emptySide("manual"), units: { tank: 10, marine: 12 }, research: ["siege", "u238", "infWeapons1"] },
        enemy: { ...emptySide("fight"), units: { dragoon: 24 }, research: ["range", "weapons1"] },
      },
    },
  },
  {
    id: "cannon-wall",
    name: "질럿 러시 대 캐논 수비",
    note: "5분, 질럿 16을 들고 캐논 4·게이트웨이 3 기지에 들어간다. 적 AI는 드라군 운영",
    config: {
      time: 300,
      placement: "home",
      races: { player: "protoss", enemy: "protoss" },
      sides: {
        player: { ...emptySide("manual"), natural: false, units: { zealot: 16 }, buildings: { gateway: 4 } },
        enemy: { ...emptySide("ai"), persona: "dragoon", natural: false, units: { zealot: 4, dragoon: 4 }, buildings: { cannon: 4, gateway: 3 } },
      },
    },
  },
  {
    id: "ai-watch",
    name: "AI 대 AI 관전",
    note: "10분부터 캐리어 함대 대 디파일러 하이브, 양쪽 AI가 운영",
    config: {
      time: 600,
      placement: "home",
      races: { player: "protoss", enemy: "zerg" },
      sides: {
        player: { ...emptySide("ai"), persona: "carrier", units: { dragoon: 8, zealot: 6 }, buildings: { gateway: 3, stargate: 2, beacon: 1 } },
        enemy: { ...emptySide("ai"), persona: "hive", units: { hydra: 20 }, buildings: { hatch: 3, nest: 1, sunken: 2 } },
      },
    },
  },
  {
    id: "blank",
    name: "빈 설정",
    note: "프로토스 대 저그, 건물·병력 없이 시작",
    config: { time: 600, placement: "clash", races: { player: "protoss", enemy: "zerg" }, sides: { player: emptySide("manual"), enemy: emptySide("fight") } },
  },
];

export function labSupply(side: LabSide) {
  const units = Object.entries(side.units).reduce((sum, [type, count]) => sum + ((STW_UNITS as Record<string, UnitDef>)[type]?.supply ?? 0) * count, 0);
  return Math.ceil(side.workers + units - 1e-9);
}

function readCustom(): LabPreset[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const config = normalizeLab(item?.config);
      return config && typeof item.name === "string" ? [{ id: String(item.id), name: item.name, note: String(item.note ?? ""), config, custom: true }] : [];
    });
  } catch {
    return [];
  }
}

function writeCustom(list: LabPreset[]) {
  try {
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.map(({ id, name, note, config }) => ({ id, name, note, config }))));
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 남는다.
  }
}

/** 설정을 한 줄로 요약한다(저장 이름의 기본값). */
function summarize(config: LabConfig) {
  const army = (key: "player" | "enemy") => {
    const picked = Object.entries(config.sides[key].units).filter(([, count]) => count > 0).map(([type, count]) => `${(STW_UNITS as Record<string, UnitDef>)[type]?.name ?? type} ${count}`);
    return picked.length ? picked.join("·") : "병력 없음";
  };
  return `${STW_RACES[config.races.player].name} 대 ${STW_RACES[config.races.enemy].name} · ${Math.round(config.time / 60)}분 · ${army("player")} / ${army("enemy")}`;
}

function Stepper({ label, value, onChange, max = 200 }: { label: string; value: number; onChange: (value: number) => void; max?: number }) {
  const set = (next: number) => onChange(Math.max(0, Math.min(max, Math.round(next))));
  return (
    <>
      <button type="button" aria-label={`${label} 1 빼기`} onClick={() => set(value - 1)} disabled={!value}>−</button>
      <input type="number" min={0} max={max} value={value} aria-label={`${label} 수`} onChange={(event) => set(Number(event.target.value) || 0)} />
      <button type="button" aria-label={`${label} 1 더하기`} onClick={() => set(value + 1)}>+</button>
    </>
  );
}

function SideEditor({ title, which, race, side, onRace, onChange }: { title: string; which: "player" | "enemy"; race: StwRaceId; side: LabSide; onRace: (race: StwRaceId) => void; onChange: (side: LabSide) => void }) {
  const units = raceUnits(race);
  const buildings = raceBuildings(race);
  const research = raceResearch(race);
  const personas = racePersonas(race);
  const supply = labSupply(side);
  const pickedBuildings = Object.values(side.buildings).filter((count) => count > 0).length;
  const pickedUnits = Object.values(side.units).filter((count) => count > 0).length;
  const fill = (def: UnitDef) => {
    const others = supply - (side.units[def.id] ?? 0) * def.supply;
    onChange({ ...side, units: { ...side.units, [def.id]: Math.max(0, Math.floor((SUPPLY_LIMIT - others) / def.supply + 1e-9)) } });
  };
  const toggle = (id: string) => onChange({ ...side, research: side.research.includes(id) ? side.research.filter((item) => item !== id) : [...side.research, id] });
  const controls: [LabControl, string][] = which === "player" ? [["manual", "직접 지휘"], ["ai", "AI 운영"]] : [["fight", "교전만"], ["ai", "AI 운영"]];
  const persona = side.persona ? (STW_AI_PERSONAS as unknown as Record<string, PersonaDef>)[side.persona] : null;
  return (
    <section className="stw-lab-side" aria-label={title}>
      <h3 className="stw-section">{title} · 인구 <b className={supply > SUPPLY_LIMIT ? "over" : undefined}>{supply}/{SUPPLY_LIMIT}</b></h3>
      <div className="stw-segment" role="radiogroup" aria-label={`${title} 종족`}>
        {RACE_IDS.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={race === id} className={race === id ? "active" : ""} onClick={() => onRace(id)}>{STW_RACES[id].name}</button>
        ))}
      </div>
      <div className="stw-segment two" role="radiogroup" aria-label={`${title} 운영`}>
        {controls.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={side.control === id} className={side.control === id ? "active" : ""} onClick={() => onChange({ ...side, control: id })}>{label}</button>
        ))}
      </div>
      {side.control === "ai" ? (
        <>
          <div className="stw-lab-chips" role="radiogroup" aria-label={`${title} 전략`}>
            <button type="button" role="radio" aria-checked={!side.persona} className={!side.persona ? "active" : ""} onClick={() => onChange({ ...side, persona: null })}>무작위</button>
            {personas.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={side.persona === item.id} className={side.persona === item.id ? "active" : ""} onClick={() => onChange({ ...side, persona: item.id })}>{item.name}</button>
            ))}
          </div>
          <p className="stw-hint">{persona ? persona.note : "시작할 때 그 종족의 전략 하나를 무작위로 고릅니다."} AI는 이 상황에서부터 짓고 뽑고 출격합니다.</p>
        </>
      ) : (
        <p className="stw-hint">{side.control === "manual" ? "평소처럼 직접 지휘합니다. 생산 라인은 비어 있으니 필요하면 켜세요." : "새로 짓거나 뽑지 않고 주어진 병력으로만 싸웁니다."}</p>
      )}
      <div className="stw-lab-economy">
        <label>일꾼<input type="number" min={0} max={60} value={side.workers} onChange={(event) => onChange({ ...side, workers: Math.max(0, Math.min(60, Number(event.target.value) || 0)) })} /></label>
        <label>광물<input type="number" min={0} step={100} value={side.minerals} onChange={(event) => onChange({ ...side, minerals: Math.max(0, Number(event.target.value) || 0) })} /></label>
        <label>가스<input type="number" min={0} step={100} value={side.gas} onChange={(event) => onChange({ ...side, gas: Math.max(0, Number(event.target.value) || 0) })} /></label>
        <label className="check"><input type="checkbox" checked={side.natural} onChange={(event) => onChange({ ...side, natural: event.target.checked })} />앞마당</label>
      </div>
      <details className="stw-lab-group">
        <summary>건물 <small>{pickedBuildings ? `${pickedBuildings}종 지정` : "필요한 것만 자동"}</small></summary>
        <p className="stw-hint">지정한 수만큼 짓습니다(이미 있는 것 포함). 유닛·연구에 필요한 건물은 지정하지 않아도 자동으로 갖춥니다. 자리가 모자라면 시작할 때 알려 줍니다.</p>
        <ul className="stw-lab-units">
          {buildings.map((def) => {
            const count = side.buildings[def.id] ?? 0;
            return (
              <li key={def.id} className={count ? "picked" : undefined}>
                <span>{def.name}<small>{def.unique ? "하나만" : def.note ?? ""}</small></span>
                <Stepper label={def.name} value={count} max={def.unique ? 1 : 30} onChange={(value) => onChange({ ...side, buildings: { ...side.buildings, [def.id]: value } })} />
              </li>
            );
          })}
        </ul>
      </details>
      {Object.entries(side.units).some(([type, count]) => count > 0 && (STW_UNITS as Record<string, UnitDef>)[type]?.maxEnergy) ? (
        <>
          <div className="stw-segment two" role="radiogroup" aria-label={`${title} 마법 에너지`}>
            <button type="button" role="radio" aria-checked={side.energy === "full"} className={side.energy === "full" ? "active" : ""} onClick={() => onChange({ ...side, energy: "full" })}>마법 에너지 가득</button>
            <button type="button" role="radio" aria-checked={side.energy === "fresh"} className={side.energy === "fresh" ? "active" : ""} onClick={() => onChange({ ...side, energy: "fresh" })}>새로 나온 유닛(50)</button>
          </div>
          {idleCasters(side).length ? <p className="stw-hint stw-hold">연구가 꺼져 있어 마법을 쓰지 않습니다 — {idleCasters(side).join(", ")}. 연구·업그레이드에서 켜세요.</p> : null}
        </>
      ) : null}
      <details className="stw-lab-group" open>
        <summary>유닛 <small>{pickedUnits ? `${pickedUnits}종 · 인구 ${supply - side.workers}` : "없음"}</small></summary>
        <ul className="stw-lab-units with-fill">
          {units.map((def) => {
            const count = side.units[def.id] ?? 0;
            return (
              <li key={def.id} className={count ? "picked" : undefined}>
                <span>{def.name}<small>인구 {def.supply}</small></span>
                <Stepper label={def.name} value={count} onChange={(value) => onChange({ ...side, units: { ...side.units, [def.id]: value } })} />
                <button type="button" className="fill" onClick={() => fill(def)}>인구 채우기</button>
              </li>
            );
          })}
        </ul>
      </details>
      <details className="stw-lab-group">
        <summary>연구·업그레이드 <small>{side.research.length ? `${side.research.length}개 켬` : "없음"}</small></summary>
        <button type="button" className="stw-lab-all" onClick={() => onChange({ ...side, research: side.research.length === research.length ? [] : research.map((item) => item.id) })}>{side.research.length === research.length ? "모두 끄기" : "모두 켜기"}</button>
        <div className="stw-lab-chips">
          {research.map((item) => (
            <button key={item.id} type="button" aria-pressed={side.research.includes(item.id)} className={side.research.includes(item.id) ? "active" : ""} onClick={() => toggle(item.id)}>{item.name}</button>
          ))}
        </div>
      </details>
    </section>
  );
}

export function LabScreen({ initial, onStart, onBack }: { initial: LabConfig; onStart: (config: LabConfig) => void; onBack: () => void }) {
  const [config, setConfig] = useState<LabConfig>(() => normalizeLab(initial) ?? structuredClone(LAB_PRESETS[0].config));
  const [custom, setCustom] = useState<LabPreset[]>(() => (typeof window === "undefined" ? [] : readCustom()));
  const [name, setName] = useState("");
  const setSide = (key: "player" | "enemy", side: LabSide) => setConfig((current) => ({ ...current, sides: { ...current.sides, [key]: side } }));
  // 종족을 바꾸면 그 쪽의 건물·병력·연구·전략을 비운다(다른 종족 것은 쓸 수 없다).
  const setRace = (key: "player" | "enemy", race: StwRaceId) => setConfig((current) => ({ ...current, races: { ...current.races, [key]: race }, sides: { ...current.sides, [key]: { ...current.sides[key], persona: null, buildings: {}, units: {}, research: [] } } }));
  const over = (["player", "enemy"] as const).filter((key) => labSupply(config.sides[key]) > SUPPLY_LIMIT);
  const saveCurrent = () => {
    const summary = summarize(config);
    const entry: LabPreset = { id: `custom-${custom.length + 1}-${Math.round(config.time)}-${summary.length}`, name: name.trim() || summary, note: summary, config: structuredClone(config), custom: true };
    const next = [entry, ...custom.filter((item) => item.name !== entry.name)].slice(0, 12);
    setCustom(next);
    writeCustom(next);
    setName("");
  };
  const removeCustom = (id: string) => {
    const next = custom.filter((item) => item.id !== id);
    setCustom(next);
    writeCustom(next);
  };
  return (
    <main className="stw-shell stw-menu-shell" data-game-menu="true">
      <header className="stw-topbar">
        <button type="button" onClick={onBack} aria-label="전투 설정으로">←</button>
        <div><span className="stw-brand">스타드래프트</span><strong>실험실</strong></div>
      </header>
      <section className="stw-menu stw-lab">
        <p className="stw-hint">종족·전략·건물·유닛·연구·시각을 마음대로 정해 경기를 바로 세웁니다. 필요한 생산·테크 건물과 선행 연구는 자동으로 갖추고, 인구 상한은 {withKoreanDirection(String(SUPPLY_LIMIT))} 채웁니다. 실험 경기는 전적과 이어하기에 남지 않습니다.</p>
        <h3 className="stw-section">불러오기</h3>
        <div className="stw-lab-presets">
          {[...custom, ...LAB_PRESETS].map((preset) => (
            <div key={preset.id} className={preset.custom ? "custom" : undefined}>
              <button type="button" onClick={() => setConfig(structuredClone(normalizeLab(preset.config) ?? preset.config))}>
                <b>{preset.name}</b>
                <span>{preset.custom ? `내 설정 · ${preset.note}` : preset.note}</span>
              </button>
              {preset.custom ? <button type="button" className="remove" aria-label={`${preset.name} 지우기`} onClick={() => removeCustom(preset.id)}>×</button> : null}
            </div>
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
        <p className="stw-hint">{config.placement === "clash" ? "두 병력이 맵 가운데에서 마주 본 채 공격 병력으로 시작합니다." : "두 병력이 각자 집결지에서 대기합니다. 출격은 직접 정하거나 AI가 정합니다."}</p>
        <h3 className="stw-section">맵</h3>
        <div className="stw-segment" role="radiogroup" aria-label="맵">
          {MAP_IDS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={(config.map ?? "plain") === id} className={(config.map ?? "plain") === id ? "active" : ""} onClick={() => setConfig({ ...config, map: id })}>{STW_MAPS[id].name}</button>
          ))}
        </div>
        <p className="stw-hint">{STW_MAPS[config.map ?? "plain"].note}</p>
        <SideEditor title="아군" which="player" race={config.races.player} side={config.sides.player} onRace={(race) => setRace("player", race)} onChange={(side) => setSide("player", side)} />
        <SideEditor title="적" which="enemy" race={config.races.enemy} side={config.sides.enemy} onRace={(race) => setRace("enemy", race)} onChange={(side) => setSide("enemy", side)} />
        {over.length ? <p className="stw-hint stw-hold">인구가 {withKoreanObject(String(SUPPLY_LIMIT))} 넘었습니다. 넘는 만큼도 나오지만 그쪽은 더 생산할 수 없습니다.</p> : null}
        <div className="stw-lab-save">
          <input type="text" value={name} maxLength={40} placeholder="이름(비우면 내용으로)" aria-label="저장할 이름" onChange={(event) => setName(event.target.value)} />
          <button type="button" className="stw-secondary" onClick={saveCurrent}>지금 설정 저장</button>
        </div>
        <button type="button" className="stw-start" onClick={() => onStart(config)}>이 상황으로 시작</button>
      </section>
    </main>
  );
}
