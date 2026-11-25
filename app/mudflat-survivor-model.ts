import {
  MUDFLAT_GENERAL_UPGRADES,
  MUDFLAT_RUN_SECONDS,
  MUDFLAT_UPGRADES,
  mudflatAdvancedSkillUnlocks,
  mudflatCastNetStats,
  mudflatElectricStats,
  mudflatEquipmentStats,
  mudflatHarpoonStats,
  mudflatNetStats,
  mudflatMosquitoChance,
  mudflatRockTurnerStats,
  mudflatGuardBasketStats,
  mudflatHoeBotStats,
  mudflatRockLiftStats,
  mudflatSmashStats,
  mudflatFireballStats,
  mudflatFlameBurstStats,
  mudflatFrostTrailStats,
  mudflatFrostWaveStats,
  mudflatChainLightningStats,
  mudflatThunderboltStats,
  mudflatSkillUnlocked,
  mudflatTongStats,
} from "./mudflat-survivor-engine.js";
import type { Campaign, CharacterOption, CountMap, GameMode, Screen, StageProfile } from "./mudflat-survivor-types";

export const BEST_KEY = "paperoid-mudflat-survivor-best-v1";
export const CAMPAIGN_KEY = "paperoid-mudflat-survivor-campaign-v1";
export const LAST_MODE_KEY = "paperoid-mudflat-survivor-last-mode-v1";
export const HIGHEST_STAGE_KEY = "paperoid-mudflat-survivor-highest-stage-v1";
export const MUDFLAT_DEV_LAUNCH_KEY = "paperoid-mudflat-dev-launch-v1";
export const MUDFLAT_BACK_GUARD_STATE = "paperoidMudflatRunBackGuard";
export const DAMAGE_TEXT_COLOR = "#ffd29a";
export const PLAYER_DAMAGE_TEXT_COLOR = "#ff695f";
export const LUMI_HOLD_MS = 3_000;
export const LUMI_CHARACTER: CharacterOption = { id: "lumi", icon: "●", sprite: "/mudflat-illustrations/lumi-side-tongs-walk-transparent.png", portrait: "/mudflat-illustrations/lumi-front-tongs-walk-transparent.png", spriteSheet: true, name: "탐험가 루미", description: "한 손의 집게와 3방향 걸음으로 갯벌을 누빕니다.", startLabel: "기본 장비 · 체력 100", levels: { hoe: 1, net: 0, salt: 0, boots: 0, basket: 0, stamina: 0 }, hp: 100 };
export const CHARACTERS: CharacterOption[] = [
  { id: "digger", icon: "⌁", name: "갯벌소년 펄럭", description: "넓은 갯벌 파동으로 시작합니다.", startLabel: "갯벌 파동 Lv.2", levels: { hoe: 2, net: 0, salt: 0, boots: 0, basket: 0, stamina: 0 }, hp: 115 },
  { id: "netter", icon: "◇", name: "뜰채장인 채리", description: "장거리 자동 뜰채를 빠르게 던집니다.", startLabel: "장거리 자동 뜰채 Lv.2", levels: { hoe: 1, net: 2, salt: 0, boots: 0, basket: 0, stamina: 0 }, hp: 100 },
  { id: "salter", icon: "✦", name: "바다요정 바요", description: "반짝이는 소금 결정의 정령과 함께 채집합니다.", startLabel: "소금 결정의 정령 Lv.2", levels: { hoe: 1, net: 0, salt: 2, boots: 0, basket: 0, stamina: 0 }, hp: 105 },
  LUMI_CHARACTER,
];
export const GENERAL_APPEARANCES: CharacterOption[] = [
  { id: "beginner", icon: "⌁", name: "기본 스킨", description: "기본 장비로 단단하게 시작합니다.", startLabel: "집게·호미질 기본 장착 · 체력 100", levels: { tongs: 1, harpoon: 0, net: 0, boots: 0, basket: 0, snack: 0, rocker: 0, digging: 1 }, hp: 100 },
  { ...LUMI_CHARACTER, description: "기술 구성은 그대로, 모습만 루미로 출발합니다.", startLabel: "집게·호미질 기본 장착 · 체력 100" },
];

export const mudflatSystemBackGuardScreen = (screen: Screen) => screen === "running" || screen === "paused" || screen === "upgrade";

export const GENERAL_CHARACTER = { id: "beginner", name: "기본 스킨", levels: { tongs: 1, harpoon: 0, net: 0, boots: 0, basket: 0, snack: 0, rocker: 0, digging: 1 }, hp: 100 };
export const defaultCharacterId = (mode: GameMode) => mode === "normal" ? "beginner" : "digger";
export const GENERAL_SKILL_ORDER = ["tongs", "digging", "harpoon", "net", "rocker", "electric", "cast-net", "guard-basket", "hoe-bot", "rock-lift", "smash", "fireball", "flame-burst", "frost-trail", "frost-wave", "chain-lightning", "thunderbolt", "boots", "snack", "basket"];
export const GENERAL_SKILL_LABELS: Record<string, string> = { tongs: "집게", digging: "호미질", harpoon: "작살", net: "뜰채", rocker: "돌뒤집개", electric: "전기", "cast-net": "그물", "guard-basket": "소쿠리", "hoe-bot": "호미봇", "rock-lift": "건곤", smash: "뻘권", fireball: "파이어볼", "flame-burst": "화염방사", "frost-trail": "서리", "frost-wave": "빙결", "chain-lightning": "번개", thunderbolt: "낙뢰", boots: "장화", snack: "간식", basket: "담기" };
export const DIRECTIONAL_SEAFOOD_TYPES = new Set(["pufferfish", "whelk", "fist-whelk", "golbaengi", "shrimp", "large-shrimp"]);
export const CATCH_FULL_MESSAGE = "더 담을 수가 없어. 다음에는 큰 통을 가져와야겠다.";

export function formatClock(seconds: number) {
  if (seconds >= MUDFLAT_RUN_SECONDS) {
    const tideElapsed = Math.floor(seconds - MUDFLAT_RUN_SECONDS);
    return `밀물 ${Math.floor(tideElapsed / 60)}:${String(tideElapsed % 60).padStart(2, "0")}`;
  }
  const remaining = Math.max(0, MUDFLAT_RUN_SECONDS - seconds);
  return `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`;
}

export function createCampaign(characterId: string, mode: GameMode, stage = 1): Campaign {
  const character = mode === "normal" ? GENERAL_CHARACTER : (CHARACTERS.find((item) => item.id === characterId) ?? CHARACTERS[0]);
  return {
    version: 1, mode, characterId, stage: Math.max(1, Math.floor(stage)), coins: 0, hp: character.hp, maxHp: character.hp, baseMaxHp: character.hp,
    level: 1, xp: 0, nextXp: mode === "normal" ? 10 : 8, levels: { ...character.levels }, activeSkills: [],
    equipment: { headlamp: 0, cooler: 0, vest: 0, gloves: 0, waders: 0 }, inventory: {}, lastHaul: {}, lastSaleValue: 0, totalScore: 0, lastBossCaught: false, gemsCollected: 0, digsCompleted: 0, lateRockFlips: 0, hitByCrab: false, hitByShrimp: false, hitByRock: false, hitByTide: false, hitByMosquito: false, hitByPufferfish: false,
    lastObjectiveLabel: "", lastObjectiveComplete: false, lastObjectiveBonus: 0,
  };
}

export function derivedMaxHp(baseMaxHp: number, equipment: CountMap, levels: CountMap, mode: GameMode) {
  if (mode !== "normal") return Math.max(1, baseMaxHp + Math.max(0, levels.stamina ?? 0) * 18);
  return mudflatEquipmentStats(equipment, baseMaxHp, levels.snack ?? 0).maxHp;
}

export function unlockedNormalUpgrades(levels: CountMap, stats: { gemsCollected?: number; digsCompleted?: number; lateRockFlips?: number; hitByCrab?: boolean; hitByShrimp?: boolean; hitByRock?: boolean; hitByTide?: boolean; hitByMosquito?: boolean; hitByPufferfish?: boolean } = {}) {
  const unlocks = mudflatAdvancedSkillUnlocks(levels, stats);
  return MUDFLAT_GENERAL_UPGRADES.filter((skill) => mudflatSkillUnlocked(skill, unlocks));
}

export function mudflatSkillDetail(skill: (typeof MUDFLAT_GENERAL_UPGRADES)[number], level: number, digging?: number, rocker?: number) {
  const safeLevel = Math.max(1, level);
  const nextLevel = Math.min(skill.max, safeLevel + 1);
  const nextLabel = safeLevel >= skill.max ? "최고 레벨에 도달했습니다." : `다음 강화 · Lv.${nextLevel}`;
  if (skill.id === "tongs") {
    const current = mudflatTongStats(safeLevel); const next = mudflatTongStats(nextLevel);
    return { current: `회전 속도 ${current.rotationSpeed.toFixed(1)} · 위력 ${current.power.toFixed(1)}`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 회전 속도 ${next.rotationSpeed.toFixed(1)} · 위력 ${next.power.toFixed(1)}` };
  }
  if (skill.id === "net") {
    const current = mudflatNetStats(safeLevel); const next = mudflatNetStats(nextLevel);
    return { current: `집게 사거리의 ${Math.round(current.scale * 100)}% · 뜰채 크기 ${Math.round(current.scale * 100)}%`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 사거리와 뜰채 크기 ${Math.round(next.scale * 100)}%` };
  }
  if (skill.id === "harpoon") {
    const current = mudflatHarpoonStats(safeLevel, 1); const next = mudflatHarpoonStats(nextLevel, 1);
    return { current: `피해 ${Math.round(current.damage)} · 사거리 ${Math.round(current.range)}px`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 피해 ${Math.round(next.damage)} · 사거리 ${Math.round(next.range)}px` };
  }
  if (skill.id === "rocker") {
    const current = mudflatRockTurnerStats(safeLevel); const next = mudflatRockTurnerStats(nextLevel);
    return { current: `처리 ${current.processingTime.toFixed(1)}초 · 재사용 ${current.cooldown.toFixed(1)}초`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 처리 ${next.processingTime.toFixed(1)}초 · 재사용 ${next.cooldown.toFixed(1)}초` };
  }
  if (skill.id === "electric") {
    const current = mudflatElectricStats(safeLevel); const next = mudflatElectricStats(nextLevel);
    return { current: `체력 50 초과 시 기본 집게 사거리 ${current.reach}px · ${current.interval.toFixed(1)}초마다 ${current.damage} 피해`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: ${next.interval.toFixed(1)}초마다 ${next.damage} 피해 · 10초마다 체력 5 소모` };
  }
  if (skill.id === "cast-net") {
    const current = mudflatCastNetStats(safeLevel); const next = mudflatCastNetStats(nextLevel);
    return { current: `무리 조준 · 반경 ${current.radius}px · ${current.holdSeconds.toFixed(1)}초 구속 후 ${current.damage} 피해 · 투척 간격 ${current.interval.toFixed(1)}초`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 반경 ${next.radius}px · 구속 ${next.holdSeconds.toFixed(1)}초 · 간격 ${next.interval.toFixed(1)}초` };
  }
  if (skill.id === "guard-basket") {
    const current = mudflatGuardBasketStats(safeLevel); const next = mudflatGuardBasketStats(nextLevel);
    const radius = (stats: ReturnType<typeof mudflatGuardBasketStats>) => stats.pullRadius >= 1200 ? "화면 전체" : `반경 ${stats.pullRadius}px`;
    const extras = `${next.bleedStop && !current.bleedStop ? " · 막을 때 출혈 정지" : ""}${next.invulnerableSeconds > current.invulnerableSeconds ? ` · 막은 뒤 ${next.invulnerableSeconds}초 무적` : ""}`;
    return { current: `${current.pullInterval}초마다 ${radius(current)} 보석 흡입 · 물살·운석·접촉 피해 1회 방어, 재충전 ${current.rechargeSeconds}초${current.bleedStop ? " · 막을 때 출혈 정지" : ""}${current.invulnerableSeconds > 0 ? ` · 막은 뒤 ${current.invulnerableSeconds}초 무적` : ""}`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: ${next.pullInterval}초마다 ${radius(next)} · 재충전 ${next.rechargeSeconds}초${extras}` };
  }
  if (skill.id === "hoe-bot") {
    const current = mudflatHoeBotStats(safeLevel); const next = mudflatHoeBotStats(nextLevel);
    const range = (stats: ReturnType<typeof mudflatHoeBotStats>) => stats.searchRange >= 1200 ? "화면 전체" : `${stats.searchRange}px`;
    const extras = `${next.gaebul && !current.gaebul ? " · 개불 숨구멍도 팜" : ""}${next.bots > current.bots ? " · 로봇 2대" : ""}`;
    return { current: `로봇 ${current.bots}대 · 구멍당 ${current.digSeconds}초 · 탐색 ${range(current)} · 이동 ${Math.round(current.speedMultiplier * 100)}%${current.gaebul ? " · 개불 숨구멍도 팜" : ""} · 조개 등급은 호미질 Lv.${Math.max(1, Math.floor(digging ?? 1))} 기준`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 구멍당 ${next.digSeconds}초 · 탐색 ${range(next)} · 이동 ${Math.round(next.speedMultiplier * 100)}%${extras}` };
  }
  if (skill.id === "rock-lift") {
    const current = mudflatRockLiftStats(safeLevel); const next = mudflatRockLiftStats(nextLevel);
    const radius = (stats: ReturnType<typeof mudflatRockLiftStats>) => stats.radius >= 1200 ? "화면 전체" : `반경 ${stats.radius}px`;
    return { current: `${current.interval}초마다 ${radius(current)} 바위 ${current.rocks}개를 띄워 떨어뜨림 · 낙하 피해 ${current.damage} · 발견물은 돌뒤집개 Lv.${Math.max(1, Math.floor(rocker ?? 1))} 기준`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: ${next.interval}초 · ${radius(next)} · ${next.rocks}개 · 피해 ${next.damage}` };
  }
  if (skill.id === "smash") {
    const current = mudflatSmashStats(safeLevel); const next = mudflatSmashStats(nextLevel);
    return { current: `재사용 ${current.cooldown}초 · 앞 ${current.length}px × 폭 ${current.width}px · 피해 ${current.damage} · 넉백 ${current.knockback}px · 바위 충돌 +${current.rockBonus}${current.chain ? " · 날아가다 부딪힌 해산물도 50% 피해와 넉백" : ""}`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 재사용 ${next.cooldown}초 · 피해 ${next.damage} · 넉백 ${next.knockback}px${next.chain && !current.chain ? " · 연쇄 넉백" : ""}` };
  }
  if (skill.id === "fireball") {
    const current = mudflatFireballStats(safeLevel); const next = mudflatFireballStats(nextLevel);
    const volley = (stats: ReturnType<typeof mudflatFireballStats>) => stats.shots === 1 ? "1발" : `${stats.shots}발(${stats.spacing}초 간격)`;
    return { current: `${current.interval}초마다 ${volley(current)} · 명중 피해 ${current.damage} · 반경 ${current.splash}px 근처도 같은 피해 · 사거리 ${current.range}px`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: ${volley(next)} · 피해 ${next.damage}` };
  }
  if (skill.id === "flame-burst") {
    const current = mudflatFlameBurstStats(safeLevel); const next = mudflatFlameBurstStats(nextLevel);
    return { current: `${current.interval}초마다 ${current.rays}방향 불줄기(길이 ${current.length}px · 폭 ${current.width}px) · 닿는 해산물마다 ${current.damage} 피해 · 첫 줄기는 바라보는 방향`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: ${next.rays}방향 · 피해 ${next.damage}` };
  }
  if (skill.id === "frost-trail") {
    const current = mudflatFrostTrailStats(safeLevel); const next = mudflatFrostTrailStats(nextLevel);
    return { current: `${current.interval}초마다 반경 ${current.radius}px 서리 바닥(${current.life}초) · 위의 해산물 둔화 ${Math.round(current.slow * 100)}% · ${current.tickSeconds}초마다 ${current.tickDamage} 피해`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 반경 ${next.radius}px · ${next.life}초 · 둔화 ${Math.round(next.slow * 100)}% · 피해 ${next.tickDamage}` };
  }
  if (skill.id === "frost-wave") {
    const current = mudflatFrostWaveStats(safeLevel); const next = mudflatFrostWaveStats(nextLevel);
    const effect = (stats: ReturnType<typeof mudflatFrostWaveStats>) => stats.freeze ? `${stats.slowSeconds}초 빙결` : `${stats.slowSeconds}초 둔화 ${Math.round(stats.slow * 100)}%`;
    return { current: `${current.interval}초마다 반경 ${current.radius}px 냉기 고리 · 닿는 해산물마다 ${current.damage} 피해 · ${effect(current)}`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 반경 ${next.radius}px · 피해 ${next.damage} · ${effect(next)}` };
  }
  if (skill.id === "chain-lightning") {
    const current = mudflatChainLightningStats(safeLevel); const next = mudflatChainLightningStats(nextLevel);
    return { current: `${current.interval}초마다 가까운 해산물에 ${current.damage} 피해 · ${current.jump}px 안으로 최대 ${current.chain}마리 번짐(번질 때마다 ${Math.round(current.decay * 100)}% 감소) · 0.2초 감전`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: ${next.interval}초 · 피해 ${next.damage} · ${next.chain}마리 · 감소 ${Math.round(next.decay * 100)}%` };
  }
  if (skill.id === "thunderbolt") {
    const current = mudflatThunderboltStats(safeLevel); const next = mudflatThunderboltStats(nextLevel);
    const strikes = (stats: ReturnType<typeof mudflatThunderboltStats>) => stats.strikes > 1 ? ` · 0.1초 간격 ${stats.strikes}연타` : "";
    return { current: `${current.interval}초마다 화면에서 체력이 가장 높은 해산물에 ${current.damage} 피해 · 반경 ${current.splash}px ${Math.round(current.splashRatio * 100)}%${strikes(current)} · 0.2초 감전`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: ${next.interval}초 · 피해 ${next.damage} · 주변 ${Math.round(next.splashRatio * 100)}%${strikes(next)}` };
  }
  if (skill.id === "boots") return { current: `이동속도와 진흙 저항 완화가 Lv.${safeLevel} 단계로 강화되었습니다.`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 이동속도와 깊은 펄 저항이 한 단계 더 좋아집니다.` };
  if (skill.id === "snack") return { current: `기본 최대 체력의 ${safeLevel * 20}%만큼 증가합니다.`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 기본 최대 체력 +${nextLevel * 20}%` };
  if (skill.id === "basket") return { current: `획득물 흡입 범위 Lv.${safeLevel}`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 더 먼 거리의 획득물을 끌어옵니다.` };
  return { current: "조개 구멍에서 채집할 때 더 좋은 조개를 얻을 확률이 적용됩니다.", next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 상위 조개와 진주 발견 확률이 높아집니다.` };
}

export function mudflatHiddenRockStage(stage: number) {
  return stage === 3 || stage === 4;
}

export function mudflatStageHazardNotes(profile: StageProfile) {
  const notes: string[] = [];
  if (profile.tideInterval > 0) notes.push(`돌발 물살 · 약 ${profile.tideInterval}초 주기 대피`);
  if (profile.wind > 0) notes.push("바람 · 이동 방향이 흔들림");
  if (profile.stage >= 6) notes.push("해산물 무리 · 불규칙한 방향·간격·구성으로 추가 출현");
  if (profile.waterChannels) notes.push("물골 · 지나갈 때 이동 감속");
  if (mudflatHiddenRockStage(profile.stage)) notes.push("숨은 돌 · 가까운 곳에 갑자기 등장");
  if (profile.fallingRocks > 0) notes.push("운석 · 충돌 피해와 바위 생성");
  if (profile.darkness >= DARK_STAGE_VISION_DARKNESS) notes.push("어둠 · 시야 제한");
  if (profile.stage === GAEBUL_STAGE) notes.push("깊은 펄 · 감속과 발 빠짐");
  if (profile.mosquitoes) {
    const chance = Math.round(mudflatMosquitoChance(profile.stage) * 100);
    notes.push(`모기떼 · 판 진입 ${chance}% · 발생 시점마다 ${chance}% · 피해 ${MOSQUITO_DAMAGE}, 체력 ${MOSQUITO_LOW_HP_THRESHOLD} 미만은 피해 없음`);
  }
  return notes;
}

export function mudflatStageRouteSummary(profile: StageProfile) {
  const notes = mudflatStageHazardNotes(profile);
  return notes.length > 0 ? notes.slice(0, 2).join(" · ") : "기본 이동과 채집 흐름을 익히는 단계";
}

export function withoutMosquitoRepellent(equipment: CountMap) {
  const rest = { ...equipment };
  delete rest[MOSQUITO_REPELLENT_KEY];
  return rest;
}

export const DARK_STAGE_VISION_DARKNESS = .6;
export const GAEBUL_STAGE = 5;
export const MOSQUITO_REPELLENT_KEY = "mosquitoRepellent";
export const MOSQUITO_REPELLENT_PRICE = 100;
export const MOSQUITO_DAMAGE = 6;
export const MOSQUITO_LOW_HP_THRESHOLD = 10;

// Children's mode still uses its own progression table, but the shell can type
// shared skill choices through the same light-weight shape.
export type UpgradeChoice = { id: string; icon: string; name: string; description: string; max: number };
export type KidsUpgradeChoice = (typeof MUDFLAT_UPGRADES)[number];
