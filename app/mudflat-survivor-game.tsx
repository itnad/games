"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  MUDFLAT_CREATURES,
  MUDFLAT_GENERAL_UPGRADES,
  MUDFLAT_RECOVERY_FOODS,
  MUDFLAT_RUN_SECONDS,
  MUDFLAT_SEAFOOD_MARKET,
  MUDFLAT_SHOP_EQUIPMENT,
  MUDFLAT_UPGRADES,
  mudflatEquipmentPrice,
  mudflatCreatureForTime,
  mudflatFinalScore,
  mudflatHarpoonStats,
  mudflatJoystickVector,
  mudflatRockCreatureForRoll,
  mudflatRockTurnerStats,
  mudflatSeafoodSaleValue,
  mudflatSettleCatch,
  mudflatSpawnInterval,
  mudflatStageStats,
  mudflatTongStats,
  mudflatTrainingPrice,
  mudflatUpgradeChoices,
} from "./mudflat-survivor-engine.js";

type ExitProps = { onExit: () => void };
type Screen = "setup" | "running" | "upgrade" | "paused" | "camp" | "defeat";
type GameMode = "kids" | "normal";
type Point = { x: number; y: number };
type CountMap = Record<string, number>;
type CreatureMovement = "chase" | "still" | "wander" | "flee";
type Creature = Point & { id: number; type: string; name: string; icon: string; color: string; hp: number; maxHp: number; speed: number; size: number; xp: number; score: number; boss?: boolean; saltHit: number; hitFlash: number; phase: number; movement: CreatureMovement; movementAngle: number; movementClock: number };
type Pickup = Point & { id: number; xp: number };
type Projectile = Point & { id: number; vx: number; vy: number; damage: number; life: number };
type Harpoon = Point & { id: number; vx: number; vy: number; damage: number; distance: number; maxDistance: number; angle: number; hitIds: Set<number> };
type NetSlamEffect = Point & { id: number; life: number; maxLife: number; damage: number; radius: number; targetId: number; area: boolean; hit: boolean };
type Burst = Point & { id: number; life: number; maxLife: number; color: string; size: number };
type FloatText = Point & { id: number; life: number; text: string; color: string };
type Rock = Point & { id: number; radius: number; tone: number };
type RockFlipEffect = Point & { originX: number; originY: number; life: number; maxLife: number };
type Runtime = {
  mode: GameMode;
  stage: number;
  elapsed: number; player: Point & { hp: number; maxHp: number; speed: number; damageCooldown: number; facing: number; stride: number };
  creatures: Creature[]; pickups: Pickup[]; projectiles: Projectile[]; harpoons: Harpoon[]; netSlams: NetSlamEffect[]; rocks: Rock[]; levels: CountMap; equipment: CountMap; basket: CountMap;
  bursts: Burst[]; floatTexts: FloatText[];
  level: number; xp: number; nextXp: number; caught: number; catchScore: number; bossCaught: boolean;
  bossSpawned: boolean; spawnClock: number; rockSpawnClock: number; rockTurnClock: number; harpoonClock: number; hoeClock: number; netClock: number; hoeEffect: number; rockFlipEffect: RockFlipEffect | null; paused: boolean; ended: boolean;
};
type Hud = { mode: GameMode; stage: number; elapsed: number; hp: number; maxHp: number; level: number; xp: number; nextXp: number; caught: number; score: number; levels: CountMap; basket: CountMap; bossCaught: boolean };
type Campaign = {
  version: 1; mode: GameMode; characterId: string; stage: number; coins: number; hp: number; maxHp: number;
  level: number; xp: number; nextXp: number; levels: CountMap; equipment: CountMap; inventory: CountMap; totalScore: number;
};

const BEST_KEY = "paperoid-mudflat-survivor-best-v1";
const CAMPAIGN_KEY = "paperoid-mudflat-survivor-campaign-v1";
const CHARACTERS = [
  { id: "digger", icon: "⌁", name: "호미꾼 하루", description: "넓은 호미질로 시작합니다.", levels: { hoe: 2, net: 0, salt: 0, boots: 0, basket: 0, stamina: 0 }, hp: 115 },
  { id: "netter", icon: "◇", name: "그물잡이 모아", description: "자동 뜰채를 빠르게 던집니다.", levels: { hoe: 1, net: 2, salt: 0, boots: 0, basket: 0, stamina: 0 }, hp: 100 },
  { id: "salter", icon: "✦", name: "소금장인 소금", description: "주위를 도는 왕소금을 사용합니다.", levels: { hoe: 1, net: 0, salt: 2, boots: 0, basket: 0, stamina: 0 }, hp: 105 },
];

const GENERAL_CHARACTER = { id: "beginner", name: "갯벌 초보", levels: { tongs: 1, harpoon: 0, net: 0, boots: 0, basket: 0, snack: 0, rocker: 0 }, hp: 92 };
const emptyHud: Hud = { mode: "kids", stage: 1, elapsed: 0, hp: 100, maxHp: 100, level: 1, xp: 0, nextXp: 8, caught: 0, score: 0, levels: {}, basket: {}, bossCaught: false };

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

function createCampaign(characterId: string, mode: GameMode): Campaign {
  const character = mode === "normal" ? GENERAL_CHARACTER : (CHARACTERS.find((item) => item.id === characterId) ?? CHARACTERS[0]);
  return {
    version: 1, mode, characterId, stage: 1, coins: 0, hp: character.hp, maxHp: character.hp,
    level: 1, xp: 0, nextXp: mode === "normal" ? 10 : 8, levels: { ...character.levels },
    equipment: { gloves: 0, waders: 0, cooler: 0, vest: 0 }, inventory: {}, totalScore: 0,
  };
}

function makeRuntime(campaign: Campaign): Runtime {
  return {
    mode: campaign.mode, stage: campaign.stage,
    elapsed: 0, player: { x: 0, y: 0, hp: campaign.hp, maxHp: campaign.maxHp, speed: 155, damageCooldown: 0, facing: 0, stride: 0 },
    creatures: [], pickups: [], projectiles: [], harpoons: [], netSlams: [], rocks: [], bursts: [], floatTexts: [], levels: { ...campaign.levels }, equipment: { ...campaign.equipment }, basket: {}, level: campaign.level, xp: campaign.xp, nextXp: campaign.nextXp,
    caught: 0, catchScore: 0, bossCaught: false, bossSpawned: false, spawnClock: 0, rockSpawnClock: 0, rockTurnClock: 0, harpoonClock: 0, hoeClock: 0, netClock: 0,
    hoeEffect: 0, rockFlipEffect: null, paused: false, ended: false,
  };
}

function readSavedCampaign(): Campaign | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(CAMPAIGN_KEY) ?? "null") as Partial<Campaign> | null;
    if (!value || value.version !== 1 || (value.mode !== "kids" && value.mode !== "normal") || !Number.isFinite(value.stage) || !value.levels || !value.equipment || !value.inventory) return null;
    return {
      version: 1, mode: value.mode, characterId: String(value.characterId ?? "digger"), stage: Math.max(1, Math.floor(value.stage ?? 1)),
      coins: Math.max(0, Math.floor(value.coins ?? 0)), hp: Math.max(1, Number(value.hp ?? 1)), maxHp: Math.max(1, Number(value.maxHp ?? 1)),
      level: Math.max(1, Math.floor(value.level ?? 1)), xp: Math.max(0, Math.floor(value.xp ?? 0)), nextXp: Math.max(1, Math.floor(value.nextXp ?? 8)),
      levels: { ...value.levels }, equipment: { ...value.equipment }, inventory: { ...value.inventory }, totalScore: Math.max(0, Math.floor(value.totalScore ?? 0)),
    };
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

function drawMudflat(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: Point,
  tide: number,
  elapsed: number,
) {
  const base = context.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, `rgb(${122 - tide * 16},${107 + tide * 5},${77 + tide * 14})`);
  base.addColorStop(.55, `rgb(${101 - tide * 10},${91 + tide * 7},${67 + tide * 15})`);
  base.addColorStop(1, `rgb(${82 - tide * 7},${78 + tide * 12},${63 + tide * 21})`);
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);

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

  context.strokeStyle = "rgba(232,207,153,.1)";
  context.lineWidth = 2;
  for (let row = 0; row < 5; row += 1) {
    const y = ((row * 167 - player.y * .35) % (height + 80) + height + 80) % (height + 80) - 40;
    context.beginPath();
    for (let x = -20; x <= width + 20; x += 24) {
      const waveY = y + Math.sin((x + player.x * .2) * .028 + row) * 5;
      if (x === -20) context.moveTo(x, waveY); else context.lineTo(x, waveY);
    }
    context.stroke();
  }

  if (tide > .7) {
    const waterTop = height - ((tide - .7) / .3) * height * .35;
    const water = context.createLinearGradient(0, waterTop, 0, height);
    water.addColorStop(0, "rgba(92,181,185,.08)");
    water.addColorStop(1, "rgba(53,142,164,.35)");
    context.fillStyle = water;
    context.beginPath();
    context.moveTo(0, height);
    for (let x = 0; x <= width + 20; x += 20) {
      context.lineTo(x, waterTop + Math.sin(x * .025 + elapsed * 1.6) * 7);
    }
    context.lineTo(width, height);
    context.closePath();
    context.fill();
  }
}

function drawCreatureSprite(context: CanvasRenderingContext2D, creature: Creature, elapsed: number) {
  const size = creature.size;
  const wobble = Math.sin(elapsed * 5 + creature.phase) * .08;
  context.save();
  context.rotate(wobble);
  context.fillStyle = "rgba(28,22,19,.28)";
  context.beginPath();
  context.ellipse(0, size * .72, size * 1.05, size * .38, 0, 0, Math.PI * 2);
  context.fill();

  if (creature.type === "crab" || creature.type === "king-crab") {
    context.strokeStyle = creature.boss ? "#9f481d" : "#a94331";
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
      context.fillStyle = creature.color;
      context.beginPath();
      context.arc(side * size * 1.2, -size * .74, size * .34, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = creature.boss ? "#ffe08a" : "#f7b2a4";
      context.lineWidth = 2;
      context.stroke();
    }
    context.fillStyle = creature.hitFlash > 0 ? "#fff8e6" : creature.color;
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
  } else if (creature.type === "mudfish") {
    context.fillStyle = creature.hitFlash > 0 ? "#effff7" : creature.color;
    context.beginPath(); context.ellipse(0, 0, size * 1.32, size * .58, 0, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.moveTo(-size * 1.15, 0); context.lineTo(-size * 1.65, -size * .62); context.lineTo(-size * 1.55, size * .62); context.closePath(); context.fill();
    context.fillStyle = "rgba(36,92,78,.45)";
    context.beginPath(); context.moveTo(-size * .2, 0); context.lineTo(size * .28, -size * .72); context.lineTo(size * .6, 0); context.fill();
    context.fillStyle = "#fff"; context.beginPath(); context.arc(size * .72, -size * .15, size * .16, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#23342e"; context.beginPath(); context.arc(size * .76, -size * .15, size * .08, 0, Math.PI * 2); context.fill();
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

function drawGatherer(context: CanvasRenderingContext2D, x: number, y: number, player: Runtime["player"], characterId: string) {
  const direction = Math.cos(player.facing) < 0 ? -1 : 1;
  const bob = Math.sin(player.stride * 9) * 1.8;
  context.save();
  context.translate(x, y + bob);
  context.scale(direction, 1);
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
  context.fillStyle = "#c58b49"; roundedRect(context, 13, -1, 15, 20, 5); context.fill();
  context.strokeStyle = "#eed7a4"; context.lineWidth = 2; context.beginPath(); context.arc(20, 0, 9, Math.PI, Math.PI * 2); context.stroke();
  context.restore();
}

function drawRock(context: CanvasRenderingContext2D, rock: Rock) {
  const radius = rock.radius;
  context.save();
  context.rotate((rock.tone - .5) * .35);
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
  context.strokeStyle = "#476f69";
  context.lineWidth = 6;
  context.beginPath(); context.moveTo(origin.x - ux * 20, origin.y - uy * 20); context.lineTo(drawX, drawY); context.stroke();
  context.strokeStyle = "#a8d1c5";
  context.lineWidth = 1.5;
  context.beginPath(); context.moveTo(origin.x - ux * 16, origin.y - uy * 16 - 2); context.lineTo(drawX, drawY - 2); context.stroke();
  context.fillStyle = "#8c5737";
  context.save(); context.translate(origin.x - ux * 18, origin.y - uy * 18); context.rotate(handleAngle); roundedRect(context, -8, -7, 24, 14, 5); context.fill(); context.restore();

  const hoopRadius = Math.min(36, Math.max(25, effect.radius * .58));
  context.translate(drawX, drawY);
  context.rotate(handleAngle + Math.PI / 2);
  context.fillStyle = impact ? "rgba(157,225,206,.22)" : "rgba(157,225,206,.12)";
  context.strokeStyle = impact ? "#e7fff4" : "#b7e4d6";
  context.lineWidth = impact ? 5 : 4;
  context.beginPath(); context.ellipse(0, 0, hoopRadius, hoopRadius * (impact ? .72 : .42), 0, 0, Math.PI * 2); context.fill(); context.stroke();
  context.strokeStyle = "rgba(225,255,246,.55)";
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
    context.fillStyle = "rgba(102,194,169,.13)";
    context.strokeStyle = "#a9ead5";
    context.lineWidth = 3;
    context.beginPath(); context.arc(target.x, target.y, effect.radius * (.74 + impactProgress * .26), 0, Math.PI * 2); context.fill(); context.stroke();
    for (let chip = 0; chip < 7; chip += 1) {
      const angle = chip / 7 * Math.PI * 2 + effect.id;
      const spread = effect.radius * (.5 + impactProgress * .46);
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
  const joystickRef = useRef({ pointerId: -1, originX: 0, originY: 0, x: 0, y: 0 });
  const keysRef = useRef(new Set<string>());
  const sequenceRef = useRef(1);
  const [screen, setScreen] = useState<Screen>("setup");
  const [mode, setMode] = useState<GameMode>("kids");
  const [characterId, setCharacterId] = useState("digger");
  const [hud, setHud] = useState<Hud>(emptyHud);
  const [choices, setChoices] = useState<Array<{ id: string; icon: string; name: string; description: string; max: number }>>([]);
  const [runId, setRunId] = useState(0);
  const [best, setBest] = useState(0);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [savedCampaign, setSavedCampaign] = useState<Campaign | null>(null);
  const [campNotice, setCampNotice] = useState("잡아온 해산물을 판매하고 다음 출정을 준비하세요.");

  useEffect(() => { setBest(Number(window.localStorage.getItem(BEST_KEY) ?? 0)); setSavedCampaign(readSavedCampaign()); }, []);

  const storeCampaign = useCallback((next: Campaign) => {
    campaignRef.current = next; setCampaign(next); setSavedCampaign(next); window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(next));
  }, []);

  const snapshot = useCallback((runtime: Runtime) => {
    setHud({
      mode: runtime.mode,
      stage: runtime.stage, elapsed: runtime.elapsed, hp: runtime.player.hp, maxHp: runtime.player.maxHp, level: runtime.level,
      xp: runtime.xp, nextXp: runtime.nextXp, caught: runtime.caught,
      score: mudflatFinalScore({ catchScore: runtime.catchScore, caught: runtime.caught, elapsed: runtime.elapsed, bossCaught: runtime.bossCaught }),
      levels: { ...runtime.levels }, basket: { ...runtime.basket }, bossCaught: runtime.bossCaught,
    });
  }, []);

  const begin = () => {
    const nextCampaign = createCampaign(characterId, mode);
    storeCampaign(nextCampaign);
    const runtime = makeRuntime(nextCampaign);
    runtimeRef.current = runtime; snapshot(runtime); setChoices([]); setScreen("running"); setRunId((value) => value + 1);
  };

  const continueCampaign = () => {
    if (!savedCampaign) return;
    setMode(savedCampaign.mode); setCharacterId(savedCampaign.characterId); storeCampaign(savedCampaign);
    setCampNotice(`${savedCampaign.stage}단계 출정을 준비하세요.`); setScreen("camp");
  };

  const endRun = useCallback((runtime: Runtime) => {
    if (runtime.ended) return;
    runtime.ended = true; runtime.paused = true; snapshot(runtime);
    const score = mudflatFinalScore({ catchScore: runtime.catchScore, caught: runtime.caught, elapsed: runtime.elapsed, bossCaught: runtime.bossCaught });
    if (score > best) { setBest(score); window.localStorage.setItem(BEST_KEY, String(score)); }
    setScreen("defeat");
  }, [best, snapshot]);

  const completeStage = useCallback((runtime: Runtime) => {
    if (runtime.ended) return;
    runtime.ended = true; runtime.paused = true; snapshot(runtime);
    const score = mudflatFinalScore({ catchScore: runtime.catchScore, caught: runtime.caught, elapsed: runtime.elapsed, bossCaught: runtime.bossCaught });
    if (score > best) { setBest(score); window.localStorage.setItem(BEST_KEY, String(score)); }
    const current = campaignRef.current ?? createCampaign(characterId, runtime.mode);
    const settlement = mudflatSettleCatch(current.inventory, runtime.basket, runtime.caught, current.equipment.cooler ?? 0);
    const next: Campaign = {
      ...current, stage: runtime.stage + 1, hp: Math.max(1, runtime.player.hp), maxHp: runtime.player.maxHp,
      level: runtime.level, xp: runtime.xp, nextXp: runtime.nextXp, levels: { ...runtime.levels }, inventory: settlement.inventory,
      totalScore: current.totalScore + score,
    };
    const recoveryNotice = settlement.recoveredCount > 0 ? ` · 누락된 ${settlement.recoveredCount}마리 정산 복구` : "";
    storeCampaign(next); setCampNotice(`${runtime.stage}단계에서 ${settlement.catchCount}마리를 잡았습니다. 예상 판매액 ${settlement.value}코인${recoveryNotice}`); setScreen("camp");
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
      const template = forcedBoss ? MUDFLAT_CREATURES.find((item) => item.boss)! : mudflatCreatureForTime(runtime.elapsed, Math.random());
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.hypot(width, height) * .58 + 70 + Math.random() * 80;
      const difficulty = runtime.mode === "normal" ? 1.15 : 1;
      const scale = (forcedBoss ? 1 : 1 + runtime.elapsed / 420) * difficulty * stageStats.creatureHpMultiplier;
      runtime.creatures.push({
        ...template, id: sequenceRef.current++, x: runtime.player.x + Math.cos(angle) * distance,
        y: runtime.player.y + Math.sin(angle) * distance, hp: template.hp * scale, maxHp: template.hp * scale,
        speed: template.speed * (1 + runtime.elapsed / 750) * (runtime.mode === "normal" ? 1.12 : 1) * stageStats.creatureSpeedMultiplier, saltHit: 0, hitFlash: 0, phase: Math.random() * Math.PI * 2,
        movement: "chase", movementAngle: angle + Math.PI, movementClock: 1,
      });
    };

    const revealRockCreature = (rock: Rock) => {
      const finding = mudflatRockCreatureForRoll(Math.random());
      const template = MUDFLAT_CREATURES.find((item) => item.id === finding.type);
      if (!template) return;
      const crabSpeed = MUDFLAT_CREATURES.find((item) => item.id === "crab")?.speed ?? 34;
      const revealAngle = Math.random() * Math.PI * 2;
      const offset = Math.max(8, rock.radius * .38);
      runtime.creatures.push({
        ...template,
        id: sequenceRef.current++,
        name: finding.name,
        x: rock.x + Math.cos(revealAngle) * offset,
        y: rock.y + Math.sin(revealAngle) * offset,
        hp: template.hp,
        maxHp: template.hp,
        speed: (finding.type === "shrimp" ? crabSpeed * (1 + runtime.elapsed / 750) * 1.12 : template.speed) * stageStats.creatureSpeedMultiplier,
        saltHit: 0,
        hitFlash: .18,
        phase: Math.random() * Math.PI * 2,
        movement: finding.movement as CreatureMovement,
        movementAngle: revealAngle,
        movementClock: 1,
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

    const damageCreature = (creature: Creature, damage: number, color = "#ffd29a", hitFlash = .12) => {
      const safeDamage = Math.max(0, Number(damage) || 0);
      if (safeDamage <= 0 || creature.hp <= 0) return;
      creature.hp -= safeDamage;
      creature.hitFlash = Math.max(creature.hitFlash, hitFlash);
      const roundedDamage = Math.round(safeDamage * 10) / 10;
      const damageText = Number.isInteger(roundedDamage) ? `-${roundedDamage}` : `-${roundedDamage.toFixed(1)}`;
      const horizontalJitter = (sequenceRef.current % 3 - 1) * 9;
      runtime.floatTexts.push({
        id: sequenceRef.current++, x: creature.x + horizontalJitter, y: creature.y - creature.size - 4,
        life: .62, text: damageText, color,
      });
    };

    const damageAndCollect = () => {
      const defeated = runtime.creatures.filter((item) => item.hp <= 0);
      if (defeated.length) {
        for (const item of defeated) {
          runtime.caught += 1; runtime.catchScore += item.score;
          runtime.basket[item.type] = (runtime.basket[item.type] ?? 0) + 1;
          runtime.pickups.push({ id: sequenceRef.current++, x: item.x, y: item.y, xp: item.xp });
          runtime.bursts.push({ id: sequenceRef.current++, x: item.x, y: item.y, life: .5, maxLife: .5, color: item.color, size: item.size });
          if (item.boss) runtime.bossCaught = true;
        }
        runtime.creatures = runtime.creatures.filter((item) => item.hp > 0);
      }
    };

    const update = (dt: number, width: number, height: number) => {
      if (runtime.paused || runtime.ended) return;
      runtime.elapsed += dt;
      runtime.player.damageCooldown = Math.max(0, runtime.player.damageCooldown - dt);
      runtime.hoeClock -= dt; runtime.netClock -= dt; runtime.rockTurnClock -= dt; runtime.harpoonClock -= dt; runtime.hoeEffect = Math.max(0, runtime.hoeEffect - dt);
      if (runtime.rockFlipEffect) {
        runtime.rockFlipEffect.life -= dt;
        if (runtime.rockFlipEffect.life <= 0) runtime.rockFlipEffect = null;
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
      const speed = runtime.player.speed * (1 + (runtime.levels.boots ?? 0) * .09) * (1 + (runtime.equipment.waders ?? 0) * .05);
      runtime.player.x += inputX * speed * dt; runtime.player.y += inputY * speed * dt;
      if (Math.hypot(inputX, inputY) > .05) {
        runtime.player.facing = Math.atan2(inputY, inputX);
        runtime.player.stride += dt * Math.max(.35, Math.hypot(inputX, inputY));
      }

      runtime.spawnClock -= dt;
      if (runtime.spawnClock <= 0 && runtime.creatures.length < 180) {
        spawnCreature(width, height); runtime.spawnClock = mudflatSpawnInterval(runtime.elapsed, runtime.mode) * stageStats.spawnIntervalMultiplier;
      }
      if (!runtime.bossSpawned && runtime.elapsed >= 200) { runtime.bossSpawned = true; spawnCreature(width, height, true); }
      if (runtime.mode === "normal") {
        if (runtime.elapsed < .08 && runtime.rocks.length === 0) for (let index = 0; index < 12; index += 1) spawnRock(width, height);
        runtime.rockSpawnClock -= dt;
        if (runtime.rockSpawnClock <= 0 && runtime.rocks.length < stageStats.rockLimit) { spawnRock(width, height); runtime.rockSpawnClock = Math.max(2.4, 4.2 * stageStats.spawnIntervalMultiplier); }
      }

      let touching = false;
      for (const creature of runtime.creatures) {
        const dx = runtime.player.x - creature.x; const dy = runtime.player.y - creature.y; const distance = Math.hypot(dx, dy) || 1;
        if (creature.movement === "chase") {
          creature.x += dx / distance * creature.speed * dt; creature.y += dy / distance * creature.speed * dt;
        } else if (creature.movement === "wander") {
          creature.movementClock -= dt;
          if (creature.movementClock <= 0) { creature.movementAngle = Math.random() * Math.PI * 2; creature.movementClock += 1; }
          creature.x += Math.cos(creature.movementAngle) * creature.speed * dt;
          creature.y += Math.sin(creature.movementAngle) * creature.speed * dt;
        } else if (creature.movement === "flee") {
          creature.x -= dx / distance * creature.speed * dt; creature.y -= dy / distance * creature.speed * dt;
        }
        creature.saltHit = Math.max(0, creature.saltHit - dt); creature.hitFlash = Math.max(0, creature.hitFlash - dt);
        if (distance < creature.size + 17) touching = true;
      }
      const touchingRock = runtime.mode === "normal" && runtime.rocks.some((rock) => Math.hypot(rock.x - runtime.player.x, rock.y - runtime.player.y) < rock.radius + 16);
      if ((touching || touchingRock) && runtime.player.damageCooldown <= 0) {
        const baseDamage = runtime.mode === "normal" ? (touchingRock ? 10 : 9) : 7;
        runtime.player.hp = Math.max(0, runtime.player.hp - (baseDamage + stageStats.contactDamageBonus + Math.floor(runtime.elapsed / 70)));
        runtime.player.damageCooldown = .52;
        runtime.bursts.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y, life: .35, maxLife: .35, color: "#ff7868", size: 24 });
        if ("vibrate" in navigator) navigator.vibrate(22);
      }

      const hoeLevel = runtime.levels.hoe ?? 0;
      const toolPower = 1 + (runtime.equipment.gloves ?? 0) * .12;
      if (hoeLevel > 0 && runtime.hoeClock <= 0) {
        const radius = 78 + hoeLevel * 12;
        for (const creature of runtime.creatures) if (Math.hypot(creature.x - runtime.player.x, creature.y - runtime.player.y) <= radius + creature.size) damageCreature(creature, (3 + hoeLevel * 2.3) * toolPower, "#ffe0a6", .1);
        runtime.hoeClock = Math.max(.42, 1.02 - hoeLevel * .09); runtime.hoeEffect = .2;
      }

      const netLevel = runtime.levels.net ?? 0;
      if (netLevel > 0 && runtime.netClock <= 0 && runtime.creatures.length) {
        const target = runtime.creatures.reduce((nearest, item) => Math.hypot(item.x - runtime.player.x, item.y - runtime.player.y) < Math.hypot(nearest.x - runtime.player.x, nearest.y - runtime.player.y) ? item : nearest);
        runtime.netSlams.push({
          id: sequenceRef.current++, x: target.x, y: target.y, targetId: target.id,
          damage: (6 + netLevel * 4) * toolPower,
          radius: runtime.mode === "normal" ? 42 + netLevel * 8 : 30,
          area: runtime.mode === "normal", hit: false, life: .62, maxLife: .62,
        });
        runtime.netClock = Math.max(.48, 1.5 - netLevel * .14);
      }
      for (const netSlam of runtime.netSlams) {
        const trackedTarget = runtime.creatures.find((item) => item.id === netSlam.targetId);
        const progressBefore = 1 - netSlam.life / netSlam.maxLife;
        if (trackedTarget && !netSlam.hit && progressBefore < .54) { netSlam.x = trackedTarget.x; netSlam.y = trackedTarget.y; }
        netSlam.life -= dt;
        const progress = 1 - netSlam.life / netSlam.maxLife;
        if (!netSlam.hit && progress >= .54) {
          if (netSlam.area) {
            for (const creature of runtime.creatures) {
              if (Math.hypot(creature.x - netSlam.x, creature.y - netSlam.y) <= netSlam.radius + creature.size) {
                damageCreature(creature, netSlam.damage, "#a9ead5", .16);
              }
            }
          } else if (trackedTarget) {
            damageCreature(trackedTarget, netSlam.damage, "#a9ead5", .16);
          }
          netSlam.hit = true;
          runtime.bursts.push({ id: sequenceRef.current++, x: netSlam.x, y: netSlam.y, life: .34, maxLife: .34, color: "#8fdac5", size: netSlam.radius });
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
          const stats = mudflatHarpoonStats(harpoonLevel, width);
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
            damageCreature(creature, harpoon.damage, "#ffc49b", .16);
            harpoon.hitIds.add(creature.id);
          }
        }
      }
      runtime.harpoons = runtime.harpoons.filter((item) => item.distance < item.maxDistance);

      const saltLevel = runtime.levels.salt ?? 0;
      if (saltLevel > 0) {
        const count = 1 + Math.floor(saltLevel / 2);
        for (let index = 0; index < count; index += 1) {
          const angle = runtime.elapsed * (1.8 + saltLevel * .08) + index / count * Math.PI * 2;
          const saltX = runtime.player.x + Math.cos(angle) * (66 + saltLevel * 3);
          const saltY = runtime.player.y + Math.sin(angle) * (66 + saltLevel * 3);
          for (const creature of runtime.creatures) if (creature.saltHit <= 0 && Math.hypot(creature.x - saltX, creature.y - saltY) < creature.size + 10) { damageCreature(creature, (3 + saltLevel * 2) * toolPower, "#fff1af", .1); creature.saltHit = .22; }
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
            damageCreature(creature, tong.power * toolPower, "#ffd29a", .1); creature.saltHit = .22;
          }
        }

        const rockerLevel = runtime.levels.rocker ?? 0;
        if (rockerLevel > 0 && runtime.rockTurnClock <= 0) {
          const target = runtime.rocks
            .filter((rock) => Math.hypot(rock.x - runtime.player.x, rock.y - runtime.player.y) <= tong.reach + rock.radius)
            .sort((left, right) => Math.hypot(left.x - runtime.player.x, left.y - runtime.player.y) - Math.hypot(right.x - runtime.player.x, right.y - runtime.player.y))[0];
          if (target) {
            const stats = mudflatRockTurnerStats(rockerLevel);
            runtime.rocks = runtime.rocks.filter((rock) => rock.id !== target.id);
            runtime.rockFlipEffect = { x: target.x, y: target.y, originX: runtime.player.x, originY: runtime.player.y, life: .58, maxLife: .58 };
            runtime.rockTurnClock = stats.interval;
            runtime.bursts.push({ id: sequenceRef.current++, x: target.x, y: target.y, life: .5, maxLife: .5, color: "#b89569", size: target.radius });
            if (Math.random() < stats.creatureChance) revealRockCreature(target);
            else runtime.floatTexts.push({ id: sequenceRef.current++, x: target.x, y: target.y - 16, life: .75, text: "빈 돌", color: "#d8c6a8" });
          } else runtime.rockTurnClock = .12;
        }
      }
      damageAndCollect();

      const pickupRadius = 50 + (runtime.levels.basket ?? 0) * 24 + (runtime.equipment.cooler ?? 0) * 12;
      for (const pickup of runtime.pickups) {
        const dx = runtime.player.x - pickup.x; const dy = runtime.player.y - pickup.y; const distance = Math.hypot(dx, dy) || 1;
        if (distance < pickupRadius) { const pull = Math.min(430, 120 + (pickupRadius - distance) * 7); pickup.x += dx / distance * pull * dt; pickup.y += dy / distance * pull * dt; }
        if (distance < 22) { runtime.xp += pickup.xp; pickup.xp = 0; }
      }
      runtime.pickups = runtime.pickups.filter((item) => item.xp > 0);
      for (const burst of runtime.bursts) burst.life -= dt;
      runtime.bursts = runtime.bursts.filter((item) => item.life > 0);
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
      drawMudflat(context, width, height, runtime.player, tide, runtime.elapsed);
      const screenPoint = (point: Point) => ({ x: width / 2 + point.x - runtime.player.x, y: height / 2 + point.y - runtime.player.y });

      for (const rock of runtime.rocks) {
        const point = screenPoint(rock); if (point.x < -45 || point.y < -45 || point.x > width + 45 || point.y > height + 45) continue;
        context.save(); context.translate(point.x, point.y); drawRock(context, rock); context.restore();
      }

      for (const pickup of runtime.pickups) {
        const point = screenPoint(pickup);
        const pulse = 1 + Math.sin(runtime.elapsed * 7 + pickup.id) * .12;
        context.save(); context.translate(point.x, point.y); context.scale(pulse, pulse);
        context.fillStyle = "rgba(94,255,210,.16)"; context.beginPath(); context.arc(0, 0, 16, 0, Math.PI * 2); context.fill();
        context.fillStyle = "#74e2bd"; context.beginPath(); context.moveTo(0, -8); context.lineTo(7, 0); context.lineTo(0, 9); context.lineTo(-7, 0); context.closePath(); context.fill();
        context.strokeStyle = "#e7fff4"; context.lineWidth = 1.5; context.stroke(); context.restore();
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
        context.save(); context.translate(point.x, point.y); drawCreatureSprite(context, creature, runtime.elapsed); context.restore();
        if (creature.boss || creature.hp < creature.maxHp) {
          const barWidth = creature.boss ? 104 : Math.max(28, creature.size * 2);
          const barY = point.y - creature.size - (creature.boss ? 29 : 13);
          context.fillStyle = "rgba(28,22,21,.64)"; roundedRect(context, point.x - barWidth / 2, barY, barWidth, creature.boss ? 9 : 5, 4); context.fill();
          context.fillStyle = creature.boss ? "#ffd55f" : "#ff8a6f"; roundedRect(context, point.x - barWidth / 2 + 2, barY + 2, Math.max(0, (barWidth - 4) * creature.hp / creature.maxHp), creature.boss ? 5 : 1.5, 3); context.fill();
          if (creature.boss) { context.fillStyle = "#fff4cf"; context.font = "800 12px system-ui"; context.textAlign = "center"; context.fillText("대왕 꽃게", point.x, barY - 6); }
        }
      }
      for (const netSlam of runtime.netSlams) {
        const point = screenPoint(netSlam);
        drawDipNetSlam(context, { x: width / 2, y: height / 2 }, point, netSlam);
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
        const origin = screenPoint({ x: runtime.rockFlipEffect.originX, y: runtime.rockFlipEffect.originY });
        drawRockHookBar(context, origin, point, runtime.rockFlipEffect);
      }
      if (runtime.hoeEffect > 0) {
        const alpha = runtime.hoeEffect / .2;
        const radius = 78 + (runtime.levels.hoe ?? 0) * 12;
        context.strokeStyle = `rgba(255,221,132,${alpha * .8})`; context.lineWidth = 6 + alpha * 4;
        context.beginPath(); context.arc(width / 2, height / 2, radius, -.18, Math.PI * 1.55); context.stroke();
        context.strokeStyle = `rgba(255,251,224,${alpha * .6})`; context.lineWidth = 2; context.beginPath(); context.arc(width / 2, height / 2, radius + 7, 0, Math.PI * 1.35); context.stroke();
      }
      drawGatherer(context, width / 2, height / 2, runtime.player, runtime.mode === "normal" ? "beginner" : characterId);
      for (const label of runtime.floatTexts) {
        const point = screenPoint(label); context.save(); context.globalAlpha = Math.min(1, label.life * 2.5);
        context.font = "900 14px system-ui"; context.textAlign = "center"; context.lineWidth = 4; context.strokeStyle = "rgba(38,29,27,.72)"; context.strokeText(label.text, point.x, point.y); context.fillStyle = label.color; context.fillText(label.text, point.x, point.y); context.restore();
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
    const visibility = () => { const runtime = runtimeRef.current; if (document.hidden && runtime && !runtime.ended && !runtime.paused) { runtime.paused = true; joystickRef.current.x = 0; joystickRef.current.y = 0; setScreen("paused"); } };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); document.removeEventListener("visibilitychange", visibility); };
  }, []);

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
  const pause = () => { const runtime = runtimeRef.current; if (!runtime || runtime.ended || runtime.paused) return; runtime.paused = true; joystickRef.current.x = 0; joystickRef.current.y = 0; setScreen("paused"); };
  const resume = () => { const runtime = runtimeRef.current; if (!runtime) return; runtime.paused = false; setScreen("running"); };
  const chooseUpgrade = (id: string) => {
    const runtime = runtimeRef.current; if (!runtime) return;
    runtime.levels[id] = (runtime.levels[id] ?? 0) + 1;
    if (id === "stamina") { runtime.player.maxHp += 18; runtime.player.hp = Math.min(runtime.player.maxHp, runtime.player.hp + 35); }
    if (id === "snack") { runtime.player.maxHp += 20; runtime.player.hp = Math.min(runtime.player.maxHp, runtime.player.hp + 42); }
    if (id === "boots" && runtime.mode === "normal") { runtime.player.maxHp += 10; runtime.player.hp = Math.min(runtime.player.maxHp, runtime.player.hp + 10); }
    setChoices([]); runtime.paused = false; snapshot(runtime); setScreen("running");
  };
  const sellSeafood = (type: string, sellAllOfType = false) => {
    const current = campaignRef.current; if (!current) return;
    const held = current.inventory[type] ?? 0; const quantity = sellAllOfType ? held : Math.min(1, held);
    if (quantity <= 0) return;
    const market = MUDFLAT_SEAFOOD_MARKET.find((item) => item.type === type);
    const earned = mudflatSeafoodSaleValue(type, quantity, current.equipment.cooler ?? 0);
    const inventory = { ...current.inventory, [type]: held - quantity };
    const next = { ...current, coins: current.coins + earned, inventory };
    storeCampaign(next); setCampNotice(`${market?.name ?? "해산물"} ${quantity}개 판매 · ${earned}코인 획득`);
  };
  const sellAllSeafood = () => {
    const current = campaignRef.current; if (!current) return;
    let earned = 0; let sold = 0;
    for (const [type, count] of Object.entries(current.inventory)) { earned += mudflatSeafoodSaleValue(type, count, current.equipment.cooler ?? 0); sold += count; }
    if (sold === 0) { setCampNotice("판매할 해산물이 없습니다."); return; }
    const next = { ...current, coins: current.coins + earned, inventory: {} };
    storeCampaign(next); setCampNotice(`해산물 ${sold}마리 일괄 판매 · ${earned}코인 획득`);
  };
  const buyEquipment = (id: string) => {
    const current = campaignRef.current; if (!current) return;
    const item = MUDFLAT_SHOP_EQUIPMENT.find((entry) => entry.id === id); if (!item) return;
    const level = current.equipment[id] ?? 0; const price = mudflatEquipmentPrice(id, level);
    if (level >= item.max) { setCampNotice("이미 최고 단계까지 정비했습니다."); return; }
    if (current.coins < price) { setCampNotice("코인이 부족합니다. 해산물을 먼저 판매해 보세요."); return; }
    const equipment = { ...current.equipment, [id]: level + 1 };
    const hpBonus = id === "waders" ? 8 : id === "vest" ? 15 : 0;
    const next = { ...current, coins: current.coins - price, equipment, maxHp: current.maxHp + hpBonus, hp: current.hp + hpBonus };
    storeCampaign(next); setCampNotice(`${item.name} Lv.${level + 1} 정비 완료`);
  };
  const buyFood = (id: string) => {
    const current = campaignRef.current; if (!current) return;
    const food = MUDFLAT_RECOVERY_FOODS.find((entry) => entry.id === id); if (!food) return;
    if (current.hp >= current.maxHp) { setCampNotice("현재 체력이 가득 찼습니다."); return; }
    if (current.coins < food.price) { setCampNotice("회복 음식을 구매할 코인이 부족합니다."); return; }
    const healedHp = food.heal === Infinity ? current.maxHp : Math.min(current.maxHp, current.hp + food.heal);
    const next = { ...current, coins: current.coins - food.price, hp: healedHp };
    storeCampaign(next); setCampNotice(`${food.name} 구매 · 체력 ${Math.ceil(healedHp)} / ${current.maxHp}`);
  };
  const trainSkill = (id: string) => {
    const current = campaignRef.current; if (!current) return;
    const upgrades = current.mode === "normal" ? MUDFLAT_GENERAL_UPGRADES : MUDFLAT_UPGRADES;
    const skill = upgrades.find((entry) => entry.id === id); if (!skill) return;
    const level = current.levels[id] ?? 0; const price = mudflatTrainingPrice(level);
    if (level >= skill.max) { setCampNotice("이미 최고 레벨에 도달한 기술입니다."); return; }
    if (current.coins < price) { setCampNotice("기술 훈련에 필요한 코인이 부족합니다."); return; }
    const levels = { ...current.levels, [id]: level + 1 };
    let maxHp = current.maxHp; let hp = current.hp;
    if (id === "stamina") { maxHp += 18; hp = Math.min(maxHp, hp + 35); }
    if (id === "snack") { maxHp += 20; hp = Math.min(maxHp, hp + 42); }
    if (id === "boots" && current.mode === "normal") { maxHp += 10; hp = Math.min(maxHp, hp + 10); }
    const next = { ...current, coins: current.coins - price, levels, maxHp, hp };
    storeCampaign(next); setCampNotice(`${skill.name} Lv.${level + 1} 훈련 완료`);
  };
  const startNextStage = () => {
    const current = campaignRef.current; if (!current) return;
    const runtime = makeRuntime(current);
    runtimeRef.current = runtime; snapshot(runtime); setChoices([]); setScreen("running"); setRunId((value) => value + 1);
  };
  const reset = () => { runtimeRef.current = null; campaignRef.current = null; joystickRef.current.x = 0; joystickRef.current.y = 0; setCampaign(null); setHud({ ...emptyHud, mode }); setChoices([]); setScreen("setup"); };
  const clearCampaign = () => { window.localStorage.removeItem(CAMPAIGN_KEY); setSavedCampaign(null); reset(); };

  if (screen === "setup") return <main className="ms-shell ms-setup"><MudflatTopbar onExit={onExit} /><section className="ms-setup-hero"><div className="ms-sun">☀</div><small>THE TIDE IS COMING</small><h1>밀물 전에<br /><em>한 바구니!</em></h1><p>화면 아무 곳이나 누른 뒤 가고 싶은 방향으로 드래그하세요.<br />도구는 자동으로 움직이고, 손을 떼면 바로 멈춥니다.</p><div className="ms-control-demo" aria-hidden="true"><span>TOUCH</span><i>●</i><b>→</b><em>상대 거리만큼 이동</em></div></section><section className="ms-character-select"><header><span>01</span><div><b>난이도와 채집꾼 선택</b><small>4분 출정 후 정비소에서 다음 갯벌을 준비합니다</small></div></header>{savedCampaign && <button type="button" className="ms-continue" onClick={continueCampaign}><span><small>SAVED EXPEDITION</small><b>{savedCampaign.stage}단계 정비소에서 이어하기</b><em>{savedCampaign.coins.toLocaleString()}코인 · LV.{savedCampaign.level}</em></span><strong>→</strong></button>}<div className="ms-mode-picker"><button type="button" className={mode === "kids" ? "selected" : ""} onClick={() => setMode("kids")}><i>☀</i><span><b>어린이 모드</b><small>기존 난이도와 세 명의 채집꾼</small></span></button><button type="button" className={mode === "normal" ? "selected" : ""} onClick={() => setMode("normal")}><i>◆</i><span><b>일반 모드</b><small>강한 해산물·돌 장애물·전용 기술</small></span></button></div>{mode === "kids" ? <><h2 className="ms-selection-title">채집꾼을 선택하세요</h2><div className="ms-character-grid">{CHARACTERS.map((item) => <button type="button" key={item.id} className={characterId === item.id ? "selected" : ""} onClick={() => setCharacterId(item.id)}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.description}</small></span><em>{item.id === "digger" ? "호미 Lv.2" : item.id === "netter" ? "뜰채 Lv.2" : "왕소금 Lv.2"}</em></button>)}</div></> : <div className="ms-general-profile"><i>⌁</i><span><small>STARTING GATHERER</small><b>갯벌 초보</b><em>집게 숙련도 Lv.1 · 체력 92 · 돌 장애물 등장</em></span></div>}<button className="ms-primary" type="button" onClick={begin}>{mode === "normal" ? "새 일반 원정 시작" : "새 어린이 원정 시작"} <span>→</span></button><p>스테이지마다 4분 동안 진행됩니다. 귀환 후 해산물을 팔아 장비와 회복 음식을 마련할 수 있습니다.</p></section></main>;

  if (screen === "camp" && campaign) {
    const coolerLevel = campaign.equipment.cooler ?? 0;
    const inventoryCount = Object.values(campaign.inventory).reduce((sum, count) => sum + count, 0);
    const inventoryValue = Object.entries(campaign.inventory).reduce((sum, [type, count]) => sum + mudflatSeafoodSaleValue(type, count, coolerLevel), 0);
    const upgrades = campaign.mode === "normal" ? MUDFLAT_GENERAL_UPGRADES : MUDFLAT_UPGRADES;
    const nextStageStats = mudflatStageStats(campaign.stage);
    return <main className="ms-shell ms-camp"><MudflatTopbar onExit={onExit} /><section className="ms-camp-hero"><div><small>STAGE {campaign.stage - 1} CLEAR</small><h1>무사히 돌아왔습니다</h1><p>{campNotice}</p></div><div className="ms-wallet"><span><small>보유 코인</small><b>{campaign.coins.toLocaleString()}</b></span><span><small>현재 체력</small><b>{Math.ceil(campaign.hp)} / {campaign.maxHp}</b></span><span><small>다음 갯벌</small><b>STAGE {campaign.stage}</b></span></div>{inventoryCount > 0 && <button type="button" className="ms-camp-quick-sale" onClick={sellAllSeafood}><span>이번 바구니 {inventoryCount}마리</span><b>{inventoryValue}코인에 모두 판매</b></button>}</section><section className="ms-camp-layout"><article className="ms-market"><header><div><small>CATCH MARKET</small><h2>해산물 판매</h2></div><span>{inventoryCount}마리 · 예상 {inventoryValue}코인</span></header><div className="ms-market-list">{MUDFLAT_SEAFOOD_MARKET.map((item) => { const count = campaign.inventory[item.type] ?? 0; const unitPrice = mudflatSeafoodSaleValue(item.type, 1, coolerLevel); return <div key={item.type} className={count ? "" : "empty"}><i>{item.icon}</i><span><b>{item.name}</b><small>마리당 {unitPrice}코인</small></span><em>{count}마리</em><button type="button" disabled={!count} onClick={() => sellSeafood(item.type)}>1개 판매</button><button type="button" disabled={!count} onClick={() => sellSeafood(item.type, true)}>전부</button></div>; })}</div><button type="button" className="ms-sell-all" disabled={!inventoryCount} onClick={sellAllSeafood}>바구니 모두 판매 · {inventoryValue}코인</button></article><div className="ms-shop-stack"><article className="ms-shop"><header><small>EQUIPMENT SHOP</small><h2>장비 물품</h2></header><div>{MUDFLAT_SHOP_EQUIPMENT.map((item) => { const level = campaign.equipment[item.id] ?? 0; const price = mudflatEquipmentPrice(item.id, level); return <button type="button" key={item.id} disabled={level >= item.max || campaign.coins < price} onClick={() => buyEquipment(item.id)}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.description}</small></span><em>{level >= item.max ? "최고 단계" : `${price}코인 · Lv.${level} → ${level + 1}`}</em></button>; })}</div></article><article className="ms-shop"><header><small>RECOVERY FOOD</small><h2>체력 회복 음식</h2></header><div>{MUDFLAT_RECOVERY_FOODS.map((food) => <button type="button" key={food.id} disabled={campaign.hp >= campaign.maxHp || campaign.coins < food.price} onClick={() => buyFood(food.id)}><i>{food.icon}</i><span><b>{food.name}</b><small>{food.description} 구매 즉시 먹습니다.</small></span><em>{food.price}코인</em></button>)}</div></article><article className="ms-shop"><header><small>SKILL TRAINING</small><h2>기술 레벨업</h2></header><div>{upgrades.map((skill) => { const level = campaign.levels[skill.id] ?? 0; const price = mudflatTrainingPrice(level); return <button type="button" key={skill.id} disabled={level >= skill.max || campaign.coins < price} onClick={() => trainSkill(skill.id)}><i>{skill.icon}</i><span><b>{skill.name}</b><small>{skill.description}</small></span><em>{level >= skill.max ? "최고 레벨" : `${price}코인 · Lv.${level} → ${level + 1}`}</em></button>; })}</div></article></div></section><section className="ms-departure"><div><small>NEXT TIDE</small><b>{campaign.stage}단계 출정 준비</b><span>해산물 체력 ×{nextStageStats.creatureHpMultiplier.toFixed(2)} · 접촉 피해 +{nextStageStats.contactDamageBonus}</span></div><button type="button" className="ms-clear-save" onClick={clearCampaign}>새 원정으로 초기화</button><button type="button" className="ms-primary" onClick={startNextStage}>다음 갯벌 출정 <span>→</span></button></section></main>;
  }

  if (screen === "defeat") return <main className="ms-shell ms-result defeat"><MudflatTopbar onExit={onExit} /><section><div className="ms-result-icon">≈</div><small>BASKET LOST</small><h1>갯벌에서 힘이 다했습니다</h1><p>마지막 정비 상태는 저장되어 있습니다. 장비와 체력을 보완해 같은 스테이지에 다시 도전하세요.</p><div className="ms-result-grid"><span><small>도전 스테이지</small><b>{hud.stage}</b></span><span><small>잡은 수</small><b>{hud.caught}</b></span><span><small>레벨</small><b>{hud.level}</b></span><span><small>대왕 꽃게</small><b>{hud.bossCaught ? "포획" : "놓침"}</b></span></div><div className="ms-result-actions"><button onClick={reset}>처음 화면</button><button className="ms-primary" onClick={() => setScreen("camp")}>정비소에서 재도전</button></div></section></main>;

  const hpWidth = Math.max(0, hud.hp / hud.maxHp * 100);
  const xpWidth = Math.max(0, hud.xp / hud.nextXp * 100);
  return <main className="ms-shell ms-game"><header className="ms-game-head"><button onClick={onExit} aria-label="게임 목록으로">←</button><div className="ms-hud-title"><small>STAGE {hud.stage} · {hud.mode === "normal" ? "NORMAL" : "KIDS"}</small><b>{formatClock(hud.elapsed)}</b></div><div className="ms-hud-score"><small>SCORE</small><b>{hud.score.toLocaleString()}</b></div><button onClick={pause} aria-label="일시정지">Ⅱ</button></header><section className="ms-canvas-wrap"><canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} aria-label="해루질럿 게임 화면. 아무 곳이나 누르고 드래그해 이동합니다." /><div className="ms-hud-bars"><div className="hp"><span>체력</span><i><b style={{ width: `${hpWidth}%` }} /></i><em>{Math.ceil(hud.hp)} / {hud.maxHp}</em></div><div className="xp"><span>LV.{hud.level}</span><i><b style={{ width: `${xpWidth}%` }} /></i><em>{hud.xp} / {hud.nextXp}</em></div></div><div className="ms-caught"><small>한 바구니</small><b>{hud.caught}</b><span>마리</span></div><div className="ms-touch-hint">아무 곳이나 누르고 드래그</div></section><section className="ms-tools">{hud.mode === "normal" ? <><span><i>⌁</i><b>집게</b><em>Lv.{hud.levels.tongs ?? 1}</em></span><span><i>➶</i><b>작살</b><em>Lv.{hud.levels.harpoon ?? 0}</em></span><span><i>◇</i><b>뜰채</b><em>Lv.{hud.levels.net ?? 0}</em></span><span><i>◆</i><b>돌뒤집게</b><em>Lv.{hud.levels.rocker ?? 0}</em></span><span><i>≫</i><b>장화</b><em>Lv.{hud.levels.boots ?? 0}</em></span><span><i>◉</i><b>바구니</b><em>Lv.{hud.levels.basket ?? 0}</em></span></> : <><span><i>⌁</i><b>호미</b><em>Lv.{hud.levels.hoe ?? 0}</em></span><span><i>◇</i><b>뜰채</b><em>Lv.{hud.levels.net ?? 0}</em></span><span><i>✦</i><b>왕소금</b><em>Lv.{hud.levels.salt ?? 0}</em></span><span><i>≫</i><b>장화</b><em>Lv.{hud.levels.boots ?? 0}</em></span><span><i>◉</i><b>바구니</b><em>Lv.{hud.levels.basket ?? 0}</em></span></>}</section>{screen === "upgrade" && <div className="ms-layer"><section><small>LEVEL {hud.level}</small><h2>새 채집 기술을 고르세요</h2><p>선택하는 동안 갯벌의 시간은 멈춥니다.</p><div>{choices.map((item) => <button key={item.id} onClick={() => chooseUpgrade(item.id)}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.description}</small></span><em>Lv.{hud.levels[item.id] ?? 0} → Lv.{(hud.levels[item.id] ?? 0) + 1}</em></button>)}</div></section></div>}{screen === "paused" && <div className="ms-layer pause"><section><small>PAUSED</small><h2>잠시 쉬어갈까요?</h2><p>게임 시간과 해산물 움직임이 모두 멈춰 있습니다.</p><button className="ms-primary" onClick={resume}>계속 채집하기</button><button className="ms-quit" onClick={reset}>이번 채집 끝내기</button></section></div>}</main>;
}
