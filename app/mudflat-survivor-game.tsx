"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  MUDFLAT_CREATURES,
  MUDFLAT_CLAM_GRADES,
  MUDFLAT_FIXED_GENERAL_SKILL_IDS,
  MUDFLAT_GENERAL_UPGRADES,
  MUDFLAT_RECOVERY_FOODS,
  MUDFLAT_REGULAR_STAGES,
  MUDFLAT_RUN_SECONDS,
  MUDFLAT_SEAFOOD_MARKET,
  MUDFLAT_SHOP_EQUIPMENT,
  MUDFLAT_UPGRADES,
  mudflatBossPulse,
  mudflatAdvancedSkillUnlocks,
  mudflatCanLearnSkill,
  mudflatAutoSellInventory,
  mudflatBleedDamage,
  mudflatCastNetTarget,
  mudflatCastNetStats,
  mudflatCatchCapacity,
  mudflatElectricStats,
  mudflatEquipmentStats,
  mudflatEquipmentDescription,
  mudflatEquipmentPrice,
  mudflatClamRewardForRoll,
  mudflatCreatureForTime,
  mudflatFinalScore,
  mudflatHarpoonStats,
  mudflatJoystickVector,
  mudflatNetStats,
  mudflatMarketImageScale,
  mudflatPufferBleedOnContact,
  mudflatPufferBleedStep,
  mudflatPufferMovementForAge,
  mudflatShellMovementSpeed,
  mudflatRockCreatureForRoll,
  mudflatRockTurnerStats,
  mudflatStageProfile,
  mudflatStageEmptySeafoodHazard,
  mudflatInWaterChannel,
  mudflatEndlessObjectiveResult,
  mudflatSettleCatch,
  mudflatSpawnInterval,
  mudflatStageStats,
  mudflatTongStats,
  mudflatTerrainSpeedMultiplier,
  mudflatTrainingPrice,
  mudflatUpgradeChoices,
} from "./mudflat-survivor-engine.js";

type ExitProps = { onExit: () => void };
type Screen = "setup" | "running" | "upgrade" | "paused" | "camp" | "defeat";
type GameMode = "kids" | "normal";
type Point = { x: number; y: number };
type CountMap = Record<string, number>;
type StageObjective = { id: "catch" | "rocks" | "health"; label: string; target: number; bonus: number };
type StageProfile = { stage: number; name: string; subtitle: string; modifiers: string[]; waterChannels: boolean; tideInterval: number; safeZone: string; rockMultiplier: number; fallingRocks: number; darkness: number; mudSlow: number; seafoodSpawnMultiplier: number; wind: number; waves: boolean; swarms: boolean; coldThresholdMultiplier: number; finalBoss: boolean; endless: boolean; objective: StageObjective | null };
type CreatureMovement = "chase" | "still" | "wander" | "flee" | "oval";
type Creature = Point & { id: number; type: string; name: string; family?: string; sprite?: string; icon: string; color: string; hp: number; maxHp: number; speed: number; size: number; visualScale?: number; xp: number; score: number; boss?: boolean; saltHit: number; hitFlash: number; phase: number; age: number; movement: CreatureMovement; movementAngle: number; movementClock: number; facing?: 1 | -1; ovalDirection?: number };
type Pickup = Point & { id: number; xp: number };
type Projectile = Point & { id: number; vx: number; vy: number; damage: number; life: number };
type Harpoon = Point & { id: number; vx: number; vy: number; damage: number; distance: number; maxDistance: number; angle: number; hitIds: Set<number> };
type NetSlamEffect = Point & { id: number; life: number; maxLife: number; damage: number; radius: number; headDepth: number; range: number; angle: number; targetId: number; area: boolean; hit: boolean };
type CastNetEffect = Point & { id: number; targetId: number; life: number; maxLife: number; damage: number; radius: number; hit: boolean };
type Burst = Point & { id: number; life: number; maxLife: number; color: string; size: number };
type FloatText = Point & { id: number; life: number; text: string; color: string; kind?: "playerDamage" };
type Rock = Point & { id: number; radius: number; tone: number };
type ClamHole = Point & { id: number; radius: number; progress: number };
type ClamReveal = Point & { id: number; life: number; maxLife: number; type: string };
type RockFlipEffect = Point & { rockId: number; life: number; maxLife: number };
type FallingRock = Point & { id: number; life: number; maxLife: number; radius: number };

const ACTION_PROGRESS_RING_RADIUS = 18;
type Runtime = {
  mode: GameMode;
  stage: number;
  elapsed: number; player: Point & { hp: number; maxHp: number; baseMaxHp: number; speed: number; damageCooldown: number; facing: number; stride: number };
  creatures: Creature[]; pickups: Pickup[]; projectiles: Projectile[]; harpoons: Harpoon[]; netSlams: NetSlamEffect[]; castNets: CastNetEffect[]; rocks: Rock[]; clamHoles: ClamHole[]; clamReveals: ClamReveal[]; levels: CountMap; equipment: CountMap; basket: CountMap;
  bursts: Burst[]; floatTexts: FloatText[];
  level: number; xp: number; nextXp: number; caught: number; catchScore: number; bossCaught: boolean;
  bossSpawned: boolean; spawnClock: number; rockSpawnClock: number; clamSpawnClock: number; rockTurnClock: number; harpoonClock: number; hoeClock: number; netClock: number; castNetClock: number; electricClock: number; selfShockClock: number; electricPulseLife: number; electricStopNotified: boolean; selfShockNotified: boolean; discoveryMessageLife: number; playerMessage: string; playerMessageLife: number; playerMessageOpacity: number; pufferTouching: boolean; hiddenRockClock: number; hiddenRockIntroShown: boolean; catchFullNoticeClock: number; hoeEffect: number; rockFlipEffect: RockFlipEffect | null; bleedSeconds: number; bleedTickClock: number; emptySeafoodSeconds: number; emptySeafoodDamageClock: number;
  safeZone: Point; lastTideCycle: number; lastSandbarCycle: number; safeZoneTransition: number; tideFlash: number; fallClock: number; fallingRocks: FallingRock[]; swarmClock: number; waveClock: number; rocksFlipped: number;
  paused: boolean; ended: boolean;
};
type Hud = { mode: GameMode; stage: number; elapsed: number; hp: number; maxHp: number; level: number; xp: number; nextXp: number; caught: number; catchCapacity: number; score: number; levels: CountMap; basket: CountMap; bossCaught: boolean };
type Campaign = {
  version: 1; mode: GameMode; characterId: string; stage: number; coins: number; hp: number; maxHp: number; baseMaxHp: number;
  level: number; xp: number; nextXp: number; levels: CountMap; equipment: CountMap; inventory: CountMap; lastHaul: CountMap; lastSaleValue: number; totalScore: number; lastBossCaught: boolean;
  lastObjectiveLabel?: string; lastObjectiveComplete?: boolean; lastObjectiveBonus?: number; pendingSkillDiscovery?: boolean;
};

const BEST_KEY = "paperoid-mudflat-survivor-best-v1";
const CAMPAIGN_KEY = "paperoid-mudflat-survivor-campaign-v1";
const LAST_MODE_KEY = "paperoid-mudflat-survivor-last-mode-v1";
const HIGHEST_STAGE_KEY = "paperoid-mudflat-survivor-highest-stage-v1";
const DAMAGE_TEXT_COLOR = "#ffd29a";
const PLAYER_DAMAGE_TEXT_COLOR = "#ff695f";
const CHARACTERS = [
  { id: "digger", icon: "⌁", name: "호미꾼 하루", description: "넓은 호미질로 시작합니다.", levels: { hoe: 2, net: 0, salt: 0, boots: 0, basket: 0, stamina: 0 }, hp: 115 },
  { id: "netter", icon: "◇", name: "그물잡이 모아", description: "자동 뜰채를 빠르게 던집니다.", levels: { hoe: 1, net: 2, salt: 0, boots: 0, basket: 0, stamina: 0 }, hp: 100 },
  { id: "salter", icon: "✦", name: "소금장인 소금", description: "주위를 도는 왕소금을 사용합니다.", levels: { hoe: 1, net: 0, salt: 2, boots: 0, basket: 0, stamina: 0 }, hp: 105 },
];

const GENERAL_CHARACTER = { id: "beginner", name: "갯벌 초보", levels: { tongs: 1, harpoon: 0, net: 0, boots: 0, basket: 0, snack: 0, rocker: 0, digging: 1 }, hp: 100 };
const GENERAL_SKILL_ORDER = ["tongs", "digging", "harpoon", "net", "rocker", "electric", "cast-net", "boots", "snack", "basket"];
const GENERAL_SKILL_LABELS: Record<string, string> = { tongs: "집게", digging: "호미질", harpoon: "작살", net: "뜰채", rocker: "돌뒤집개", electric: "전기", "cast-net": "그물", boots: "장화", snack: "간식", basket: "바구니" };
const DIRECTIONAL_SEAFOOD_TYPES = new Set(["pufferfish", "whelk", "fist-whelk", "golbaengi", "shrimp"]);
const CATCH_FULL_MESSAGE = "더 담을 수가 없어. 다음에는 큰 통을 가져와야겠다.";
const emptyHud: Hud = { mode: "kids", stage: 1, elapsed: 0, hp: 100, maxHp: 100, level: 1, xp: 0, nextXp: 8, caught: 0, catchCapacity: 500, score: 0, levels: {}, basket: {}, bossCaught: false };

function MudflatBrand() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function MudflatTopbar({ onExit }: ExitProps) {
  return (
    <header className="game-topbar ms-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup">
        <MudflatBrand />
        <div><span>paperoid</span><strong>해루질럿</strong></div>
      </div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

function formatClock(seconds: number) {
  const remaining = Math.max(0, MUDFLAT_RUN_SECONDS - seconds);
  return `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`;
}

function createCampaign(characterId: string, mode: GameMode, stage = 1): Campaign {
  const character = mode === "normal" ? GENERAL_CHARACTER : (CHARACTERS.find((item) => item.id === characterId) ?? CHARACTERS[0]);
  return {
    version: 1, mode, characterId, stage: Math.max(1, Math.floor(stage)), coins: 0, hp: character.hp, maxHp: character.hp, baseMaxHp: character.hp,
    level: 1, xp: 0, nextXp: mode === "normal" ? 10 : 8, levels: { ...character.levels },
    equipment: { headlamp: 0, cooler: 0, vest: 0, gloves: 0, waders: 0 }, inventory: {}, lastHaul: {}, lastSaleValue: 0, totalScore: 0, lastBossCaught: false,
    lastObjectiveLabel: "", lastObjectiveComplete: false, lastObjectiveBonus: 0,
  };
}

function derivedMaxHp(baseMaxHp: number, equipment: CountMap, levels: CountMap, mode: GameMode) {
  if (mode !== "normal") return Math.max(1, baseMaxHp + Math.max(0, levels.stamina ?? 0) * 18);
  return mudflatEquipmentStats(equipment, baseMaxHp, levels.snack ?? 0).maxHp;
}

function unlockedNormalUpgrades(levels: CountMap) {
  const unlocks = mudflatAdvancedSkillUnlocks(levels);
  return MUDFLAT_GENERAL_UPGRADES.filter((skill) => !skill.advanced || (skill.id === "electric" ? unlocks.electric : unlocks.castNet));
}

function mudflatSkillDetail(skill: (typeof MUDFLAT_GENERAL_UPGRADES)[number], level: number) {
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
    return { current: `${current.interval.toFixed(1)}초마다 주변에 ${current.damage} 피해`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: ${next.interval.toFixed(1)}초마다 ${next.damage} 피해` };
  }
  if (skill.id === "cast-net") {
    const current = mudflatCastNetStats(safeLevel); const next = mudflatCastNetStats(nextLevel);
    return { current: `${current.interval.toFixed(1)}초마다 반경 ${current.radius}px에 ${current.damage} 피해`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: ${next.interval.toFixed(1)}초마다 반경 ${next.radius}px에 ${next.damage} 피해` };
  }
  if (skill.id === "boots") return { current: `이동과 생존이 Lv.${safeLevel} 단계로 강화되었습니다.`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 이동과 생존 능력이 한 단계 더 강화됩니다.` };
  if (skill.id === "snack") return { current: `기본 최대 체력의 ${safeLevel * 20}%만큼 증가합니다.`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 기본 최대 체력 +${nextLevel * 20}%` };
  if (skill.id === "basket") return { current: `획득물 흡입 범위 Lv.${safeLevel}`, next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 더 먼 거리의 획득물을 끌어옵니다.` };
  return { current: "조개 구멍에서 채집할 때 더 좋은 조개를 얻을 확률이 적용됩니다.", next: safeLevel >= skill.max ? nextLabel : `${nextLabel}: 상위 조개와 진주 발견 확률이 높아집니다.` };
}

function makeRuntime(campaign: Campaign): Runtime {
  const stats = mudflatEquipmentStats(campaign.equipment, campaign.baseMaxHp, campaign.mode === "normal" ? campaign.levels.snack : 0);
  return {
    mode: campaign.mode, stage: campaign.stage,
    elapsed: 0, player: { x: 0, y: 0, hp: Math.min(campaign.hp, stats.maxHp), maxHp: stats.maxHp, baseMaxHp: campaign.baseMaxHp, speed: 155, damageCooldown: 0, facing: 0, stride: 0 },
    creatures: [], pickups: [], projectiles: [], harpoons: [], netSlams: [], castNets: [], rocks: [], clamHoles: [], clamReveals: [], bursts: [], floatTexts: [], levels: { ...(campaign.mode === "normal" ? GENERAL_CHARACTER.levels : {}), ...campaign.levels }, equipment: { ...campaign.equipment }, basket: {}, level: campaign.level, xp: campaign.xp, nextXp: campaign.nextXp,
    caught: 0, catchScore: 0, bossCaught: false, bossSpawned: false, spawnClock: 0, rockSpawnClock: 0, clamSpawnClock: 0, rockTurnClock: 0, harpoonClock: 0, hoeClock: 0, netClock: 0, castNetClock: 0, electricClock: 0, selfShockClock: 10, electricPulseLife: 0, electricStopNotified: false, selfShockNotified: false, discoveryMessageLife: campaign.pendingSkillDiscovery ? 3 : 0,
    playerMessage: "", playerMessageLife: 0, playerMessageOpacity: 1, pufferTouching: false, hiddenRockClock: campaign.stage === 3 ? .5 : 0, hiddenRockIntroShown: false, catchFullNoticeClock: 0,
    hoeEffect: 0, rockFlipEffect: null, bleedSeconds: 0, bleedTickClock: 1, emptySeafoodSeconds: 0, emptySeafoodDamageClock: 0,
    safeZone: { x: 90, y: 0 }, lastTideCycle: 0, lastSandbarCycle: -1, safeZoneTransition: 0, tideFlash: 0, fallClock: 5, fallingRocks: [], swarmClock: 12, waveClock: 10, rocksFlipped: 0,
    paused: false, ended: false,
  };
}

function readSavedCampaign(): Campaign | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(CAMPAIGN_KEY) ?? "null") as Partial<Campaign> | null;
    if (!value || value.version !== 1 || (value.mode !== "kids" && value.mode !== "normal") || !Number.isFinite(value.stage) || !value.levels || !value.equipment || !value.inventory) return null;
    const restored: Campaign = {
      version: 1, mode: value.mode, characterId: String(value.characterId ?? "digger"), stage: Math.max(1, Math.floor(value.stage ?? 1)),
      coins: Math.max(0, Math.floor(value.coins ?? 0)), hp: Math.max(1, Number(value.hp ?? 1)), maxHp: Math.max(1, Number(value.maxHp ?? 1)), baseMaxHp: Math.max(1, Number(value.baseMaxHp ?? (value.mode === "normal" ? 100 : (CHARACTERS.find((item) => item.id === value.characterId)?.hp ?? 100)))),
      level: Math.max(1, Math.floor(value.level ?? 1)), xp: Math.max(0, Math.floor(value.xp ?? 0)), nextXp: Math.max(1, Math.floor(value.nextXp ?? 8)),
      levels: { ...value.levels }, equipment: { ...value.equipment }, inventory: { ...value.inventory }, lastHaul: { ...(value.lastHaul ?? {}) }, lastSaleValue: Math.max(0, Math.floor(value.lastSaleValue ?? 0)), totalScore: Math.max(0, Math.floor(value.totalScore ?? 0)), lastBossCaught: Boolean(value.lastBossCaught),
      lastObjectiveLabel: String(value.lastObjectiveLabel ?? ""), lastObjectiveComplete: Boolean(value.lastObjectiveComplete), lastObjectiveBonus: Math.max(0, Math.floor(value.lastObjectiveBonus ?? 0)), pendingSkillDiscovery: Boolean(value.pendingSkillDiscovery),
    };
    restored.maxHp = derivedMaxHp(restored.baseMaxHp, restored.equipment, restored.levels, restored.mode);
    restored.hp = Math.min(restored.hp, restored.maxHp);
    const unsold = mudflatAutoSellInventory(restored.inventory, restored.equipment.cooler ?? 0);
    if (unsold.count === 0) return restored;
    return { ...restored, coins: restored.coins + unsold.value, inventory: {}, lastHaul: unsold.haul as CountMap, lastSaleValue: unsold.value };
  } catch { return null; }
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, safeRadius);
}

function worldHash(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function waterChannelCenterX(worldY: number, stage: number, channel = 0) {
  if (channel === 0) return Math.sin((worldY + stage * 83) / 175) * 92 + Math.sin((worldY - stage * 41) / 430) * 52;
  return 265 + Math.sin((worldY - stage * 63) / 210) * 74;
}

function nextSandbarPosition(origin: Point, stage: number, cycle: number): Point {
  const seed = Math.sin((stage + 1) * 87.31 + (cycle + 1) * 43.17);
  const angle = seed * Math.PI + stage * .54 + cycle * .82;
  const distance = 172 + (Math.sin((cycle + 1) * 2.31 + stage) + 1) * 30;
  return { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance };
}

function drawWaterChannelArrows(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: Point,
  elapsed: number,
  profile: StageProfile,
) {
  const count = profile.endless || profile.stage === 8 ? 3 : 2;
  context.save();
  context.strokeStyle = "rgba(223, 247, 250, .72)";
  context.fillStyle = "rgba(223, 247, 250, .72)";
  context.lineWidth = 2.4;
  context.lineCap = "round";
  for (let index = 0; index < count; index += 1) {
    const channel = count === 3 && index === 2 ? 1 : 0;
    const screenY = ((elapsed * 13 + index * (height / count + 38)) % (height + 108)) - 54;
    const worldY = player.y + screenY - height / 2;
    const screenX = width / 2 + waterChannelCenterX(worldY, profile.stage, channel) - player.x;
    context.save();
    context.translate(screenX, screenY);
    context.rotate(Math.PI / 2);
    context.beginPath();
    context.moveTo(-11, -7); context.lineTo(0, 0); context.lineTo(-11, 7);
    context.stroke();
    context.restore();
  }
  context.restore();
}

function drawSandbarDirectionGuide(context: CanvasRenderingContext2D, width: number, player: Point, sandbar: Point) {
  const deltaX = sandbar.x - player.x;
  const deltaY = sandbar.y - player.y;
  const distance = Math.hypot(deltaX, deltaY);
  const angle = Math.atan2(deltaY, deltaX);
  const panelWidth = 208;
  const panelLeft = width / 2 - panelWidth / 2;
  const panelTop = 138;
  context.save();
  context.fillStyle = "rgba(19, 52, 64, .9)";
  roundedRect(context, panelLeft, panelTop, panelWidth, 36, 15); context.fill();
  context.strokeStyle = "rgba(151, 230, 236, .72)";
  context.lineWidth = 1.5; context.stroke();
  context.translate(panelLeft + 25, panelTop + 18);
  context.rotate(angle);
  context.fillStyle = "#ffe5a2";
  context.beginPath(); context.moveTo(10, 0); context.lineTo(-7, -7); context.lineTo(-3, 0); context.lineTo(-7, 7); context.closePath(); context.fill();
  context.restore();
  context.save();
  context.fillStyle = "#efffff";
  context.font = "800 13px system-ui";
  context.textAlign = "left";
  context.fillText(`다음 모래톱 · ${Math.round(distance / 10)}m`, panelLeft + 47, panelTop + 23);
  context.restore();
}

function drawMudflat(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: Point,
  tide: number,
  profile: StageProfile,
) {
  const base = context.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, `rgb(${122 - tide * 16},${107 + tide * 5},${77 + tide * 14})`);
  base.addColorStop(.55, `rgb(${101 - tide * 10},${91 + tide * 7},${67 + tide * 15})`);
  base.addColorStop(1, `rgb(${82 - tide * 7},${78 + tide * 12},${63 + tide * 21})`);
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);

  if (profile.waterChannels) {
    const channelCount = profile.endless || profile.stage === 8 ? 2 : 1;
    for (let channel = 0; channel < channelCount; channel += 1) {
      context.save();
      context.strokeStyle = "rgba(75, 156, 179, .34)";
      context.lineWidth = channel === 0 ? 84 : 68;
      context.lineCap = "round";
      context.beginPath();
      for (let screenY = -80; screenY <= height + 80; screenY += 24) {
        const worldY = player.y + screenY - height / 2;
        const worldX = waterChannelCenterX(worldY, profile.stage, channel);
        const screenX = width / 2 + worldX - player.x;
        if (screenY === -80) context.moveTo(screenX, screenY); else context.lineTo(screenX, screenY);
      }
      context.stroke();
      context.strokeStyle = "rgba(191, 232, 239, .24)";
      context.lineWidth = 3;
      context.stroke();
      context.restore();
    }
  }

  const tile = 138;
  const minWorldX = Math.floor((player.x - width / 2) / tile) - 1;
  const maxWorldX = Math.ceil((player.x + width / 2) / tile) + 1;
  const minWorldY = Math.floor((player.y - height / 2) / tile) - 1;
  const maxWorldY = Math.ceil((player.y + height / 2) / tile) + 1;
  for (let worldY = minWorldY; worldY <= maxWorldY; worldY += 1) {
    for (let worldX = minWorldX; worldX <= maxWorldX; worldX += 1) {
      const hash = worldHash(worldX, worldY);
      const screenX = width / 2 + worldX * tile - player.x + (hash - .5) * 62;
      const screenY = height / 2 + worldY * tile - player.y + (worldHash(worldY, worldX) - .5) * 58;
      if (hash > .54) {
        context.save();
        context.translate(screenX, screenY);
        context.rotate((hash - .5) * 1.8);
        const puddle = context.createRadialGradient(-12, -7, 2, 0, 0, 62);
        puddle.addColorStop(0, `rgba(111,174,170,${.27 + tide * .12})`);
        puddle.addColorStop(.65, `rgba(72,133,137,${.2 + tide * .1})`);
        puddle.addColorStop(1, "rgba(43,91,99,0)");
        context.fillStyle = puddle;
        context.beginPath();
        context.ellipse(0, 0, 67 + hash * 28, 25 + hash * 17, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "rgba(205,228,207,.13)";
        context.lineWidth = 1.5;
        for (let line = 0; line < 2; line += 1) {
          context.beginPath();
          context.ellipse(-13 + line * 18, -4 + line * 5, 21 + line * 8, 7 + line * 2, 0, Math.PI * .05, Math.PI * .92);
          context.stroke();
        }
        context.restore();
      } else if (hash < .2) {
        context.fillStyle = "rgba(42,35,28,.26)";
        context.beginPath();
        context.arc(screenX, screenY, 3 + hash * 11, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "rgba(224,197,145,.16)";
        context.lineWidth = 1;
        for (let mark = 0; mark < 3; mark += 1) {
          context.beginPath();
          context.moveTo(screenX + 7, screenY + mark * 5 - 5);
          context.quadraticCurveTo(screenX + 19, screenY + mark * 4 - 9, screenX + 31, screenY + mark * 4 - 4);
          context.stroke();
        }
      } else if (hash > .34 && hash < .41) {
        context.strokeStyle = "rgba(67,92,65,.34)";
        context.lineWidth = 2;
        for (let blade = -1; blade <= 1; blade += 1) {
          context.beginPath();
          context.moveTo(screenX, screenY + 9);
          context.quadraticCurveTo(screenX + blade * 6, screenY - 2, screenX + blade * 9, screenY - 13 - Math.abs(blade) * 3);
          context.stroke();
        }
      }
    }
  }

}

function creatureSpriteHorizontalScale(creature: Creature) {
  const facesRight = (creature.facing ?? 1) > 0;
  const artworkFacesRight = creature.type !== "shrimp";
  return facesRight === artworkFacesRight ? 1 : -1;
}

function drawCreatureSprite(context: CanvasRenderingContext2D, creature: Creature, elapsed: number, sprites: ReadonlyMap<string, HTMLImageElement>) {
  const size = creature.size * (creature.visualScale ?? 1);
  const wobble = Math.sin(elapsed * 5 + creature.phase) * .08;
  const bossPulse = creature.boss ? mudflatBossPulse(elapsed, creature.phase) : null;
  context.save();
  context.rotate(wobble);
  if (DIRECTIONAL_SEAFOOD_TYPES.has(creature.type)) context.scale(creatureSpriteHorizontalScale(creature), 1);
  context.fillStyle = "rgba(28,22,19,.28)";
  context.beginPath();
  context.ellipse(0, size * .72, size * 1.05, size * .38, 0, 0, Math.PI * 2);
  context.fill();
  if (bossPulse) context.scale(bossPulse.scaleX, bossPulse.scaleY);

  const sprite = creature.sprite && !creature.boss ? sprites.get(creature.type) : undefined;
  if (sprite?.complete && sprite.naturalWidth > 0) {
    const maxWidth = size * (creature.type === "flounder" ? 3.6 : 3.1);
    const maxHeight = size * 3;
    const scale = Math.min(maxWidth / sprite.naturalWidth, maxHeight / sprite.naturalHeight);
    const drawWidth = sprite.naturalWidth * scale;
    const drawHeight = sprite.naturalHeight * scale;
    context.filter = creature.hitFlash > 0 ? "brightness(1.8) saturate(.6)" : "none";
    context.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
    return;
  }

  if (creature.family === "crab") {
    const crabColor = bossPulse?.color ?? creature.color;
    context.strokeStyle = creature.boss ? "#111f46" : "#a94331";
    context.lineWidth = Math.max(2, size * .12);
    context.lineCap = "round";
    for (const side of [-1, 1]) {
      for (let leg = -1; leg <= 1; leg += 1) {
        context.beginPath();
        context.moveTo(side * size * .55, leg * size * .28);
        context.lineTo(side * size * (1.03 + Math.abs(leg) * .12), leg * size * .56 + size * .28);
        context.stroke();
      }
      context.beginPath();
      context.moveTo(side * size * .48, -size * .24);
      context.lineTo(side * size * 1.12, -size * .68);
      context.stroke();
      context.fillStyle = crabColor;
      context.beginPath();
      context.arc(side * size * 1.2, -size * .74, size * .34, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = creature.boss ? "#ffe08a" : "#f7b2a4";
      context.lineWidth = 2;
      context.stroke();
    }
    context.fillStyle = creature.hitFlash > 0 ? "#fff8e6" : crabColor;
    context.beginPath();
    context.ellipse(0, 0, size * 1.02, size * .68, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = creature.boss ? "#ffe084" : "rgba(255,238,220,.7)";
    context.lineWidth = creature.boss ? 4 : 2;
    context.stroke();
    for (const eyeX of [-.38, .38]) {
      context.fillStyle = "#fff9eb";
      context.beginPath(); context.arc(eyeX * size, -size * .56, size * .16, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#31251f";
      context.beginPath(); context.arc(eyeX * size, -size * .57, size * .075, 0, Math.PI * 2); context.fill();
    }
    if (creature.boss) {
      context.fillStyle = "#ffd65f";
      context.beginPath();
      context.moveTo(-size * .48, -size * .76); context.lineTo(-size * .25, -size * 1.25); context.lineTo(0, -size * .88);
      context.lineTo(size * .27, -size * 1.28); context.lineTo(size * .5, -size * .75); context.closePath(); context.fill();
    }
  } else if (creature.type === "shrimp") {
    context.strokeStyle = creature.hitFlash > 0 ? "#fff8f1" : creature.color;
    context.lineWidth = Math.max(2, size * .18);
    context.lineCap = "round";
    context.beginPath();
    context.arc(-size * .08, 0, size * .83, -.9, Math.PI * .92);
    context.stroke();
    context.fillStyle = creature.hitFlash > 0 ? "#fff8f1" : creature.color;
    context.beginPath(); context.ellipse(size * .55, -size * .17, size * .48, size * .34, -.2, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.moveTo(-size * .73, size * .4); context.lineTo(-size * 1.22, size * .08); context.lineTo(-size * 1.05, size * .7); context.closePath(); context.fill();
    context.strokeStyle = "rgba(91,52,43,.68)"; context.lineWidth = 1.3;
    for (let segment = -1; segment <= 2; segment += 1) { context.beginPath(); context.moveTo(segment * size * .28, -size * .45); context.lineTo(segment * size * .18, size * .5); context.stroke(); }
    context.strokeStyle = creature.color; context.lineWidth = 1.2;
    context.beginPath(); context.moveTo(size * .82, -size * .34); context.quadraticCurveTo(size * 1.42, -size * .78, size * 1.66, -size * .3); context.stroke();
    context.fillStyle = "#2b2421"; context.beginPath(); context.arc(size * .75, -size * .31, size * .07, 0, Math.PI * 2); context.fill();
  } else if (creature.type === "whelk") {
    context.fillStyle = creature.hitFlash > 0 ? "#fff7e9" : creature.color;
    context.beginPath(); context.ellipse(0, size * .16, size * 1.05, size * .78, -.2, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "rgba(94,58,35,.55)"; context.lineWidth = 2.2;
    context.beginPath(); context.arc(-size * .08, size * .08, size * .5, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.arc(-size * .08, size * .08, size * .25, 0, Math.PI * 2); context.stroke();
    context.fillStyle = "#b97e58"; roundedRect(context, -size * 1.18, size * .45, size * 1.2, size * .42, size * .2); context.fill();
  } else if (creature.type === "octopus") {
    context.strokeStyle = creature.hitFlash > 0 ? "#fff0fb" : creature.color; context.lineWidth = size * .3; context.lineCap = "round";
    for (let tentacle = 0; tentacle < 5; tentacle += 1) {
      const startX = (tentacle - 2) * size * .32;
      context.beginPath(); context.moveTo(startX, size * .35); context.quadraticCurveTo(startX + Math.sin(elapsed * 4 + tentacle) * size * .35, size, startX + (tentacle - 2) * size * .16, size * 1.2); context.stroke();
    }
    context.fillStyle = creature.hitFlash > 0 ? "#fff0fb" : creature.color;
    context.beginPath(); context.ellipse(0, -size * .12, size * .86, size * .9, 0, 0, Math.PI * 2); context.fill();
    for (const eyeX of [-.27, .27]) { context.fillStyle = "#fff"; context.beginPath(); context.arc(eyeX * size, -size * .24, size * .14, 0, Math.PI * 2); context.fill(); context.fillStyle = "#352438"; context.beginPath(); context.arc(eyeX * size, -size * .22, size * .065, 0, Math.PI * 2); context.fill(); }
  } else {
    context.fillStyle = creature.hitFlash > 0 ? "#fff" : creature.color;
    context.beginPath(); context.ellipse(0, size * .08, size * 1.06, size * .78, 0, Math.PI, Math.PI * 2); context.lineTo(size * 1.06, size * .28); context.quadraticCurveTo(0, size * .94, -size * 1.06, size * .28); context.closePath(); context.fill();
    context.strokeStyle = "rgba(120,91,54,.48)"; context.lineWidth = 1.5;
    for (let ridge = -2; ridge <= 2; ridge += 1) { context.beginPath(); context.moveTo(0, -size * .66); context.lineTo(ridge * size * .34, size * .4); context.stroke(); }
    for (const eyeX of [-.28, .28]) { context.fillStyle = "#2d2925"; context.beginPath(); context.arc(eyeX * size, size * .1, size * .07, 0, Math.PI * 2); context.fill(); }
  }
  context.restore();
}

function drawGatherer(context: CanvasRenderingContext2D, x: number, y: number, player: Runtime["player"], characterId: string, hasHeadlamp: boolean) {
  const direction = Math.cos(player.facing) < 0 ? -1 : 1;
  const bob = Math.sin(player.stride * 9) * 1.8;
  context.save();
  context.translate(x, y + bob);
  context.scale(direction, 1);
  if (hasHeadlamp) {
    const beam = context.createLinearGradient(12, -34, 112, -34);
    beam.addColorStop(0, "rgba(255,232,151,.27)");
    beam.addColorStop(1, "rgba(255,232,151,0)");
    context.fillStyle = beam;
    context.beginPath(); context.moveTo(12, -39); context.lineTo(112, -65); context.lineTo(112, -3); context.closePath(); context.fill();
  }
  context.fillStyle = "rgba(24,20,17,.3)";
  context.beginPath(); context.ellipse(0, 22, 25, 9, 0, 0, Math.PI * 2); context.fill();
  context.strokeStyle = "#273e40"; context.lineWidth = 7; context.lineCap = "round";
  context.beginPath(); context.moveTo(-7, 10); context.lineTo(-10, 22 + Math.sin(player.stride * 9) * 3); context.stroke();
  context.beginPath(); context.moveTo(7, 10); context.lineTo(11, 22 - Math.sin(player.stride * 9) * 3); context.stroke();
  context.fillStyle = player.damageCooldown > 0 ? "#fff7e7" : characterId === "netter" ? "#4a8aa6" : characterId === "salter" ? "#ad7649" : "#e76e4e";
  roundedRect(context, -16, -9, 32, 28, 11); context.fill();
  context.fillStyle = "#f2bb86"; context.beginPath(); context.arc(0, -17, 12, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#3b3029"; context.beginPath(); context.arc(-4, -18, 1.5, 0, Math.PI * 2); context.arc(4, -18, 1.5, 0, Math.PI * 2); context.fill();
  context.strokeStyle = "#6f3f2f"; context.lineWidth = 1.4; context.beginPath(); context.arc(0, -15, 4, .2, Math.PI - .2); context.stroke();
  context.fillStyle = "#f5d87a"; context.beginPath(); context.ellipse(0, -28, 24, 6, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#e8b950"; roundedRect(context, -13, -39, 26, 13, 5); context.fill();
  context.fillStyle = "#41352c"; context.fillRect(-14, -30, 28, 3);
  if (hasHeadlamp) {
    context.fillStyle = "#3b3835"; roundedRect(context, -14, -36, 28, 5, 2); context.fill();
    context.fillStyle = "#273036"; roundedRect(context, 9, -41, 13, 13, 4); context.fill();
    context.strokeStyle = "#11191d"; context.lineWidth = 1.5; context.stroke();
    context.fillStyle = "#fff0a4"; context.beginPath(); context.arc(18, -34.5, 4.2, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#fffbe0"; context.beginPath(); context.arc(19.2, -35.7, 1.5, 0, Math.PI * 2); context.fill();
  }
  context.fillStyle = "#c58b49"; roundedRect(context, 13, -1, 15, 20, 5); context.fill();
  context.strokeStyle = "#eed7a4"; context.lineWidth = 2; context.beginPath(); context.arc(20, 0, 9, Math.PI, Math.PI * 2); context.stroke();
  context.restore();
}

function drawRock(context: CanvasRenderingContext2D, rock: Rock, effect?: RockFlipEffect) {
  const radius = rock.radius;
  const progress = effect ? Math.max(0, Math.min(1, 1 - effect.life / effect.maxLife)) : 0;
  const shakeEnvelope = effect ? Math.sin(Math.min(1, progress / .72) * Math.PI) : 0;
  const shake = effect ? Math.sin(progress * Math.PI * 14) * 2.4 * shakeEnvelope : 0;
  const liftProgress = effect ? Math.max(0, (progress - .58) / .42) : 0;
  context.save();
  context.translate(shake, -radius * .72 * liftProgress * liftProgress);
  context.rotate((rock.tone - .5) * .35 + shake * .015 + liftProgress * .24);
  context.globalAlpha = progress > .84 ? Math.max(0, (1 - progress) / .16) : 1;
  context.fillStyle = "rgba(25,21,19,.28)";
  context.beginPath(); context.ellipse(3, radius * .72, radius * 1.1, radius * .42, 0, 0, Math.PI * 2); context.fill();
  const gradient = context.createLinearGradient(-radius, -radius, radius, radius);
  gradient.addColorStop(0, rock.tone > .5 ? "#958878" : "#81786c");
  gradient.addColorStop(1, rock.tone > .5 ? "#4f4a45" : "#5f5750");
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(-radius, radius * .2); context.lineTo(-radius * .58, -radius * .7); context.lineTo(radius * .18, -radius);
  context.lineTo(radius * .92, -radius * .32); context.lineTo(radius * .78, radius * .55); context.lineTo(-radius * .2, radius * .85);
  context.closePath(); context.fill();
  context.strokeStyle = "rgba(240,225,197,.22)"; context.lineWidth = 2; context.stroke();
  context.restore();
  if (effect) {
    context.save();
    context.strokeStyle = "rgba(38,31,28,.58)"; context.lineWidth = 6;
    context.beginPath(); context.arc(0, 0, ACTION_PROGRESS_RING_RADIUS, -Math.PI / 2, Math.PI * 1.5); context.stroke();
    context.strokeStyle = "#ffe29a"; context.lineWidth = 4;
    context.beginPath(); context.arc(0, 0, ACTION_PROGRESS_RING_RADIUS, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); context.stroke();
    context.fillStyle = "#fff8df"; context.font = "900 11px system-ui"; context.textAlign = "center";
    context.shadowColor = "rgba(20,16,14,.78)"; context.shadowBlur = 5;
    context.fillText(`돌뒤집기 ${Math.ceil(progress * 100)}%`, 0, -ACTION_PROGRESS_RING_RADIUS - 7);
    context.restore();
  }
}

function drawClamHole(context: CanvasRenderingContext2D, hole: ClamHole) {
  const active = hole.progress > 0;
  context.save();
  context.fillStyle = "rgba(28,23,20,.28)";
  context.beginPath(); context.ellipse(2, 5, hole.radius * 1.2, hole.radius * .62, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = active ? "#382f29" : "#50453c";
  context.beginPath(); context.ellipse(0, 0, hole.radius, hole.radius * .48, 0, 0, Math.PI * 2); context.fill();
  context.strokeStyle = active ? "#f4d38b" : "rgba(218,191,145,.52)";
  context.lineWidth = active ? 3 : 1.5;
  context.stroke();
  context.fillStyle = "rgba(11,16,16,.7)";
  context.beginPath(); context.ellipse(0, 1, hole.radius * .48, hole.radius * .2, 0, 0, Math.PI * 2); context.fill();
  if (active) {
    const progress = Math.min(1, hole.progress / 2);
    context.strokeStyle = "rgba(38,31,28,.5)"; context.lineWidth = 6;
    context.beginPath(); context.arc(0, 0, ACTION_PROGRESS_RING_RADIUS, -Math.PI / 2, Math.PI * 1.5); context.stroke();
    context.strokeStyle = "#ffe29a"; context.lineWidth = 4;
    context.beginPath(); context.arc(0, 0, ACTION_PROGRESS_RING_RADIUS, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); context.stroke();
    context.fillStyle = "#fff8df"; context.font = "900 11px system-ui"; context.textAlign = "center";
    context.fillText(`호미질 ${Math.ceil(progress * 100)}%`, 0, -ACTION_PROGRESS_RING_RADIUS - 7);
  }
  context.restore();
}

function drawClamDigging(context: CanvasRenderingContext2D, origin: Point, target: Point, progress: number) {
  const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
  const strike = Math.sin((progress * 4 % 1) * Math.PI);
  // Keep the hoe close to the gatherer: a short grip and an immediately
  // visible hoe head read more naturally than a long pole across the field.
  const gripLength = 24;
  const headX = gripLength + 3;
  context.save(); context.translate(origin.x, origin.y); context.rotate(angle - .85 + strike * 1.15);
  context.strokeStyle = "rgba(28,23,20,.35)"; context.lineWidth = 8; context.lineCap = "round";
  context.beginPath(); context.moveTo(8, 6); context.lineTo(gripLength, 6); context.stroke();
  context.strokeStyle = "#d7b270"; context.lineWidth = 5;
  context.beginPath(); context.moveTo(8, 0); context.lineTo(gripLength, 0); context.stroke();
  context.strokeStyle = "#64706c"; context.lineWidth = 7;
  context.beginPath(); context.moveTo(headX, -10); context.lineTo(headX + 8, 9); context.stroke();
  context.restore();
}

function drawExperiencePickup(context: CanvasRenderingContext2D, pickup: Pickup, elapsed: number) {
  const pulse = 1 + Math.sin(elapsed * 7 + pickup.id) * .12;
  const drawDiamond = (radius: number, fill: string, stroke: string, lineWidth = 1.5) => {
    context.fillStyle = fill;
    context.beginPath(); context.moveTo(0, -radius); context.lineTo(radius * .8, 0); context.lineTo(0, radius); context.lineTo(-radius * .8, 0); context.closePath(); context.fill();
    context.strokeStyle = stroke; context.lineWidth = lineWidth; context.stroke();
  };
  const drawDot = (x: number, y: number, radius = 3.25) => {
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "#e7fff4"; context.lineWidth = 1; context.stroke();
  };

  context.save(); context.scale(pulse, pulse);
  if (pickup.xp <= 5) {
    context.fillStyle = "#74e2bd";
    if (pickup.xp === 1) drawDot(0, 0);
    else if (pickup.xp === 2) { drawDot(0, -4); drawDot(0, 4); }
    else if (pickup.xp === 3) { drawDot(0, -5); drawDot(-4, 3); drawDot(4, 3); }
    else if (pickup.xp === 4) { drawDot(-4, -4); drawDot(4, -4); drawDot(-4, 4); drawDot(4, 4); }
    else { drawDot(0, 0, 5.25); }
  } else if (pickup.xp <= 10) {
    drawDiamond(8, "#74e2bd", "#e7fff4");
  } else if (pickup.xp <= 20) {
    context.fillStyle = "rgba(123,255,220,.2)"; context.beginPath(); context.arc(0, 0, 18, 0, Math.PI * 2); context.fill();
    drawDiamond(11, "#81f0ce", "#f0fff9", 1.7);
  } else if (pickup.xp <= 30) {
    context.fillStyle = "rgba(69,242,229,.19)"; context.beginPath(); context.arc(0, 0, 24, 0, Math.PI * 2); context.fill();
    drawDiamond(15, "#44cfc4", "#e6fffa", 2);
    context.fillStyle = "rgba(219,255,251,.7)"; context.beginPath(); context.moveTo(0, -10); context.lineTo(5, 0); context.lineTo(0, 5); context.closePath(); context.fill();
  } else {
    const glint = .45 + .55 * Math.max(0, Math.sin(elapsed * 12 + pickup.id));
    context.fillStyle = "rgba(248,213,111,.2)"; context.beginPath(); context.arc(0, 0, 29, 0, Math.PI * 2); context.fill();
    drawDiamond(20, "#27b9bd", "#fff7c7", 2.5);
    context.fillStyle = "rgba(213,255,252,.78)"; context.beginPath(); context.moveTo(0, -14); context.lineTo(7, -1); context.lineTo(0, 8); context.lineTo(-7, -1); context.closePath(); context.fill();
    context.fillStyle = `rgba(255,221,119,${glint})`;
    for (const [x, y] of [[-19, -12], [20, 7], [5, -24]]) { context.beginPath(); context.arc(x, y, 2.2, 0, Math.PI * 2); context.fill(); }
  }
  context.restore();
}

function drawRotatingTongs(context: CanvasRenderingContext2D, x: number, y: number, angle: number, reach: number) {
  context.save(); context.translate(x, y); context.rotate(angle);
  context.strokeStyle = "rgba(30,24,20,.28)"; context.lineWidth = 9; context.lineCap = "round";
  context.beginPath(); context.moveTo(18, 5); context.lineTo(reach - 7, 5); context.stroke();
  context.strokeStyle = "#d9c6a0"; context.lineWidth = 5;
  context.beginPath(); context.moveTo(17, 0); context.lineTo(reach - 8, 0); context.stroke();
  context.strokeStyle = "#f4e6c5"; context.lineWidth = 1.5;
  context.beginPath(); context.moveTo(18, -1.5); context.lineTo(reach - 11, -1.5); context.stroke();
  context.strokeStyle = "#cf7449"; context.lineWidth = 5;
  context.beginPath(); context.moveTo(reach - 13, 0); context.quadraticCurveTo(reach + 4, -16, reach + 13, -8); context.stroke();
  context.beginPath(); context.moveTo(reach - 13, 0); context.quadraticCurveTo(reach + 4, 16, reach + 13, 8); context.stroke();
  context.fillStyle = "#ffe0a6"; context.beginPath(); context.arc(reach, 0, 7, 0, Math.PI * 2); context.fill();
  context.restore();
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * ratio), point.y - (start.y + dy * ratio));
}

function isInsideDipNetArea(creature: Point & { size: number }, netSlam: NetSlamEffect) {
  const dx = creature.x - netSlam.x;
  const dy = creature.y - netSlam.y;
  const forward = dx * Math.cos(netSlam.angle) + dy * Math.sin(netSlam.angle);
  const lateral = -dx * Math.sin(netSlam.angle) + dy * Math.cos(netSlam.angle);
  const halfWidth = netSlam.radius + creature.size;
  const depth = netSlam.headDepth + creature.size;
  if (halfWidth <= 0 || depth <= 0) return false;
  return (lateral * lateral) / (halfWidth * halfWidth) + (forward * forward) / (depth * depth) <= 1;
}

function drawHarpoonSprite(context: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.lineCap = "round";
  context.strokeStyle = "rgba(28,22,18,.4)";
  context.lineWidth = 8;
  context.beginPath(); context.moveTo(-30, 5); context.lineTo(13, 5); context.stroke();
  context.strokeStyle = "#85552f";
  context.lineWidth = 6;
  context.beginPath(); context.moveTo(-31, 0); context.lineTo(12, 0); context.stroke();
  context.strokeStyle = "#d0a066";
  context.lineWidth = 1.5;
  context.beginPath(); context.moveTo(-28, -1.8); context.lineTo(11, -1.8); context.stroke();
  context.strokeStyle = "#aeb3ae";
  context.lineWidth = 4;
  context.beginPath(); context.moveTo(9, 0); context.lineTo(27, 0); context.stroke();
  context.fillStyle = "#e5e8df";
  context.beginPath(); context.moveTo(35, 0); context.lineTo(22, -6); context.lineTo(22, 6); context.closePath(); context.fill();
  context.fillStyle = "#5d3824";
  roundedRect(context, -35, -7, 12, 14, 4); context.fill();
  context.restore();
}

function drawRockHookBar(context: CanvasRenderingContext2D, origin: Point, target: Point, effect: RockFlipEffect) {
  const progress = 1 - effect.life / effect.maxLife;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const extend = progress < .48 ? Math.min(1, progress / .48) : progress < .7 ? 1 : Math.max(0, 1 - (progress - .7) / .3);
  const eased = 1 - (1 - extend) ** 3;
  const behind = -30;
  const visibleLength = behind + (distance - behind) * eased;
  const impact = progress >= .42 && progress <= .72 ? Math.sin((progress - .42) / .3 * Math.PI) : 0;

  context.save();
  context.translate(origin.x, origin.y);
  context.rotate(angle - impact * .18);
  context.globalAlpha = Math.min(1, progress * 8, (1 - progress) * 7);
  context.lineCap = "round";
  context.strokeStyle = "rgba(28,22,18,.38)";
  context.lineWidth = 8;
  context.beginPath(); context.moveTo(-17, 5); context.lineTo(visibleLength, 5); context.stroke();
  context.strokeStyle = "#666b67";
  context.lineWidth = 6;
  context.beginPath(); context.moveTo(-18, 0); context.lineTo(visibleLength, 0); context.stroke();
  context.strokeStyle = "#c9d0c8";
  context.lineWidth = 1.7;
  context.beginPath(); context.moveTo(-15, -2); context.lineTo(visibleLength - 1, -2); context.stroke();
  context.strokeStyle = "#454b48";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(visibleLength - 1, 0);
  context.quadraticCurveTo(visibleLength + 13, 4, visibleLength + 8, 17);
  context.quadraticCurveTo(visibleLength + 4, 25, visibleLength - 5, 18);
  context.stroke();
  context.fillStyle = "#7b4e31";
  roundedRect(context, -24, -7, 18, 14, 5); context.fill();
  context.restore();

  if (progress > .42 && progress < .86) {
    const mudProgress = Math.min(1, (progress - .42) / .44);
    context.save();
    context.globalAlpha = Math.max(0, 1 - mudProgress);
    context.strokeStyle = "#c7a06d";
    context.lineWidth = 3;
    for (let chip = 0; chip < 6; chip += 1) {
      const chipAngle = -Math.PI * .92 + chip * .38;
      const chipDistance = 9 + mudProgress * (12 + chip * 3);
      context.beginPath();
      context.moveTo(target.x + Math.cos(chipAngle) * 5, target.y + Math.sin(chipAngle) * 5);
      context.quadraticCurveTo(target.x + Math.cos(chipAngle) * chipDistance, target.y - 8 - chip * 2, target.x + Math.cos(chipAngle) * (chipDistance + 7), target.y + Math.sin(chipAngle) * chipDistance);
      context.stroke();
    }
    context.restore();
  }
}

function drawDipNetSlam(context: CanvasRenderingContext2D, origin: Point, target: Point, effect: NetSlamEffect) {
  const progress = 1 - effect.life / effect.maxLife;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / distance;
  const uy = dy / distance;
  const px = -uy;
  const py = ux;
  const swingProgress = progress < .62 ? 1 - (1 - progress / .62) ** 3 : 1;
  const retract = progress < .82 ? 0 : Math.min(1, (progress - .82) / .18);
  const behindX = origin.x - ux * 34 - px * 18;
  const behindY = origin.y - uy * 34 - py * 18;
  const arc = Math.sin(swingProgress * Math.PI) * Math.min(58, distance * .22);
  const hoopX = behindX + (target.x - behindX) * swingProgress + px * arc;
  const hoopY = behindY + (target.y - behindY) * swingProgress + py * arc - Math.sin(swingProgress * Math.PI) * 18;
  const drawX = hoopX + (behindX - hoopX) * retract;
  const drawY = hoopY + (behindY - hoopY) * retract;
  const handleAngle = Math.atan2(drawY - origin.y, drawX - origin.x);
  const impact = progress >= .54 && progress <= .86;
  const fade = Math.min(1, progress * 8, (1 - progress) * 7);

  context.save();
  context.globalAlpha = fade;
  context.lineCap = "round";
  context.strokeStyle = "rgba(24,28,27,.36)";
  context.lineWidth = 10;
  context.beginPath(); context.moveTo(origin.x - ux * 18, origin.y - uy * 18 + 5); context.lineTo(drawX, drawY + 5); context.stroke();
  context.strokeStyle = "#594768";
  context.lineWidth = 6;
  context.beginPath(); context.moveTo(origin.x - ux * 20, origin.y - uy * 20); context.lineTo(drawX, drawY); context.stroke();
  context.strokeStyle = "#d8c8e8";
  context.lineWidth = 1.5;
  context.beginPath(); context.moveTo(origin.x - ux * 16, origin.y - uy * 16 - 2); context.lineTo(drawX, drawY - 2); context.stroke();
  context.fillStyle = "#8c5737";
  context.save(); context.translate(origin.x - ux * 18, origin.y - uy * 18); context.rotate(handleAngle); roundedRect(context, -8, -7, 24, 14, 5); context.fill(); context.restore();

  const hoopRadius = Math.max(16, effect.radius);
  const hoopDepth = Math.max(12, effect.headDepth);
  context.translate(drawX, drawY);
  context.rotate(handleAngle + Math.PI / 2);
  context.fillStyle = impact ? "rgba(164,105,193,.24)" : "rgba(164,105,193,.13)";
  context.strokeStyle = impact ? "#f8e7ff" : "#cda7df";
  context.lineWidth = impact ? 5 : 4;
  context.beginPath(); context.ellipse(0, 0, hoopRadius, hoopDepth * (impact ? 1 : .72), 0, 0, Math.PI * 2); context.fill(); context.stroke();
  context.strokeStyle = "rgba(241,220,251,.65)";
  context.lineWidth = 1.3;
  for (let line = -2; line <= 2; line += 1) {
    const offset = line * hoopRadius * .28;
    context.beginPath(); context.moveTo(-hoopRadius * .82, offset * .62); context.lineTo(hoopRadius * .82, -offset * .62); context.stroke();
    context.beginPath(); context.moveTo(offset, -hoopRadius * .48); context.lineTo(-offset, hoopRadius * .48); context.stroke();
  }
  context.restore();

  if (impact) {
    const impactProgress = Math.min(1, Math.max(0, (progress - .54) / .32));
    context.save();
    context.globalAlpha = (1 - impactProgress) * .78;
    context.fillStyle = "rgba(139,82,169,.16)";
    context.strokeStyle = "#d8b3eb";
    context.lineWidth = 3;
    context.save();
    context.translate(target.x, target.y);
    context.rotate(effect.angle + Math.PI / 2);
    context.beginPath(); context.ellipse(0, 0, effect.radius * (.82 + impactProgress * .18), effect.headDepth * (.82 + impactProgress * .18), 0, 0, Math.PI * 2); context.fill(); context.stroke();
    context.restore();
    for (let chip = 0; chip < 7; chip += 1) {
      const angle = chip / 7 * Math.PI * 2 + effect.id;
      const spread = Math.max(effect.radius, effect.headDepth) * (.5 + impactProgress * .46);
      context.fillStyle = "#b99a70";
      context.beginPath(); context.arc(target.x + Math.cos(angle) * spread, target.y + Math.sin(angle) * spread * .55, 2.5, 0, Math.PI * 2); context.fill();
    }
    context.restore();
  }
}

export function MudflatSurvivorGame({ onExit }: ExitProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const campaignRef = useRef<Campaign | null>(null);
  const departureRef = useRef<HTMLElement | null>(null);
  const joystickRef = useRef({ pointerId: -1, originX: 0, originY: 0, x: 0, y: 0 });
  const keysRef = useRef(new Set<string>());
  const sequenceRef = useRef(1);
  const [screen, setScreen] = useState<Screen>("setup");
  const [mode, setMode] = useState<GameMode>("normal");
  const [characterId, setCharacterId] = useState("digger");
  const [hud, setHud] = useState<Hud>(emptyHud);
  const [choices, setChoices] = useState<Array<{ id: string; icon: string; name: string; description: string; max: number }>>([]);
  const [runId, setRunId] = useState(0);
  const [best, setBest] = useState(0);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [savedCampaign, setSavedCampaign] = useState<Campaign | null>(null);
  const [departureSpace, setDepartureSpace] = useState(220);
  const [highestUnlockedStage, setHighestUnlockedStage] = useState(1);
  const [selectedStage, setSelectedStage] = useState(1);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  // A captured pointer can survive a browser/app pause. Never let that stale
  // drag resume the gatherer: every running entry requires fresh input.
  const resetMovementInput = useCallback(() => {
    joystickRef.current = { pointerId: -1, originX: 0, originY: 0, x: 0, y: 0 };
    keysRef.current.clear();
  }, []);
  const [campNotice, setCampNotice] = useState("잡아온 해산물을 판매하고 다음 출정을 준비하세요.");

  useEffect(() => {
    setBest(Number(window.localStorage.getItem(BEST_KEY) ?? 0));
    const restoredCampaign = readSavedCampaign();
    setSavedCampaign(restoredCampaign);
    const storedHighest = Math.min(9, Math.max(1, Math.floor(Number(window.localStorage.getItem(HIGHEST_STAGE_KEY) ?? 1))));
    const restoredHighest = restoredCampaign ? Math.min(9, restoredCampaign.stage) : 1;
    const highest = Math.max(storedHighest, restoredHighest);
    setHighestUnlockedStage(highest);
    window.localStorage.setItem(HIGHEST_STAGE_KEY, String(highest));
    const lastMode = window.localStorage.getItem(LAST_MODE_KEY);
    if (lastMode === "kids" || lastMode === "normal") setMode(lastMode);
  }, []);

  useEffect(() => {
    if (screen !== "camp") return;
    const panel = departureRef.current;
    if (!panel) return;
    const updateSpace = () => setDepartureSpace(Math.ceil(panel.getBoundingClientRect().height) + 32);
    updateSpace();
    const observer = new ResizeObserver(updateSpace);
    observer.observe(panel);
    window.addEventListener("resize", updateSpace);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateSpace); };
  }, [screen, campaign?.stage]);

  useEffect(() => {
    const timers = new Map<HTMLButtonElement, number>();
    const confirmButtonTouch = (event: PointerEvent) => {
      const button = event.target instanceof Element ? event.target.closest(".ms-shell button:not(:disabled)") : null;
      if (!(button instanceof HTMLButtonElement)) return;
      const previousTimer = timers.get(button);
      if (previousTimer) window.clearTimeout(previousTimer);
      button.classList.remove("ms-touch-confirmed");
      void button.offsetWidth;
      button.classList.add("ms-touch-confirmed");
      const timer = window.setTimeout(() => {
        button.classList.remove("ms-touch-confirmed");
        timers.delete(button);
      }, 260);
      timers.set(button, timer);
    };
    document.addEventListener("pointerdown", confirmButtonTouch, true);
    return () => {
      document.removeEventListener("pointerdown", confirmButtonTouch, true);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const storeCampaign = useCallback((next: Campaign) => {
    campaignRef.current = next; setCampaign(next); setSavedCampaign(next); window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(next));
  }, []);

  const snapshot = useCallback((runtime: Runtime) => {
    setHud({
      mode: runtime.mode,
      stage: runtime.stage, elapsed: runtime.elapsed, hp: runtime.player.hp, maxHp: runtime.player.maxHp, level: runtime.level,
      xp: runtime.xp, nextXp: runtime.nextXp, caught: runtime.caught, catchCapacity: mudflatCatchCapacity(runtime.equipment.cooler ?? 0),
      score: mudflatFinalScore({ catchScore: runtime.catchScore, caught: runtime.caught, elapsed: runtime.elapsed, bossCaught: runtime.bossCaught }),
      levels: { ...runtime.levels }, basket: { ...runtime.basket }, bossCaught: runtime.bossCaught,
    });
  }, []);

  const beginAtStage = (stage: number) => {
    window.localStorage.setItem(LAST_MODE_KEY, mode);
    const entryStage = Math.max(1, Math.min(highestUnlockedStage, Math.floor(stage)));
    const nextCampaign = createCampaign(characterId, mode, entryStage);
    storeCampaign(nextCampaign);
    const runtime = makeRuntime(nextCampaign);
    resetMovementInput(); runtimeRef.current = runtime; snapshot(runtime); setChoices([]); setScreen("running"); setRunId((value) => value + 1);
  };
  const begin = () => beginAtStage(selectedStage);

  const continueCampaign = () => {
    if (!savedCampaign) return;
    window.localStorage.setItem(LAST_MODE_KEY, savedCampaign.mode);
    setMode(savedCampaign.mode); setCharacterId(savedCampaign.characterId); storeCampaign(savedCampaign);
    const previousHaulCount = Object.values(savedCampaign.lastHaul).reduce((sum, count) => sum + count, 0);
    setCampNotice(`${savedCampaign.stage - 1}단계에서 잡은 ${previousHaulCount}마리를 판매해서 ${savedCampaign.lastSaleValue}코인을 얻었습니다.`); setScreen("camp");
  };

  const endRun = useCallback((runtime: Runtime) => {
    if (runtime.ended) return;
    runtime.ended = true; runtime.paused = true; snapshot(runtime);
    const score = mudflatFinalScore({ catchScore: runtime.catchScore, caught: runtime.caught, elapsed: runtime.elapsed, bossCaught: runtime.bossCaught });
    if (score > best) { setBest(score); window.localStorage.setItem(BEST_KEY, String(score)); }
    // A defeat ends this expedition completely. Do not retain a camp save,
    // equipment, or stage that could be resumed from the result screen.
    window.localStorage.removeItem(CAMPAIGN_KEY);
    campaignRef.current = null;
    setCampaign(null);
    setSavedCampaign(null);
    setScreen("defeat");
  }, [best, snapshot]);

  const completeStage = useCallback((runtime: Runtime) => {
    if (runtime.ended) return;
    runtime.ended = true; runtime.paused = true; snapshot(runtime);
    const score = mudflatFinalScore({ catchScore: runtime.catchScore, caught: runtime.caught, elapsed: runtime.elapsed, bossCaught: runtime.bossCaught });
    if (score > best) { setBest(score); window.localStorage.setItem(BEST_KEY, String(score)); }
    const current = campaignRef.current ?? createCampaign(characterId, runtime.mode);
    const settlement = mudflatSettleCatch(current.inventory, runtime.basket, runtime.caught, current.equipment.cooler ?? 0);
    const autoSale = mudflatAutoSellInventory(settlement.inventory, current.equipment.cooler ?? 0, runtime.stage);
    const objective = mudflatEndlessObjectiveResult(mudflatStageProfile(runtime.stage), { caught: runtime.caught, rocksFlipped: runtime.rocksFlipped, hp: runtime.player.hp, maxHp: runtime.player.maxHp });
    const next: Campaign = {
      ...current, stage: runtime.stage + 1, hp: Math.max(1, runtime.player.hp), maxHp: runtime.player.maxHp,
      coins: current.coins + autoSale.value + objective.bonus,
      level: runtime.level, xp: runtime.xp, nextXp: runtime.nextXp, levels: { ...runtime.levels }, inventory: {}, lastHaul: autoSale.haul as CountMap, lastSaleValue: autoSale.value,
      totalScore: current.totalScore + score, lastBossCaught: runtime.bossCaught,
      lastObjectiveLabel: objective.label, lastObjectiveComplete: objective.complete, lastObjectiveBonus: objective.bonus,
    };
    const newlyUnlockedStage = Math.min(9, runtime.stage + 1);
    setHighestUnlockedStage((previous) => {
      const highest = Math.max(previous, newlyUnlockedStage);
      window.localStorage.setItem(HIGHEST_STAGE_KEY, String(highest));
      return highest;
    });
    const regularClear = runtime.stage === 8 ? " 정규 원정을 완주해 끝없는 물때가 열렸습니다." : "";
    const objectiveNotice = objective.label ? ` 보조 목표 ${objective.complete ? `달성(+${objective.bonus}코인)` : "미달성"}: ${objective.label}.` : "";
    storeCampaign(next); setCampNotice(`${runtime.stage}단계에서 잡은 ${settlement.catchCount}마리를 판매해서 ${autoSale.value}코인을 얻었습니다.${regularClear}${objectiveNotice}`); setScreen("camp");
  }, [best, characterId, snapshot, storeCampaign]);

  useEffect(() => {
    if (!runId) return;
    const canvas = canvasRef.current;
    const runtime = runtimeRef.current;
    if (!canvas || !runtime) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animation = 0;
    let previous = performance.now();
    let hudClock = 0;
    let mounted = true;
    const stageStats = mudflatStageStats(runtime.stage);
    const stageProfile = mudflatStageProfile(runtime.stage) as StageProfile;
    const creatureSprites = new Map<string, HTMLImageElement>();
    for (const item of MUDFLAT_CREATURES) {
      if (!item.sprite) continue;
      const image = new Image(); image.src = item.sprite; creatureSprites.set(item.id, image);
    }
    const clamSprite = new Image(); clamSprite.src = "/mudflat-creatures/clam.png"; creatureSprites.set("clam-reveal", clamSprite);
    const razorClamSprite = new Image(); razorClamSprite.src = "/mudflat-creatures/razor-clam.svg"; creatureSprites.set("razor-clam-reveal", razorClamSprite);

    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(320, canvas.clientWidth);
      const height = Math.max(420, canvas.clientHeight);
      if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
        canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { width, height };
    };

    const spawnCreature = (width: number, height: number, forcedBoss = false) => {
      const template = forcedBoss ? MUDFLAT_CREATURES.find((item) => item.boss)! : mudflatCreatureForTime(runtime.elapsed, Math.random(), { headlamp: (runtime.equipment.headlamp ?? 0) > 0 });
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.hypot(width, height) * .58 + 70 + Math.random() * 80;
      const difficulty = runtime.mode === "normal" ? 1.15 : 1;
      const bossScale = forcedBoss && stageProfile.finalBoss ? 1.7 : 1;
      const scale = (forcedBoss ? bossScale : 1 + runtime.elapsed / 420) * difficulty * stageStats.creatureHpMultiplier;
      runtime.creatures.push({
        ...template, id: sequenceRef.current++, type: template.id, x: runtime.player.x + Math.cos(angle) * distance,
        y: runtime.player.y + Math.sin(angle) * distance, hp: template.hp * scale, maxHp: template.hp * scale,
        speed: template.speed * (1 + runtime.elapsed / 750) * (runtime.mode === "normal" ? 1.12 : 1) * stageStats.creatureSpeedMultiplier, saltHit: 0, hitFlash: 0, phase: Math.random() * Math.PI * 2, age: 0,
        movement: (template.movement ?? "chase") as CreatureMovement, movementAngle: angle + Math.PI, movementClock: 1,
      });
    };

    const revealRockCreature = (rock: Rock, finding: NonNullable<ReturnType<typeof mudflatRockCreatureForRoll>>) => {
      const template = MUDFLAT_CREATURES.find((item) => item.id === finding.type);
      if (!template) return;
      const crabSpeed = MUDFLAT_CREATURES.find((item) => item.id === "crab")?.speed ?? 34;
      const revealAngle = Math.random() * Math.PI * 2;
      const offset = Math.max(8, rock.radius * .38);
      runtime.creatures.push({
        ...template,
        id: sequenceRef.current++,
        type: template.id,
        name: finding.name,
        x: rock.x + Math.cos(revealAngle) * offset,
        y: rock.y + Math.sin(revealAngle) * offset,
        hp: template.hp,
        maxHp: template.hp,
        speed: finding.type === "pufferfish" ? template.speed : (finding.type === "shrimp" ? crabSpeed * (1 + runtime.elapsed / 750) * 1.12 : template.speed) * stageStats.creatureSpeedMultiplier,
        saltHit: 0,
        hitFlash: .18,
        phase: Math.random() * Math.PI * 2,
        age: 0,
        movement: finding.movement as CreatureMovement,
        movementAngle: revealAngle,
        movementClock: 1,
        ovalDirection: Math.random() < .5 ? -1 : 1,
      });
      runtime.bursts.push({ id: sequenceRef.current++, x: rock.x, y: rock.y, life: .62, maxLife: .62, color: template.color, size: rock.radius + 5 });
      runtime.floatTexts.push({ id: sequenceRef.current++, x: rock.x, y: rock.y - 20, life: 1.05, text: `${finding.name} 발견!`, color: "#fff0a8" });
    };

    const spawnRock = (width: number, height: number) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 105 + Math.random() * Math.max(160, Math.hypot(width, height) * .58);
      runtime.rocks.push({
        id: sequenceRef.current++,
        x: runtime.player.x + Math.cos(angle) * distance,
        y: runtime.player.y + Math.sin(angle) * distance,
        radius: 17 + Math.random() * 9,
        tone: Math.random(),
      });
    };

    const spawnClamHole = (width: number, height: number) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 70 + Math.random() * Math.max(150, Math.hypot(width, height) * .52);
      runtime.clamHoles.push({
        id: sequenceRef.current++,
        x: runtime.player.x + Math.cos(angle) * distance,
        y: runtime.player.y + Math.sin(angle) * distance,
        radius: 8 + Math.random() * 3,
        progress: 0,
      });
    };

    const damageCreature = (creature: Creature, damage: number, hitFlash = .12) => {
      const safeDamage = Math.max(0, Number(damage) || 0);
      if (safeDamage <= 0 || creature.hp <= 0) return;
      creature.hp -= safeDamage;
      creature.hitFlash = Math.max(creature.hitFlash, hitFlash);
      const roundedDamage = Math.round(safeDamage * 10) / 10;
      const damageText = Number.isInteger(roundedDamage) ? `-${roundedDamage}` : `-${roundedDamage.toFixed(1)}`;
      const horizontalJitter = (sequenceRef.current % 3 - 1) * 9;
      runtime.floatTexts.push({
        id: sequenceRef.current++, x: creature.x + horizontalJitter, y: creature.y - creature.size - 4,
        life: .62, text: damageText, color: DAMAGE_TEXT_COLOR,
      });
    };

    const damagePlayer = (damage: number, color = PLAYER_DAMAGE_TEXT_COLOR) => {
      const safeDamage = Math.max(0, Math.round((Number(damage) || 0) * 100) / 100);
      if (!safeDamage) return;
      runtime.player.hp = Math.max(0, runtime.player.hp - safeDamage);
      runtime.bursts.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y, life: .42, maxLife: .42, color, size: 25 });
      const damageLabel = Number.isInteger(safeDamage) ? String(safeDamage) : safeDamage.toFixed(1);
      runtime.floatTexts.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y + 4, life: .78, text: `-${damageLabel}`, color: PLAYER_DAMAGE_TEXT_COLOR, kind: "playerDamage" });
    };

    const showPlayerMessage = (message: string, life: number, opacity = 1) => {
      runtime.playerMessage = message;
      runtime.playerMessageLife = life;
      runtime.playerMessageOpacity = opacity;
    };

    const showCatchFullMessage = () => {
      if (runtime.catchFullNoticeClock > 0) return;
      showPlayerMessage(CATCH_FULL_MESSAGE, 1.2);
      runtime.catchFullNoticeClock = 15;
    };

    const damageAndCollect = () => {
      const defeated = runtime.creatures.filter((item) => item.hp <= 0);
      if (defeated.length) {
        const catchCapacity = mudflatCatchCapacity(runtime.equipment.cooler ?? 0);
        for (const item of defeated) {
          if (runtime.caught < catchCapacity) {
            runtime.caught += 1; runtime.catchScore += item.score;
            runtime.basket[item.type] = (runtime.basket[item.type] ?? 0) + 1;
            if (item.boss) runtime.bossCaught = true;
          } else showCatchFullMessage();
          // A full container prevents selling the catch, not learning from it.
          runtime.pickups.push({ id: sequenceRef.current++, x: item.x, y: item.y, xp: item.xp });
          runtime.bursts.push({ id: sequenceRef.current++, x: item.x, y: item.y, life: .5, maxLife: .5, color: item.color, size: item.size });
        }
        runtime.creatures = runtime.creatures.filter((item) => item.hp > 0);
      }
    };

    const update = (dt: number, width: number, height: number) => {
      if (runtime.paused || runtime.ended) return;
      runtime.elapsed += dt;
      runtime.player.damageCooldown = Math.max(0, runtime.player.damageCooldown - dt);
      runtime.hoeClock -= dt; runtime.netClock -= dt; runtime.castNetClock -= dt; runtime.electricClock -= dt; runtime.selfShockClock -= dt; runtime.rockTurnClock -= dt; runtime.harpoonClock -= dt; runtime.hoeEffect = Math.max(0, runtime.hoeEffect - dt);
      runtime.electricPulseLife = Math.max(0, runtime.electricPulseLife - dt); runtime.discoveryMessageLife = Math.max(0, runtime.discoveryMessageLife - dt); runtime.playerMessageLife = Math.max(0, runtime.playerMessageLife - dt); runtime.catchFullNoticeClock = Math.max(0, runtime.catchFullNoticeClock - dt);
      if (runtime.bleedSeconds > 0) {
        const bleed = mudflatPufferBleedStep(runtime.bleedSeconds, runtime.bleedTickClock, dt);
        runtime.bleedSeconds = bleed.seconds; runtime.bleedTickClock = bleed.tickClock;
        for (let tick = 0; tick < bleed.ticks; tick += 1) {
          damagePlayer(mudflatBleedDamage(runtime.player.maxHp), "#ff695f");
        }
      }
      if (runtime.rockFlipEffect) {
        const completedEffect = runtime.rockFlipEffect;
        const target = runtime.rocks.find((rock) => rock.id === completedEffect.rockId);
        const tongReach = mudflatTongStats(runtime.levels.tongs ?? 1).reach;
        const stillInRange = target && Math.hypot(target.x - runtime.player.x, target.y - runtime.player.y) <= tongReach + target.radius;
        if (!stillInRange) {
          runtime.rockFlipEffect = null;
          runtime.rockTurnClock = mudflatRockTurnerStats(runtime.levels.rocker ?? 1).cooldown;
        } else {
          const activeEffect = runtime.rockFlipEffect;
          if (activeEffect) activeEffect.life = (activeEffect.life ?? 0) - dt;
        }
        if (runtime.rockFlipEffect && runtime.rockFlipEffect.life <= 0) {
          if (target) {
            const finding = mudflatRockCreatureForRoll(Math.random(), runtime.levels.rocker ?? 1);
            runtime.rocks = runtime.rocks.filter((rock) => rock.id !== target.id);
            runtime.rocksFlipped += 1;
            runtime.bursts.push({ id: sequenceRef.current++, x: target.x, y: target.y, life: .5, maxLife: .5, color: "#b89569", size: target.radius });
            if (finding) revealRockCreature(target, finding);
          }
          runtime.rockFlipEffect = null;
        }
      }

      let inputX = joystickRef.current.x;
      let inputY = joystickRef.current.y;
      const keys = keysRef.current;
      if (keys.has("ArrowLeft") || keys.has("KeyA")) inputX -= 1;
      if (keys.has("ArrowRight") || keys.has("KeyD")) inputX += 1;
      if (keys.has("ArrowUp") || keys.has("KeyW")) inputY -= 1;
      if (keys.has("ArrowDown") || keys.has("KeyS")) inputY += 1;
      const inputLength = Math.hypot(inputX, inputY);
      if (inputLength > 1) { inputX /= inputLength; inputY /= inputLength; }
      const inWaterChannel = stageProfile.waterChannels && mudflatInWaterChannel(runtime.player.x, runtime.player.y, runtime.stage);
      const tidePhase = stageProfile.tideInterval > 0 ? runtime.elapsed % stageProfile.tideInterval : stageProfile.tideInterval;
      const tideSurge = stageProfile.tideInterval > 0 ? Math.max(0, 1 - tidePhase / 7) : 0;
      const inSafeSandbar = stageProfile.safeZone !== "none" && Math.hypot(runtime.player.x - runtime.safeZone.x, runtime.player.y - runtime.safeZone.y) <= 112;
      const incomingTideSlow = tideSurge > 0 && !inSafeSandbar ? .8 : 1;
      const rawTerrainSpeed = stageProfile.mudSlow * (inWaterChannel ? .68 : 1) * incomingTideSlow;
      const terrainSpeed = mudflatTerrainSpeedMultiplier(rawTerrainSpeed, runtime.equipment.waders ?? 0);
      const speed = runtime.player.speed * (1 + (runtime.levels.boots ?? 0) * .09) * terrainSpeed;
      runtime.player.x += inputX * speed * dt; runtime.player.y += inputY * speed * dt;
      if (stageProfile.wind > 0) {
        const windAngle = Math.sin(runtime.elapsed / 8 + runtime.stage) * .7 + runtime.stage * .31;
        runtime.player.x += Math.cos(windAngle) * stageProfile.wind * dt;
        runtime.player.y += Math.sin(windAngle) * stageProfile.wind * dt;
      }
      if (Math.hypot(inputX, inputY) > .05) {
        runtime.player.facing = Math.atan2(inputY, inputX);
        runtime.player.stride += dt * Math.max(.35, Math.hypot(inputX, inputY));
      }

      if (stageProfile.safeZone !== "none" && stageProfile.tideInterval > 0) {
        const sandbarCycle = Math.floor(runtime.elapsed / stageProfile.tideInterval);
        const afterTide = tidePhase >= 7;
        if (afterTide && sandbarCycle > runtime.lastSandbarCycle) {
          runtime.lastSandbarCycle = sandbarCycle;
          runtime.safeZone = nextSandbarPosition(runtime.player, runtime.stage, sandbarCycle);
          runtime.safeZoneTransition = .72;
        }
        runtime.safeZoneTransition = Math.max(0, runtime.safeZoneTransition - dt);
      }
      if (stageProfile.tideInterval > 0) {
        const tideCycle = Math.floor(runtime.elapsed / stageProfile.tideInterval);
        if (tideCycle > runtime.lastTideCycle) {
          runtime.lastTideCycle = tideCycle;
          runtime.tideFlash = .7;
          const inSafeZone = Math.hypot(runtime.player.x - runtime.safeZone.x, runtime.player.y - runtime.safeZone.y) <= 112;
          if (!inSafeZone) {
            damagePlayer(10 + runtime.stage, "#79c7df");
            showPlayerMessage("밀물 물살에 휩쓸렸다! 마른 모래톱으로!", 3.6);
          } else {
            showPlayerMessage("마른 모래톱에서 밀물을 피했다.", 2.6);
          }
        }
      }
      runtime.tideFlash = Math.max(0, runtime.tideFlash - dt);

      if (runtime.mode === "normal" && runtime.stage === 3) {
        runtime.hiddenRockClock -= dt;
        if (runtime.hiddenRockClock <= 0 && runtime.rocks.length < stageStats.rockLimit) {
          const firstReveal = !runtime.hiddenRockIntroShown;
          const angle = firstReveal ? Math.PI * .18 : Math.random() * Math.PI * 2;
          const distance = firstReveal ? 58 : 72 + Math.random() * 74;
          const rock = { id: sequenceRef.current++, x: runtime.player.x + Math.cos(angle) * distance, y: runtime.player.y + Math.sin(angle) * distance, radius: 18 + Math.random() * 7, tone: Math.random() };
          runtime.rocks.push(rock);
          runtime.bursts.push({ id: sequenceRef.current++, x: rock.x, y: rock.y, life: .46, maxLife: .46, color: "#c5a276", size: rock.radius + 10 });
          if (firstReveal) {
            runtime.hiddenRockIntroShown = true;
            showPlayerMessage("아 깜짝이야, 여기 돌이 있었네!", 3);
          }
          runtime.hiddenRockClock = 7 + Math.random() * 5;
        }
      }

      if (stageProfile.fallingRocks > 0) {
        runtime.fallClock -= dt;
        if (runtime.fallClock <= 0) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 45 + Math.random() * 230;
          runtime.fallingRocks.push({ id: sequenceRef.current++, x: runtime.player.x + Math.cos(angle) * distance, y: runtime.player.y + Math.sin(angle) * distance, life: 2.1, maxLife: 2.1, radius: 29 });
          runtime.fallClock = stageProfile.fallingRocks * (.72 + Math.random() * .48);
        }
        for (const falling of runtime.fallingRocks) {
          const previousLife = falling.life;
          falling.life -= dt;
          if (previousLife > 0 && falling.life <= 0) {
            if (Math.hypot(falling.x - runtime.player.x, falling.y - runtime.player.y) <= falling.radius + 16) damagePlayer(14 + runtime.stage * 2, "#d69d68");
            runtime.rocks.push({ id: sequenceRef.current++, x: falling.x, y: falling.y, radius: 18 + Math.random() * 7, tone: Math.random() });
            runtime.bursts.push({ id: sequenceRef.current++, x: falling.x, y: falling.y, life: .55, maxLife: .55, color: "#c99564", size: 36 });
          }
        }
        runtime.fallingRocks = runtime.fallingRocks.filter((item) => item.life > 0);
      }

      if (stageProfile.waves) {
        runtime.waveClock -= dt;
        if (runtime.waveClock <= 0) {
          damagePlayer(4 + Math.floor(runtime.stage / 3), "#6ec4d4");
          runtime.tideFlash = Math.max(runtime.tideFlash, .35);
          runtime.waveClock = 16 + Math.random() * 8;
        }
      }

      runtime.spawnClock -= dt;
      if (runtime.spawnClock <= 0 && runtime.creatures.length < 180) {
        spawnCreature(width, height); runtime.spawnClock = mudflatSpawnInterval(runtime.elapsed, runtime.mode) * stageStats.spawnIntervalMultiplier;
      }
      if (stageProfile.swarms) {
        runtime.swarmClock -= dt;
        if (runtime.swarmClock <= 0 && runtime.creatures.length < 165) {
          for (let index = 0; index < 5; index += 1) spawnCreature(width, height);
          runtime.swarmClock = 18 + Math.random() * 9;
          runtime.floatTexts.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y - 72, life: 1.15, text: "해산물 무리가 몰려옵니다!", color: "#fff1a8" });
        }
      }
      if (!runtime.bossSpawned && runtime.elapsed >= 200) { runtime.bossSpawned = true; spawnCreature(width, height, true); }
      if (runtime.elapsed < .08 && runtime.clamHoles.length === 0) for (let index = 0; index < 12; index += 1) spawnClamHole(width, height);
      runtime.clamSpawnClock -= dt;
      if (runtime.clamSpawnClock <= 0 && runtime.clamHoles.length < 18) { spawnClamHole(width, height); runtime.clamSpawnClock = 4.8; }
      if (runtime.mode === "normal") {
        if (runtime.stage !== 3 && runtime.elapsed < .08 && runtime.rocks.length === 0) for (let index = 0; index < 12; index += 1) spawnRock(width, height);
        runtime.rockSpawnClock -= dt;
        if (runtime.stage !== 3 && runtime.rockSpawnClock <= 0 && runtime.rocks.length < stageStats.rockLimit) { spawnRock(width, height); runtime.rockSpawnClock = Math.max(2.4, 4.2 * stageStats.spawnIntervalMultiplier); }
      }

      let touching = false;
      let bleedingCreatureTouching = false;
      let pufferTouching = false;
      for (const creature of runtime.creatures) {
        creature.age += dt;
        const previousX = creature.x;
        const dx = runtime.player.x - creature.x; const dy = runtime.player.y - creature.y; const distance = Math.hypot(dx, dy) || 1;
        const activeMovement = creature.type === "pufferfish" ? mudflatPufferMovementForAge(creature.age) : creature.movement;
        const creatureSpeed = ["whelk", "fist-whelk", "golbaengi"].includes(creature.type) ? mudflatShellMovementSpeed(speed) : creature.speed;
        if (activeMovement === "chase") {
          creature.x += dx / distance * creatureSpeed * dt; creature.y += dy / distance * creatureSpeed * dt;
        } else if (activeMovement === "wander") {
          creature.movementClock -= dt;
          if (creature.movementClock <= 0) { creature.movementAngle = Math.random() * Math.PI * 2; creature.movementClock += 1; }
          creature.x += Math.cos(creature.movementAngle) * creatureSpeed * dt;
          creature.y += Math.sin(creature.movementAngle) * creatureSpeed * dt;
        } else if (activeMovement === "flee") {
          creature.x -= dx / distance * creatureSpeed * dt; creature.y -= dy / distance * creatureSpeed * dt;
        } else if (activeMovement === "oval") {
          creature.movementClock -= dt;
          if (creature.movementClock <= 0) {
            creature.movementClock = .8 + Math.random() * 1.6;
            creature.ovalDirection = Math.random() < .5 ? -1 : 1;
          }
          const direction = creature.ovalDirection ?? 1;
          const travelSpeed = creatureSpeed;
          creature.movementAngle += direction * travelSpeed / 52 * dt;
          // The ellipse travels with the fish while its centre consistently
          // retreats from the player, so a loop can never bring it closer.
          const retreatSpeed = travelSpeed * .62;
          const orbitSpeed = travelSpeed * .34;
          const localX = -Math.sin(creature.movementAngle) * orbitSpeed * direction;
          const localY = Math.cos(creature.movementAngle) * orbitSpeed * .58 * direction;
          creature.x += (-dx / distance * retreatSpeed + Math.cos(creature.phase) * localX - Math.sin(creature.phase) * localY) * dt;
          creature.y += (-dy / distance * retreatSpeed + Math.sin(creature.phase) * localX + Math.cos(creature.phase) * localY) * dt;
        }
        if (Math.abs(creature.x - previousX) > .001) creature.facing = creature.x > previousX ? 1 : -1;
        creature.saltHit = Math.max(0, creature.saltHit - dt); creature.hitFlash = Math.max(0, creature.hitFlash - dt);
        if (distance < creature.size + 17) {
          touching = true;
          if (creature.type === "pufferfish" || creature.type === "king-crab") bleedingCreatureTouching = true;
          if (creature.type === "pufferfish") pufferTouching = true;
        }
      }
      if (bleedingCreatureTouching) {
        const bleed = mudflatPufferBleedOnContact(runtime.bleedSeconds, runtime.bleedTickClock, runtime.equipment.vest ?? 0);
        runtime.bleedSeconds = bleed.seconds; runtime.bleedTickClock = bleed.tickClock;
      }
      if (pufferTouching && !runtime.pufferTouching) {
        showPlayerMessage("앗 따가워, 몸이 이상해.", 3);
      }
      runtime.pufferTouching = pufferTouching;
      const touchingRock = runtime.mode === "normal" && runtime.rocks.some((rock) => Math.hypot(rock.x - runtime.player.x, rock.y - runtime.player.y) < rock.radius + 16);
      if ((touching || touchingRock) && runtime.player.damageCooldown <= 0) {
        const baseDamage = runtime.mode === "normal" ? (touchingRock ? 10 : 9) : 7;
        const playerDamage = baseDamage + stageStats.contactDamageBonus + Math.floor(runtime.elapsed / 70);
        runtime.player.hp = Math.max(0, runtime.player.hp - playerDamage);
        runtime.player.damageCooldown = .52;
        runtime.bursts.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y, life: .35, maxLife: .35, color: "#ff7868", size: 24 });
        runtime.floatTexts.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y + 4, life: .72, text: `-${playerDamage}`, color: PLAYER_DAMAGE_TEXT_COLOR, kind: "playerDamage" });
        if ("vibrate" in navigator) navigator.vibrate(22);
      }

      let activeClamHole: ClamHole | null = null;
      let activeClamDistance = Infinity;
      for (const hole of runtime.clamHoles) {
        const distance = Math.hypot(hole.x - runtime.player.x, hole.y - runtime.player.y);
        if (distance <= 48 && distance < activeClamDistance) { activeClamHole = hole; activeClamDistance = distance; }
      }
      for (const hole of runtime.clamHoles) {
        if (hole !== activeClamHole) hole.progress = 0;
      }
      if (activeClamHole) {
        activeClamHole.progress += dt;
        runtime.player.facing = Math.atan2(activeClamHole.y - runtime.player.y, activeClamHole.x - runtime.player.x);
        if (activeClamHole.progress >= 2) {
          const diggingLevel = runtime.mode === "normal" ? (runtime.levels.digging ?? 1) : Math.max(1, runtime.levels.hoe ?? 1);
          const reward = mudflatClamRewardForRoll(diggingLevel, Math.random()) ?? MUDFLAT_CLAM_GRADES[0]!;
          const catchCapacity = mudflatCatchCapacity(runtime.equipment.cooler ?? 0);
          if (runtime.caught < catchCapacity) {
            runtime.caught += 1; runtime.catchScore += reward.score;
            runtime.basket[reward.id] = (runtime.basket[reward.id] ?? 0) + 1;
          } else showCatchFullMessage();
          runtime.pickups.push({ id: sequenceRef.current++, x: activeClamHole.x, y: activeClamHole.y, xp: reward.xp });
          runtime.clamReveals.push({ id: sequenceRef.current++, x: activeClamHole.x, y: activeClamHole.y, life: .9, maxLife: .9, type: reward.id });
          runtime.bursts.push({ id: sequenceRef.current++, x: activeClamHole.x, y: activeClamHole.y, life: .55, maxLife: .55, color: reward.id === "pearl" ? "#fff0a2" : "#dbc69c", size: 18 });
          runtime.floatTexts.push({ id: sequenceRef.current++, x: activeClamHole.x, y: activeClamHole.y - 24, life: 1.05, text: `${reward.name} 채집!`, color: reward.id === "pearl" ? "#fff2a4" : "#ffe2a6" });
          runtime.clamHoles = runtime.clamHoles.filter((hole) => hole.id !== activeClamHole?.id);
          if ("vibrate" in navigator) navigator.vibrate([18, 25, 35]);
        }
      }

      const hoeLevel = runtime.levels.hoe ?? 0;
      const toolPower = mudflatEquipmentStats(runtime.equipment, runtime.player.baseMaxHp, runtime.levels.snack ?? 0).toolPowerMultiplier;
      if (hoeLevel > 0 && runtime.hoeClock <= 0) {
        const radius = 78 + hoeLevel * 12;
        for (const creature of runtime.creatures) if (Math.hypot(creature.x - runtime.player.x, creature.y - runtime.player.y) <= radius + creature.size) damageCreature(creature, (3 + hoeLevel * 2.3) * toolPower, .1);
        runtime.hoeClock = Math.max(.42, 1.02 - hoeLevel * .09); runtime.hoeEffect = .2;
      }

      const netLevel = runtime.levels.net ?? 0;
      if (netLevel > 0 && runtime.netClock <= 0 && runtime.creatures.length) {
        const target = runtime.creatures.reduce((nearest, item) => Math.hypot(item.x - runtime.player.x, item.y - runtime.player.y) < Math.hypot(nearest.x - runtime.player.x, nearest.y - runtime.player.y) ? item : nearest);
        const netStats = mudflatNetStats(netLevel);
        const targetDx = target.x - runtime.player.x; const targetDy = target.y - runtime.player.y;
        const targetDistance = Math.hypot(targetDx, targetDy) || 1;
        const angle = Math.atan2(targetDy, targetDx);
        const impactDistance = runtime.mode === "normal" ? Math.min(targetDistance, netStats.range) : targetDistance;
        runtime.netSlams.push({
          id: sequenceRef.current++, x: runtime.player.x + Math.cos(angle) * impactDistance, y: runtime.player.y + Math.sin(angle) * impactDistance, targetId: target.id,
          damage: (6 + netLevel * 4) * toolPower,
          radius: runtime.mode === "normal" ? netStats.radius : 30,
          headDepth: runtime.mode === "normal" ? netStats.headDepth : 20,
          range: runtime.mode === "normal" ? netStats.range : targetDistance,
          angle,
          area: runtime.mode === "normal", hit: false, life: .62, maxLife: .62,
        });
        runtime.netClock = Math.max(.48, 1.5 - netLevel * .14);
      }
      for (const netSlam of runtime.netSlams) {
        const trackedTarget = runtime.creatures.find((item) => item.id === netSlam.targetId);
        const progressBefore = 1 - netSlam.life / netSlam.maxLife;
        if (trackedTarget && !netSlam.hit && progressBefore < .54) {
          const dx = trackedTarget.x - runtime.player.x; const dy = trackedTarget.y - runtime.player.y;
          const distance = Math.hypot(dx, dy) || 1;
          netSlam.angle = Math.atan2(dy, dx);
          const impactDistance = netSlam.area ? Math.min(distance, netSlam.range) : distance;
          netSlam.x = runtime.player.x + Math.cos(netSlam.angle) * impactDistance;
          netSlam.y = runtime.player.y + Math.sin(netSlam.angle) * impactDistance;
        }
        netSlam.life -= dt;
        const progress = 1 - netSlam.life / netSlam.maxLife;
        if (!netSlam.hit && progress >= .54) {
          if (netSlam.area) {
            for (const creature of runtime.creatures) {
              if (isInsideDipNetArea(creature, netSlam)) {
                damageCreature(creature, netSlam.damage, .16);
              }
            }
          } else if (trackedTarget) {
            damageCreature(trackedTarget, netSlam.damage, .16);
          }
          netSlam.hit = true;
          runtime.bursts.push({ id: sequenceRef.current++, x: netSlam.x, y: netSlam.y, life: .34, maxLife: .34, color: "#aa72c6", size: netSlam.radius });
        }
      }
      runtime.netSlams = runtime.netSlams.filter((item) => item.life > 0);

      const harpoonLevel = runtime.levels.harpoon ?? 0;
      if (runtime.mode === "normal" && harpoonLevel > 0 && runtime.harpoonClock <= 0) {
        const target = runtime.creatures.reduce<Creature | null>((nearest, item) => {
          if (!nearest) return item;
          return Math.hypot(item.x - runtime.player.x, item.y - runtime.player.y) < Math.hypot(nearest.x - runtime.player.x, nearest.y - runtime.player.y) ? item : nearest;
        }, null);
        if (target) {
          const stats = mudflatHarpoonStats(harpoonLevel, netLevel);
          const dx = target.x - runtime.player.x; const dy = target.y - runtime.player.y; const distance = Math.hypot(dx, dy) || 1;
          const angle = Math.atan2(dy, dx);
          runtime.harpoons.push({
            id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y,
            vx: dx / distance * stats.speed, vy: dy / distance * stats.speed,
            damage: stats.damage * toolPower, distance: 0, maxDistance: stats.range, angle, hitIds: new Set<number>(),
          });
          runtime.harpoonClock = stats.interval;
        } else runtime.harpoonClock = .15;
      }
      for (const harpoon of runtime.harpoons) {
        const previousPosition = { x: harpoon.x, y: harpoon.y };
        const step = Math.min(Math.hypot(harpoon.vx, harpoon.vy) * dt, Math.max(0, harpoon.maxDistance - harpoon.distance));
        harpoon.x += Math.cos(harpoon.angle) * step;
        harpoon.y += Math.sin(harpoon.angle) * step;
        harpoon.distance += step;
        for (const creature of runtime.creatures) {
          if (harpoon.hitIds.has(creature.id)) continue;
          if (distanceToSegment(creature, previousPosition, harpoon) <= creature.size + 7) {
            damageCreature(creature, harpoon.damage, .16);
            harpoon.hitIds.add(creature.id);
          }
        }
      }
      runtime.harpoons = runtime.harpoons.filter((item) => item.distance < item.maxDistance);

      const electricLevel = runtime.levels.electric ?? 0;
      if (runtime.mode === "normal" && electricLevel > 0 && runtime.player.hp > 50) {
        const electric = mudflatElectricStats(electricLevel);
        if (runtime.electricClock <= 0) {
          const reach = mudflatTongStats(runtime.levels.tongs ?? 1).reach;
          for (const creature of runtime.creatures) {
            if (Math.hypot(creature.x - runtime.player.x, creature.y - runtime.player.y) <= reach + creature.size) damageCreature(creature, electric.damage * toolPower, .14);
          }
          runtime.electricPulseLife = .42;
          runtime.electricClock = electric.interval;
        }
        if (runtime.selfShockClock <= 0) {
          damagePlayer(electric.selfDamage, "#79ddff");
          const hasSelfShockMessage = runtime.selfShockNotified;
          showPlayerMessage(hasSelfShockMessage ? "악 찌릿찌릿해!" : "악 찌릿찌릿해, 이거 계속 쓸 수는 없겠네.", hasSelfShockMessage ? 1 : 3, hasSelfShockMessage ? .7 : 1);
          runtime.selfShockNotified = true;
          runtime.selfShockClock = electric.selfInterval;
        }
        runtime.electricStopNotified = false;
      } else {
        runtime.electricClock = 0;
        runtime.selfShockClock = 10;
        if (runtime.mode === "normal" && electricLevel > 0 && runtime.player.hp <= 50 && !runtime.electricStopNotified && runtime.playerMessageLife <= 0) {
          showPlayerMessage("체력이 부족해서 지금은 전기 스파크를 못 쓰겠어.", 3);
          runtime.electricStopNotified = true;
        }
      }

      const castNetLevel = runtime.levels["cast-net"] ?? 0;
      if (runtime.mode === "normal" && castNetLevel > 0 && runtime.castNetClock <= 0 && runtime.creatures.length) {
        const castNet = mudflatCastNetStats(castNetLevel);
        const tongReach = mudflatTongStats(runtime.levels.tongs ?? 1).reach;
        const target = mudflatCastNetTarget(runtime.creatures, runtime.player, { width, height }, tongReach * 1.25);
        if (target) {
          runtime.castNets.push({ id: sequenceRef.current++, targetId: target.id, x: target.x, y: target.y, life: .82, maxLife: .82, damage: castNet.damage * toolPower, radius: castNet.radius, hit: false });
          runtime.castNetClock = castNet.interval;
        }
      }
      for (const castNet of runtime.castNets) {
        const trackedTarget = runtime.creatures.find((creature) => creature.id === castNet.targetId);
        const progressBefore = 1 - castNet.life / castNet.maxLife;
        // Keep the falling net aligned with its living target until impact so
        // quick seafood cannot simply swim away before the net reaches it.
        if (trackedTarget && !castNet.hit && progressBefore < .62) {
          castNet.x = trackedTarget.x;
          castNet.y = trackedTarget.y;
        }
        castNet.life -= dt;
        const progress = 1 - castNet.life / castNet.maxLife;
        if (!castNet.hit && progress >= .62) {
          for (const creature of runtime.creatures) {
            if (Math.hypot(creature.x - castNet.x, creature.y - castNet.y) <= castNet.radius + creature.size) damageCreature(creature, castNet.damage, .18);
          }
          castNet.hit = true;
          runtime.bursts.push({ id: sequenceRef.current++, x: castNet.x, y: castNet.y, life: .34, maxLife: .34, color: "#d8e8df", size: castNet.radius });
        }
      }
      runtime.castNets = runtime.castNets.filter((item) => item.life > 0);

      const saltLevel = runtime.levels.salt ?? 0;
      if (saltLevel > 0) {
        const count = 1 + Math.floor(saltLevel / 2);
        for (let index = 0; index < count; index += 1) {
          const angle = runtime.elapsed * (1.8 + saltLevel * .08) + index / count * Math.PI * 2;
          const saltX = runtime.player.x + Math.cos(angle) * (66 + saltLevel * 3);
          const saltY = runtime.player.y + Math.sin(angle) * (66 + saltLevel * 3);
          for (const creature of runtime.creatures) if (creature.saltHit <= 0 && Math.hypot(creature.x - saltX, creature.y - saltY) < creature.size + 10) { damageCreature(creature, (3 + saltLevel * 2) * toolPower, .1); creature.saltHit = .22; }
        }
      }

      const tongLevel = runtime.levels.tongs ?? 0;
      if (runtime.mode === "normal" && tongLevel > 0) {
        const tong = mudflatTongStats(tongLevel);
        const angle = runtime.elapsed * tong.rotationSpeed;
        const tipX = runtime.player.x + Math.cos(angle) * tong.reach;
        const tipY = runtime.player.y + Math.sin(angle) * tong.reach;
        for (const creature of runtime.creatures) {
          if (creature.saltHit <= 0 && Math.hypot(creature.x - tipX, creature.y - tipY) < creature.size + 10) {
            damageCreature(creature, tong.power * toolPower, .1); creature.saltHit = .22;
          }
        }

        const rockerLevel = runtime.levels.rocker ?? 0;
        if (rockerLevel > 0 && !runtime.rockFlipEffect && runtime.rockTurnClock <= 0) {
          const target = runtime.rocks
            .filter((rock) => Math.hypot(rock.x - runtime.player.x, rock.y - runtime.player.y) <= tong.reach + rock.radius)
            .sort((left, right) => Math.hypot(left.x - runtime.player.x, left.y - runtime.player.y) - Math.hypot(right.x - runtime.player.x, right.y - runtime.player.y))[0];
          if (target) {
            const stats = mudflatRockTurnerStats(rockerLevel);
            runtime.rockFlipEffect = { rockId: target.id, x: target.x, y: target.y, life: stats.processingTime, maxLife: stats.processingTime };
            runtime.rockTurnClock = 0;
          } else runtime.rockTurnClock = .12;
        }
      }
      damageAndCollect();

      const hasVisibleSeafood = runtime.creatures.some((creature) => {
        const screenX = width / 2 + creature.x - runtime.player.x;
        const screenY = height / 2 + creature.y - runtime.player.y;
        const margin = Math.max(10, creature.size * 1.6);
        return screenX >= -margin && screenX <= width + margin && screenY >= -margin && screenY <= height + margin;
      });
      if (hasVisibleSeafood) {
        runtime.emptySeafoodSeconds = 0;
        runtime.emptySeafoodDamageClock = 0;
      } else {
        runtime.emptySeafoodSeconds += dt;
        const emptyHazard = mudflatStageEmptySeafoodHazard(runtime.emptySeafoodSeconds, runtime.stage);
        if (emptyHazard.damagePerSecond > 0) {
          runtime.emptySeafoodDamageClock += dt;
          while (runtime.emptySeafoodDamageClock >= 1) {
            runtime.emptySeafoodDamageClock -= 1;
            runtime.player.hp = Math.max(0, runtime.player.hp - emptyHazard.damagePerSecond);
            runtime.bursts.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y, life: .4, maxLife: .4, color: emptyHazard.damagePerSecond >= 10 ? "#8bbcff" : "#d6bcff", size: 22 });
            runtime.floatTexts.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y + 4, life: .8, text: `-${emptyHazard.damagePerSecond}`, color: PLAYER_DAMAGE_TEXT_COLOR, kind: "playerDamage" });
          }
        } else runtime.emptySeafoodDamageClock = 0;
      }

      const pickupRadius = 50 + (runtime.levels.basket ?? 0) * 24 + (runtime.equipment.cooler ?? 0) * 12;
      for (const pickup of runtime.pickups) {
        const dx = runtime.player.x - pickup.x; const dy = runtime.player.y - pickup.y; const distance = Math.hypot(dx, dy) || 1;
        if (distance < pickupRadius) { const pull = Math.min(430, 120 + (pickupRadius - distance) * 7); pickup.x += dx / distance * pull * dt; pickup.y += dy / distance * pull * dt; }
        if (distance < 22) { runtime.xp += pickup.xp; pickup.xp = 0; }
      }
      runtime.pickups = runtime.pickups.filter((item) => item.xp > 0);
      for (const burst of runtime.bursts) burst.life -= dt;
      runtime.bursts = runtime.bursts.filter((item) => item.life > 0);
      for (const reveal of runtime.clamReveals) reveal.life -= dt;
      runtime.clamReveals = runtime.clamReveals.filter((item) => item.life > 0);
      for (const label of runtime.floatTexts) { label.life -= dt; label.y -= 28 * dt; }
      runtime.floatTexts = runtime.floatTexts.filter((item) => item.life > 0);
      if (runtime.xp >= runtime.nextXp) {
        runtime.xp -= runtime.nextXp; runtime.level += 1; runtime.nextXp = Math.floor(runtime.nextXp * 1.24 + 4); runtime.paused = true;
        const nextChoices = mudflatUpgradeChoices(runtime.level, runtime.levels, runtime.mode);
        if (nextChoices.length) { setChoices(nextChoices); setScreen("upgrade"); if ("vibrate" in navigator) navigator.vibrate([30, 30, 30]); }
        else runtime.paused = false;
      }
      if (runtime.player.hp <= 0) endRun(runtime);
      else if (runtime.elapsed >= MUDFLAT_RUN_SECONDS) completeStage(runtime);
    };

    const draw = (width: number, height: number) => {
      context.clearRect(0, 0, width, height);
      const tide = Math.min(1, runtime.elapsed / MUDFLAT_RUN_SECONDS);
      drawMudflat(context, width, height, runtime.player, tide, stageProfile);
      const screenPoint = (point: Point) => ({ x: width / 2 + point.x - runtime.player.x, y: height / 2 + point.y - runtime.player.y });
      const tidePhase = stageProfile.tideInterval > 0 ? runtime.elapsed % stageProfile.tideInterval : stageProfile.tideInterval;
      const tideSurge = stageProfile.tideInterval > 0 ? Math.max(0, 1 - tidePhase / 7) : 0;
      if (stageProfile.waterChannels && tideSurge > 0) {
        drawWaterChannelArrows(context, width, height, runtime.player, runtime.elapsed, stageProfile);
      }

      if (stageProfile.safeZone !== "none") {
        const safe = screenPoint(runtime.safeZone);
        const sandbarAlpha = runtime.safeZoneTransition > 0 ? Math.max(0, 1 - runtime.safeZoneTransition / .72) : 1;
        context.save(); context.globalAlpha = sandbarAlpha; context.translate(safe.x, safe.y);
        const sandbar = context.createRadialGradient(-20, -24, 10, 0, 0, 118);
        sandbar.addColorStop(0, "rgba(255,239,170,.96)"); sandbar.addColorStop(.72, "rgba(216,180,104,.9)"); sandbar.addColorStop(1, "rgba(150,112,66,.72)");
        context.fillStyle = sandbar; context.strokeStyle = "rgba(255,237,148,.94)"; context.lineWidth = 4;
        context.beginPath(); context.ellipse(0, 0, 112, 94, -.12, 0, Math.PI * 2); context.fill(); context.stroke();
        context.fillStyle = "rgba(116,76,40,.28)";
        for (let mark = -66; mark <= 66; mark += 22) { context.beginPath(); context.arc(mark, 22 + Math.sin(mark) * 10, 2.5, 0, Math.PI * 2); context.fill(); }
        context.fillStyle = "#855c34"; context.fillRect(-2, -48, 4, 28); context.fillStyle = "#f5ad57";
        context.beginPath(); context.moveTo(2, -47); context.lineTo(26, -38); context.lineTo(2, -30); context.closePath(); context.fill();
        context.fillStyle = "rgba(255,247,196,.96)"; context.font = "900 12px system-ui"; context.textAlign = "center"; context.fillText("마른 모래톱 · 밀물 피난처", 0, -126); context.restore();
      }
      for (const falling of runtime.fallingRocks) {
        const point = screenPoint(falling); const progress = 1 - falling.life / falling.maxLife;
        context.save(); context.translate(point.x, point.y);
        context.fillStyle = `rgba(114,51,35,${.18 + progress * .3})`; context.strokeStyle = `rgba(255,177,108,${.55 + progress * .4})`; context.lineWidth = 3;
        context.beginPath(); context.arc(0, 0, falling.radius * (1 - progress * .18), 0, Math.PI * 2); context.fill(); context.stroke();
        context.fillStyle = "#fff0cf"; context.font = "900 15px system-ui"; context.textAlign = "center"; context.fillText("낙석!", 0, 5); context.restore();
      }

      for (const hole of runtime.clamHoles) {
        const point = screenPoint(hole); if (point.x < -35 || point.y < -35 || point.x > width + 35 || point.y > height + 35) continue;
        context.save(); context.translate(point.x, point.y); drawClamHole(context, hole); context.restore();
      }

      for (const rock of runtime.rocks) {
        const point = screenPoint(rock); if (point.x < -45 || point.y < -45 || point.x > width + 45 || point.y > height + 45) continue;
        const effect = runtime.rockFlipEffect?.rockId === rock.id ? runtime.rockFlipEffect : undefined;
        context.save(); context.translate(point.x, point.y); drawRock(context, rock, effect); context.restore();
      }

      for (const pickup of runtime.pickups) {
        const point = screenPoint(pickup);
        context.save(); context.translate(point.x, point.y); drawExperiencePickup(context, pickup, runtime.elapsed); context.restore();
      }
      for (const projectile of runtime.projectiles) {
        const point = screenPoint(projectile);
        context.save(); context.translate(point.x, point.y); context.rotate(Math.atan2(projectile.vy, projectile.vx));
        context.strokeStyle = "#f7e5b8"; context.lineWidth = 2;
        context.beginPath(); context.arc(0, 0, 11, 0, Math.PI * 2); context.stroke();
        for (let line = -1; line <= 1; line += 1) { context.beginPath(); context.moveTo(-9, line * 5); context.lineTo(9, line * 5); context.moveTo(line * 5, -9); context.lineTo(line * 5, 9); context.stroke(); }
        context.restore();
      }
      for (const harpoon of runtime.harpoons) {
        const point = screenPoint(harpoon);
        drawHarpoonSprite(context, point.x, point.y, harpoon.angle);
      }
      for (const creature of runtime.creatures) {
        const point = screenPoint(creature); if (point.x < -70 || point.y < -70 || point.x > width + 70 || point.y > height + 70) continue;
        context.save(); context.translate(point.x, point.y); drawCreatureSprite(context, creature, runtime.elapsed, creatureSprites); context.restore();
        if (creature.boss || creature.hp < creature.maxHp) {
          const visualSize = creature.size * (creature.visualScale ?? 1);
          const barWidth = creature.boss ? 104 : Math.max(28, visualSize * 2);
          const barY = point.y - visualSize - (creature.boss ? 29 : 13);
          context.fillStyle = "rgba(28,22,21,.64)"; roundedRect(context, point.x - barWidth / 2, barY, barWidth, creature.boss ? 9 : 5, 4); context.fill();
          context.fillStyle = creature.boss ? "#ffd55f" : "#ff8a6f"; roundedRect(context, point.x - barWidth / 2 + 2, barY + 2, Math.max(0, (barWidth - 4) * creature.hp / creature.maxHp), creature.boss ? 5 : 1.5, 3); context.fill();
          if (creature.boss) { context.fillStyle = "#fff4cf"; context.font = "800 12px system-ui"; context.textAlign = "center"; context.fillText("대왕 박하지", point.x, barY - 6); }
        }
      }
      for (const reveal of runtime.clamReveals) {
        const point = screenPoint(reveal); const progress = 1 - reveal.life / reveal.maxLife;
        context.save(); context.globalAlpha = Math.min(1, reveal.life * 3); context.translate(point.x, point.y - progress * 26);
        if (reveal.type === "pearl") {
          const glow = context.createRadialGradient(0, 0, 2, 0, 0, 22); glow.addColorStop(0, "#fffef2"); glow.addColorStop(.35, "#ffe98e"); glow.addColorStop(1, "rgba(255,219,94,0)");
          context.fillStyle = glow; context.beginPath(); context.arc(0, 0, 22, 0, Math.PI * 2); context.fill();
          context.fillStyle = "#fffbe3"; context.beginPath(); context.arc(0, 0, 8, 0, Math.PI * 2); context.fill();
        } else {
          const isRazorClam = reveal.type === "razor-clam";
          const image = creatureSprites.get(isRazorClam ? "razor-clam-reveal" : "clam-reveal");
          const clamGrade = MUDFLAT_CLAM_GRADES.find((grade) => grade.id === reveal.type);
          const clamSize = clamGrade?.visualSize ?? 42;
          if (image?.complete && image.naturalWidth > 0) {
            if (clamGrade?.vertical) {
              context.save(); context.rotate(Math.PI / 2);
              context.drawImage(image, -clamSize / 2, -clamSize * .2, clamSize, clamSize * .4);
              context.restore();
            } else context.drawImage(image, -clamSize / 2, -clamSize / 2, clamSize, clamSize);
          }
        }
        context.restore();
      }
      for (const netSlam of runtime.netSlams) {
        const point = screenPoint(netSlam);
        drawDipNetSlam(context, { x: width / 2, y: height / 2 }, point, netSlam);
      }
      for (const castNet of runtime.castNets) {
        const point = screenPoint(castNet); const progress = 1 - castNet.life / castNet.maxLife;
        context.save(); context.translate(point.x, point.y); context.globalAlpha = Math.min(1, progress * 2.4, castNet.life * 4);
        const dropHeight = Math.max(0, (1 - Math.min(1, progress / .62)) * 90);
        context.translate(0, -dropHeight); context.strokeStyle = "#edf8f1"; context.lineWidth = 2;
        context.beginPath(); context.arc(0, 0, castNet.radius * Math.min(1, progress * 1.8), 0, Math.PI * 2); context.stroke();
        for (let line = -2; line <= 2; line += 1) { context.beginPath(); context.moveTo(-castNet.radius, line * 6); context.lineTo(castNet.radius, line * 6); context.moveTo(line * 6, -castNet.radius); context.lineTo(line * 6, castNet.radius); context.stroke(); }
        context.restore();
      }
      for (const burst of runtime.bursts) {
        const point = screenPoint(burst); const progress = 1 - burst.life / burst.maxLife;
        context.save(); context.globalAlpha = Math.max(0, burst.life / burst.maxLife);
        for (let particle = 0; particle < 8; particle += 1) {
          const angle = particle / 8 * Math.PI * 2 + burst.id;
          const distance = progress * (burst.size + 20);
          context.fillStyle = burst.color; context.beginPath(); context.arc(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance, 3 + (particle % 2), 0, Math.PI * 2); context.fill();
        }
        context.restore();
      }
      if ((runtime.levels.salt ?? 0) > 0) {
        const count = 1 + Math.floor((runtime.levels.salt ?? 0) / 2);
        for (let index = 0; index < count; index += 1) {
          const angle = runtime.elapsed * (1.8 + (runtime.levels.salt ?? 0) * .08) + index / count * Math.PI * 2;
          const saltX = width / 2 + Math.cos(angle) * (66 + (runtime.levels.salt ?? 0) * 3); const saltY = height / 2 + Math.sin(angle) * (66 + (runtime.levels.salt ?? 0) * 3);
          context.fillStyle = "rgba(255,244,190,.18)"; context.beginPath(); context.arc(saltX, saltY, 15, 0, Math.PI * 2); context.fill();
          context.fillStyle = "#fff1af"; context.save(); context.translate(saltX, saltY); context.rotate(angle); context.fillRect(-6, -6, 12, 12); context.restore();
        }
      }
      if (runtime.mode === "normal" && (runtime.levels.tongs ?? 0) > 0) {
        const tong = mudflatTongStats(runtime.levels.tongs);
        drawRotatingTongs(context, width / 2, height / 2, runtime.elapsed * tong.rotationSpeed, tong.reach);
      }
      if (runtime.rockFlipEffect) {
        const point = screenPoint(runtime.rockFlipEffect);
        drawRockHookBar(context, { x: width / 2, y: height / 2 }, point, runtime.rockFlipEffect);
      }
      if (runtime.hoeEffect > 0) {
        const alpha = runtime.hoeEffect / .2;
        const radius = 78 + (runtime.levels.hoe ?? 0) * 12;
        context.strokeStyle = `rgba(255,221,132,${alpha * .8})`; context.lineWidth = 6 + alpha * 4;
        context.beginPath(); context.arc(width / 2, height / 2, radius, -.18, Math.PI * 1.55); context.stroke();
        context.strokeStyle = `rgba(255,251,224,${alpha * .6})`; context.lineWidth = 2; context.beginPath(); context.arc(width / 2, height / 2, radius + 7, 0, Math.PI * 1.35); context.stroke();
      }
      drawGatherer(context, width / 2, height / 2, runtime.player, runtime.mode === "normal" ? "beginner" : characterId, (runtime.equipment.headlamp ?? 0) > 0);
      if (runtime.electricPulseLife > 0) {
        const reach = mudflatTongStats(runtime.levels.tongs ?? 1).reach;
        const pulse = Math.min(1, runtime.electricPulseLife / .42);
        const centerX = width / 2; const centerY = height / 2;
        const phase = runtime.elapsed * 12;
        context.save(); context.globalCompositeOperation = "lighter";
        const cloud = context.createRadialGradient(centerX, centerY, reach * .08, centerX, centerY, reach * 1.04);
        cloud.addColorStop(0, `rgba(250,245,255,${pulse * .42})`);
        cloud.addColorStop(.32, `rgba(193,115,255,${pulse * .22})`);
        cloud.addColorStop(.7, `rgba(79,78,255,${pulse * .1})`);
        cloud.addColorStop(1, "rgba(72,62,255,0)");
        context.fillStyle = cloud; context.beginPath(); context.arc(centerX, centerY, reach * 1.05, 0, Math.PI * 2); context.fill();
        for (let ring = 0; ring < 3; ring += 1) {
          const ringRadius = reach * (.38 + ring * .22) + Math.sin(phase + ring * 1.8) * 5;
          context.strokeStyle = ring === 1 ? `rgba(235,188,255,${pulse * .65})` : `rgba(100,192,255,${pulse * .5})`;
          context.lineWidth = 1.5 + (2 - ring) * .6;
          context.setLineDash([5 + ring * 4, 9 - ring]); context.lineDashOffset = -phase * (4 + ring * 2);
          context.beginPath(); context.arc(centerX, centerY, ringRadius, phase * (.4 + ring * .11), phase * (.4 + ring * .11) + Math.PI * 1.45); context.stroke();
        }
        context.setLineDash([]);
        for (let bolt = 0; bolt < 10; bolt += 1) {
          const angle = bolt / 10 * Math.PI * 2 + phase * .24;
          const endRadius = reach * (.58 + ((bolt * 17) % 4) * .1);
          context.strokeStyle = bolt % 2 ? `rgba(124,222,255,${pulse * .8})` : `rgba(231,184,255,${pulse * .82})`;
          context.lineWidth = bolt % 3 === 0 ? 2.6 : 1.35;
          context.beginPath();
          context.moveTo(centerX + Math.cos(angle) * 14, centerY + Math.sin(angle) * 14);
          for (let step = 1; step <= 4; step += 1) {
            const distance = endRadius * step / 4;
            const jitter = Math.sin(phase * 2.6 + bolt * 3.1 + step * 4.7) * 10 * (step < 4 ? 1 : .25);
            context.lineTo(centerX + Math.cos(angle) * distance + Math.cos(angle + Math.PI / 2) * jitter, centerY + Math.sin(angle) * distance + Math.sin(angle + Math.PI / 2) * jitter);
          }
          context.stroke();
        }
        for (let spark = 0; spark < 18; spark += 1) {
          const angle = spark / 18 * Math.PI * 2 - phase * .32;
          const distance = reach * (.26 + ((spark * 7) % 11) / 18);
          const radius = 1.4 + (spark % 3) * .65;
          context.fillStyle = spark % 2 ? `rgba(225,188,255,${pulse * .78})` : `rgba(144,236,255,${pulse * .7})`;
          context.beginPath(); context.arc(centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance, radius, 0, Math.PI * 2); context.fill();
        }
        context.restore();
      }
      if (stageProfile.darkness > 0) {
        const headlamp = (runtime.equipment.headlamp ?? 0) > 0;
        const radius = headlamp ? 215 : 112;
        context.save();
        const darkness = context.createRadialGradient(width / 2, height / 2, radius * .16, width / 2, height / 2, Math.max(radius, Math.hypot(width, height) * .72));
        darkness.addColorStop(0, "rgba(3,8,15,0)");
        darkness.addColorStop(Math.min(.8, radius / Math.max(radius, Math.hypot(width, height) * .72)), "rgba(3,8,15,.08)");
        darkness.addColorStop(1, `rgba(3,8,15,${stageProfile.darkness})`);
        context.fillStyle = darkness; context.fillRect(0, 0, width, height); context.restore();
      }
      if (runtime.tideFlash > 0) {
        context.fillStyle = `rgba(84,181,206,${runtime.tideFlash * .28})`; context.fillRect(0, 0, width, height);
      }
      if (stageProfile.tideInterval > 0) {
        const phase = runtime.elapsed % stageProfile.tideInterval;
        const warning = stageProfile.tideInterval - phase;
        if (warning <= 7) {
          const warningText = `밀물 접근 · ${Math.max(1, Math.ceil(warning))}초`;
          context.save(); context.fillStyle = "rgba(16,48,65,.92)"; roundedRect(context, width / 2 - 158, 88, 316, 42, 18); context.fill();
          context.strokeStyle = "#8de4ef"; context.lineWidth = 2; context.stroke(); context.fillStyle = "#eaffff"; context.font = "900 14px system-ui"; context.textAlign = "center";
          context.fillText(warningText, width / 2, 114); context.restore();
          if (stageProfile.safeZone !== "none") drawSandbarDirectionGuide(context, width, runtime.player, runtime.safeZone);
        }
      }
      if (runtime.elapsed < 4.5) {
        const alpha = Math.min(1, runtime.elapsed * 2, (4.5 - runtime.elapsed) * 1.5);
        context.save(); context.globalAlpha = alpha; context.fillStyle = "rgba(21,27,29,.9)"; roundedRect(context, 18, height - 155, width - 36, 118, 22); context.fill();
        context.strokeStyle = "rgba(255,220,139,.55)"; context.lineWidth = 1.5; context.stroke(); context.fillStyle = "#ffcf78"; context.font = "900 12px system-ui"; context.textAlign = "left"; context.fillText(`STAGE ${runtime.stage}`, 38, height - 125);
        context.fillStyle = "#fff8e9"; context.font = "900 23px system-ui"; context.fillText(stageProfile.name, 38, height - 94);
        context.fillStyle = "#d8d3c6"; context.font = "700 13px system-ui"; context.fillText(stageProfile.subtitle, 38, height - 67); context.restore();
      }
      if (runtime.stage === 1 && runtime.elapsed < 3) {
        const message = "일단 저 구멍들을 파봐야겠다.";
        const alpha = Math.min(1, runtime.elapsed * 4, (3 - runtime.elapsed) * 3);
        context.save(); context.globalAlpha = alpha; context.font = "900 14px system-ui"; context.textAlign = "center";
        const bubbleWidth = Math.min(width - 28, context.measureText(message).width + 34);
        const bubbleTop = height / 2 - 116;
        context.shadowColor = "rgba(25,18,15,.34)"; context.shadowBlur = 12; context.shadowOffsetY = 5;
        context.fillStyle = "rgba(255,248,223,.96)"; roundedRect(context, width / 2 - bubbleWidth / 2, bubbleTop, bubbleWidth, 40, 16); context.fill();
        context.shadowColor = "transparent"; context.beginPath(); context.moveTo(width / 2 - 8, bubbleTop + 39); context.lineTo(width / 2 + 8, bubbleTop + 39); context.lineTo(width / 2, bubbleTop + 50); context.closePath(); context.fill();
        context.strokeStyle = "rgba(75,57,44,.28)"; context.lineWidth = 1.5; roundedRect(context, width / 2 - bubbleWidth / 2, bubbleTop, bubbleWidth, 40, 16); context.stroke();
        context.fillStyle = "#46372c"; context.fillText(message, width / 2, bubbleTop + 26); context.restore();
      }
      if (runtime.playerMessageLife > 0) {
        const message = runtime.playerMessage;
        const isCatchFullMessage = message === CATCH_FULL_MESSAGE;
        const messageAlpha = (isCatchFullMessage ? Math.min(1, runtime.playerMessageLife / .45) : Math.min(1, runtime.playerMessageLife * 2)) * runtime.playerMessageOpacity;
        context.save(); context.globalAlpha = messageAlpha; context.font = "900 14px system-ui"; context.textAlign = "center";
        const bubbleWidth = Math.min(width - 28, context.measureText(message).width + 36); const bubbleTop = height / 2 - 116;
        context.fillStyle = "rgba(255,244,218,.97)"; roundedRect(context, width / 2 - bubbleWidth / 2, bubbleTop, bubbleWidth, 40, 16); context.fill();
        context.strokeStyle = "rgba(134,76,48,.48)"; context.lineWidth = 1.5; context.stroke(); context.fillStyle = "#512f25"; context.fillText(message, width / 2, bubbleTop + 26); context.restore();
      }
      if (runtime.discoveryMessageLife > 0) {
        const message = "신기술을 알게되었다.";
        context.save(); context.globalAlpha = Math.min(1, runtime.discoveryMessageLife * 2); context.font = "900 15px system-ui"; context.textAlign = "center";
        const bubbleWidth = Math.min(width - 28, context.measureText(message).width + 40); const bubbleTop = height / 2 - 124;
        context.fillStyle = "rgba(224,250,255,.97)"; roundedRect(context, width / 2 - bubbleWidth / 2, bubbleTop, bubbleWidth, 42, 17); context.fill();
        context.strokeStyle = "#61cde8"; context.lineWidth = 2; context.stroke(); context.fillStyle = "#123f53"; context.fillText(message, width / 2, bubbleTop + 27); context.restore();
      }
      const emptyHazard = mudflatStageEmptySeafoodHazard(runtime.emptySeafoodSeconds, runtime.stage);
      if (emptyHazard.message) {
        context.save();
        context.font = "900 14px system-ui"; context.textAlign = "center";
        const messageWidth = Math.min(width - 30, context.measureText(emptyHazard.message).width + 34);
        context.fillStyle = emptyHazard.damagePerSecond >= 10 ? "rgba(21,42,72,.92)" : "rgba(47,34,62,.9)";
        roundedRect(context, width / 2 - messageWidth / 2, height / 2 - 92, messageWidth, 36, 14); context.fill();
        context.strokeStyle = emptyHazard.damagePerSecond >= 10 ? "#9fc9ff" : "#d8b9ff"; context.lineWidth = 1.5; context.stroke();
        context.fillStyle = "#fffaf2"; context.fillText(emptyHazard.message, width / 2, height / 2 - 69); context.restore();
      }
      const diggingHole = runtime.clamHoles.find((hole) => hole.progress > 0);
      if (diggingHole) drawClamDigging(context, { x: width / 2, y: height / 2 }, screenPoint(diggingHole), diggingHole.progress / 2);
      for (const label of runtime.floatTexts) {
        const point = screenPoint(label); context.save(); context.globalAlpha = Math.min(1, label.life * 2.5);
        const isPlayerDamage = label.kind === "playerDamage";
        context.font = isPlayerDamage ? "900 25px system-ui" : "900 14px system-ui"; context.textAlign = "center"; context.lineWidth = isPlayerDamage ? 6 : 4; context.strokeStyle = isPlayerDamage ? "rgba(42,14,18,.9)" : "rgba(38,29,27,.72)"; context.strokeText(label.text, point.x, point.y); context.fillStyle = label.color; context.fillText(label.text, point.x, point.y); context.restore();
      }
    };

    const loop = (now: number) => {
      if (!mounted) return;
      const size = resize(); const dt = Math.min(.034, Math.max(0, (now - previous) / 1000)); previous = now;
      update(dt, size.width, size.height); draw(size.width, size.height); hudClock += dt;
      if (hudClock >= .1) { hudClock = 0; snapshot(runtime); }
      animation = requestAnimationFrame(loop);
    };
    animation = requestAnimationFrame(loop);
    return () => { mounted = false; cancelAnimationFrame(animation); };
  }, [completeStage, endRun, runId, snapshot]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) { event.preventDefault(); keysRef.current.add(event.code); } };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.code);
    const visibility = () => { const runtime = runtimeRef.current; if (document.hidden && runtime && !runtime.ended && !runtime.paused) { runtime.paused = true; resetMovementInput(); setScreen("paused"); } };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); document.removeEventListener("visibilitychange", visibility); };
  }, [resetMovementInput]);

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (screen !== "running") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    joystickRef.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, x: 0, y: 0 };
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const joystick = joystickRef.current; if (joystick.pointerId !== event.pointerId) return;
    const vector = mudflatJoystickVector(event.clientX - joystick.originX, event.clientY - joystick.originY);
    joystick.x = vector.x; joystick.y = vector.y;
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (joystickRef.current.pointerId !== event.pointerId) return;
    joystickRef.current = { pointerId: -1, originX: 0, originY: 0, x: 0, y: 0 };
  };
  const pause = () => { const runtime = runtimeRef.current; if (!runtime || runtime.ended || runtime.paused) return; runtime.paused = true; resetMovementInput(); setScreen("paused"); };
  const resume = () => { const runtime = runtimeRef.current; if (!runtime) return; resetMovementInput(); runtime.paused = false; setScreen("running"); };
  const chooseUpgrade = (id: string) => {
    const runtime = runtimeRef.current; if (!runtime) return;
    const beforeUnlocks = mudflatAdvancedSkillUnlocks(runtime.levels);
    runtime.levels[id] = (runtime.levels[id] ?? 0) + 1;
    runtime.bleedSeconds = 0; runtime.bleedTickClock = 1;
    if (id === "stamina") { runtime.player.maxHp += 18; runtime.player.hp = Math.min(runtime.player.maxHp, runtime.player.hp + 35); }
    if (runtime.mode === "normal") {
      const nextMaxHp = derivedMaxHp(runtime.player.baseMaxHp, runtime.equipment, runtime.levels, runtime.mode);
      runtime.player.maxHp = nextMaxHp;
      if (id === "snack") runtime.player.hp = nextMaxHp;
      else runtime.player.hp = Math.min(runtime.player.hp, nextMaxHp);
      const afterUnlocks = mudflatAdvancedSkillUnlocks(runtime.levels);
      if ((!beforeUnlocks.electric && afterUnlocks.electric) || (!beforeUnlocks.castNet && afterUnlocks.castNet)) runtime.discoveryMessageLife = 3;
    }
    resetMovementInput(); setChoices([]); runtime.paused = false; snapshot(runtime); setScreen("running");
  };
  const rerollUpgradeChoices = () => {
    const runtime = runtimeRef.current; if (!runtime) return;
    const cost = Math.ceil(runtime.player.maxHp * .2);
    if (runtime.player.hp <= cost) return;
    runtime.player.hp -= cost;
    runtime.floatTexts.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y + 4, life: .72, text: `-${cost}`, color: PLAYER_DAMAGE_TEXT_COLOR, kind: "playerDamage" });
    setChoices(mudflatUpgradeChoices(runtime.level, runtime.levels, runtime.mode)); snapshot(runtime);
    if ("vibrate" in navigator) navigator.vibrate(18);
  };
  const buyEquipment = (id: string) => {
    const current = campaignRef.current; if (!current) return;
    const item = MUDFLAT_SHOP_EQUIPMENT.find((entry) => entry.id === id); if (!item) return;
    const level = current.equipment[id] ?? 0; const price = mudflatEquipmentPrice(id, level);
    if (level >= item.max) { setCampNotice("이미 최고 단계까지 정비했습니다."); return; }
    if (current.coins < price) { setCampNotice("코인이 부족합니다. 해산물을 먼저 판매해 보세요."); return; }
    const equipment = { ...current.equipment, [id]: level + 1 };
    const maxHp = Math.max(current.maxHp, derivedMaxHp(current.baseMaxHp, equipment, current.levels, current.mode));
    const hp = Math.min(maxHp, current.hp + Math.max(0, maxHp - current.maxHp));
    const next = { ...current, coins: current.coins - price, equipment, maxHp, hp };
    storeCampaign(next); setCampNotice(`${item.name} Lv.${level + 1} 정비 완료 · ${mudflatEquipmentDescription(id, level + 1)}`);
  };
  const buyFood = (id: string) => {
    const current = campaignRef.current; if (!current) return;
    const food = MUDFLAT_RECOVERY_FOODS.find((entry) => entry.id === id); if (!food) return;
    if (current.hp >= current.maxHp) { setCampNotice("현재 체력이 가득 찼습니다."); return; }
    if (current.coins < food.price) { setCampNotice("회복 음식을 구매할 코인이 부족합니다."); return; }
    const healedHp = food.heal === Infinity ? current.maxHp : Math.min(current.maxHp, current.hp + food.heal);
    const next = { ...current, coins: current.coins - food.price, hp: healedHp };
    storeCampaign(next); setCampNotice(`${food.name} 구매 · 체력 ${Math.floor(healedHp)} / ${Math.floor(current.maxHp)}`);
  };
  const trainSkill = (id: string) => {
    const current = campaignRef.current; if (!current) return;
    const upgrades = current.mode === "normal" ? unlockedNormalUpgrades(current.levels) : MUDFLAT_UPGRADES;
    const skill = upgrades.find((entry) => entry.id === id); if (!skill) return;
    const level = current.levels[id] ?? 0; const price = mudflatTrainingPrice(level);
    if (!mudflatCanLearnSkill(current.levels, id, current.mode)) { setCampNotice("선택 기술은 최대 6개까지만 보유할 수 있습니다."); return; }
    if (level >= skill.max) { setCampNotice("이미 최고 레벨에 도달한 기술입니다."); return; }
    if (current.coins < price) { setCampNotice("기술 훈련에 필요한 코인이 부족합니다."); return; }
    const beforeUnlocks = mudflatAdvancedSkillUnlocks(current.levels);
    const levels = { ...current.levels, [id]: level + 1 };
    let maxHp = current.maxHp; let hp = current.hp;
    if (id === "stamina") { maxHp += 18; hp = Math.min(maxHp, hp + 35); }
    if (current.mode === "normal") {
      maxHp = derivedMaxHp(current.baseMaxHp, current.equipment, levels, current.mode);
      hp = id === "snack" ? maxHp : Math.min(hp, maxHp);
    }
    const afterUnlocks = mudflatAdvancedSkillUnlocks(levels);
    const discovered = (!beforeUnlocks.electric && afterUnlocks.electric) || (!beforeUnlocks.castNet && afterUnlocks.castNet);
    const next = { ...current, coins: current.coins - price, levels, maxHp, hp, pendingSkillDiscovery: current.pendingSkillDiscovery || discovered };
    storeCampaign(next); setCampNotice(discovered ? `신기술을 알게 되었습니다. ${skill.name} Lv.${level + 1} 훈련 완료` : `${skill.name} Lv.${level + 1} 훈련 완료`);
  };
  const startNextStage = () => {
    const current = campaignRef.current; if (!current) return;
    const runtime = makeRuntime(current);
    if (current.pendingSkillDiscovery) storeCampaign({ ...current, pendingSkillDiscovery: false });
    resetMovementInput(); runtimeRef.current = runtime; snapshot(runtime); setChoices([]); setScreen("running"); setRunId((value) => value + 1);
  };
  const reset = () => { runtimeRef.current = null; campaignRef.current = null; resetMovementInput(); setCampaign(null); setHud({ ...emptyHud, mode }); setSelectedStage(1); setChoices([]); setSelectedSkillId(null); setScreen("setup"); };
  const clearCampaign = () => { window.localStorage.removeItem(CAMPAIGN_KEY); setSavedCampaign(null); reset(); };

  if (screen === "setup") return (
    <main className="ms-shell ms-setup">
      <MudflatTopbar onExit={onExit} />
      <section className="ms-setup-hero">
        <img className="ms-hero-crab" src="/mudflat-creatures/crab.png" alt="" aria-hidden="true" />
        <h1>해루질에 <em>미친 자여!</em></h1>
      </section>
      <section className="ms-character-select">
        <h2 className="ms-mode-heading">어떤 해루질로 떠날까요?</h2>
        <div className="ms-mode-picker">
          <button type="button" className={mode === "normal" ? "selected" : ""} onClick={() => { setMode("normal"); window.localStorage.setItem(LAST_MODE_KEY, "normal"); }}>
            <i>◆</i><span><b>일반 모드</b><small>강한 해산물·돌 장애물·전용 기술</small></span>
          </button>
          <button type="button" className={mode === "kids" ? "selected" : ""} onClick={() => { setMode("kids"); window.localStorage.setItem(LAST_MODE_KEY, "kids"); }}>
            <i>☀</i><span><b>어린이 모드</b><small>가볍게 익히는 채집 모험</small></span>
          </button>
        </div>
        {mode === "kids" ? <>
          <h3 className="ms-selection-title">채집꾼 선택</h3>
          <div className="ms-character-grid">
            {CHARACTERS.map((item) => <button type="button" key={item.id} className={characterId === item.id ? "selected" : ""} onClick={() => setCharacterId(item.id)}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.description}</small></span><em>{item.id === "digger" ? "호미 Lv.2" : item.id === "netter" ? "뜰채 Lv.2" : "왕소금 Lv.2"}</em></button>)}
          </div>
        </> : <div className="ms-general-profile"><i>⌁</i><span><small>STARTING GATHERER</small><b>갯벌 초보</b><em>집게·호미질 기본 장착 · 체력 100</em></span></div>}
        <button className="ms-primary" type="button" onClick={begin}>
          {selectedStage > 1 ? `${selectedStage === 9 ? "끝없는 물때" : `${selectedStage}단계`} 새 원정 시작` : mode === "normal" ? "새 일반 원정 시작" : "새 어린이 원정 시작"} <span>→</span>
        </button>
        {savedCampaign && <details className="ms-setup-details ms-saved-expedition">
          <summary><span><small>SAVED EXPEDITION</small><b>저장된 원정 이어하기</b></span><i>⌄</i></summary>
          <button type="button" className="ms-continue" onClick={continueCampaign}><span><b>{savedCampaign.stage}단계 정비소</b><em>{savedCampaign.coins.toLocaleString()}코인 · LV.{savedCampaign.level}</em></span><strong>→</strong></button>
        </details>}
        {highestUnlockedStage > 1 && <details className="ms-setup-details ms-reentry-details">
          <summary><span><small>STAGE SELECT</small><b>열린 스테이지 재도전</b></span><i>⌄</i></summary>
          <div className="ms-stage-reentry"><div>{Array.from({ length: highestUnlockedStage }, (_, index) => index + 1).map((stage) => <button type="button" key={stage} className={selectedStage === stage ? "selected" : ""} onClick={() => setSelectedStage(stage)}>{stage === 9 ? "9+ 무한" : `${stage}단계`}</button>)}</div><p>재도전하면 장비·기술·경험치·코인은 모두 처음 상태입니다.</p></div>
        </details>}
        <details className="ms-setup-details ms-roadmap-details">
          <summary><span><small>EXPEDITION ROUTE</small><b>원정 경로 보기</b></span><i>⌄</i></summary>
          <div className="ms-stage-roadmap"><div>{MUDFLAT_REGULAR_STAGES.map((stage) => <span key={stage.stage}><i>{stage.stage}</i><b>{stage.name}</b><small>{stage.modifiers.join(" · ")}</small></span>)}<span className="endless"><i>9+</i><b>끝없는 물때</b><small>지형·날씨·생물·보조 목표 무작위 조합</small></span></div></div>
        </details>
      </section>
    </main>
  );

  if (screen === "camp" && campaign) {
    const haulCount = Object.values(campaign.lastHaul).reduce((sum, count) => sum + count, 0);
    const upgrades = campaign.mode === "normal" ? unlockedNormalUpgrades(campaign.levels) : MUDFLAT_UPGRADES;
    const nextStageStats = mudflatStageStats(campaign.stage);
    const nextStageProfile = mudflatStageProfile(campaign.stage) as StageProfile;
    const nextStageObjective = nextStageProfile.objective;
    const soldItems = MUDFLAT_SEAFOOD_MARKET.filter((item) => (campaign.lastHaul[item.type] ?? 0) > 0);
    const campHpPercent = Math.max(0, Math.min(100, campaign.hp / Math.max(1, campaign.maxHp) * 100));
    const campXpPercent = Math.max(0, Math.min(100, campaign.xp / Math.max(1, campaign.nextXp) * 100));
    return <main className="ms-shell ms-camp" style={{ "--ms-departure-space": `${departureSpace}px` } as CSSProperties}>
      <MudflatTopbar onExit={onExit} />
      <section className="ms-camp-hero">
        <div><small>STAGE {campaign.stage - 1} CLEAR</small><h1>무사히 돌아왔습니다</h1><p>{campNotice}</p></div>
        <div className="ms-wallet">
          <span><small>보유 코인</small><b>{campaign.coins.toLocaleString()}</b></span>
          <span><small>현재 체력</small><b>{Math.floor(campaign.hp)} / {Math.floor(campaign.maxHp)}</b></span>
          <span><small>다음 갯벌</small><b>{campaign.stage} · {nextStageProfile.name}</b></span>
          <span className="ms-boss-status"><small>대왕 박하지</small><b>{campaign.lastBossCaught ? "포획" : "미포획"}</b></span>
        </div>
        <div className="ms-camp-auto-sale"><span>이번 바구니 {haulCount}마리</span><b>+{campaign.lastSaleValue.toLocaleString()}코인</b></div>
      </section>
      <section className="ms-camp-layout">
        <article className="ms-market">
          <header><div><small>CATCH SUMMARY</small><h2>해산물 정산 내역</h2></div><span>{haulCount}마리 · 판매 완료</span></header>
          <div className="ms-market-table" role="table" aria-label="해산물별 판매 내역">
            {soldItems.length > 0 ? soldItems.map((item) => {
              const count = campaign.lastHaul[item.type] ?? 0;
              const marketScale = mudflatMarketImageScale(item.type);
              const isVertical = MUDFLAT_CLAM_GRADES.find((grade) => grade.id === item.type)?.vertical;
              return <div className={`ms-market-cell${marketScale !== 1 ? " is-scaled" : ""}${isVertical ? " is-vertical" : ""}`} role="cell" key={item.type} style={{ "--ms-market-scale": marketScale } as CSSProperties}>
                <img src={item.image} alt="" />
                <b>{item.name}</b>
                <small>{count.toLocaleString()}×{item.price}C</small>
              </div>;
            }) : <p className="ms-market-empty">이번 단계에서 정산할 해산물이 없습니다.</p>}
          </div>
          <div className="ms-sale-total"><span>전체 판매 가격</span><b>{campaign.lastSaleValue.toLocaleString()}코인</b></div>
        </article>
        <div className="ms-shop-stack">
          <article className="ms-shop"><header><small>EQUIPMENT SHOP</small><h2>장비 물품</h2></header><div>{MUDFLAT_SHOP_EQUIPMENT.map((item) => { const level = campaign.equipment[item.id] ?? 0; const price = mudflatEquipmentPrice(item.id, level); const effectLevel = Math.max(1, Math.min(item.max, level >= item.max ? level : level + 1)); const effectDescription = item.id === "headlamp" ? item.description : `Lv.${effectLevel} 효과 · ${mudflatEquipmentDescription(item.id, effectLevel)}`; return <button type="button" key={item.id} disabled={level >= item.max || campaign.coins < price} onClick={() => buyEquipment(item.id)}><i>{item.icon}</i><span><b>{item.name}</b><small>{effectDescription}</small></span><em>{level >= item.max ? "최고 단계" : `${price}코인 · Lv.${level} → ${level + 1}`}</em></button>; })}</div></article>
          <article className="ms-shop"><header><small>RECOVERY FOOD</small><h2>체력 회복 음식</h2></header><div>{MUDFLAT_RECOVERY_FOODS.map((food) => <button type="button" key={food.id} disabled={campaign.hp >= campaign.maxHp || campaign.coins < food.price} onClick={() => buyFood(food.id)}><i>{food.icon}</i><span><b>{food.name}</b><small>{food.description} 구매 즉시 먹습니다.</small></span><em>{food.price}코인</em></button>)}</div></article>
          <article className="ms-shop"><header><small>SKILL TRAINING</small><h2>기술 레벨업</h2></header><div>{upgrades.map((skill) => { const level = campaign.levels[skill.id] ?? 0; const price = mudflatTrainingPrice(level); return <button type="button" key={skill.id} disabled={level >= skill.max || campaign.coins < price} onClick={() => trainSkill(skill.id)}><i>{skill.icon}</i><span><b>{skill.name}</b><small>{skill.description}</small></span><em>{level >= skill.max ? "최고 레벨" : `${price}코인 · Lv.${level} → ${level + 1}`}</em></button>; })}</div></article>
        </div>
      </section>
      <section className="ms-departure" ref={departureRef}>
        <div className="ms-departure-copy"><small>{nextStageProfile.endless ? "ENDLESS TIDE" : "NEXT TIDE"}</small><b>{campaign.stage}단계 · {nextStageProfile.name}</b><span>{nextStageProfile.subtitle}</span><div className="ms-stage-modifiers">{nextStageProfile.modifiers.map((modifier: string) => <em key={modifier}>{modifier}</em>)}</div>{nextStageObjective && <strong>보조 목표 · {nextStageObjective.label} · 성공 보너스 {nextStageObjective.bonus}C</strong>}<small>해산물 체력 ×{nextStageStats.creatureHpMultiplier.toFixed(2)} · 접촉 피해 +{nextStageStats.contactDamageBonus}</small></div>
        <div className="ms-departure-status" aria-label="현재 원정 상태">
          <span className="ms-departure-coins"><small>보유 코인</small><b>{campaign.coins.toLocaleString()}C</b></span>
          <span className="ms-departure-meter hp"><small><b>체력</b><em>{Math.floor(campaign.hp)} / {Math.floor(campaign.maxHp)}</em></small><i role="progressbar" aria-label="현재 체력" aria-valuemin={0} aria-valuemax={Math.floor(campaign.maxHp)} aria-valuenow={Math.floor(campaign.hp)}><span style={{ width: `${campHpPercent}%` }} /></i></span>
          <span className="ms-departure-meter xp"><small><b>경험치</b><em>{campaign.xp} / {campaign.nextXp}</em></small><i role="progressbar" aria-label="현재 경험치" aria-valuemin={0} aria-valuemax={campaign.nextXp} aria-valuenow={campaign.xp}><span style={{ width: `${campXpPercent}%` }} /></i></span>
        </div>
        <button type="button" className="ms-clear-save" onClick={clearCampaign}>새 원정으로 초기화</button><button type="button" className="ms-primary" onClick={startNextStage}>다음 갯벌 출정 <span>→</span></button>
      </section>
    </main>;
  }

  if (screen === "defeat") return <main className="ms-shell ms-result defeat"><MudflatTopbar onExit={onExit} /><section><div className="ms-result-icon">≈</div><small>EXPEDITION ENDED</small><h1><span>갯벌에서</span>{" "}<span>힘이 다했습니다</span></h1><p><span>갯벌에는 여러가지 위험이 도사리고 있습니다.</span><br /><span>절대로 자만하지 말고 안전한 해루질 하세요.</span></p><div className="ms-result-grid"><span><small>도전 스테이지</small><b>{hud.stage}</b></span><span><small>잡은 수</small><b>{hud.caught}</b></span><span><small>레벨</small><b>{hud.level}</b></span><span><small>대왕 박하지</small><b>{hud.bossCaught ? "포획" : "놓침"}</b></span></div><p className="ms-reentry-note">한 번 연 스테이지는 유지됩니다. 재도전하면 장비·기술·경험치·코인은 모두 초기화됩니다.</p><div className="ms-result-actions"><button onClick={reset}>단계 선택으로</button><button className="ms-primary" onClick={() => beginAtStage(Math.min(9, highestUnlockedStage))}>{highestUnlockedStage > 1 ? `${highestUnlockedStage === 9 ? "끝없는 물때" : `${highestUnlockedStage}단계`} 재도전` : "처음부터 새 원정"}</button></div></section></main>;

  const hpWidth = Math.max(0, hud.hp / hud.maxHp * 100);
  const xpWidth = Math.max(0, hud.xp / hud.nextXp * 100);
  const fixedNormalSkills = GENERAL_SKILL_ORDER.map((id) => MUDFLAT_GENERAL_UPGRADES.find((skill) => skill.id === id)).filter((skill): skill is (typeof MUDFLAT_GENERAL_UPGRADES)[number] => Boolean(skill && MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(skill.id)));
  const normalSkills = GENERAL_SKILL_ORDER.map((id) => MUDFLAT_GENERAL_UPGRADES.find((skill) => skill.id === id)).filter((skill): skill is (typeof MUDFLAT_GENERAL_UPGRADES)[number] => Boolean(skill && !MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(skill.id) && (hud.levels[skill.id] ?? 0) > 0)).slice(0, 6);
  const selectedSkill = selectedSkillId ? MUDFLAT_GENERAL_UPGRADES.find((skill) => skill.id === selectedSkillId && (hud.levels[skill.id] ?? 0) > 0) : undefined;
  const selectedSkillDetail = selectedSkill ? mudflatSkillDetail(selectedSkill, hud.levels[selectedSkill.id] ?? 1) : null;
  const rerollCost = Math.ceil(hud.maxHp * .2);
  const canReroll = hud.hp > rerollCost;
  const activeStageProfile = mudflatStageProfile(hud.stage) as StageProfile;
  const activeStageObjective = activeStageProfile.objective;
  return <main className="ms-shell ms-game"><header className="ms-game-head"><button onClick={onExit} aria-label="게임 목록으로">←</button><div className="ms-hud-title"><small>STAGE {hud.stage} · {activeStageProfile.name}</small><b>{formatClock(hud.elapsed)}</b></div><div className="ms-hud-score"><small>SCORE</small><b>{hud.score.toLocaleString()}</b></div><button onClick={pause} aria-label="일시정지">Ⅱ</button></header><section className="ms-canvas-wrap"><canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} aria-label="해루질럿 게임 화면. 아무 곳이나 누르고 드래그해 이동합니다." /><div className="ms-hud-bars"><div className="hp"><span>체력</span><i><b style={{ width: `${hpWidth}%` }} /></i><em>{Math.floor(hud.hp)} / {Math.floor(hud.maxHp)}</em></div><div className="xp"><span>LV.{hud.level}</span><i><b style={{ width: `${xpWidth}%` }} /></i><em>{hud.xp} / {hud.nextXp}</em></div></div>{hud.mode === "normal" && <div className="ms-base-tools" aria-label="기본 채집 도구">{fixedNormalSkills.map((skill) => <button type="button" key={skill.id} onClick={() => setSelectedSkillId(skill.id)}><i>{skill.icon}</i><span>{GENERAL_SKILL_LABELS[skill.id] ?? skill.name} <em>Lv.{hud.levels[skill.id] ?? 0}</em></span></button>)}</div>}<div className="ms-caught"><small>한 바구니</small><b>{hud.caught}</b><span>마리</span></div>{activeStageObjective && <div className="ms-stage-objective"><small>보조 목표</small><b>{activeStageObjective.label}</b></div>}<div className="ms-touch-hint">아무 곳이나 누르고 드래그</div></section><section className="ms-tools" aria-label="선택 기술">{hud.mode === "normal" ? <>{normalSkills.map((skill) => <button type="button" key={skill.id} onClick={() => setSelectedSkillId(skill.id)} aria-label={`${skill.name} 상세 보기`}><i>{skill.icon}</i><b>{GENERAL_SKILL_LABELS[skill.id] ?? skill.name}</b><em>Lv.{hud.levels[skill.id] ?? 0}</em></button>)}{Array.from({ length: Math.max(0, 6 - normalSkills.length) }, (_, index) => <span className="ms-tool-empty" key={`empty-${index}`} aria-label="비어 있는 선택 기술 칸">+</span>)}</> : <><span><i>⌁</i><b>호미</b><em>Lv.{hud.levels.hoe ?? 0}</em></span><span><i>◇</i><b>뜰채</b><em>Lv.{hud.levels.net ?? 0}</em></span><span><i>✦</i><b>왕소금</b><em>Lv.{hud.levels.salt ?? 0}</em></span><span><i>≫</i><b>장화</b><em>Lv.{hud.levels.boots ?? 0}</em></span><span><i>◉</i><b>쓸어담기</b><em>Lv.{hud.levels.basket ?? 0}</em></span></>}</section>{selectedSkill && selectedSkillDetail && <aside className="ms-skill-detail" role="dialog" aria-label={`${selectedSkill.name} 상세`}><button type="button" aria-label="기술 상세 닫기" onClick={() => setSelectedSkillId(null)}>×</button><i>{selectedSkill.icon}</i><div><small>{MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(selectedSkill.id) ? "기본 채집 도구" : "선택 기술"} · Lv.{hud.levels[selectedSkill.id] ?? 0}</small><b>{selectedSkill.name}</b><p>{selectedSkillDetail.current}</p><strong>{selectedSkillDetail.next}</strong></div></aside>}{screen === "upgrade" && <div className="ms-layer"><section><small>LEVEL {hud.level}</small><h2>새 채집 기술을 고르세요</h2><p>선택하는 동안 갯벌의 시간은 멈춥니다.</p><div>{choices.map((item) => <button key={item.id} onClick={() => chooseUpgrade(item.id)}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.description}</small></span><em>Lv.{hud.levels[item.id] ?? 0} → Lv.{(hud.levels[item.id] ?? 0) + 1}</em></button>)}</div><button type="button" className="ms-reroll" disabled={!canReroll} onClick={rerollUpgradeChoices}>새로고침 · 최대 체력 20% ({rerollCost}) 사용</button><small className="ms-skill-slots">선택 기술 {normalSkills.length} / 6 · 집게와 호미질은 기본 기술입니다.</small></section></div>}{screen === "paused" && <div className="ms-layer pause"><section><small>PAUSED</small><h2>잠시 쉬어갈까요?</h2><p>게임 시간과 해산물 움직임이 모두 멈춰 있습니다.</p><button className="ms-primary" onClick={resume}>계속 채집하기</button><button className="ms-quit" onClick={reset}>이번 채집 끝내기</button></section></div>}</main>;
}
