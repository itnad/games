import { CAST_NET_FLIGHT, CAST_NET_CLOSE, CAST_NET_FADE, castNetPhase } from "./mudflat-cast-net.js";

function netWarp(angle, seed, closing) {
  const looseness = 1 - closing * .58;
  return Math.sin(angle * 3 + seed * .41) * 2.4 * looseness
    + Math.cos(angle * 7 - seed * .23) * 1.45 * looseness;
}

function drawNetRing(context, radius, seed, closing, offset = 0) {
  const segments = 64;
  context.beginPath();
  for (let index = 0; index <= segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    const pulled = radius * (1 - closing * .08) + netWarp(angle + offset, seed, closing);
    const x = Math.cos(angle) * pulled;
    const y = Math.sin(angle) * pulled + Math.sin(angle * 2 + seed) * 1.1 * (1 - closing);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
}

function drawWeightedKnot(context, radius, angle, seed, closing) {
  const pulled = radius * (1 - closing * .08) + netWarp(angle, seed, closing);
  const x = Math.cos(angle) * pulled;
  const y = Math.sin(angle) * pulled;
  context.save();
  context.translate(x, y);
  context.rotate(angle + Math.PI / 2);
  context.fillStyle = "rgba(56,54,43,.56)";
  context.beginPath(); context.ellipse(0, 1.2, 3.4, 2.15, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = "rgba(245,229,185,.68)";
  context.beginPath(); context.ellipse(-.55, -.3, 1.1, .72, 0, 0, Math.PI * 2); context.fill();
  context.restore();
}

export function drawCastNetThrow(context, origin, target, net) {
  const phase = castNetPhase(net);
  if (phase === "ended") return;
  const flight = Math.min(1, net.age / CAST_NET_FLIGHT);
  const travel = 1 - (1 - flight) ** 2;
  const closing = Math.max(0, Math.min(1, (net.age - CAST_NET_FLIGHT - net.holdSeconds) / CAST_NET_CLOSE));
  const fade = phase === "fading" ? Math.max(0, (net.duration - net.age) / CAST_NET_FADE) : 1;
  const dx = target.x - origin.x, dy = target.y - origin.y;
  const lift = Math.sin(flight * Math.PI) * Math.min(76, Math.hypot(dx, dy) * .4);
  const x = origin.x + dx * travel, y = origin.y + dy * travel - lift;
  const radius = net.radius * (.28 + .72 * travel) * (phase === "fading" ? .6 + .4 * fade : 1);
  const tilt = .45 + .55 * flight;
  const seed = net.id * 1.719 + net.angle * .37;

  context.save();
  context.globalAlpha = Math.min(1, net.age * 12) * fade;
  // A faint landing shadow, not a luminous target marker.
  if (phase === "flight") {
    context.fillStyle = `rgba(38,50,43,${.05 + flight * .045})`;
    context.beginPath(); context.ellipse(target.x, target.y, net.radius * (.72 + flight * .18), net.radius * (.5 + flight * .18), net.angle, 0, Math.PI * 2); context.fill();
    context.strokeStyle = `rgba(102,91,66,${.44 * (1 - flight)})`;
    context.lineWidth = 1.2;
    context.beginPath(); context.moveTo(origin.x, origin.y - 6);
    context.quadraticCurveTo((origin.x + x) / 2, Math.min(origin.y, y) - 15, x, y); context.stroke();
    context.strokeStyle = `rgba(229,220,178,${.22 * (1 - flight)})`;
    for (let strand = -1; strand <= 1; strand += 1) {
      context.beginPath();
      context.moveTo(origin.x + strand * 3, origin.y - 8);
      context.quadraticCurveTo((origin.x + x) / 2 + strand * 8, Math.min(origin.y, y) - 22 - strand * 3, x - strand * 5, y + strand * 2);
      context.stroke();
    }
  }
  context.translate(x, y);
  context.scale(1, tilt);
  context.rotate(net.angle + (1 - flight) * -.7);
  context.lineCap = "round";

  context.fillStyle = "rgba(169,201,180,.055)";
  drawNetRing(context, radius, seed, closing);
  context.fill();

  context.save();
  drawNetRing(context, radius * 1.02, seed, closing);
  context.clip();
  const spacing = Math.max(8, radius / 5);
  for (const ring of [.33, .56, .78]) {
    context.strokeStyle = `rgba(224,235,210,${.12 + ring * .18})`;
    context.lineWidth = .65;
    drawNetRing(context, radius * ring * (1 - closing * .05), seed + ring * 9, closing, ring);
    context.stroke();
  }
  context.strokeStyle = "rgba(235,241,219,.34)";
  context.lineWidth = .72;
  for (let spoke = 0; spoke < 20; spoke += 1) {
    const angle = spoke / 20 * Math.PI * 2 + Math.sin(seed) * .035;
    const end = radius * (.91 + Math.sin(spoke * 1.7 + seed) * .035);
    const bend = Math.sin(spoke + seed) * 5.5 * (1 - closing * .35);
    context.beginPath();
    context.moveTo(Math.cos(angle) * radius * .07, Math.sin(angle) * radius * .07);
    context.quadraticCurveTo(Math.cos(angle + .23) * radius * .48 + bend, Math.sin(angle - .18) * radius * .48 - bend * .45,
      Math.cos(angle) * end, Math.sin(angle) * end);
    context.stroke();
  }
  for (const direction of [-1, 1]) {
    context.strokeStyle = direction === 1 ? "rgba(230,240,219,.58)" : "rgba(113,152,134,.42)";
    context.lineWidth = direction === 1 ? .82 : .68;
    for (let offset = -radius * 2; offset <= radius * 2; offset += spacing) {
      const bow = Math.sin(offset * .16 + seed) * 4.2 * (1 - closing * .35);
      context.beginPath(); context.moveTo(-radius * 1.08, offset - direction * radius + bow);
      context.quadraticCurveTo(closing * 7 + bow, offset * (1 - closing * .22), radius * 1.08, offset + direction * radius - bow); context.stroke();
    }
  }
  context.restore();

  context.strokeStyle = "rgba(31,39,32,.38)"; context.lineWidth = 4.4;
  drawNetRing(context, radius, seed, closing); context.stroke();
  context.strokeStyle = "rgba(248,234,190,.82)"; context.lineWidth = 2.05;
  drawNetRing(context, radius - 1.1, seed + 4, closing); context.stroke();
  context.strokeStyle = "rgba(131,116,82,.55)"; context.lineWidth = .9;
  drawNetRing(context, radius + 1.8, seed + 8, closing); context.stroke();

  const cinchRadius = radius * (1 - closing * .09);
  if (closing > 0 && phase !== "fading") {
    context.strokeStyle = `rgba(238,242,212,${closing * .78})`; context.lineWidth = 1.35;
    drawNetRing(context, cinchRadius, seed + 12, closing); context.stroke();
    context.strokeStyle = `rgba(90,78,53,${closing * .32})`; context.lineWidth = 2.4;
    context.beginPath(); context.arc(0, 0, radius * (.72 - closing * .08), 0, Math.PI * 2); context.stroke();
  }
  const knots = Math.max(16, Math.round(radius / 5.2));
  for (let index = 0; index < knots; index += 1) {
    drawWeightedKnot(context, cinchRadius, index / knots * Math.PI * 2, seed, closing);
  }
  context.restore();

  if (phase === "open" || phase === "closing") {
    // Local tension around the catch keeps the seafood readable under the mesh.
    context.save(); context.lineWidth = 1; context.strokeStyle = "rgba(228,239,212,.66)";
    for (const point of net.caughtPoints.slice(0, 8)) {
      const px = target.x + point.x - net.x, py = target.y + point.y - net.y;
      const twitch = Math.sin(net.age * 18 + point.id) * 1.4;
      context.beginPath(); context.moveTo(px - 9, py + 4);
      context.quadraticCurveTo(px + twitch, py - 9, px + 9, py + 4); context.stroke();
      context.strokeStyle = "rgba(96,116,91,.34)";
      context.beginPath(); context.moveTo(px - 12, py - 2);
      context.quadraticCurveTo(px - twitch * .5, py + 8, px + 11, py - 1); context.stroke();
      context.strokeStyle = "rgba(228,239,212,.66)";
    }
    context.restore();
  }
}
