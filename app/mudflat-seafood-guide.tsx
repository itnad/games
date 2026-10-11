"use client";

import {
  MUDFLAT_CLAM_GRADES,
  MUDFLAT_CREATURES,
  MUDFLAT_GAEBUL,
  MUDFLAT_PEARL,
  MUDFLAT_SEAFOOD_MARKET,
  mudflatStageProfile,
} from "./mudflat-survivor-engine.js";
import type { CreatureMovement, StageProfile } from "./mudflat-survivor-types";

type SeafoodGuideEntry = {
  type: string;
  name: string;
  image: string;
  category: string;
  hp: string;
  xp: string;
  price: string;
  appears: string;
  feature: string;
  tip: string;
  focus?: string;
};
type SeafoodMarketItem = { type: string; name: string; image: string; price: number; unit?: string };
type SeafoodCreatureTemplate = { id: string; family?: string; hp: number; xp: number; score: number; unlock: number; movement?: CreatureMovement; requiresHeadlamp?: boolean; spawnVariant?: boolean; boss?: boolean };
type SeafoodClamTemplate = { id: string; xp: number; score: number; price: number; vertical?: boolean };

const SEAFOOD_MOVEMENT_LABELS: Record<string, string> = {
  chase: "다가옴",
  flee: "도망감",
  oval: "급회전",
  still: "고정",
  wander: "배회",
};

function seafoodGuideCategory(type: string, creature?: SeafoodCreatureTemplate, clamGrade?: SeafoodClamTemplate) {
  if (creature?.boss) return "대형 목표";
  if (creature?.family === "crab") return "게류";
  if (type === "shrimp" || type === "large-shrimp") return "새우류";
  if (type === "whelk" || type === "fist-whelk" || type === "golbaengi") return "고둥·소라류";
  if (type === "octopus" || type === "gaebul") return "연체류";
  if (type === "flounder") return "어류";
  if (type === "pufferfish") return "위험 생물";
  if (clamGrade) return "조개류";
  if (type === MUDFLAT_PEARL.id) return "희귀 보상";
  return "기타";
}

function seafoodGuideAppears(type: string, creature?: SeafoodCreatureTemplate, clamGrade?: SeafoodClamTemplate) {
  if (type === MUDFLAT_GAEBUL.id) return "5단계 깊은 펄";
  if (type === MUDFLAT_PEARL.id) return "호미질 희귀 보상";
  if (clamGrade) return "조개 구멍 호미질";
  if (creature?.boss) return "마지막 물때 목표";
  if (creature?.spawnVariant) return type === "large-shrimp" ? "새우 출현 중 5%" : "특수 변종 출현";
  if (creature?.requiresHeadlamp) return "헤드랜턴으로 발견";
  if (!creature || creature.unlock <= 0) return "원정 시작부터";
  if (creature.unlock <= 45) return "원정 초반";
  if (creature.unlock <= 105) return "원정 중반";
  return "원정 후반";
}

function seafoodGuideFeature(type: string, creature?: SeafoodCreatureTemplate, clamGrade?: SeafoodClamTemplate) {
  if (type === MUDFLAT_GAEBUL.id) return "깊은 펄 보상";
  if (type === MUDFLAT_PEARL.id) return "고가 희귀품";
  if (clamGrade?.vertical) return "길게 솟는 조개";
  if (clamGrade) return "호미질 보상";
  const parts: string[] = [];
  if (creature?.boss) parts.push("대왕 목표");
  if (creature?.requiresHeadlamp) parts.push("랜턴 필요");
  if (creature?.spawnVariant && type !== "large-shrimp") parts.push("특수 변종");
  if (type === "large-shrimp") parts.push("큰 새우");
  if (type === "pufferfish") parts.push("접촉 위험");
  if (creature?.movement) parts.push(SEAFOOD_MOVEMENT_LABELS[creature.movement] ?? creature.movement);
  return parts.join(" · ") || "일반 채집";
}

function seafoodGuideTip(type: string, creature?: SeafoodCreatureTemplate, clamGrade?: SeafoodClamTemplate) {
  if (type === MUDFLAT_GAEBUL.id) return "깊은 펄 감속을 감수하고 구멍을 오래 파면 노릴 수 있습니다.";
  if (type === MUDFLAT_PEARL.id) return "호미질 레벨이 높을수록 더 좋은 결과를 기대할 수 있습니다.";
  if (clamGrade) return "구멍 위에서 호미질을 유지하면 채집됩니다.";
  if (type === "pufferfish") return "몸으로 부딪히지 말고 원거리 기술이나 그물로 처리하세요.";
  if (creature?.requiresHeadlamp) return "랜턴 범위 안에서 드러난 뒤 채집 판정이 쉬워집니다.";
  if (creature?.boss) return "충분한 기술 레벨과 체력을 갖춘 뒤 오래 추적해야 합니다.";
  return "집게로 체력을 깎고 자동 기술로 마무리하면 안정적입니다.";
}

const MUDFLAT_SEAFOOD_GUIDE: SeafoodGuideEntry[] = (MUDFLAT_SEAFOOD_MARKET as SeafoodMarketItem[]).map((marketItem) => {
  const creature = MUDFLAT_CREATURES.find((item) => item.id === marketItem.type) as SeafoodCreatureTemplate | undefined;
  const clamGrade = MUDFLAT_CLAM_GRADES.find((item) => item.id === marketItem.type) as SeafoodClamTemplate | undefined;
  const isGaebul = marketItem.type === MUDFLAT_GAEBUL.id;
  const isPearl = marketItem.type === MUDFLAT_PEARL.id;
  const xp = creature?.xp ?? clamGrade?.xp ?? (isGaebul ? MUDFLAT_GAEBUL.xp : isPearl ? MUDFLAT_PEARL.xp : 0);
  const score = creature?.score ?? clamGrade?.score ?? (isGaebul ? MUDFLAT_GAEBUL.score : isPearl ? MUDFLAT_PEARL.score : 0);
  return {
    type: marketItem.type,
    name: marketItem.name,
    image: marketItem.image,
    category: seafoodGuideCategory(marketItem.type, creature, clamGrade),
    hp: creature ? String(Math.ceil(creature.hp)) : isPearl ? "희귀" : "호미질",
    xp: `${xp} / ${score}점`,
    price: `${marketItem.price.toLocaleString()}C`,
    appears: seafoodGuideAppears(marketItem.type, creature, clamGrade),
    feature: seafoodGuideFeature(marketItem.type, creature, clamGrade),
    tip: seafoodGuideTip(marketItem.type, creature, clamGrade),
    focus: marketItem.type === MUDFLAT_GAEBUL.id ? "5단계 핵심" : creature?.boss ? "최종 목표" : undefined,
  };
});

export function MudflatSeafoodGuide({ activeStage, onClose }: { activeStage: number; onClose: () => void }) {
  const stage = Math.max(1, Math.floor(activeStage || 1));
  const profile = mudflatStageProfile(stage) as StageProfile;
  return (
    <div className="ms-layer ms-seafood-guide" role="dialog" aria-modal="true" aria-label="해산물 도감" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section>
        <button type="button" className="ms-seafood-close" aria-label="해산물 도감 닫기" onClick={onClose}>×</button>
        <small>SEAFOOD GUIDE</small>
        <h2>해산물 도감</h2>
        <p>전체 해산물 목록을 먼저 훑어보고, 궁금한 항목을 눌러 체력·보상·채집 팁을 펼쳐볼 수 있습니다.</p>
        <div className="ms-seafood-stage-note">
          <span><b>현재 확인 중</b>{stage}단계 · {profile.name}</span>
          <em>{profile.modifiers.slice(0, 3).join(" · ") || "기본 갯벌"}</em>
        </div>
        <div className="ms-seafood-list" role="list" aria-label="해산물 요약 목록" tabIndex={0}>
          {MUDFLAT_SEAFOOD_GUIDE.map((entry) => (
            <details key={entry.type} className={`ms-seafood-card${entry.focus ? " is-focus" : ""}`} role="listitem">
              <summary>
                <span className="ms-seafood-name"><img className={`ms-seafood-thumb${entry.type === "shrimp" ? " is-small-shrimp" : ""}`} src={entry.image} alt="" /> <b>{entry.name}</b>{entry.focus && <em>{entry.focus}</em>}</span>
                <span className="ms-seafood-summary"><b>{entry.category}</b><small>{entry.appears}</small></span>
                <strong>{entry.price}</strong>
                <i aria-hidden="true">자세히</i>
              </summary>
              <div className="ms-seafood-detail">
                <span><small>체력</small><b>{entry.hp}</b></span>
                <span><small>경험치·점수</small><b>{entry.xp}</b></span>
                <span><small>판매가</small><b>{entry.price}</b></span>
                <span><small>등장·채집</small><b>{entry.appears}</b></span>
                <p><b>{entry.feature}</b><small>{entry.tip}</small></p>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
