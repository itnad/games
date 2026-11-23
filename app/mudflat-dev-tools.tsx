"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PAPEROID_BUILD_ID } from "./app-version";
import { MUDFLAT_ACTIVE_RUN_KEY } from "./mudflat-run-save.js";
import type { Campaign, CountMap, GameMode } from "./mudflat-survivor-types";
import {
  BEST_KEY,
  CAMPAIGN_KEY,
  HIGHEST_STAGE_KEY,
  LAST_MODE_KEY,
  MOSQUITO_REPELLENT_KEY,
  MUDFLAT_DEV_LAUNCH_KEY,
  createCampaign,
} from "./mudflat-survivor-model";
import { MUDFLAT_FIXED_GENERAL_SKILL_IDS, MUDFLAT_REGULAR_STAGES, MUDFLAT_SELECTABLE_SKILL_LIMIT, MUDFLAT_SHOP_EQUIPMENT, mudflatNormalizeActiveSkills, mudflatStageProfile } from "./mudflat-survivor-engine.js";
import { MUDFLAT_DEV_BUILD_MAX_STAGE, createMudflatDevBuild, mudflatDevBuildCampaign, mudflatDevBuildSeed, mudflatDevBuildSkills, mudflatDevFixedSeed, validateMudflatDevBuild } from "./mudflat-dev-build.js";

type DevBuild = ReturnType<typeof createMudflatDevBuild>;
import { createMudflatSeed } from "./mudflat-rng.js";

type DevPreset = {
  id: string;
  title: string;
  stage: number;
  description: string;
  mode?: GameMode;
  characterId?: string;
  tutorial?: boolean;
  supervisor?: boolean;
  coins?: number;
  level?: number;
  xp?: number;
  nextXp?: number;
  levels?: CountMap;
  equipment?: CountMap;
  gemsCollected?: number;
  digsCompleted?: number;
  hitByCrab?: boolean;
  hitByShrimp?: boolean;
  hitByRock?: boolean;
  hitByTide?: boolean;
  hitByMosquito?: boolean;
  hitByPufferfish?: boolean;
  bossEarly?: boolean;
};

type LocalSnapshot = {
  highest: string;
  lastMode: string;
  best: string;
  campaign: string;
  activeRun: string;
};

const DEV_PRESETS: DevPreset[] = [
  {
    id: "supervisor",
    title: "AI 감독모드 · 1단계부터",
    stage: 1,
    supervisor: true,
    description: "AI가 실제 조작과 피해 판정으로 채집·회피·귀환을 수행합니다. 레벨업 기술과 정비 화면의 구매·출정은 직접 선택하며 일반 기록과 저장에는 반영되지 않습니다.",
  },
  {
    id: "tutorial",
    title: "1단계 튜토리얼 확인",
    stage: 1,
    tutorial: true,
    description: "첫 움직임, 집게 채집, 호미질, 장애물 안내를 처음부터 확인합니다.",
  },
  {
    id: "dark-lamp-low",
    title: "4단계 어두운 갯벌 · 랜턴 Lv.1",
    stage: 4,
    description: "어두운 갯벌의 기본 시야와 낮은 랜턴 성능을 확인합니다.",
    coins: 900,
    level: 6,
    xp: 20,
    nextXp: 57,
    levels: { tongs: 2, digging: 2, basket: 1 },
    equipment: { headlamp: 1, cooler: 1 },
  },
  {
    id: "dark-lamp-max",
    title: "4단계 어두운 갯벌 · 랜턴 Lv.6",
    stage: 4,
    description: "랜턴 최대 레벨의 밝기와 방향 시야 밸런스를 확인합니다.",
    coins: 3000,
    level: 12,
    xp: 120,
    nextXp: 270,
    levels: { tongs: 4, digging: 3, basket: 3, electric: 3 },
    equipment: { headlamp: 6, cooler: 3, gloves: 2 },
  },
  {
    id: "deep-mud",
    title: "5단계 깊은 펄",
    stage: 5,
    description: "깊은 펄 웅덩이, 발 빠짐 게이지, 개불 숨구멍, 장화 완화 효과를 확인합니다.",
    coins: 2400,
    level: 11,
    xp: 80,
    nextXp: 210,
    levels: { tongs: 3, digging: 5, rocker: 2, basket: 2 },
    equipment: { waders: 3, cooler: 2, gloves: 2 },
  },
  {
    id: "mosquitoes",
    title: "6단계 모기떼/해충기피제",
    stage: 6,
    description: "모기떼 피해와 1회용 해충기피제 방어 처리를 빠르게 확인합니다.",
    coins: 1800,
    level: 10,
    xp: 55,
    nextXp: 180,
    levels: { tongs: 3, digging: 3, net: 2, basket: 2 },
    equipment: { cooler: 2, vest: 1, [MOSQUITO_REPELLENT_KEY]: 1 },
  },
  {
    id: "secret-skills",
    title: "비밀 채집기술 프리셋",
    stage: 3,
    description: "전기 5, 담기 5, 돌뒤집개 5, 그물 1 상태로 시작합니다.",
    coins: 1500,
    level: 15,
    xp: 350,
    nextXp: 478,
    levels: { tongs: 1, digging: 1, electric: 5, basket: 5, rocker: 5, "cast-net": 1 },
    equipment: { cooler: 3, gloves: 2 },
  },
  {
    id: "guard-basket",
    title: "3단계 바위 갯벌 · 소쿠리의 달인 Lv.6",
    stage: 3,
    description: "소쿠리 흡입 주기·범위, 접촉·물살 피해 1회 방어와 충전 고리 표시를 확인합니다.",
    coins: 3000,
    level: 10,
    xp: 0,
    nextXp: 90,
    levels: { tongs: 3, digging: 3, "guard-basket": 6, basket: 1 },
    equipment: { cooler: 1 },
    gemsCollected: 100,
  },
  {
    id: "hoe-bot",
    title: "3단계 바위 갯벌 · 호미봇 Lv.6 · 호미질 Lv.1",
    stage: 3,
    description: "로봇 2대가 조개 구멍을 찾아 파고, 호미질 Lv.1 기준 등급이 나오는지 확인합니다.",
    coins: 3000,
    level: 10,
    xp: 0,
    nextXp: 90,
    levels: { tongs: 3, digging: 1, "hoe-bot": 6, basket: 1 },
    equipment: { cooler: 1 },
    digsCompleted: 20,
  },
  {
    id: "rock-lift",
    title: "3단계 바위 갯벌 · 건곤대나이 Lv.6 · 돌뒤집개 Lv.1",
    stage: 3,
    description: "8초마다 바위 7개가 떠올랐다 떨어지며 사라지고, 낙하 피해와 돌뒤집개 Lv.1 기준 발견물이 나오는지 확인합니다.",
    coins: 3000,
    level: 12,
    xp: 0,
    nextXp: 90,
    levels: { tongs: 3, digging: 2, rocker: 1, harpoon: 1, net: 1, boots: 1, basket: 1, "rock-lift": 6 },
    equipment: { cooler: 1 },
  },
  {
    id: "smash",
    title: "4단계 어두운 갯벌 · 뻘권 Lv.6",
    stage: 4,
    description: "게 일렬 돌진 앞에서 뻘권이 조작 방향으로 발동해 피해·넉백·바위 충돌·연쇄 넉백이 나오는지 확인합니다.",
    coins: 3000,
    level: 12,
    xp: 0,
    nextXp: 90,
    levels: { tongs: 3, digging: 3, harpoon: 3, boots: 3, smash: 6 },
    equipment: { headlamp: 4, cooler: 1 },
  },
  {
    id: "fire",
    title: "3단계 바위 갯벌 · 파이어볼 Lv.6 · 화염 방사 Lv.6",
    stage: 3,
    description: "1초마다 불덩이 6발이 흔들리며 날아가 근처까지 태우고, 5초마다 8방향 불줄기가 150 피해를 주는지 확인합니다.",
    coins: 3000,
    level: 12,
    xp: 0,
    nextXp: 90,
    levels: { tongs: 3, digging: 2, harpoon: 3, fireball: 6, "flame-burst": 6 },
    equipment: { cooler: 1 },
    hitByCrab: true,
    hitByShrimp: true,
  },
  {
    id: "frost",
    title: "3단계 바위 갯벌 · 서리 발자국 Lv.6 · 빙결 파동 Lv.6",
    stage: 3,
    description: "지나간 자리에 서리 바닥이 남아 게가 느려지며 틱 피해를 받고, 5초마다 냉기 고리가 반경 200px의 해산물을 1.2초 얼리는지 확인합니다.",
    coins: 3000,
    level: 12,
    xp: 0,
    nextXp: 90,
    levels: { tongs: 3, digging: 2, harpoon: 3, "frost-trail": 6, "frost-wave": 6 },
    equipment: { cooler: 1 },
    hitByRock: true,
    hitByTide: true,
  },
  {
    id: "lightning",
    title: "2단계 차오르는 물골 · 번개 체인 Lv.6 · 낙뢰 Lv.6",
    stage: 2,
    description: "2.5초마다 가까운 게에서 최대 8마리로 번개가 번지고, 5초마다 체력이 가장 높은 게 발밑에 예고가 뜬 뒤 번개가 0.1초 간격으로 세 번 떨어지는지, 맞은 게가 0.2초 감전되는지 확인합니다.",
    coins: 3000,
    level: 12,
    xp: 0,
    nextXp: 90,
    levels: { tongs: 3, digging: 2, harpoon: 3, "chain-lightning": 6, thunderbolt: 6 },
    equipment: { cooler: 1 },
    hitByMosquito: true,
    hitByPufferfish: true,
  },
  {
    id: "boss-skills",
    title: "8단계 마지막 물때 · 대왕 박하지 8초 등장 · 점프·파이어볼·집게발·복어 소환",
    stage: 8,
    description: "대왕 박하지가 8초 뒤 나타나 4초마다 점프 공격(보라 고리 예고 뒤 착지 반경 80px), Lv.5 파이어볼 5발, 집게발 왕복 투척, 돌진 복어 4마리 소환을 번갈아 쓰는지, 체력이 16배(약 31,000)인지 확인합니다.",
    coins: 3000,
    level: 14,
    xp: 0,
    nextXp: 90,
    levels: { tongs: 4, digging: 2, harpoon: 4, electric: 3, "guard-basket": 3 },
    equipment: { cooler: 1, vest: 2 },
    bossEarly: true,
  },
  {
    id: "final-boss",
    title: "8단계 마지막 물때",
    stage: 8,
    description: "복합 환경과 강화 대왕 박하지, 최종 귀환 흐름을 확인합니다.",
    coins: 5000,
    level: 18,
    xp: 520,
    nextXp: 760,
    levels: { tongs: 6, digging: 6, electric: 4, basket: 4, rocker: 4, "cast-net": 3, snack: 2, boots: 3 },
    equipment: { headlamp: 4, cooler: 5, vest: 3, gloves: 4, waders: 4, [MOSQUITO_REPELLENT_KEY]: 1 },
  },
];

const STORAGE_KEYS = [
  CAMPAIGN_KEY,
  MUDFLAT_ACTIVE_RUN_KEY,
  HIGHEST_STAGE_KEY,
  LAST_MODE_KEY,
  BEST_KEY,
];

function safeRead(key: string) {
  try { return window.localStorage.getItem(key); }
  catch { return null; }
}

function summarizeCampaign(raw: string | null) {
  if (!raw) return "없음";
  try {
    const value = JSON.parse(raw) as Partial<Campaign> & { inProgress?: boolean };
    return `${value.inProgress ? "진행 중" : "정비 저장"} · ${value.stage ?? "?"}단계 · LV.${value.level ?? "?"} · ${Number(value.coins ?? 0).toLocaleString()}C`;
  } catch { return "읽을 수 없는 저장값"; }
}

function summarizeActiveRun(raw: string | null) {
  if (!raw) return "없음";
  try {
    const value = JSON.parse(raw) as { savedAt?: number; campaign?: Partial<Campaign>; runtime?: { stage?: number; player?: { hp?: number; maxHp?: number }; elapsed?: number; level?: number } };
    const savedAt = value.savedAt ? new Date(value.savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "시간 없음";
    return `${value.runtime?.stage ?? value.campaign?.stage ?? "?"}단계 · LV.${value.runtime?.level ?? value.campaign?.level ?? "?"} · 체력 ${Math.floor(value.runtime?.player?.hp ?? value.campaign?.hp ?? 0)} / ${Math.floor(value.runtime?.player?.maxHp ?? value.campaign?.maxHp ?? 0)} · ${savedAt}`;
  } catch { return "읽을 수 없는 이어하기 저장값"; }
}

function makePresetCampaign(preset: DevPreset) {
  const mode = preset.mode ?? "normal";
  const campaign = createCampaign(preset.characterId ?? "beginner", mode, preset.stage);
  const levels = { ...campaign.levels, ...(preset.levels ?? {}) };
  const equipment = { ...campaign.equipment, ...(preset.equipment ?? {}) };
  const maxHp = Math.max(campaign.maxHp, campaign.baseMaxHp + Math.max(0, levels.snack ?? 0) * 18, 100);
  return {
    ...campaign,
    coins: preset.coins ?? campaign.coins,
    hp: maxHp,
    maxHp,
    level: preset.level ?? campaign.level,
    xp: preset.xp ?? campaign.xp,
    nextXp: preset.nextXp ?? campaign.nextXp,
    levels,
    activeSkills: mudflatNormalizeActiveSkills(levels, undefined, mode),
    gemsCollected: preset.gemsCollected ?? 0,
    digsCompleted: preset.digsCompleted ?? 0,
    hitByCrab: preset.hitByCrab === true,
    hitByShrimp: preset.hitByShrimp === true,
    hitByRock: preset.hitByRock === true,
    hitByTide: preset.hitByTide === true,
    hitByMosquito: preset.hitByMosquito === true,
    hitByPufferfish: preset.hitByPufferfish === true,
    equipment,
    pendingSkillDiscovery: false,
  };
}

function readSnapshot(): LocalSnapshot {
  return {
    highest: safeRead(HIGHEST_STAGE_KEY) ?? "1",
    lastMode: safeRead(LAST_MODE_KEY) ?? "없음",
    best: safeRead(BEST_KEY) ?? "0",
    campaign: summarizeCampaign(safeRead(CAMPAIGN_KEY)),
    activeRun: summarizeActiveRun(safeRead(MUDFLAT_ACTIVE_RUN_KEY)),
  };
}

function collectExportPayload() {
  const entries = STORAGE_KEYS.reduce<Record<string, string | null>>((acc, key) => {
    acc[key] = safeRead(key);
    return acc;
  }, {});
  return JSON.stringify({
    formatVersion: 1,
    buildId: PAPEROID_BUILD_ID,
    exportedAt: new Date().toISOString(),
    storage: entries,
  }, null, 2);
}

const MAX_IMPORT_LENGTH = 1_000_000;

function parseRestorePayload(raw: string) {
  if (!raw.trim()) throw new Error("복원할 JSON을 먼저 붙여 넣어 주세요.");
  if (raw.length > MAX_IMPORT_LENGTH) throw new Error("복원 데이터가 1MB를 넘어 사용할 수 없습니다.");
  let payload: unknown;
  try { payload = JSON.parse(raw); }
  catch { throw new Error("JSON 형식이 올바르지 않습니다."); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("복원 데이터의 최상위 형식이 올바르지 않습니다.");
  const record = payload as { formatVersion?: unknown; storage?: unknown };
  if (record.formatVersion !== 1) throw new Error("지원하지 않는 저장값 형식입니다.");
  if (!record.storage || typeof record.storage !== "object" || Array.isArray(record.storage)) throw new Error("storage 항목이 없습니다.");
  const storage = record.storage as Record<string, unknown>;
  const unknownKeys = Object.keys(storage).filter((key) => !STORAGE_KEYS.includes(key));
  if (unknownKeys.length > 0) throw new Error("해루질럿과 관계없는 저장 키가 포함되어 있습니다.");
  for (const key of STORAGE_KEYS) {
    const value = storage[key] ?? null;
    if (value !== null && typeof value !== "string") throw new Error(`${key} 값은 문자열이어야 합니다.`);
  }
  const mode = storage[LAST_MODE_KEY];
  if (mode !== null && mode !== undefined && mode !== "normal" && mode !== "kids") throw new Error("마지막 모드 값이 올바르지 않습니다.");
  for (const [key, minimum, maximum] of [[HIGHEST_STAGE_KEY, 1, 9], [BEST_KEY, 0, Number.MAX_SAFE_INTEGER]] as const) {
    const value = storage[key];
    if (value !== null && value !== undefined) {
      const numeric = Number(value);
      if (!Number.isInteger(numeric) || numeric < minimum || numeric > maximum) throw new Error(`${key} 숫자 값이 올바르지 않습니다.`);
    }
  }
  for (const key of [CAMPAIGN_KEY, MUDFLAT_ACTIVE_RUN_KEY]) {
    const value = storage[key];
    if (typeof value !== "string") continue;
    try {
      const parsed = JSON.parse(value);
      if (parsed === null || typeof parsed !== "object") throw new Error();
    } catch { throw new Error(`${key} 내부 JSON이 올바르지 않습니다.`); }
  }
  return STORAGE_KEYS.reduce<Record<string, string | null>>((result, key) => {
    result[key] = typeof storage[key] === "string" ? storage[key] as string : null;
    return result;
  }, {});
}

export function MudflatDevTools() {
  const [snapshot, setSnapshot] = useState<LocalSnapshot>(() => ({ highest: "-", lastMode: "-", best: "-", campaign: "-", activeRun: "-" }));
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [supervisorSeed, setSupervisorSeed] = useState("20261203");
  const [status, setStatus] = useState("개발 프리셋을 선택하면 해루질럿으로 이동해 바로 시작합니다.");
  // 맞춤 원정 빌더: 원하는 기술 레벨·활성 구성·단계·장비·시드를 골라 바로 실행하거나 정비 저장으로 남긴다.
  const [build, setBuild] = useState<DevBuild>(() => createMudflatDevBuild("normal"));
  const buildErrors = validateMudflatDevBuild(build);
  const buildSkills = mudflatDevBuildSkills(build.mode);
  const updateBuild = (patch: Partial<DevBuild>) => setBuild((current) => ({ ...current, ...patch }));
  const setBuildSkillLevel = (id: string, level: number) => setBuild((current) => {
    const skill = mudflatDevBuildSkills(current.mode).find((item) => item.id === id);
    const next = Math.max(0, Math.min(skill?.max ?? 6, Math.floor(Number.isFinite(level) ? level : 0)));
    const previous = current.levels[id] ?? 0;
    const basic = current.mode === "normal" && MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(id);
    let activeSkills = current.activeSkills;
    if (next <= 0) activeSkills = activeSkills.filter((item) => item !== id);
    else if (previous <= 0 && current.mode === "normal" && !basic && !activeSkills.includes(id) && activeSkills.length < MUDFLAT_SELECTABLE_SKILL_LIMIT) activeSkills = [...activeSkills, id];
    return { ...current, levels: { ...current.levels, [id]: next }, activeSkills };
  });
  const toggleBuildActive = (id: string) => setBuild((current) => {
    const isActive = current.activeSkills.includes(id);
    if (!isActive && current.activeSkills.length >= MUDFLAT_SELECTABLE_SKILL_LIMIT) return current;
    return { ...current, activeSkills: isActive ? current.activeSkills.filter((item) => item !== id) : [...current.activeSkills, id] };
  });
  const setBuildEquipment = (id: string, level: number) => setBuild((current) => {
    const item = MUDFLAT_SHOP_EQUIPMENT.find((entry) => entry.id === id);
    const next = Math.max(0, Math.min(item?.max ?? 6, Math.floor(Number.isFinite(level) ? level : 0)));
    return { ...current, equipment: { ...current.equipment, [id]: next } };
  });
  const numberField = (value: string, fallback = 0) => { const parsed = Number.parseInt(value, 10); return Number.isFinite(parsed) ? parsed : fallback; };
  const buildCampaign = () => mudflatDevBuildCampaign(build, createCampaign(build.characterId, build.mode, build.stage));
  // 바로 실행은 사람이 플레이하고, 감독모드 관전은 같은 세팅(기술 레벨·활성 구성·단계·장비·시드·보스 등장)을 AI 감독이 플레이한다.
  // 감독모드는 일반 모드에서만 열리고 이어하기 저장·최고 단계를 건드리지 않는다.
  const startBuild = (supervisor = false) => {
    if (buildErrors.length > 0 || (supervisor && build.mode !== "normal")) return;
    try {
      const campaign = buildCampaign();
      if (!supervisor) {
        window.localStorage.setItem(LAST_MODE_KEY, campaign.mode);
        window.localStorage.setItem(HIGHEST_STAGE_KEY, String(Math.max(1, Math.min(9, campaign.stage))));
        window.localStorage.removeItem(MUDFLAT_ACTIVE_RUN_KEY);
      }
      window.sessionStorage.setItem(MUDFLAT_DEV_LAUNCH_KEY, JSON.stringify({
        version: 1,
        seed: mudflatDevBuildSeed(build, createMudflatSeed),
        label: `맞춤 원정 · ${campaign.stage}단계${supervisor ? " · 감독모드" : ""}`,
        campaign,
        run: true,
        tutorial: build.stage === 1 && build.tutorial && !supervisor,
        supervisor,
        bossEarly: build.bossEarly,
      }));
      window.location.assign("/haeru");
    } catch {
      setStatus("맞춤 원정을 시작하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.");
    }
  };
  const saveBuildOnly = () => {
    if (buildErrors.length > 0) return;
    try {
      const campaign = buildCampaign();
      window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ ...campaign, inProgress: false }));
      window.localStorage.setItem(LAST_MODE_KEY, campaign.mode);
      window.localStorage.setItem(HIGHEST_STAGE_KEY, String(Math.max(1, Math.min(9, campaign.stage))));
      setSnapshot(readSnapshot());
      setStatus(`맞춤 원정 ${campaign.stage}단계 상태를 정비 화면 저장값으로 넣었습니다.`);
    } catch {
      setStatus("저장값을 넣지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.");
    }
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSnapshot(readSnapshot()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const stageRows = useMemo(() => {
    return [...MUDFLAT_REGULAR_STAGES, { stage: 9, name: "끝없는 물때", subtitle: "무한 조합 테스트", modifiers: ["엔드리스"] }]
      .map((stage) => mudflatStageProfile(stage.stage));
  }, []);

  const refreshSnapshot = () => {
    setSnapshot(readSnapshot());
    setStatus("현재 브라우저 저장값을 다시 읽었습니다.");
  };

  const startPreset = (preset: DevPreset, explicitSeed?: number) => {
    try {
      const campaign = makePresetCampaign(preset);
      if (!preset.supervisor) {
        window.localStorage.setItem(LAST_MODE_KEY, campaign.mode);
        window.localStorage.setItem(HIGHEST_STAGE_KEY, String(Math.max(1, Math.min(9, campaign.stage))));
        window.localStorage.removeItem(MUDFLAT_ACTIVE_RUN_KEY);
      }
      window.sessionStorage.setItem(MUDFLAT_DEV_LAUNCH_KEY, JSON.stringify({
        version: 1,
        seed: explicitSeed ?? (preset.supervisor ? createMudflatSeed() : 20261102 + preset.stage * 101),
        label: preset.title,
        campaign,
        run: true,
        tutorial: Boolean(preset.tutorial),
        supervisor: Boolean(preset.supervisor),
        bossEarly: Boolean(preset.bossEarly),
      }));
      window.location.assign("/haeru");
    } catch {
      setStatus("개발 프리셋을 적용하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.");
    }
  };

  const startRandomSupervisor = (preset: DevPreset) => {
    startPreset(preset, createMudflatSeed());
  };

  const replaySupervisorSeed = (preset: DevPreset) => {
    const seed = Number(supervisorSeed);
    if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
      setStatus("재현 시드는 1부터 4294967295 사이의 정수로 입력해 주세요.");
      return;
    }
    startPreset(preset, seed);
  };

  const savePresetOnly = (preset: DevPreset) => {
    try {
      const campaign = makePresetCampaign(preset);
      window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ ...campaign, inProgress: false }));
      window.localStorage.setItem(LAST_MODE_KEY, campaign.mode);
      window.localStorage.setItem(HIGHEST_STAGE_KEY, String(Math.max(1, Math.min(9, campaign.stage))));
      setSnapshot(readSnapshot());
      setStatus(`${preset.title} 상태를 정비 화면 저장값으로 넣었습니다.`);
    } catch {
      setStatus("저장값을 넣지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.");
    }
  };

  const clearSavedData = () => {
    try {
      STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
      window.sessionStorage.removeItem(MUDFLAT_DEV_LAUNCH_KEY);
      setExportText("");
      setSnapshot(readSnapshot());
      setStatus("해루질럿 관련 로컬 저장값을 정리했습니다.");
    } catch {
      setStatus("저장값 정리에 실패했습니다. 브라우저 저장소 설정을 확인해 주세요.");
    }
  };

  const exportData = async () => {
    const payload = collectExportPayload();
    setExportText(payload);
    try {
      await navigator.clipboard?.writeText(payload);
      setStatus("저장값을 클립보드에 복사했습니다.");
    } catch {
      setStatus("저장값을 아래 상자에 표시했습니다. 필요하면 직접 복사해 주세요.");
    }
  };

  const restoreData = () => {
    try {
      const storage = parseRestorePayload(importText);
      if (!window.confirm("현재 해루질럿 저장값을 붙여 넣은 데이터로 교체할까요?")) return;
      for (const key of STORAGE_KEYS) {
        const value = storage[key];
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      }
      window.sessionStorage.removeItem(MUDFLAT_DEV_LAUNCH_KEY);
      setSnapshot(readSnapshot());
      setStatus("내보낸 해루질럿 저장값을 이 브라우저에 복원했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장값을 복원하지 못했습니다.");
    }
  };

  const supervisorPreset = DEV_PRESETS.find((preset) => preset.supervisor);
  const testPresets = DEV_PRESETS.filter((preset) => !preset.supervisor);

  return (
    <main className="mudflat-dev-shell">
      <section className="mudflat-dev-hero">
        <Link href="/haeru" className="mudflat-dev-back">← 해루질럿으로</Link>
        <small>HAERUJILOT INTERNAL DEV</small>
        <h1>해루질럿 개발용 도구</h1>
        <p>직접 주소로만 접근하는 테스트 화면입니다. 서버 데이터나 비밀값을 바꾸지 않고, 현재 브라우저의 해루질럿 저장값과 테스트 진입만 다룹니다.</p>
        <div className="mudflat-dev-build"><span>빌드</span><b>{PAPEROID_BUILD_ID}</b></div>
      </section>

      {supervisorPreset && (
        <section className="mudflat-dev-supervisor">
          <div>
            <small>AI SUPERVISOR</small>
            <h2>{supervisorPreset.title}</h2>
            <p>{supervisorPreset.description}</p>
          </div>
          <div className="mudflat-dev-supervisor-controls">
            <button type="button" onClick={() => startRandomSupervisor(supervisorPreset)}>무작위 시드 관전 시작</button>
            <label>
              <span>재현 시드</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="감독모드 재현 시드"
                value={supervisorSeed}
                onChange={(event) => setSupervisorSeed(event.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </label>
            <button type="button" className="secondary" onClick={() => replaySupervisorSeed(supervisorPreset)}>입력 시드로 재현</button>
          </div>
        </section>
      )}

      <section className="mudflat-dev-warning">
        <b>공개 메뉴에는 노출되지 않는 테스트 도구입니다.</b>
        <span>다만 사이트 주소를 아는 사람은 열 수 있으므로, 운영 보안·관리자 권한 화면처럼 사용하면 안 됩니다.</span>
      </section>

      <section className="mudflat-dev-grid">
        <article className="mudflat-dev-panel">
          <header>
            <small>LOCAL STATE</small>
            <h2>현재 저장 상태</h2>
          </header>
          <dl className="mudflat-dev-state">
            <div><dt>열린 최고 단계</dt><dd>{snapshot.highest}</dd></div>
            <div><dt>마지막 모드</dt><dd>{snapshot.lastMode}</dd></div>
            <div><dt>최고 점수</dt><dd>{Number(snapshot.best).toLocaleString()}</dd></div>
            <div><dt>정비 저장</dt><dd>{snapshot.campaign}</dd></div>
            <div><dt>이어하기</dt><dd>{snapshot.activeRun}</dd></div>
          </dl>
          <div className="mudflat-dev-actions">
            <button type="button" onClick={refreshSnapshot}>다시 읽기</button>
            <button type="button" onClick={exportData}>저장값 내보내기</button>
            <button type="button" className="danger" onClick={clearSavedData}>해루질럿 저장값 정리</button>
          </div>
          {exportText && <textarea readOnly value={exportText} aria-label="해루질럿 저장값 내보내기" />}
          <label className="mudflat-dev-import">
            <b>저장값 복원</b>
            <span>위에서 내보낸 JSON을 붙여 넣으면 형식과 저장 키를 확인한 뒤 현재 브라우저에 복원합니다.</span>
            <textarea value={importText} onChange={(event) => setImportText(event.target.value)} aria-label="해루질럿 저장값 복원 JSON" placeholder="내보낸 JSON을 여기에 붙여 넣으세요." />
          </label>
          <div className="mudflat-dev-actions">
            <button type="button" onClick={restoreData} disabled={!importText.trim()}>붙여 넣은 저장값 복원</button>
          </div>
          <p className="mudflat-dev-status" role="status">{status}</p>
        </article>

        <article className="mudflat-dev-panel">
          <header>
            <small>STAGE MAP</small>
            <h2>단계 특징 빠른 확인</h2>
          </header>
          <div className="mudflat-dev-stage-list">
            {stageRows.map((stage) => (
              <span key={stage.stage}>
                <b>{stage.stage === 9 ? "9+" : stage.stage} · {stage.name}</b>
                <small>{stage.modifiers.slice(0, 4).join(" · ") || stage.subtitle}</small>
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="mudflat-dev-builder" aria-label="맞춤 원정 빌더">
        <header>
          <small>CUSTOM EXPEDITION</small>
          <h2>맞춤 원정 빌더</h2>
          <p>원하는 기술 레벨·활성 구성·단계·장비·시드를 골라 바로 실행하거나 정비 화면 저장으로 남깁니다. 바로 실행은 현재 진행 중 저장을 지웁니다.</p>
        </header>
        <div className="mudflat-dev-builder-grid">
          <fieldset>
            <legend>모드 · 단계</legend>
            <div className="mudflat-dev-choice" role="group" aria-label="모드">
              {(["normal", "kids"] as const).map((mode) => <button type="button" key={mode} aria-pressed={build.mode === mode} onClick={() => setBuild(createMudflatDevBuild(mode))}>{mode === "normal" ? "일반 모드" : "어린이 모드"}</button>)}
            </div>
            <div className="mudflat-dev-choice" role="group" aria-label="단계">
              {MUDFLAT_REGULAR_STAGES.map((stage) => <button type="button" key={stage.stage} aria-pressed={build.stage === stage.stage} onClick={() => updateBuild({ stage: stage.stage })}>{stage.stage}</button>)}
              <button type="button" aria-pressed={build.stage >= 9} onClick={() => updateBuild({ stage: Math.max(9, build.stage) })}>9+</button>
            </div>
            <label className="field"><span>단계 직접 입력 (9 이상은 끝없는 물때)</span><input type="number" min={1} max={MUDFLAT_DEV_BUILD_MAX_STAGE} value={build.stage} onChange={(event) => updateBuild({ stage: numberField(event.target.value, 1) })} /></label>
            {build.stage === 1 && <label className="check"><input type="checkbox" checked={build.tutorial} onChange={(event) => updateBuild({ tutorial: event.target.checked })} /><span>튜토리얼 포함</span></label>}
            <label className="check"><input type="checkbox" checked={build.bossEarly} onChange={(event) => updateBuild({ bossEarly: event.target.checked })} /><span>대왕 박하지 8초 뒤 등장 (기본 200초)</span></label>
            <fieldset className="mudflat-dev-seed">
              <legend>시드</legend>
              <div className="mudflat-dev-choice" role="group" aria-label="시드 방식">
                {([["fixed", "단계별 고정"], ["random", "무작위"], ["custom", "직접 입력"]] as const).map(([seedMode, label]) => <button type="button" key={seedMode} aria-pressed={build.seedMode === seedMode} onClick={() => updateBuild({ seedMode })}>{label}</button>)}
              </div>
              {build.seedMode === "custom" && <label className="field"><span>시드 (1 ~ 4294967295)</span><input type="text" inputMode="numeric" value={String(build.seed)} onChange={(event) => updateBuild({ seed: numberField(event.target.value.replace(/\D/g, "").slice(0, 10), 0) })} /></label>}
              {build.seedMode === "fixed" && <p className="mudflat-dev-hint">프리셋과 같은 고정 시드 {mudflatDevFixedSeed(build.stage)}</p>}
            </fieldset>
          </fieldset>
          <fieldset className="mudflat-dev-skill-table">
            <legend>기술{build.mode === "normal" && <em>활성 {build.activeSkills.length} / {MUDFLAT_SELECTABLE_SKILL_LIMIT}</em>}</legend>
            {buildSkills.map((skill) => {
              const basic = build.mode === "normal" && MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(skill.id);
              const level = build.levels[skill.id] ?? 0;
              const isActive = build.activeSkills.includes(skill.id);
              return <div className={`mudflat-dev-skill-row${basic ? " is-basic" : ""}`} key={skill.id}>
                <b>{skill.name}{basic && <small>기본</small>}</b>
                <div className="mudflat-dev-stepper">
                  <button type="button" aria-label={`${skill.name} 레벨 내리기`} disabled={level <= 0} onClick={() => setBuildSkillLevel(skill.id, level - 1)}>−</button>
                  <input type="number" min={0} max={skill.max} value={level} aria-label={`${skill.name} 레벨`} onChange={(event) => setBuildSkillLevel(skill.id, numberField(event.target.value, 0))} />
                  <button type="button" aria-label={`${skill.name} 레벨 올리기`} disabled={level >= skill.max} onClick={() => setBuildSkillLevel(skill.id, level + 1)}>＋</button>
                </div>
                {build.mode === "normal" && !basic ? <label className="check"><input type="checkbox" checked={isActive} disabled={!isActive && (level <= 0 || build.activeSkills.length >= MUDFLAT_SELECTABLE_SKILL_LIMIT)} onChange={() => toggleBuildActive(skill.id)} /><span>활성</span></label> : <span className="mudflat-dev-always">{build.mode === "normal" ? "항상 작동" : ""}</span>}
              </div>;
            })}
            {build.mode === "normal" && <label className="check"><input type="checkbox" checked={build.autoUnlock} onChange={(event) => updateBuild({ autoUnlock: event.target.checked })} /><span>해금 조건 자동 충족 (소쿠리의 달인은 경험치 보석 100개, 호미봇은 호미질 20회로 맞춤. 건곤대나이는 선택 기술 5종, 뻘권은 Lv.3 이상 기술 4개, 파이어볼은 선택 기술 6개 + 게 피격, 화염 방사는 Lv.2 선택 기술 5개 + 새우 피격, 서리 발자국은 선택 기술 5개 + 바위 피격, 빙결 파동은 Lv.3 선택 기술 4개 + 돌발 물살 피격, 번개 체인은 선택 기술 5개 + 모기떼 피격, 낙뢰는 Lv.2 선택 기술 4개 + 복어 피격이 필요하며 레벨이 있으면 피격 경험을 채움)</span></label>}
          </fieldset>
          <fieldset>
            <legend>캐릭터</legend>
            <label className="field"><span>캐릭터 레벨</span><input type="number" min={1} value={build.level} onChange={(event) => updateBuild({ level: numberField(event.target.value, 1) })} /></label>
            <label className="field"><span>현재 경험치</span><input type="number" min={0} value={build.xp} onChange={(event) => updateBuild({ xp: numberField(event.target.value, 0) })} /></label>
            <label className="field"><span>다음 레벨 경험치</span><input type="number" min={1} value={build.nextXp} onChange={(event) => updateBuild({ nextXp: numberField(event.target.value, 1) })} /></label>
            <label className="field"><span>코인</span><input type="number" min={0} value={build.coins} onChange={(event) => updateBuild({ coins: numberField(event.target.value, 0) })} /></label>
            <label className="field"><span>체력 (최대 체력 대비 %)</span><input type="number" min={1} max={100} value={build.hpPercent} onChange={(event) => updateBuild({ hpPercent: numberField(event.target.value, 100) })} /></label>
            {build.mode === "normal" && <label className="field"><span>누적 경험치 보석 수</span><input type="number" min={0} value={build.gemsCollected} onChange={(event) => updateBuild({ gemsCollected: numberField(event.target.value, 0) })} /></label>}
            {build.mode === "normal" && <label className="check"><input type="checkbox" checked={build.hitByCrab} onChange={(event) => updateBuild({ hitByCrab: event.target.checked })} /><span>게에게 피해를 받은 경험</span></label>}
            {build.mode === "normal" && <label className="check"><input type="checkbox" checked={build.hitByShrimp} onChange={(event) => updateBuild({ hitByShrimp: event.target.checked })} /><span>새우에게 피해를 받은 경험</span></label>}
            {build.mode === "normal" && <label className="check"><input type="checkbox" checked={build.hitByRock} onChange={(event) => updateBuild({ hitByRock: event.target.checked })} /><span>바위에 피해를 받은 경험</span></label>}
            {build.mode === "normal" && <label className="check"><input type="checkbox" checked={build.hitByTide} onChange={(event) => updateBuild({ hitByTide: event.target.checked })} /><span>돌발 물살에 피해를 받은 경험</span></label>}
            {build.mode === "normal" && <label className="check"><input type="checkbox" checked={build.hitByMosquito} onChange={(event) => updateBuild({ hitByMosquito: event.target.checked })} /><span>모기떼에게 피해를 받은 경험</span></label>}
            {build.mode === "normal" && <label className="check"><input type="checkbox" checked={build.hitByPufferfish} onChange={(event) => updateBuild({ hitByPufferfish: event.target.checked })} /><span>복어에게 피해를 받은 경험</span></label>}
            {build.mode === "normal" && <label className="field"><span>누적 호미질 수</span><input type="number" min={0} value={build.digsCompleted} onChange={(event) => updateBuild({ digsCompleted: numberField(event.target.value, 0) })} /></label>}
          </fieldset>
          <fieldset>
            <legend>장비</legend>
            {MUDFLAT_SHOP_EQUIPMENT.map((item) => {
              const level = build.equipment[item.id] ?? 0;
              return <div className="mudflat-dev-skill-row" key={item.id}>
                <b>{item.name}</b>
                <div className="mudflat-dev-stepper">
                  <button type="button" aria-label={`${item.name} 레벨 내리기`} disabled={level <= 0} onClick={() => setBuildEquipment(item.id, level - 1)}>−</button>
                  <input type="number" min={0} max={item.max} value={level} aria-label={`${item.name} 레벨`} onChange={(event) => setBuildEquipment(item.id, numberField(event.target.value, 0))} />
                  <button type="button" aria-label={`${item.name} 레벨 올리기`} disabled={level >= item.max} onClick={() => setBuildEquipment(item.id, level + 1)}>＋</button>
                </div>
                <span className="mudflat-dev-always" />
              </div>;
            })}
            <label className="check"><input type="checkbox" checked={build.mosquitoRepellent} onChange={(event) => updateBuild({ mosquitoRepellent: event.target.checked })} /><span>해충기피제 준비</span></label>
          </fieldset>
        </div>
        {buildErrors.length > 0 && <ul className="mudflat-dev-errors" role="alert">{buildErrors.map((error) => <li key={error}>{error}</li>)}</ul>}
        <div className="mudflat-dev-actions">
          <button type="button" onClick={() => startBuild(false)} disabled={buildErrors.length > 0}>바로 실행</button>
          <button type="button" className="secondary" onClick={() => startBuild(true)} disabled={buildErrors.length > 0 || build.mode !== "normal"} title={build.mode !== "normal" ? "AI 감독모드는 일반 모드에서만 관전할 수 있습니다." : "같은 세팅으로 AI 감독이 플레이하는 것을 관전합니다. 일반 저장을 건드리지 않습니다."}>감독모드로 관전</button>
          <button type="button" onClick={saveBuildOnly} disabled={buildErrors.length > 0}>정비 저장만</button>
          <button type="button" onClick={() => setBuild(createMudflatDevBuild(build.mode))}>초기화</button>
        </div>
      </section>

      <section className="mudflat-dev-presets">
        <header>
          <small>ONE TAP PRESETS</small>
          <h2>테스트 프리셋</h2>
          <p>바로 실행은 현재 진행 중 저장을 지웁니다. “감독모드로 관전”은 같은 세팅을 AI 감독이 플레이하는 것을 보며 저장을 건드리지 않습니다. “정비 저장만”은 다음에 해루질럿 메인에서 이어서 확인할 때 사용합니다.</p>
        </header>
        <div>
          {testPresets.map((preset) => (
            <article key={preset.id}>
              <small>{preset.stage}단계</small>
              <h3>{preset.title}</h3>
              <p>{preset.description}</p>
              <div>
                <button type="button" onClick={() => startPreset(preset)}>바로 실행</button>
                {(preset.mode ?? "normal") === "normal" && <button type="button" className="secondary" onClick={() => startPreset({ ...preset, supervisor: true }, createMudflatSeed())} title="같은 세팅으로 AI 감독이 플레이하는 것을 관전합니다. 일반 저장을 건드리지 않습니다.">감독모드로 관전</button>}
                <button type="button" onClick={() => savePresetOnly(preset)}>정비 저장만</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
