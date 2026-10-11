"use client";

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
  MUDFLAT_BACK_GUARD_STATE,
  MUDFLAT_DEV_LAUNCH_KEY,
  createCampaign,
} from "./mudflat-survivor-model";
import { MUDFLAT_REGULAR_STAGES, mudflatStageProfile } from "./mudflat-survivor-engine.js";

type DevPreset = {
  id: string;
  title: string;
  stage: number;
  description: string;
  mode?: GameMode;
  characterId?: string;
  tutorial?: boolean;
  coins?: number;
  level?: number;
  xp?: number;
  nextXp?: number;
  levels?: CountMap;
  equipment?: CountMap;
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
    title: "비밀 스킬 프리셋",
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
  MUDFLAT_BACK_GUARD_STATE,
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
    buildId: PAPEROID_BUILD_ID,
    exportedAt: new Date().toISOString(),
    storage: entries,
  }, null, 2);
}

export function MudflatDevTools() {
  const [snapshot, setSnapshot] = useState<LocalSnapshot>(() => ({ highest: "-", lastMode: "-", best: "-", campaign: "-", activeRun: "-" }));
  const [exportText, setExportText] = useState("");
  const [status, setStatus] = useState("개발 프리셋을 선택하면 해루질럿으로 이동해 바로 시작합니다.");

  useEffect(() => {
    setSnapshot(readSnapshot());
  }, []);

  const stageRows = useMemo(() => {
    return [...MUDFLAT_REGULAR_STAGES, { stage: 9, name: "끝없는 물때", subtitle: "무한 조합 테스트", modifiers: ["엔드리스"] }]
      .map((stage) => mudflatStageProfile(stage.stage));
  }, []);

  const refreshSnapshot = () => {
    setSnapshot(readSnapshot());
    setStatus("현재 브라우저 저장값을 다시 읽었습니다.");
  };

  const startPreset = (preset: DevPreset) => {
    try {
      const campaign = makePresetCampaign(preset);
      window.localStorage.setItem(LAST_MODE_KEY, campaign.mode);
      window.localStorage.setItem(HIGHEST_STAGE_KEY, String(Math.max(1, Math.min(9, campaign.stage))));
      window.localStorage.removeItem(MUDFLAT_ACTIVE_RUN_KEY);
      window.sessionStorage.setItem(MUDFLAT_DEV_LAUNCH_KEY, JSON.stringify({
        version: 1,
        label: preset.title,
        campaign,
        run: true,
        tutorial: Boolean(preset.tutorial),
      }));
      window.location.assign("/haeru");
    } catch {
      setStatus("개발 프리셋을 적용하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.");
    }
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

  return (
    <main className="mudflat-dev-shell">
      <section className="mudflat-dev-hero">
        <a href="/haeru" className="mudflat-dev-back">← 해루질럿으로</a>
        <small>HAERUJILOT INTERNAL DEV</small>
        <h1>해루질럿 개발용 도구</h1>
        <p>직접 주소로만 접근하는 테스트 화면입니다. 서버 데이터나 비밀값을 바꾸지 않고, 현재 브라우저의 해루질럿 저장값과 테스트 진입만 다룹니다.</p>
        <div className="mudflat-dev-build"><span>빌드</span><b>{PAPEROID_BUILD_ID}</b></div>
      </section>

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

      <section className="mudflat-dev-presets">
        <header>
          <small>ONE TAP PRESETS</small>
          <h2>테스트 프리셋</h2>
          <p>바로 실행은 현재 진행 중 저장을 지우고 선택한 상태로 시작합니다. “정비 저장만”은 다음에 해루질럿 메인에서 이어서 확인할 때 사용합니다.</p>
        </header>
        <div>
          {DEV_PRESETS.map((preset) => (
            <article key={preset.id}>
              <small>{preset.stage}단계</small>
              <h3>{preset.title}</h3>
              <p>{preset.description}</p>
              <div>
                <button type="button" onClick={() => startPreset(preset)}>바로 실행</button>
                <button type="button" onClick={() => savePresetOnly(preset)}>정비 저장만</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
