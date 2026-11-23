// 해루질럿 개발 도구의 맞춤 원정 빌더. 화면 상태(빌드 명세)를 검증하고 실제
// 캠페인 저장값으로 바꾼다. 순수 함수만 두어 Node 테스트로 검증한다.
import {
  MUDFLAT_FIXED_GENERAL_SKILL_IDS,
  MUDFLAT_GENERAL_UPGRADES,
  MUDFLAT_GUARD_BASKET_UNLOCK_GEMS,
  MUDFLAT_HOE_BOT_UNLOCK_DIGS,
  MUDFLAT_SELECTABLE_SKILL_LIMIT,
  MUDFLAT_SHOP_EQUIPMENT,
  MUDFLAT_UPGRADES,
  mudflatActiveLevels,
  mudflatEquipmentStats,
  mudflatNormalizeActiveSkills,
} from "./mudflat-survivor-engine.js";
import { withKoreanTopic } from "./korean-particles.js";

export const MUDFLAT_DEV_BUILD_VERSION = 1;
export const MUDFLAT_DEV_BUILD_MAX_STAGE = 30;
export const MUDFLAT_DEV_BUILD_SEED_MODES = ["fixed", "random", "custom"];
// 모델의 MOSQUITO_REPELLENT_KEY와 같은 값이어야 한다(소스 감사 테스트로 확인).
const MOSQUITO_REPELLENT_KEY = "mosquitoRepellent";
const KIDS_BASE_SKILL_ID = "hoe";

/**
 * @typedef {{
 *   version: 1, mode: "normal" | "kids", stage: number, tutorial: boolean, supervisor: boolean,
 *   characterId: string, level: number, xp: number, nextXp: number, coins: number, hpPercent: number,
 *   levels: Record<string, number>, activeSkills: string[], equipment: Record<string, number>,
 *   mosquitoRepellent: boolean, gemsCollected: number, digsCompleted: number, hitByCrab: boolean, hitByShrimp: boolean, hitByRock: boolean, hitByTide: boolean, autoUnlock: boolean,
 *   seedMode: "fixed" | "random" | "custom", seed: number,
 * }} MudflatDevBuild
 */

/** @param {string} [mode] */
export function mudflatDevBuildSkills(mode = "normal") {
  return mode === "normal" ? MUDFLAT_GENERAL_UPGRADES : MUDFLAT_UPGRADES;
}

// 기존 프리셋과 같은 단계별 고정 시드.
export function mudflatDevFixedSeed(stage = 1) {
  return 20261102 + Math.max(1, Math.floor(Number(stage) || 1)) * 101;
}

/** @returns {MudflatDevBuild} */
export function createMudflatDevBuild(mode = "normal") {
  const safeMode = mode === "kids" ? "kids" : "normal";
  /** @type {Record<string, number>} */
  const levels = {};
  for (const skill of mudflatDevBuildSkills(safeMode)) {
    const basic = safeMode === "normal" ? MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(skill.id) : skill.id === KIDS_BASE_SKILL_ID;
    levels[skill.id] = basic ? 1 : 0;
  }
  /** @type {Record<string, number>} */
  const equipment = {};
  for (const item of MUDFLAT_SHOP_EQUIPMENT) equipment[item.id] = 0;
  return {
    version: 1, mode: safeMode, stage: 1, tutorial: false, supervisor: false,
    characterId: safeMode === "normal" ? "beginner" : "digger",
    level: 1, xp: 0, nextXp: safeMode === "normal" ? 10 : 8, coins: 1000, hpPercent: 100,
    levels, activeSkills: [], equipment, mosquitoRepellent: false, gemsCollected: 0, digsCompleted: 0, hitByCrab: false, hitByShrimp: false, hitByRock: false, hitByTide: false, autoUnlock: true,
    seedMode: "fixed", seed: mudflatDevFixedSeed(1),
  };
}

const isInt = (value) => Number.isInteger(value);

/**
 * 실행 전에 보여 줄 오류 목록. 비어 있으면 실행할 수 있다.
 * @param {Partial<MudflatDevBuild> | null | undefined} build
 */
export function validateMudflatDevBuild(build) {
  /** @type {string[]} */
  const errors = [];
  if (!build || typeof build !== "object") return ["빌드 명세가 없습니다."];
  const mode = build.mode;
  if (mode !== "normal" && mode !== "kids") return ["모드는 일반 또는 어린이여야 합니다."];
  if (!isInt(build.stage) || build.stage < 1 || build.stage > MUDFLAT_DEV_BUILD_MAX_STAGE) errors.push(`단계는 1부터 ${MUDFLAT_DEV_BUILD_MAX_STAGE}까지입니다.`);
  const skills = mudflatDevBuildSkills(mode);
  for (const skill of skills) {
    const level = build.levels?.[skill.id] ?? 0;
    const basic = mode === "normal" ? MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(skill.id) : skill.id === KIDS_BASE_SKILL_ID;
    if (!isInt(level) || level < 0 || level > skill.max) errors.push(`${skill.name} 레벨은 0부터 ${skill.max}까지입니다.`);
    else if (basic && level < 1) errors.push(`${withKoreanTopic(skill.name)} 기본 기술이라 Lv.1 이상이어야 합니다.`);
  }
  if (mode === "normal") {
    const active = Array.isArray(build.activeSkills) ? build.activeSkills : [];
    if (active.length > MUDFLAT_SELECTABLE_SKILL_LIMIT) errors.push(`활성 기술은 최대 ${MUDFLAT_SELECTABLE_SKILL_LIMIT}개입니다.`);
    if (new Set(active).size !== active.length) errors.push("활성 기술이 중복되었습니다.");
    for (const id of active) {
      const skill = skills.find((item) => item.id === id);
      if (!skill || MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(id)) errors.push(`활성 목록에 둘 수 없는 기술 ID: ${id}`);
      else if ((build.levels?.[id] ?? 0) < 1) errors.push(`${withKoreanTopic(skill.name)} 레벨이 0이라 활성화할 수 없습니다.`);
    }
  }
  if (!isInt(build.level) || build.level < 1) errors.push("캐릭터 레벨은 1 이상의 정수여야 합니다.");
  if (!isInt(build.xp) || build.xp < 0) errors.push("경험치는 0 이상의 정수여야 합니다.");
  if (!isInt(build.nextXp) || build.nextXp < 1) errors.push("다음 레벨 경험치는 1 이상의 정수여야 합니다.");
  if (!isInt(build.coins) || build.coins < 0) errors.push("코인은 0 이상의 정수여야 합니다.");
  if (!isInt(build.hpPercent) || build.hpPercent < 1 || build.hpPercent > 100) errors.push("체력 비율은 1부터 100까지입니다.");
  for (const item of MUDFLAT_SHOP_EQUIPMENT) {
    const level = build.equipment?.[item.id] ?? 0;
    if (!isInt(level) || level < 0 || level > item.max) errors.push(`${item.name} 레벨은 0부터 ${item.max}까지입니다.`);
  }
  if (!isInt(build.gemsCollected) || build.gemsCollected < 0) errors.push("경험치 보석 수는 0 이상의 정수여야 합니다.");
  if (!isInt(build.digsCompleted) || build.digsCompleted < 0) errors.push("호미질 수는 0 이상의 정수여야 합니다.");
  if (!MUDFLAT_DEV_BUILD_SEED_MODES.includes(build.seedMode ?? "")) errors.push("시드 방식이 올바르지 않습니다.");
  else if (build.seedMode === "custom" && (!isInt(build.seed) || build.seed < 1 || build.seed > 0xffffffff)) errors.push("직접 입력 시드는 1부터 4294967295 사이의 정수여야 합니다.");
  if (build.supervisor && mode !== "normal") errors.push("AI 감독모드는 일반 모드에서만 관전할 수 있습니다.");
  return errors;
}

/**
 * 빌드 명세를 캠페인 저장값으로 바꾼다. baseCampaign은 createCampaign(characterId, mode, stage)의 결과다.
 * @param {MudflatDevBuild} build
 * @param {any} baseCampaign
 */
export function mudflatDevBuildCampaign(build, baseCampaign) {
  const mode = build.mode === "kids" ? "kids" : "normal";
  /** @type {Record<string, number>} */
  const levels = { ...baseCampaign.levels };
  for (const skill of mudflatDevBuildSkills(mode)) levels[skill.id] = Math.max(0, Math.min(skill.max, Math.floor(Number(build.levels?.[skill.id]) || 0)));
  const activeSkills = mudflatNormalizeActiveSkills(levels, build.activeSkills, mode);
  /** @type {Record<string, number>} */
  const equipment = { ...baseCampaign.equipment };
  for (const item of MUDFLAT_SHOP_EQUIPMENT) equipment[item.id] = Math.max(0, Math.min(item.max, Math.floor(Number(build.equipment?.[item.id]) || 0)));
  if (build.mosquitoRepellent) equipment[MOSQUITO_REPELLENT_KEY] = 1;
  else delete equipment[MOSQUITO_REPELLENT_KEY];
  const activeLevels = mudflatActiveLevels(levels, activeSkills, mode);
  const baseMaxHp = Math.max(1, Number(baseCampaign.baseMaxHp) || 100);
  const maxHp = mode === "normal"
    ? mudflatEquipmentStats(equipment, baseMaxHp, activeLevels.snack ?? 0).maxHp
    : Math.max(1, baseMaxHp + Math.max(0, levels.stamina ?? 0) * 18);
  const hpPercent = Math.max(1, Math.min(100, Math.floor(Number(build.hpPercent) || 100)));
  // 해금 조건 자동 충족: 소쿠리의 달인 레벨이 있으면 보석 100개, 호미봇 레벨이 있으면 호미질 20회를 채운다.
  const autoUnlock = mode === "normal" && build.autoUnlock !== false;
  const gemsCollected = Math.max(Math.max(0, Math.floor(Number(build.gemsCollected) || 0)), autoUnlock && (levels["guard-basket"] ?? 0) > 0 ? MUDFLAT_GUARD_BASKET_UNLOCK_GEMS : 0);
  const digsCompleted = Math.max(Math.max(0, Math.floor(Number(build.digsCompleted) || 0)), autoUnlock && (levels["hoe-bot"] ?? 0) > 0 ? MUDFLAT_HOE_BOT_UNLOCK_DIGS : 0);
  return {
    ...baseCampaign,
    mode,
    stage: Math.max(1, Math.floor(Number(build.stage) || 1)),
    coins: Math.max(0, Math.floor(Number(build.coins) || 0)),
    level: Math.max(1, Math.floor(Number(build.level) || 1)),
    xp: Math.max(0, Math.floor(Number(build.xp) || 0)),
    nextXp: Math.max(1, Math.floor(Number(build.nextXp) || 1)),
    levels, activeSkills, equipment, maxHp,
    hp: Math.max(1, Math.round(maxHp * hpPercent / 100)),
    gemsCollected, digsCompleted,
    // 자동 해금: 파이어볼·화염 방사 레벨이 있으면 게·새우 피격 경험을 채운다.
    hitByCrab: build.hitByCrab === true || (autoUnlock && (levels.fireball ?? 0) > 0),
    hitByShrimp: build.hitByShrimp === true || (autoUnlock && (levels["flame-burst"] ?? 0) > 0),
    hitByRock: build.hitByRock === true || (autoUnlock && (levels["frost-trail"] ?? 0) > 0),
    hitByTide: build.hitByTide === true || (autoUnlock && (levels["frost-wave"] ?? 0) > 0),
    pendingSkillDiscovery: false,
  };
}

/**
 * @param {MudflatDevBuild} build
 * @param {() => number} [randomSeed]
 */
export function mudflatDevBuildSeed(build, randomSeed = () => 1) {
  if (build.seedMode === "custom") return Math.floor(Number(build.seed) || 1);
  if (build.seedMode === "random") return randomSeed();
  return mudflatDevFixedSeed(build.stage);
}
