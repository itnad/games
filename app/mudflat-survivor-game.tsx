"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  MUDFLAT_CREATURES,
  MUDFLAT_RUN_SECONDS,
  mudflatCreatureForTime,
  mudflatFinalScore,
  mudflatJoystickVector,
  mudflatSpawnInterval,
  mudflatUpgradeChoices,
} from "./mudflat-survivor-engine.js";

type ExitProps = { onExit: () => void };
type Screen = "setup" | "running" | "upgrade" | "paused" | "victory" | "defeat";
type Point = { x: number; y: number };
type Creature = Point & { id: number; type: string; name: string; icon: string; color: string; hp: number; maxHp: number; speed: number; size: number; xp: number; score: number; boss?: boolean; saltHit: number; hitFlash: number; phase: number };
type Pickup = Point & { id: number; xp: number };
type Projectile = Point & { id: number; vx: number; vy: number; damage: number; life: number };
type Burst = Point & { id: number; life: number; maxLife: number; color: string; size: number };
type FloatText = Point & { id: number; life: number; text: string; color: string };
type Runtime = {
  elapsed: number; player: Point & { hp: number; maxHp: number; speed: number; damageCooldown: number; facing: number; stride: number };
  creatures: Creature[]; pickups: Pickup[]; projectiles: Projectile[]; levels: Record<string, number>;
  bursts: Burst[]; floatTexts: FloatText[];
  level: number; xp: number; nextXp: number; caught: number; catchScore: number; bossCaught: boolean;
  bossSpawned: boolean; spawnClock: number; hoeClock: number; netClock: number; hoeEffect: number; paused: boolean; ended: boolean;
};
type Hud = { elapsed: number; hp: number; maxHp: number; level: number; xp: number; nextXp: number; caught: number; score: number; levels: Record<string, number>; bossCaught: boolean };

const BEST_KEY = "paperoid-mudflat-survivor-best-v1";
const CHARACTERS = [
  { id: "digger", icon: "⌁", name: "호미꾼 하루", description: "넓은 호미질로 시작합니다.", levels: { hoe: 2, net: 0, salt: 0, boots: 0, basket: 0, stamina: 0 }, hp: 115 },
  { id: "netter", icon: "◇", name: "그물잡이 모아", description: "자동 뜰채를 빠르게 던집니다.", levels: { hoe: 1, net: 2, salt: 0, boots: 0, basket: 0, stamina: 0 }, hp: 100 },
  { id: "salter", icon: "✦", name: "소금장인 소금", description: "주위를 도는 왕소금을 사용합니다.", levels: { hoe: 1, net: 0, salt: 2, boots: 0, basket: 0, stamina: 0 }, hp: 105 },
];

const emptyHud: Hud = { elapsed: 0, hp: 100, maxHp: 100, level: 1, xp: 0, nextXp: 8, caught: 0, score: 0, levels: {}, bossCaught: false };

function formatClock(seconds: number) {
  const remaining = Math.max(0, MUDFLAT_RUN_SECONDS - seconds);
  return `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`;
}

function makeRuntime(characterId: string): Runtime {
  const character = CHARACTERS.find((item) => item.id === characterId) ?? CHARACTERS[0];
  return {
    elapsed: 0, player: { x: 0, y: 0, hp: character.hp, maxHp: character.hp, speed: 155, damageCooldown: 0, facing: 0, stride: 0 },
    creatures: [], pickups: [], projectiles: [], bursts: [], floatTexts: [], levels: { ...character.levels }, level: 1, xp: 0, nextXp: 8,
    caught: 0, catchScore: 0, bossCaught: false, bossSpawned: false, spawnClock: 0, hoeClock: 0, netClock: 0,
    hoeEffect: 0, paused: false, ended: false,
  };
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

export function MudflatSurvivorGame({ onExit }: ExitProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const joystickRef = useRef({ pointerId: -1, originX: 0, originY: 0, x: 0, y: 0 });
  const keysRef = useRef(new Set<string>());
  const sequenceRef = useRef(1);
  const [screen, setScreen] = useState<Screen>("setup");
  const [characterId, setCharacterId] = useState("digger");
  const [hud, setHud] = useState<Hud>(emptyHud);
  const [choices, setChoices] = useState<Array<{ id: string; icon: string; name: string; description: string; max: number }>>([]);
  const [runId, setRunId] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => { setBest(Number(window.localStorage.getItem(BEST_KEY) ?? 0)); }, []);

  const snapshot = useCallback((runtime: Runtime) => {
    setHud({
      elapsed: runtime.elapsed, hp: runtime.player.hp, maxHp: runtime.player.maxHp, level: runtime.level,
      xp: runtime.xp, nextXp: runtime.nextXp, caught: runtime.caught,
      score: mudflatFinalScore({ catchScore: runtime.catchScore, caught: runtime.caught, elapsed: runtime.elapsed, bossCaught: runtime.bossCaught }),
      levels: { ...runtime.levels }, bossCaught: runtime.bossCaught,
    });
  }, []);

  const begin = () => {
    const runtime = makeRuntime(characterId);
    runtimeRef.current = runtime; snapshot(runtime); setChoices([]); setScreen("running"); setRunId((value) => value + 1);
  };

  const endRun = useCallback((screenResult: "victory" | "defeat", runtime: Runtime) => {
    if (runtime.ended) return;
    runtime.ended = true; runtime.paused = true; snapshot(runtime);
    const score = mudflatFinalScore({ catchScore: runtime.catchScore, caught: runtime.caught, elapsed: runtime.elapsed, bossCaught: runtime.bossCaught });
    if (score > best) { setBest(score); window.localStorage.setItem(BEST_KEY, String(score)); }
    setScreen(screenResult);
  }, [best, snapshot]);

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
      const scale = forcedBoss ? 1 : 1 + runtime.elapsed / 420;
      runtime.creatures.push({
        ...template, id: sequenceRef.current++, x: runtime.player.x + Math.cos(angle) * distance,
        y: runtime.player.y + Math.sin(angle) * distance, hp: template.hp * scale, maxHp: template.hp * scale,
        speed: template.speed * (1 + runtime.elapsed / 750), saltHit: 0, hitFlash: 0, phase: Math.random() * Math.PI * 2,
      });
    };

    const damageAndCollect = () => {
      const defeated = runtime.creatures.filter((item) => item.hp <= 0);
      if (defeated.length) {
        for (const item of defeated) {
          runtime.caught += 1; runtime.catchScore += item.score;
          runtime.pickups.push({ id: sequenceRef.current++, x: item.x, y: item.y, xp: item.xp });
          runtime.bursts.push({ id: sequenceRef.current++, x: item.x, y: item.y, life: .5, maxLife: .5, color: item.color, size: item.size });
          runtime.floatTexts.push({ id: sequenceRef.current++, x: item.x, y: item.y - item.size, life: .8, text: `+${item.score}`, color: item.boss ? "#ffe174" : "#f9efd5" });
          if (item.boss) runtime.bossCaught = true;
        }
        runtime.creatures = runtime.creatures.filter((item) => item.hp > 0);
      }
    };

    const update = (dt: number, width: number, height: number) => {
      if (runtime.paused || runtime.ended) return;
      runtime.elapsed += dt;
      runtime.player.damageCooldown = Math.max(0, runtime.player.damageCooldown - dt);
      runtime.hoeClock -= dt; runtime.netClock -= dt; runtime.hoeEffect = Math.max(0, runtime.hoeEffect - dt);

      let inputX = joystickRef.current.x;
      let inputY = joystickRef.current.y;
      const keys = keysRef.current;
      if (keys.has("ArrowLeft") || keys.has("KeyA")) inputX -= 1;
      if (keys.has("ArrowRight") || keys.has("KeyD")) inputX += 1;
      if (keys.has("ArrowUp") || keys.has("KeyW")) inputY -= 1;
      if (keys.has("ArrowDown") || keys.has("KeyS")) inputY += 1;
      const inputLength = Math.hypot(inputX, inputY);
      if (inputLength > 1) { inputX /= inputLength; inputY /= inputLength; }
      const speed = runtime.player.speed * (1 + (runtime.levels.boots ?? 0) * .09);
      runtime.player.x += inputX * speed * dt; runtime.player.y += inputY * speed * dt;
      if (Math.hypot(inputX, inputY) > .05) {
        runtime.player.facing = Math.atan2(inputY, inputX);
        runtime.player.stride += dt * Math.max(.35, Math.hypot(inputX, inputY));
      }

      runtime.spawnClock -= dt;
      if (runtime.spawnClock <= 0 && runtime.creatures.length < 180) {
        spawnCreature(width, height); runtime.spawnClock = mudflatSpawnInterval(runtime.elapsed);
      }
      if (!runtime.bossSpawned && runtime.elapsed >= 200) { runtime.bossSpawned = true; spawnCreature(width, height, true); }

      let touching = false;
      for (const creature of runtime.creatures) {
        const dx = runtime.player.x - creature.x; const dy = runtime.player.y - creature.y; const distance = Math.hypot(dx, dy) || 1;
        creature.x += dx / distance * creature.speed * dt; creature.y += dy / distance * creature.speed * dt;
        creature.saltHit = Math.max(0, creature.saltHit - dt); creature.hitFlash = Math.max(0, creature.hitFlash - dt);
        if (distance < creature.size + 17) touching = true;
      }
      if (touching && runtime.player.damageCooldown <= 0) {
        runtime.player.hp = Math.max(0, runtime.player.hp - (7 + Math.floor(runtime.elapsed / 70)));
        runtime.player.damageCooldown = .52;
        runtime.bursts.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y, life: .35, maxLife: .35, color: "#ff7868", size: 24 });
        if ("vibrate" in navigator) navigator.vibrate(22);
      }

      const hoeLevel = runtime.levels.hoe ?? 0;
      if (hoeLevel > 0 && runtime.hoeClock <= 0) {
        const radius = 78 + hoeLevel * 12;
        for (const creature of runtime.creatures) if (Math.hypot(creature.x - runtime.player.x, creature.y - runtime.player.y) <= radius + creature.size) { creature.hp -= 3 + hoeLevel * 2.3; creature.hitFlash = .1; }
        runtime.hoeClock = Math.max(.42, 1.02 - hoeLevel * .09); runtime.hoeEffect = .2;
      }

      const netLevel = runtime.levels.net ?? 0;
      if (netLevel > 0 && runtime.netClock <= 0 && runtime.creatures.length) {
        const target = runtime.creatures.reduce((nearest, item) => Math.hypot(item.x - runtime.player.x, item.y - runtime.player.y) < Math.hypot(nearest.x - runtime.player.x, nearest.y - runtime.player.y) ? item : nearest);
        const dx = target.x - runtime.player.x; const dy = target.y - runtime.player.y; const distance = Math.hypot(dx, dy) || 1;
        runtime.projectiles.push({ id: sequenceRef.current++, x: runtime.player.x, y: runtime.player.y, vx: dx / distance * 430, vy: dy / distance * 430, damage: 6 + netLevel * 4, life: 1.5 });
        runtime.netClock = Math.max(.48, 1.5 - netLevel * .14);
      }
      for (const projectile of runtime.projectiles) {
        projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.life -= dt;
        const hit = runtime.creatures.find((item) => Math.hypot(item.x - projectile.x, item.y - projectile.y) < item.size + 9);
        if (hit) { hit.hp -= projectile.damage; hit.hitFlash = .12; projectile.life = 0; }
      }
      runtime.projectiles = runtime.projectiles.filter((item) => item.life > 0);

      const saltLevel = runtime.levels.salt ?? 0;
      if (saltLevel > 0) {
        const count = 1 + Math.floor(saltLevel / 2);
        for (let index = 0; index < count; index += 1) {
          const angle = runtime.elapsed * (1.8 + saltLevel * .08) + index / count * Math.PI * 2;
          const saltX = runtime.player.x + Math.cos(angle) * (66 + saltLevel * 3);
          const saltY = runtime.player.y + Math.sin(angle) * (66 + saltLevel * 3);
          for (const creature of runtime.creatures) if (creature.saltHit <= 0 && Math.hypot(creature.x - saltX, creature.y - saltY) < creature.size + 10) { creature.hp -= 3 + saltLevel * 2; creature.saltHit = .22; creature.hitFlash = .1; }
        }
      }
      damageAndCollect();

      const pickupRadius = 50 + (runtime.levels.basket ?? 0) * 24;
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
        const nextChoices = mudflatUpgradeChoices(runtime.level, runtime.levels);
        if (nextChoices.length) { setChoices(nextChoices); setScreen("upgrade"); if ("vibrate" in navigator) navigator.vibrate([30, 30, 30]); }
        else runtime.paused = false;
      }
      if (runtime.player.hp <= 0) endRun("defeat", runtime);
      else if (runtime.elapsed >= MUDFLAT_RUN_SECONDS) endRun("victory", runtime);
    };

    const draw = (width: number, height: number) => {
      context.clearRect(0, 0, width, height);
      const tide = Math.min(1, runtime.elapsed / MUDFLAT_RUN_SECONDS);
      drawMudflat(context, width, height, runtime.player, tide, runtime.elapsed);
      const screenPoint = (point: Point) => ({ x: width / 2 + point.x - runtime.player.x, y: height / 2 + point.y - runtime.player.y });

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
      if (runtime.hoeEffect > 0) {
        const alpha = runtime.hoeEffect / .2;
        const radius = 78 + (runtime.levels.hoe ?? 0) * 12;
        context.strokeStyle = `rgba(255,221,132,${alpha * .8})`; context.lineWidth = 6 + alpha * 4;
        context.beginPath(); context.arc(width / 2, height / 2, radius, -.18, Math.PI * 1.55); context.stroke();
        context.strokeStyle = `rgba(255,251,224,${alpha * .6})`; context.lineWidth = 2; context.beginPath(); context.arc(width / 2, height / 2, radius + 7, 0, Math.PI * 1.35); context.stroke();
      }
      drawGatherer(context, width / 2, height / 2, runtime.player, characterId);
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
  }, [endRun, runId, snapshot]);

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
    setChoices([]); runtime.paused = false; snapshot(runtime); setScreen("running");
  };
  const reset = () => { runtimeRef.current = null; joystickRef.current.x = 0; joystickRef.current.y = 0; setHud(emptyHud); setChoices([]); setScreen("setup"); };

  if (screen === "setup") return <main className="ms-shell ms-setup"><header className="ms-topbar"><button onClick={onExit} aria-label="게임 목록으로">←</button><div><small>paperoid · MUDFLAT ACTION</small><strong>갯벌 한탕</strong></div><span>최고 {best.toLocaleString()}점</span></header><section className="ms-setup-hero"><div className="ms-sun">☀</div><small>THE TIDE IS COMING</small><h1>밀물 전에<br /><em>한 바구니!</em></h1><p>화면 아무 곳이나 누른 뒤 가고 싶은 방향으로 드래그하세요.<br />도구는 자동으로 움직이고, 손을 떼면 바로 멈춥니다.</p><div className="ms-control-demo" aria-hidden="true"><span>TOUCH</span><i>●</i><b>→</b><em>상대 거리만큼 이동</em></div></section><section className="ms-character-select"><header><span>01</span><div><b>오늘의 채집꾼</b><small>시작 도구가 서로 다릅니다</small></div></header><div>{CHARACTERS.map((item) => <button type="button" key={item.id} className={characterId === item.id ? "selected" : ""} onClick={() => setCharacterId(item.id)}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.description}</small></span><em>{item.id === "digger" ? "호미 Lv.2" : item.id === "netter" ? "뜰채 Lv.2" : "왕소금 Lv.2"}</em></button>)}</div><button className="ms-primary" type="button" onClick={begin}>4분 채집 시작 <span>→</span></button><p>PC에서는 방향키 또는 WASD를 사용할 수 있습니다.</p></section></main>;

  if (screen === "victory" || screen === "defeat") return <main className={`ms-shell ms-result ${screen}`}><header className="ms-topbar"><button onClick={onExit} aria-label="게임 목록으로">←</button><div><small>paperoid · MUDFLAT ACTION</small><strong>갯벌 한탕</strong></div><span>{formatClock(hud.elapsed)}</span></header><section><div className="ms-result-icon">{screen === "victory" ? "☀" : "≈"}</div><small>{screen === "victory" ? "TIDE CLEARED" : "BASKET LOST"}</small><h1>{screen === "victory" ? "밀물 전에 돌아왔습니다!" : "갯벌에서 힘이 다했습니다"}</h1><p>{screen === "victory" ? "잡은 해산물과 보너스를 모두 정산했습니다." : "다음에는 이동 도구와 체력을 먼저 강화해 보세요."}</p><div className="ms-result-grid"><span><small>최종 점수</small><b>{hud.score.toLocaleString()}</b></span><span><small>잡은 수</small><b>{hud.caught}</b></span><span><small>레벨</small><b>{hud.level}</b></span><span><small>대왕 꽃게</small><b>{hud.bossCaught ? "포획" : "놓침"}</b></span></div><div className="ms-result-actions"><button onClick={onExit}>게임 목록</button><button className="ms-primary" onClick={reset}>다시 채집</button></div></section></main>;

  const hpWidth = Math.max(0, hud.hp / hud.maxHp * 100);
  const xpWidth = Math.max(0, hud.xp / hud.nextXp * 100);
  return <main className="ms-shell ms-game"><header className="ms-game-head"><button onClick={onExit} aria-label="게임 목록으로">←</button><div className="ms-hud-title"><small>TIDE LEFT</small><b>{formatClock(hud.elapsed)}</b></div><div className="ms-hud-score"><small>SCORE</small><b>{hud.score.toLocaleString()}</b></div><button onClick={pause} aria-label="일시정지">Ⅱ</button></header><section className="ms-canvas-wrap"><canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} aria-label="갯벌 채집 게임 화면. 아무 곳이나 누르고 드래그해 이동합니다." /><div className="ms-hud-bars"><div className="hp"><span>체력</span><i><b style={{ width: `${hpWidth}%` }} /></i><em>{Math.ceil(hud.hp)} / {hud.maxHp}</em></div><div className="xp"><span>LV.{hud.level}</span><i><b style={{ width: `${xpWidth}%` }} /></i><em>{hud.xp} / {hud.nextXp}</em></div></div><div className="ms-caught"><small>한 바구니</small><b>{hud.caught}</b><span>마리</span></div><div className="ms-touch-hint">아무 곳이나 누르고 드래그</div></section><section className="ms-tools"><span><i>⌁</i><b>호미</b><em>Lv.{hud.levels.hoe ?? 0}</em></span><span><i>◇</i><b>뜰채</b><em>Lv.{hud.levels.net ?? 0}</em></span><span><i>✦</i><b>왕소금</b><em>Lv.{hud.levels.salt ?? 0}</em></span><span><i>≫</i><b>장화</b><em>Lv.{hud.levels.boots ?? 0}</em></span><span><i>◉</i><b>바구니</b><em>Lv.{hud.levels.basket ?? 0}</em></span></section>{screen === "upgrade" && <div className="ms-layer"><section><small>LEVEL {hud.level}</small><h2>새 채집 기술을 고르세요</h2><p>선택하는 동안 갯벌의 시간은 멈춥니다.</p><div>{choices.map((item) => <button key={item.id} onClick={() => chooseUpgrade(item.id)}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.description}</small></span><em>Lv.{hud.levels[item.id] ?? 0} → Lv.{(hud.levels[item.id] ?? 0) + 1}</em></button>)}</div></section></div>}{screen === "paused" && <div className="ms-layer pause"><section><small>PAUSED</small><h2>잠시 쉬어갈까요?</h2><p>게임 시간과 해산물 움직임이 모두 멈춰 있습니다.</p><button className="ms-primary" onClick={resume}>계속 채집하기</button><button className="ms-quit" onClick={reset}>이번 채집 끝내기</button></section></div>}</main>;
}
