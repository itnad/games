import { CAST_NET_FLIGHT, CAST_NET_CLOSE, CAST_NET_FADE, castNetPhase } from "./mudflat-cast-net.js";

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

  context.save();
  context.globalAlpha = Math.min(1, net.age * 12) * fade;
  // A faint landing shadow, not a luminous target marker.
  if (phase === "flight") {
    context.fillStyle = "rgba(38,50,43,.09)";
    context.beginPath(); context.ellipse(target.x, target.y, net.radius * .9, net.radius * .9, 0, 0, Math.PI * 2); context.fill();
    context.strokeStyle = `rgba(102,91,66,${.45 * (1 - flight)})`;
    context.lineWidth = 1.2;
    context.beginPath(); context.moveTo(origin.x, origin.y - 6);
    context.quadraticCurveTo((origin.x + x) / 2, Math.min(origin.y, y) - 15, x, y); context.stroke();
  }
  context.translate(x, y);
  context.scale(1, tilt);
  context.rotate(net.angle + (1 - flight) * -.7);
  context.lineCap = "round";
  context.fillStyle = "rgba(169,201,180,.055)";
  context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.fill();
  context.save();
  context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.clip();
  const spacing = Math.max(8, radius / 5);
  for (const direction of [-1, 1]) {
    context.strokeStyle = direction === 1 ? "rgba(225,237,215,.54)" : "rgba(107,146,130,.48)";
    context.lineWidth = .85;
    for (let offset = -radius * 2; offset <= radius * 2; offset += spacing) {
      context.beginPath(); context.moveTo(-radius, offset - direction * radius);
      context.quadraticCurveTo(closing * 5, offset * (1 - closing * .22), radius, offset + direction * radius); context.stroke();
    }
  }
  context.restore();
  context.strokeStyle = "rgba(46,60,49,.42)"; context.lineWidth = 3.4;
  context.beginPath(); context.arc(0, 1, radius, 0, Math.PI * 2); context.stroke();
  context.strokeStyle = "rgba(223,218,184,.92)"; context.lineWidth = 1.7;
  context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.stroke();
  const cinchRadius = radius * (1 - closing * .09);
  if (closing > 0 && phase !== "fading") {
    context.strokeStyle = `rgba(229,235,207,${closing * .7})`; context.lineWidth = 1.15;
    context.beginPath(); context.arc(0, 0, cinchRadius, 0, Math.PI * 2); context.stroke();
  }
  for (let index = 0; index < 14; index++) {
    const angle = index / 14 * Math.PI * 2;
    const knotX = Math.cos(angle) * cinchRadius, knotY = Math.sin(angle) * cinchRadius;
    context.fillStyle = "#786e58"; context.beginPath(); context.ellipse(knotX, knotY, 2.5, 1.8, angle, 0, Math.PI * 2); context.fill();
    context.fillStyle = "rgba(245,228,184,.7)"; context.beginPath(); context.arc(knotX - .5, knotY - .5, .8, 0, Math.PI * 2); context.fill();
  }
  context.restore();

  if (phase === "open" || phase === "closing") {
    // Local tension around the catch keeps the seafood readable under the mesh.
    context.save(); context.lineWidth = 1; context.strokeStyle = "rgba(223,237,208,.64)";
    for (const point of net.caughtPoints.slice(0, 8)) {
      const px = target.x + point.x - net.x, py = target.y + point.y - net.y;
      const twitch = Math.sin(net.age * 18 + point.id) * 1.4;
      context.beginPath(); context.moveTo(px - 9, py + 4);
      context.quadraticCurveTo(px + twitch, py - 9, px + 9, py + 4); context.stroke();
    }
    context.restore();
  }
}
