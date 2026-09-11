const TAU = Math.PI * 2;
export const HARVEST_PULSE_SECONDS = .42;

// Shared positions keep the rendered crystals on their real collection path.
export function saltSpiritPose(elapsed, level, index) {
  const count = 1 + Math.floor(level / 2);
  const angle = elapsed * (1.8 + level * .08) + index / count * TAU;
  const radius = 66 + level * 3;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle, radius };
}

export function harvestPulseFrame(life, radius) {
  const progress = Math.max(0, Math.min(1, 1 - life / HARVEST_PULSE_SECONDS));
  return {
    progress,
    opacity: Math.max(0, Math.min(1, life / .12)),
    waveRadius: radius * (.24 + .76 * (1 - Math.pow(1 - progress, 3))),
  };
}

function glint(context, x, y, size, opacity, color) {
  context.save(); context.globalAlpha *= opacity;
  context.strokeStyle = color; context.lineWidth = 1.1;
  context.beginPath(); context.moveTo(x - size, y); context.lineTo(x + size, y);
  context.moveTo(x, y - size); context.lineTo(x, y + size); context.stroke();
  context.restore();
}

// A complete ground-level wave with a soft crest and sand motes, never a
// broken weapon arc. Keep the center transparent so nearby catches stay legible.
export function drawHarvestPulse(context, x, y, radius, life, elapsed) {
  if (life <= 0) return;
  const { progress, opacity, waveRadius } = harvestPulseFrame(life, radius);
  context.save(); context.translate(x, y); context.globalAlpha = opacity;
  const wash = context.createRadialGradient(0, 0, 8, 0, 0, radius);
  wash.addColorStop(0, "rgba(255,237,169,0)");
  wash.addColorStop(.35, `rgba(255,225,140,${(1 - progress) * .10})`);
  wash.addColorStop(.9, `rgba(255,228,151,${(1 - progress) * .19})`);
  wash.addColorStop(1, "rgba(255,231,171,0)");
  context.fillStyle = wash; context.beginPath(); context.arc(0, 0, radius, 0, TAU); context.fill();

  const crest = context.createRadialGradient(0, 0, Math.max(0, waveRadius - 17), 0, 0, waveRadius + 5);
  crest.addColorStop(0, "rgba(247,190,83,0)");
  crest.addColorStop(.55, "rgba(255,220,133,.14)");
  crest.addColorStop(.78, "rgba(255,249,210,.65)");
  crest.addColorStop(.9, "rgba(255,224,146,.32)");
  crest.addColorStop(1, "rgba(255,227,161,0)");
  context.fillStyle = crest; context.beginPath(); context.arc(0, 0, waveRadius + 5, 0, TAU); context.fill();

  // Fixed seeds avoid random flicker or per-frame particle allocations.
  for (let index = 0; index < 24; index += 1) {
    const seed = ((index * 17) % 23) / 23;
    const angle = index / 24 * TAU + Math.sin(index * 2.4) * .08;
    const distance = radius * (.2 + (.49 + seed * .3) * (1 - Math.pow(1 - progress, 2)));
    const px = Math.cos(angle) * distance;
    const py = Math.sin(angle) * distance - Math.sin(progress * Math.PI) * (4 + seed * 8);
    context.strokeStyle = `rgba(255,223,150,${(1 - progress) * .35})`;
    context.lineWidth = 1.4;
    context.beginPath(); context.moveTo(px - Math.cos(angle) * 7, py - Math.sin(angle) * 7); context.lineTo(px, py); context.stroke();
    context.fillStyle = index % 3 ? "#f6d792" : "#fffbe6";
    context.beginPath(); context.arc(px, py, 1.1 + seed * 1.4, 0, TAU); context.fill();
    if (index % 6 === 0) glint(context, px, py, 3 + Math.sin(elapsed * 8 + index), 1 - progress, "#fffbe6");
  }
  context.restore();
}

function crystalFacet(context, points, color) {
  context.fillStyle = color; context.beginPath();
  points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
  context.closePath(); context.fill();
}

export function drawSaltSpirit(context, x, y, elapsed, level, index) {
  const pose = saltSpiritPose(elapsed, level, index);
  context.save(); context.translate(x, y);
  // Short, fading orbital motes show movement without drawing a permanent ring.
  for (let trail = 7; trail >= 1; trail -= 1) {
    const past = saltSpiritPose(elapsed - trail * .025, level, index);
    context.fillStyle = `rgba(154,228,255,${(1 - trail / 8) * .26})`;
    context.beginPath(); context.arc(past.x, past.y, 1.2 + (8 - trail) * .35, 0, TAU); context.fill();
  }
  context.translate(pose.x, pose.y);
  const shimmer = .88 + Math.sin(elapsed * 3.5 + index * 2) * .12;
  const halo = context.createRadialGradient(0, 0, 2, 0, 0, 24);
  halo.addColorStop(0, `rgba(221,252,255,${.34 * shimmer})`);
  halo.addColorStop(.45, "rgba(134,214,255,.15)"); halo.addColorStop(1, "rgba(127,209,255,0)");
  context.fillStyle = halo; context.beginPath(); context.arc(0, 0, 24, 0, TAU); context.fill();
  context.save(); context.rotate(Math.sin(elapsed * 2 + index) * .13);
  // A pearly, three-dimensional salt cube: distinct lit, cool, and glass faces.
  crystalFacet(context, [[0, -12], [10, -6], [0, 0], [-10, -6]], "#f1feff");
  const left = context.createLinearGradient(-10, -6, 0, 12);
  left.addColorStop(0, "#d6faff"); left.addColorStop(1, "#82c9e4");
  crystalFacet(context, [[-10, -6], [0, 0], [0, 12], [-10, 6]], left);
  const right = context.createLinearGradient(0, 0, 10, 10);
  right.addColorStop(0, "#a4e5f7"); right.addColorStop(1, "#709ac9");
  crystalFacet(context, [[0, 0], [10, -6], [10, 6], [0, 12]], right);
  context.strokeStyle = "rgba(238,255,255,.92)"; context.lineWidth = 1.15; context.lineJoin = "round";
  context.beginPath(); context.moveTo(0, -12); context.lineTo(10, -6); context.lineTo(10, 6); context.lineTo(0, 12);
  context.lineTo(-10, 6); context.lineTo(-10, -6); context.closePath(); context.stroke();
  context.strokeStyle = "rgba(255,255,255,.64)"; context.lineWidth = .8;
  context.beginPath(); context.moveTo(-10, -6); context.lineTo(0, 0); context.lineTo(10, -6);
  context.moveTo(0, 0); context.lineTo(0, 12); context.stroke();
  // Tiny eyes give the crystal a spirit-like personality while preserving its silhouette.
  context.fillStyle = "#375f85";
  context.beginPath(); context.ellipse(-4, 2.5, .85, 1.3, -.15, 0, TAU); context.ellipse(3.5, 3, .85, 1.3, .15, 0, TAU); context.fill();
  glint(context, -4, -8, 3.1, shimmer, "#ffffff");
  context.restore();
  for (let mote = 0; mote < 3; mote += 1) {
    const angle = elapsed * .9 + index * 2 + mote / 3 * TAU;
    glint(context, Math.cos(angle) * 17, Math.sin(angle) * 17, 1.7, .35 + .25 * Math.sin(elapsed * 3 + mote), "#d9f9ff");
  }
  context.restore();
}
