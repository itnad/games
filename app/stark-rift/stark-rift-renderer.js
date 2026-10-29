// Stark Rift Canvas 렌더러. 상태를 읽기만 하고 바꾸지 않는다.
import { STARK_RIFT_BUILDINGS, STARK_RIFT_EDGES, STARK_RIFT_MAP_HEIGHT, STARK_RIFT_MAP_WIDTH, STARK_RIFT_UNITS, STARK_RIFT_ZONES } from "./stark-rift-data.js";
import { starkRiftBaseAt, starkRiftBuildingDone, starkRiftMinePosition, starkRiftWorkerPoint, starkRiftZone } from "./stark-rift-engine.js";

export const STARK_RIFT_COLORS = {
  player: { main: "#4aa8ff", light: "#bfe0ff", dark: "#123c66", shot: "#d8f0ff" },
  enemy: { main: "#ff5d4f", light: "#ffc8c0", dark: "#661c16", shot: "#ffd27a" },
};

/**
 * 캔버스 CSS 크기에 맞춰 지도를 배치한다.
 * fit: 지도 전체를 한 화면에 넣는다. fill: 화면 폭을 채우고 세로는 top(지도 좌표)부터 보여 준다.
 * @param {number} width
 * @param {number} height
 * @param {"fit" | "fill"} [mode]
 * @param {number} [top]
 */
export function starkRiftViewport(width, height, mode = "fit", top = 0) {
  const fitScale = Math.min(width / STARK_RIFT_MAP_WIDTH, height / STARK_RIFT_MAP_HEIGHT);
  // 확대 지도는 화면 폭을 채우되 지도 세로의 60% 이상은 항상 보이게 한다.
  const fillScale = Math.min(width / STARK_RIFT_MAP_WIDTH, height / (STARK_RIFT_MAP_HEIGHT * 0.6));
  if (mode === "fit" || fillScale <= fitScale * 1.05) {
    return {
      width,
      height,
      scale: fitScale,
      ox: (width - STARK_RIFT_MAP_WIDTH * fitScale) / 2,
      oy: (height - STARK_RIFT_MAP_HEIGHT * fitScale) / 2,
      top: 0,
      maxTop: 0,
    };
  }
  const maxTop = Math.max(0, STARK_RIFT_MAP_HEIGHT - height / fillScale);
  const clamped = Math.min(maxTop, Math.max(0, top));
  return { width, height, scale: fillScale, ox: (width - STARK_RIFT_MAP_WIDTH * fillScale) / 2, oy: -clamped * fillScale, top: clamped, maxTop };
}

/** 지정한 지도 y를 화면 가운데에 두는 top 값. */
export function starkRiftCenterTop(view, y) {
  return Math.min(view.maxTop, Math.max(0, y - view.height / view.scale / 2));
}

export function starkRiftScreenToMap(view, sx, sy) {
  return { x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale };
}

function sx(view, x) { return view.ox + x * view.scale; }
function sy(view, y) { return view.oy + y * view.scale; }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGround(ctx, view) {
  ctx.fillStyle = "#0d1512";
  ctx.fillRect(0, 0, view.width, view.height);
  const x = view.ox;
  const y = view.oy;
  const w = STARK_RIFT_MAP_WIDTH * view.scale;
  const h = STARK_RIFT_MAP_HEIGHT * view.scale;
  const ground = ctx.createLinearGradient(0, y, 0, y + h);
  ground.addColorStop(0, "#2a2320");
  ground.addColorStop(0.5, "#27302a");
  ground.addColorStop(1, "#1f2b2c");
  ctx.fillStyle = ground;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "#ffffff08";
  ctx.lineWidth = 1;
  const step = 10 * view.scale;
  for (let gx = x; gx <= x + w; gx += step) {
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
  }
  for (let gy = y; gy <= y + h; gy += step) {
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }
  ctx.restore();
}

function drawRoads(ctx, view) {
  ctx.save();
  ctx.lineCap = "round";
  for (const [a, b] of STARK_RIFT_EDGES) {
    const za = starkRiftZone(a);
    const zb = starkRiftZone(b);
    ctx.strokeStyle = "#8a775c55";
    ctx.lineWidth = Math.max(6, 4.2 * view.scale);
    ctx.beginPath(); ctx.moveTo(sx(view, za.x), sy(view, za.y)); ctx.lineTo(sx(view, zb.x), sy(view, zb.y)); ctx.stroke();
    ctx.strokeStyle = "#e6d3a92e";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(sx(view, za.x), sy(view, za.y)); ctx.lineTo(sx(view, zb.x), sy(view, zb.y)); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawZones(ctx, state, view, ui) {
  for (const zone of STARK_RIFT_ZONES) {
    const owner = starkRiftBaseAt(state, zone.id)?.side ?? null;
    const x = sx(view, zone.x);
    const y = sy(view, zone.y);
    const r = zone.radius * view.scale;
    ctx.save();
    const fill = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    const tint = owner ? STARK_RIFT_COLORS[owner].main : "#c9c2a8";
    fill.addColorStop(0, `${tint}22`);
    fill.addColorStop(1, `${tint}0a`);
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = owner ? `${STARK_RIFT_COLORS[owner].main}88` : "#ffffff26";
    ctx.lineWidth = owner ? 2 : 1;
    ctx.setLineDash(owner ? [] : [4, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (zone.highGround) {
      ctx.strokeStyle = "#e9d7a133";
      for (const ratio of [0.4, 0.7]) {
        ctx.beginPath(); ctx.arc(x, y, r * ratio, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (ui.selectedZone === zone.id) {
      const pulse = 0.5 + Math.sin(ui.clock * 5) * 0.5;
      ctx.strokeStyle = `rgba(255, 228, 120, ${0.55 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, r + 3 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawMines(ctx, state, view) {
  for (const zone of STARK_RIFT_ZONES) {
    if (!zone.mine) continue;
    const remaining = state.zones[zone.id].ore / zone.mine;
    const position = starkRiftMinePosition(zone.id);
    const x = sx(view, position.x);
    const y = sy(view, position.y);
    const size = view.scale * (1.2 + remaining * 1.3);
    ctx.save();
    ctx.globalAlpha = remaining > 0 ? 1 : 0.25;
    const crystals = [[-1.6, 0.4, 0.9], [0, -0.5, 1.2], [1.5, 0.5, 0.85], [-0.6, 1.2, 0.7], [0.8, 1.3, 0.7]];
    for (const [cx, cy, scale] of crystals) {
      const px = x + cx * size;
      const py = y + cy * size;
      const s = size * scale;
      ctx.fillStyle = "#4fe3d1";
      ctx.beginPath();
      ctx.moveTo(px, py - s * 1.3);
      ctx.lineTo(px + s * 0.6, py);
      ctx.lineTo(px, py + s * 0.7);
      ctx.lineTo(px - s * 0.6, py);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c8fff7aa";
      ctx.beginPath();
      ctx.moveTo(px, py - s * 1.3);
      ctx.lineTo(px + s * 0.25, py - s * 0.1);
      ctx.lineTo(px - s * 0.2, py);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawWorkers(ctx, state, view, ui) {
  for (const side of ["player", "enemy"]) {
    const record = state.sides[side];
    for (const [zoneId, count] of Object.entries(record.workers)) {
      if (!count) continue;
      const base = starkRiftBaseAt(state, zoneId);
      if (!base) continue;
      const mine = starkRiftMinePosition(zoneId);
      const shown = Math.min(count, 14);
      for (let index = 0; index < shown; index += 1) {
        const phase = (ui.clock * 0.35 + index / shown) % 1;
        const t = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        const offset = ((index % 5) - 2) * 0.9;
        const x = base.x + (mine.x - base.x) * (0.25 + t * 0.6) + offset * 0.4;
        const y = base.y + (mine.y - base.y) * (0.25 + t * 0.6) + offset * 0.3;
        ctx.fillStyle = STARK_RIFT_COLORS[side].light;
        ctx.beginPath(); ctx.arc(sx(view, x), sy(view, y), Math.max(1.6, 0.45 * view.scale), 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const trip of record.transit) {
      const from = starkRiftWorkerPoint(state, trip.from);
      const to = starkRiftZone(trip.to);
      const total = Math.max(0.1, trip.eta - trip.start);
      const t = Math.min(1, Math.max(0, (state.time - trip.start) / total));
      ctx.fillStyle = STARK_RIFT_COLORS[side].light;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(sx(view, from.x + (to.x - from.x) * t), sy(view, from.y + (to.y - from.y) * t), Math.max(1.6, 0.45 * view.scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawBar(ctx, x, y, width, ratio, color) {
  ctx.fillStyle = "#000000aa";
  ctx.fillRect(x - width / 2, y, width, 3);
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, ratio)), 3);
}

function drawBuildings(ctx, state, view) {
  for (const building of state.buildings) {
    const def = STARK_RIFT_BUILDINGS[building.type];
    const colors = STARK_RIFT_COLORS[building.side];
    const size = def.size * view.scale;
    const x = sx(view, building.x);
    const y = sy(view, building.y);
    const done = starkRiftBuildingDone(building);
    ctx.save();
    ctx.globalAlpha = done ? 1 : 0.55 + building.progress * 0.35;
    ctx.fillStyle = "#00000055";
    roundRect(ctx, x - size / 2 + 2, y - size / 2 + 3, size, size, size * 0.2);
    ctx.fill();
    ctx.fillStyle = done ? colors.dark : "#2c3136";
    roundRect(ctx, x - size / 2, y - size / 2, size, size, size * 0.2);
    ctx.fill();
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = building.type === "hq" ? 3 : 2;
    if (!done) ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (building.type === "turret" && done) {
      const target = state.units.find((unit) => unit.id === building.targetId);
      const angle = target ? Math.atan2(target.y - building.y, target.x - building.x) : building.side === "player" ? -Math.PI / 2 : Math.PI / 2;
      ctx.strokeStyle = colors.light;
      ctx.lineWidth = Math.max(2, view.scale * 0.6);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * size * 0.75, y + Math.sin(angle) * size * 0.75); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${Math.max(12, Math.min(20, size * 0.55))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.short, x, y + 1);
    if (!done) {
      ctx.strokeStyle = "#ffe48a";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, size * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * building.progress); ctx.stroke();
    } else if (building.queue.length) {
      const item = building.queue[0];
      const total = item.duration ?? STARK_RIFT_UNITS[item.unit].time;
      drawBar(ctx, x, y + size / 2 + 2, size, 1 - item.remaining / total, "#ffe48a");
    }
    if (building.hp < building.maxHp * 0.98 && done) drawBar(ctx, x, y - size / 2 - 6, size, building.hp / building.maxHp, building.hp / building.maxHp > 0.4 ? "#71e08a" : "#ff7a5c");
    ctx.restore();
  }
}

function drawUnits(ctx, state, view, ui) {
  for (const unit of state.units) {
    const colors = STARK_RIFT_COLORS[unit.side];
    const x = sx(view, unit.x);
    const y = sy(view, unit.y);
    const r = Math.max(3.2, unit.radius * view.scale);
    const selected = unit.side === "player" && unit.squad === ui.selectedSquad;
    ctx.save();
    if (selected) {
      ctx.strokeStyle = "#ffe48acc";
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = colors.main;
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 1.4;
    if (unit.type === "rifle") {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = colors.light;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(unit.heading) * r * 1.6, y + Math.sin(unit.heading) * r * 1.6); ctx.stroke();
    } else if (unit.type === "guard") {
      ctx.translate(x, y);
      ctx.rotate(unit.heading);
      roundRect(ctx, -r, -r, r * 2, r * 2, r * 0.35); ctx.fill(); ctx.stroke();
      ctx.fillStyle = colors.light;
      ctx.fillRect(r * 0.55, -r * 0.9, r * 0.45, r * 1.8);
    } else {
      ctx.translate(x, y);
      ctx.rotate(unit.heading);
      roundRect(ctx, -r * 1.15, -r * 0.85, r * 2.3, r * 1.7, r * 0.3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = colors.light;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colors.light;
      ctx.lineWidth = Math.max(2, r * 0.32);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.6, 0); ctx.stroke();
    }
    ctx.restore();
    if (unit.hp < unit.maxHp) drawBar(ctx, x, y - r - 5, Math.max(10, r * 2.4), unit.hp / unit.maxHp, unit.hp / unit.maxHp > 0.4 ? "#71e08a" : "#ff7a5c");
  }
}

function drawSquadMarkers(ctx, state, view, ui) {
  const record = state.sides.player;
  for (const squad of Object.values(record.squads)) {
    const units = state.units.filter((unit) => unit.side === "player" && unit.squad === squad.id);
    if (!units.length) continue;
    const cx = units.reduce((sum, unit) => sum + unit.x, 0) / units.length;
    const cy = units.reduce((sum, unit) => sum + unit.y, 0) / units.length;
    const selected = squad.id === ui.selectedSquad;
    const target = starkRiftZone(squad.zone);
    if (selected && units.some((unit) => unit.mode === "travel")) {
      ctx.save();
      ctx.strokeStyle = squad.order === "attack" ? "#ff9a7a" : "#9fd5ff";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -ui.clock * 20;
      ctx.beginPath(); ctx.moveTo(sx(view, cx), sy(view, cy)); ctx.lineTo(sx(view, target.x), sy(view, target.y)); ctx.stroke();
      ctx.restore();
    }
    const bx = sx(view, cx);
    const by = sy(view, cy) - 14 - view.scale * 2;
    ctx.save();
    ctx.fillStyle = selected ? "#ffe48a" : "#0f1a24dd";
    ctx.strokeStyle = selected ? "#7a5a00" : "#4aa8ff";
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx - 11, by - 9, 22, 18, 6);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = selected ? "#2b2100" : "#e5f2ff";
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(squad.id), bx, by + 1);
    ctx.restore();
  }
}

function drawEffects(ctx, state, view) {
  for (const effect of state.effects) {
    const t = 1 - effect.ttl / effect.max;
    const colors = STARK_RIFT_COLORS[effect.side];
    ctx.save();
    if (effect.kind === "shot") {
      ctx.strokeStyle = colors.shot;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(sx(view, effect.x1), sy(view, effect.y1)); ctx.lineTo(sx(view, effect.x2), sy(view, effect.y2)); ctx.stroke();
    } else if (effect.kind === "slash") {
      ctx.strokeStyle = colors.shot;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx(view, effect.x2), sy(view, effect.y2), 4 + t * 4, 0, Math.PI); ctx.stroke();
    } else if (effect.kind === "shell") {
      const x = effect.x1 + (effect.x2 - effect.x1) * t;
      const y = effect.y1 + (effect.y2 - effect.y1) * t - Math.sin(t * Math.PI) * 4;
      ctx.fillStyle = "#fff2b0";
      ctx.beginPath(); ctx.arc(sx(view, x), sy(view, y), 2.6, 0, Math.PI * 2); ctx.fill();
    } else if (effect.kind === "boom" || effect.kind === "death" || effect.kind === "collapse") {
      const radius = (effect.radius ?? 2) * view.scale * (0.4 + t * 0.8);
      ctx.globalAlpha = (1 - t) * (effect.kind === "death" ? 0.6 : 0.85);
      ctx.fillStyle = effect.kind === "death" ? colors.light : "#ffb347";
      ctx.beginPath(); ctx.arc(sx(view, effect.x1), sy(view, effect.y1), radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawLabels(ctx, state, view) {
  ctx.save();
  ctx.font = "800 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const zone of STARK_RIFT_ZONES) {
    const x = sx(view, zone.x);
    const below = zone.y < STARK_RIFT_MAP_HEIGHT / 2 || zone.id === "home" ? -1 : 1;
    const y = sy(view, zone.y + (zone.id === "home" ? -zone.radius - 2.5 : zone.id === "enemy" ? zone.radius + 2.5 : below * (zone.radius + 2.5)));
    const label = zone.name;
    const width = ctx.measureText(label).width + 12;
    ctx.fillStyle = "#0b1110cc";
    roundRect(ctx, x - width / 2, y - 9, width, 18, 9);
    ctx.fill();
    const owner = starkRiftBaseAt(state, zone.id)?.side;
    ctx.fillStyle = owner ? STARK_RIFT_COLORS[owner].light : "#e8e2cf";
    ctx.fillText(label, x, y + 0.5);
  }
  ctx.restore();
}

function drawScrollHint(ctx, view) {
  if (!view.maxTop) return;
  const visible = view.height / view.scale;
  const trackHeight = view.height - 16;
  const thumb = Math.max(28, (visible / STARK_RIFT_MAP_HEIGHT) * trackHeight);
  const y = 8 + (view.top / view.maxTop) * (trackHeight - thumb);
  ctx.fillStyle = "#ffffff14";
  roundRect(ctx, view.width - 7, 8, 4, trackHeight, 2);
  ctx.fill();
  ctx.fillStyle = "#f2c55caa";
  roundRect(ctx, view.width - 7, y, 4, thumb, 2);
  ctx.fill();
}

export function drawStarkRift(ctx, state, view, ui) {
  drawGround(ctx, view);
  drawRoads(ctx, view);
  drawZones(ctx, state, view, ui);
  drawMines(ctx, state, view);
  drawWorkers(ctx, state, view, ui);
  drawBuildings(ctx, state, view);
  drawUnits(ctx, state, view, ui);
  drawEffects(ctx, state, view);
  drawSquadMarkers(ctx, state, view, ui);
  drawLabels(ctx, state, view);
  drawScrollHint(ctx, view);
}
