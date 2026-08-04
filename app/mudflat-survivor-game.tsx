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
type Creature = Point & { id: number; type: string; name: string; icon: string; color: string; hp: number; maxHp: number; speed: number; size: number; xp: number; score: number; boss?: boolean; saltHit: number };
type Pickup = Point & { id: number; xp: number };
type Projectile = Point & { id: number; vx: number; vy: number; damage: number; life: number };
type Runtime = {
  elapsed: number; player: Point & { hp: number; maxHp: number; speed: number; damageCooldown: number };
  creatures: Creature[]; pickups: Pickup[]; projectiles: Projectile[]; levels: Record<string, number>;
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
    elapsed: 0, player: { x: 0, y: 0, hp: character.hp, maxHp: character.hp, speed: 155, damageCooldown: 0 },
    creatures: [], pickups: [], projectiles: [], levels: { ...character.levels }, level: 1, xp: 0, nextXp: 8,
    caught: 0, catchScore: 0, bossCaught: false, bossSpawned: false, spawnClock: 0, hoeClock: 0, netClock: 0,
    hoeEffect: 0, paused: false, ended: false,
  };
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
        speed: template.speed * (1 + runtime.elapsed / 750), saltHit: 0,
      });
    };

    const damageAndCollect = () => {
      const defeated = runtime.creatures.filter((item) => item.hp <= 0);
      if (defeated.length) {
        for (const item of defeated) {
          runtime.caught += 1; runtime.catchScore += item.score;
          runtime.pickups.push({ id: sequenceRef.current++, x: item.x, y: item.y, xp: item.xp });
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

      runtime.spawnClock -= dt;
      if (runtime.spawnClock <= 0 && runtime.creatures.length < 180) {
        spawnCreature(width, height); runtime.spawnClock = mudflatSpawnInterval(runtime.elapsed);
      }
      if (!runtime.bossSpawned && runtime.elapsed >= 200) { runtime.bossSpawned = true; spawnCreature(width, height, true); }

      let touching = false;
      for (const creature of runtime.creatures) {
        const dx = runtime.player.x - creature.x; const dy = runtime.player.y - creature.y; const distance = Math.hypot(dx, dy) || 1;
        creature.x += dx / distance * creature.speed * dt; creature.y += dy / distance * creature.speed * dt;
        creature.saltHit = Math.max(0, creature.saltHit - dt);
        if (distance < creature.size + 17) touching = true;
      }
      if (touching && runtime.player.damageCooldown <= 0) {
        runtime.player.hp = Math.max(0, runtime.player.hp - (7 + Math.floor(runtime.elapsed / 70)));
        runtime.player.damageCooldown = .52;
        if ("vibrate" in navigator) navigator.vibrate(22);
      }

      const hoeLevel = runtime.levels.hoe ?? 0;
      if (hoeLevel > 0 && runtime.hoeClock <= 0) {
        const radius = 78 + hoeLevel * 12;
        for (const creature of runtime.creatures) if (Math.hypot(creature.x - runtime.player.x, creature.y - runtime.player.y) <= radius + creature.size) creature.hp -= 3 + hoeLevel * 2.3;
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
        if (hit) { hit.hp -= projectile.damage; projectile.life = 0; }
      }
      runtime.projectiles = runtime.projectiles.filter((item) => item.life > 0);

      const saltLevel = runtime.levels.salt ?? 0;
      if (saltLevel > 0) {
        const count = 1 + Math.floor(saltLevel / 2);
        for (let index = 0; index < count; index += 1) {
          const angle = runtime.elapsed * (1.8 + saltLevel * .08) + index / count * Math.PI * 2;
          const saltX = runtime.player.x + Math.cos(angle) * (66 + saltLevel * 3);
          const saltY = runtime.player.y + Math.sin(angle) * (66 + saltLevel * 3);
          for (const creature of runtime.creatures) if (creature.saltHit <= 0 && Math.hypot(creature.x - saltX, creature.y - saltY) < creature.size + 10) { creature.hp -= 3 + saltLevel * 2; creature.saltHit = .22; }
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
      context.fillStyle = `rgb(${87 - tide * 16},${79 + tide * 13},${66 + tide * 20})`; context.fillRect(0, 0, width, height);
      const grid = 80; const offsetX = ((-runtime.player.x % grid) + grid) % grid; const offsetY = ((-runtime.player.y % grid) + grid) % grid;
      context.strokeStyle = "rgba(238,220,174,.08)"; context.lineWidth = 1;
      for (let x = offsetX; x < width; x += grid) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = offsetY; y < height; y += grid) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      context.fillStyle = "rgba(61,105,112,.14)";
      for (let index = 0; index < 9; index += 1) { const x = (index * 173 + offsetX * .4) % (width + 120) - 60; const y = (index * 97 + offsetY * .5) % (height + 80) - 40; context.beginPath(); context.ellipse(x, y, 45 + index % 3 * 16, 18 + index % 2 * 8, index, 0, Math.PI * 2); context.fill(); }
      const screenPoint = (point: Point) => ({ x: width / 2 + point.x - runtime.player.x, y: height / 2 + point.y - runtime.player.y });

      for (const pickup of runtime.pickups) { const point = screenPoint(pickup); context.fillStyle = "#7af0ca"; context.beginPath(); context.arc(point.x, point.y, 5 + Math.min(4, pickup.xp), 0, Math.PI * 2); context.fill(); context.strokeStyle = "#d9fff3"; context.stroke(); }
      for (const projectile of runtime.projectiles) { const point = screenPoint(projectile); context.save(); context.translate(point.x, point.y); context.rotate(Math.atan2(projectile.vy, projectile.vx)); context.strokeStyle = "#f8e5b7"; context.lineWidth = 3; context.strokeRect(-8, -8, 16, 16); context.restore(); }
      for (const creature of runtime.creatures) {
        const point = screenPoint(creature); if (point.x < -70 || point.y < -70 || point.x > width + 70 || point.y > height + 70) continue;
        context.save(); context.translate(point.x, point.y); context.fillStyle = "rgba(20,15,22,.25)"; context.beginPath(); context.ellipse(0, creature.size * .72, creature.size, creature.size * .38, 0, 0, Math.PI * 2); context.fill();
        context.fillStyle = creature.color; context.beginPath(); context.arc(0, 0, creature.size, 0, Math.PI * 2); context.fill(); context.strokeStyle = creature.boss ? "#ffd772" : "rgba(255,255,255,.6)"; context.lineWidth = creature.boss ? 5 : 2; context.stroke();
        context.fillStyle = "#2b2228"; context.font = `900 ${Math.max(15, creature.size * 1.05)}px system-ui`; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(creature.icon, 0, 1);
        if (creature.boss) { context.fillStyle = "rgba(26,19,25,.8)"; context.fillRect(-44, -creature.size - 16, 88, 7); context.fillStyle = "#f2a849"; context.fillRect(-44, -creature.size - 16, 88 * Math.max(0, creature.hp / creature.maxHp), 7); }
        context.restore();
      }
      if ((runtime.levels.salt ?? 0) > 0) { const count = 1 + Math.floor((runtime.levels.salt ?? 0) / 2); for (let index = 0; index < count; index += 1) { const angle = runtime.elapsed * (1.8 + (runtime.levels.salt ?? 0) * .08) + index / count * Math.PI * 2; context.fillStyle = "#fff3bd"; context.beginPath(); context.arc(width / 2 + Math.cos(angle) * (66 + (runtime.levels.salt ?? 0) * 3), height / 2 + Math.sin(angle) * (66 + (runtime.levels.salt ?? 0) * 3), 8, 0, Math.PI * 2); context.fill(); } }
      if (runtime.hoeEffect > 0) { context.strokeStyle = `rgba(255,225,146,${runtime.hoeEffect * 4})`; context.lineWidth = 7; context.beginPath(); context.arc(width / 2, height / 2, 78 + (runtime.levels.hoe ?? 0) * 12, -.25, Math.PI * 1.5); context.stroke(); }
      context.save(); context.translate(width / 2, height / 2); context.fillStyle = runtime.player.damageCooldown > 0 ? "#fff" : "#f4c95d"; context.beginPath(); context.arc(0, 0, 19, 0, Math.PI * 2); context.fill(); context.strokeStyle = "#fff4c8"; context.lineWidth = 4; context.stroke(); context.fillStyle = "#34291f"; context.fillRect(-17, -16, 34, 8); context.fillStyle = "#f16b45"; context.fillRect(-9, 5, 18, 13); context.restore();
      const waterHeight = Math.max(0, (tide - .72) / .28) * height * .28; if (waterHeight > 0) { context.fillStyle = "rgba(57,145,164,.22)"; context.fillRect(0, height - waterHeight, width, waterHeight); }
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
