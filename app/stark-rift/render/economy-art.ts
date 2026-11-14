import type { Graphics } from "pixi.js";
import type { RenderEntity } from "../worker/render-snapshot";
import { economyDefinition } from "../data/economy-catalog";
const keys = new WeakMap<Graphics, string>();
/** Vector silhouettes are minimum gameplay art, distinct from the final stage-9 art pass. */
export function updateEconomicMarker(
  g: Graphics,
  e: RenderEntity,
  color: number,
  ring: number | null,
  progress: number | null,
  started = true,
): boolean {
  const d = economyDefinition(e.definitionId);
  if (!d) return false;
  const hp = Math.floor((e.health / d.health) * 10),
    sp = Math.floor(((e.shield ?? 0) / Math.max(1, d.shield)) * 10),
    p = progress === null ? -1 : Math.floor(progress * 20),
    key = [d.id, color, ring, hp, sp, p, started, e.burrowed, e.cloaked, e.auraCloaked, !!e.stasisTicks, !!e.recallTicks, e.unitMorph ? Math.floor(20 * (1 - e.unitMorph.remainingTicks / e.unitMorph.totalTicks)) : -1, Math.floor((e.energy ?? 0) / 10), e.siegeTransition ? Math.floor(20 * (1 - e.siegeTransition.remainingTicks / e.siegeTransition.totalTicks)) : -1].join(":");
  if (keys.get(g) === key) return true;
  keys.set(g, key);
  g.clear();
  g.alpha = e.cloaked ? 0.48 : started ? 1 : 0.42;
  const w = d.width,
    h = d.height,
    terr = d.faction === "terran",
    zerg = d.faction === "zerg";
  if (e.burrowed) {
    const r = Math.max(0.3, e.radius / 256);
    g.ellipse(0, 0.08, r * 1.2, r * 0.55).fill(0x362a38).stroke({ color: 0xae876e, width: 0.05 });
    g.ellipse(0, 0, r * 0.85, r * 0.3).fill(0x604553).stroke({ color, width: 0.045 });
    if (ring !== null) g.ellipse(0, 0.08, r * 1.5, r * 0.8).stroke({ color: ring, width: 0.055 });
    return true;
  }
  if (d.kind === "building") {
    g.ellipse(0.12, 0.22, w * 0.55, h * 0.48).fill({
      color: 0x030911,
      alpha: 0.7,
    });
    if (terr) {
      g.poly([
        -w / 2 + 0.15,
        -h / 2,
        w / 2 - 0.15,
        -h / 2,
        w / 2,
        -h / 2 + 0.3,
        w / 2,
        h / 2 - 0.15,
        w / 2 - 0.2,
        h / 2,
        -w / 2 + 0.2,
        h / 2,
        -w / 2,
        h / 2 - 0.2,
        -w / 2,
        -h / 2 + 0.3,
      ])
        .fill(0x182d39)
        .stroke({ color: 0x77939b, width: 0.07 });
      g.rect(-w / 2 + 0.22, -h / 2 + 0.2, w - 0.44, h - 0.4).fill(0x3a505a);
      for (let x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.5)
        g.rect(x, h / 2 - 0.24, 0.22, 0.12).fill(0xe4a73e);
      if (d.headquarters) {
        g.poly([
          -1, -0.65, -0.6, -1.05, 0.65, -1.05, 1.1, -0.5, 1.1, 0.65, -0.8, 0.65,
          -1, 0.2,
        ])
          .fill(0x67808a)
          .stroke({ color: 0xabc1c5, width: 0.06 });
        g.rect(-0.6, -0.6, 1.2, 0.65).fill(0x1b3f4e);
        g.rect(-0.45, -0.52, 0.9, 0.2).fill(color);
        g.rect(-0.5, 0.3, 1, 0.7).fill(0x1a2833);
        g.rect(-0.28, 0.45, 0.56, 0.45).fill(0x76dfe7);
        g.circle(1.25, -0.75, 0.34)
          .fill(0x253c47)
          .stroke({ color: color, width: 0.09 });
        g.moveTo(1.25, -1.45)
          .lineTo(1.25, -0.8)
          .stroke({ color: 0xb4d2d8, width: 0.07 });
      } else if (d.icon === "supply") {
        for (const x of [-0.55, 0.2])
          g.roundRect(x, -0.5, 0.5, 0.95, 0.1)
            .fill(0x77919a)
            .stroke({ color: 0x28424f, width: 0.05 });
        g.rect(-0.75, 0.52, 1.5, 0.12).fill(color);
      } else if (d.icon === "military") {
        g.rect(-w * 0.3, -h * 0.3, w * 0.6, h * 0.55).fill(0x6f858e);
        g.rect(-w * 0.24, h * 0.05, w * 0.48, h * 0.38).fill(0x12232e);
        for (let x = -w * 0.2; x < w * 0.2; x += 0.25)
          g.rect(x, h * 0.1, 0.11, h * 0.25).fill(0x465f6d);
        g.rect(-w * 0.2, -h * 0.2, w * 0.4, 0.15).fill(color);
        if (d.id === "terran-factory")
          g.circle(w * 0.27, -h * 0.22, 0.35)
            .fill(0x122b36)
            .stroke({ color: 0xe5a24d, width: 0.12 });
      } else if (d.gasBuilding) {
        for (const x of [-0.7, 0, 0.7])
          g.circle(x, 0, 0.35)
            .fill(0x284a4b)
            .stroke({ color: 0x9eb5b2, width: 0.09 });
        g.rect(-1.25, -0.24, 2.5, 0.28).fill(0x80d785);
      } else {
        g.rect(-w * 0.28, -h * 0.3, w * 0.56, h * 0.6).fill(0x7c959e);
        g.poly([-0.55, 0.1, 0, -0.6, 0.55, 0.1, 0, 0.5]).fill(color);
      }
    } else if (zerg) {
      g.ellipse(0, 0.1, w * 0.5, h * 0.49)
        .fill(0x3d203b)
        .stroke({ color: 0xb27b79, width: 0.08 });
      for (let i = 0; i < 5; i++) {
        const angle = i * 1.25,
          x = Math.cos(angle) * w * 0.35,
          y = Math.sin(angle) * h * 0.34;
        g.ellipse(x, y, 0.25, 0.3)
          .fill(0x875569)
          .stroke({ color: 0xb6858c, width: 0.05 });
      }
      if (d.headquarters) {
        g.poly([
          -1, 0.3, -0.6, -0.7, -0.15, -1, 0.2, -0.6, 0.65, -0.9, 1, 0.25, 0.6,
          0.65, -0.7, 0.7,
        ])
          .fill(0x9e687d)
          .stroke({ color: 0xc89b9c, width: 0.07 });
        g.ellipse(0, 0.15, 0.7, 0.4).fill(0x261b32);
        g.ellipse(0, 0.1, 0.45, 0.23).fill(0xc99c76);
        g.circle(-0.32, -0.25, 0.15).fill(color);
        g.circle(0.38, -0.25, 0.13).fill(color);
      } else if (d.id === "zerg-spawning-pool" || d.gasBuilding) {
        g.ellipse(0, 0, w * 0.31, h * 0.29)
          .fill(0x152f2a)
          .stroke({ color: 0x90ba79, width: 0.09 });
        g.ellipse(-0.1, -0.1, w * 0.24, h * 0.2).fill(0x6da270);
        g.circle(0.3, 0.1, 0.16).fill(0xb4d998);
      } else {
        g.poly([-0.5, 0.5, -0.35, -0.5, 0, -0.9, 0.3, -0.5, 0.5, 0.5])
          .fill(0xa27683)
          .stroke({ color: 0xcba5a3, width: 0.06 });
        g.ellipse(0, 0, 0.25, 0.4).fill(color);
      }
    } else {
      g.poly([
        -w * 0.5,
        0,
        -w * 0.3,
        -h * 0.4,
        w * 0.28,
        -h * 0.4,
        w * 0.5,
        0,
        w * 0.32,
        h * 0.4,
        -w * 0.32,
        h * 0.4,
      ])
        .fill(0x755b2f)
        .stroke({ color: 0xe2c88b, width: 0.09 });
      g.poly([
        -w * 0.36,
        -0.05,
        -w * 0.22,
        -h * 0.29,
        w * 0.2,
        -h * 0.29,
        w * 0.36,
        -0.05,
        w * 0.2,
        h * 0.29,
        -w * 0.22,
        h * 0.29,
      ]).fill(0x253b47);
      if (d.headquarters) {
        for (const x of [-1.15, 1.15])
          g.poly([
            x - 0.3,
            0.45,
            x - 0.18,
            -0.6,
            x,
            -0.95,
            x + 0.22,
            -0.6,
            x + 0.3,
            0.45,
          ]).fill(0xe1c67e);
        g.poly([-0.6, 0.25, 0, -1.05, 0.6, 0.25, 0, 0.85])
          .fill(0x70c6dc)
          .stroke({ color: 0xdaffff, width: 0.06 });
        g.poly([0, -1.05, 0, 0.85, 0.6, 0.25]).fill(0x2988b0);
      } else if (d.id === "protoss-pylon") {
        g.poly([-0.4, 0, 0, -0.85, 0.4, 0, 0, 0.75])
          .fill(0x73e4f0)
          .stroke({ color: 0xd3feff, width: 0.06 });
        g.poly([0, -0.85, 0.4, 0, 0, 0.75]).fill(0x2683c5);
      } else if (d.icon === "military") {
        g.poly([
          -0.8, 0.6, -0.75, -0.7, -0.4, -0.95, -0.3, 0.4, 0.3, 0.4, 0.4, -0.95,
          0.75, -0.7, 0.8, 0.6,
        ])
          .fill(0xcdb37c)
          .stroke({ color: 0xf5db98, width: 0.05 });
        g.ellipse(0, 0, 0.28, 0.55).fill(color);
      } else {
        g.circle(0, 0, 0.48)
          .fill(0x285a75)
          .stroke({ color: 0xd9c18c, width: 0.14 });
        g.poly([-0.35, 0, 0, -0.5, 0.35, 0, 0, 0.45]).fill(color);
      }
    }
    if (ring !== null)
      g.rect(-w / 2 - 0.12, -h / 2 - 0.12, w + 0.24, h + 0.24).stroke({
        color: ring,
        width: 0.065,
      });
    if (p >= 0) {
      g.rect(-w / 2, h / 2 + 0.2, w, 0.12).fill(0x091521);
      g.rect(-w / 2, h / 2 + 0.2, (w * p) / 20, 0.12).fill(0xf2bf69);
    }
  } else {
    g.ellipse(0.06, 0.15, 0.36, 0.2).fill({ color: 0x030810, alpha: 0.7 });
    if (d.icon === "transport") {
      g.ellipse(0, 0.12, .8, .38).fill({ color: 0x030810, alpha: .6 });
      g.poly([-.35,-.72,.35,-.72,.48,.55,0,.8,-.48,.55]).fill(terr ? 0x6b858d : 0xd4ba78).stroke({color:terr?0xa8c3c9:0xffe4a8,width:.06});
      for (const sign of [-1,1]) g.poly([sign*.32,-.3,sign*.9,-.1,sign*.85,.45,sign*.32,.3]).fill(terr?0x405965:0xa58b60).stroke({color,width:.07});
      g.ellipse(0,-.38,.2,.24).fill(color);g.rect(-.2,.1,.4,.4).fill(0x253542);
    } else if (d.icon === "detector") {
      g.ellipse(0,0,.55,.3).fill(0xcbb778).stroke({color:0xffe3a2,width:.06});
      g.circle(0,0,.22).fill(color).stroke({color:0xd4faff,width:.05});
      for (const sign of [-1,1]) g.moveTo(sign*.4,0).lineTo(sign*.7,-.35).stroke({color:0xdcc99c,width:.08});
    } else if (d.id === "protoss-dark-templar") {
      g.poly([-.36,.35,-.2,-.4,0,-.6,.2,-.4,.36,.35,0,.55]).fill(0x584d7d).stroke({color:0xb49de0,width:.05});
      g.circle(0,-.28,.12).fill(color);g.moveTo(.15,.1).lineTo(.6,-.55).stroke({color:0x9df6bc,width:.1});
    } else if (terr && d.kind === "worker") {
      g.rect(-0.3, -0.21, 0.6, 0.43)
        .fill(0x889d9f)
        .stroke({ color: 0xd9c38b, width: 0.06 });
      g.rect(-0.14, -0.28, 0.28, 0.24).fill(color);
      for (const x of [-0.4, 0.26]) g.rect(x, -0.12, 0.14, 0.47).fill(0xd0a34e);
    } else if (d.id === "terran-siege-tank-siege-mode") {
      for (const x of [-0.65, 0.5]) g.rect(x, -0.3, 0.15, 0.65).fill(0xa7a17f).stroke({ color: 0xe9d795, width: 0.04 });
      g.rect(-0.45, -0.28, 0.9, 0.57).fill(0x55717c).stroke({ color: 0xb1c6c9, width: 0.05 });
      g.rect(-0.28, -0.22, 0.56, 0.4).fill(color);
      g.rect(-0.09, -1.05, 0.18, 1.12).fill(0xbbc5ae);
      g.rect(-0.17, -1.1, 0.34, 0.14).fill(0x3c4a50);
    } else if (terr && d.icon === "vehicle") {
      g.rect(-0.45, -0.22, 0.9, 0.45).fill(0x3e5660);
      g.rect(-0.3, -0.3, 0.6, 0.15).fill(0x91a7a8);
      g.rect(-0.1, -0.12, 0.2, 0.6).fill(color);
    } else if (d.id === "terran-wraith") {
      g.poly([-0.72, 0.4, -0.48, -0.05, -0.22, -0.12, 0, -0.7, 0.22, -0.12, 0.48, -0.05, 0.72, 0.4, 0.2, 0.23, 0, 0.4, -0.2, 0.23]).fill(0x718b9a).stroke({ color: 0xc1d7df, width: 0.04 });
      g.poly([-0.1, 0.1, 0, -0.45, 0.1, 0.1]).fill(color);
      for (const x of [-0.45, 0.45]) g.rect(x - 0.06, 0.18, 0.12, 0.24).fill(0x7edce8);
    } else if (d.id === "terran-ghost") {
      g.circle(0, -0.2, 0.12).fill(0xb0c8d0);
      g.poly([-0.15, -0.08, 0.15, -0.08, 0.2, 0.32, -0.2, 0.32]).fill(0x73969e).stroke({ color, width: 0.05 });
      g.rect(0.12, -0.05, 0.07, 0.65).fill(0xc5d8dc);
    } else if (terr) {
      g.circle(0, -0.18, 0.17).fill(0xa7b3ae);
      g.roundRect(-0.23, -0.1, 0.46, 0.45, 0.1).fill(color);
      g.rect(0.15, -0.1, 0.15, 0.5).fill(0x152933);
    } else if (d.id === "protoss-arbiter") {
      g.poly([-.95, .3, -.45, -.2, -.2, -.65, 0, -.45, .2, -.65, .45, -.2, .95, .3, .45, .16, .2, .45, -.2, .45, -.45, .16]).fill(0xd1bc78).stroke({ color: 0xf1dfab, width: .06 });
      g.ellipse(0, -.04, .23, .4).fill(0x7757ab).stroke({ color, width: .05 });
      g.circle(0, -.08, .11).fill(0xc5b9ff);
    } else if (d.id === "zerg-lurker-egg") {
      g.ellipse(0, 0, .43, .58).fill(0x8d627e).stroke({ color: 0xd6b494, width: .06 });
      for (const y of [-.3, -.05, .2]) g.ellipse(0, y, .35, .13).stroke({ color, width: .07 });
    } else if (d.id === "zerg-lurker") {
      for (const x of [-.6, .6]) for (const y of [-.3, .15, .45]) g.moveTo(x * .4, y * .4).lineTo(x, y).lineTo(x * 1.15, y + .2).stroke({ color: 0xe6bb96, width: .08 });
      g.ellipse(0, 0, .38, .47).fill(0x805265).stroke({ color, width: .07 });
      g.poly([-.25, -.1, 0, -.65, .25, -.1]).fill(0xe6bb96);
    } else if (zerg && d.icon === "airSupply") {
      g.ellipse(0, 0, 0.7, 0.5).fill(0x9d797e);
      for (const x of [-0.4, 0, 0.4])
        g.moveTo(x, 0.3)
          .lineTo(x + 0.1, 0.8)
          .stroke({ color: 0xb8948c, width: 0.1 });
      g.ellipse(0, -0.08, 0.45, 0.28).fill(0x695074);
      g.circle(0.3, 0, 0.09).fill(color);
    } else if (zerg) {
      g.ellipse(0, 0, 0.28, d.kind === "worker" ? 0.23 : 0.4)
        .fill(0x997484)
        .stroke({ color: 0xc59d93, width: 0.06 });
      for (const sign of [-1, 1])
        for (let y = -0.2; y < 0.3; y += 0.2)
          g.moveTo(sign * 0.2, y)
            .lineTo(sign * 0.43, y + 0.15)
            .stroke({ color: 0xc9b19b, width: 0.07 });
      g.circle(0, -0.2, 0.1).fill(color);
    } else if (d.kind === "worker") {
      g.poly([
        -0.37, 0.18, -0.25, -0.15, 0, -0.35, 0.25, -0.15, 0.37, 0.18, 0, 0.3,
      ])
        .fill(0xd5bd86)
        .stroke({ color: 0xf7e0ac, width: 0.06 });
      g.poly([-0.13, 0, 0, -0.2, 0.13, 0, 0, 0.16]).fill(color);
    } else {
      g.poly([
        -0.28, 0.3, -0.35, -0.12, 0, -0.4, 0.35, -0.12, 0.28, 0.3, 0, 0.45,
      ])
        .fill(0xc9ab6c)
        .stroke({ color: 0xf2da9d, width: 0.05 });
      g.circle(0, -0.12, 0.13).fill(color);
      if (d.icon === "infantry")
        for (const sign of [-1, 1])
          g.moveTo(sign * 0.26, 0)
            .lineTo(sign * 0.45, -0.4)
            .stroke({ color: 0x97ecff, width: 0.09 });
    }
    if (ring !== null)
      g.ellipse(
        0,
        0.05,
        Math.max(0.4, e.radius / 256 + 0.08),
        Math.max(0.32, e.radius / 256),
      ).stroke({ color: ring, width: 0.06 });
  }
  if (hp < 10 || ring !== null) {
    const width = d.kind === "building" ? w : 1;
    g.rect(-width / 2, -h / 2 - 0.26, width, 0.08).fill(0x172327);
    g.rect(
      -width / 2,
      -h / 2 - 0.26,
      (width * Math.max(0, hp)) / 10,
      0.08,
    ).fill(0x8bd88b);
  }
  if (d.shield > 0 && (sp < 10 || ring !== null)) {
    const width = d.kind === "building" ? w : 1;
    g.rect(-width / 2, -h / 2 - 0.39, width, 0.08).fill(0x172327);
    g.rect(
      -width / 2,
      -h / 2 - 0.39,
      (width * Math.max(0, sp)) / 10,
      0.08,
    ).fill(0x7ebdff);
  }
  if (e.stasisTicks) g.poly([-.65, -.2, -.3, -.95, .38, -.85, .7, -.1, .42, .75, -.45, .7]).fill({ color: 0x8dc9f4, alpha: .65 }).stroke({ color: 0xd8f5ff, width: .08 });
  if (e.recallTicks) g.circle(0,0,1).stroke({ color: 0xf0d69e, width: .08 });
  if (e.auraCloaked) g.ellipse(0, 0, Math.max(.4, e.radius / 256) * 1.25, Math.max(.3, e.radius / 256) * .85).stroke({ color: 0xc6a1ff, width: .05, alpha: .8 });
  if (e.unitMorph) {
    g.rect(-.45, .68, .9, .08).fill(0x352b42);
    g.rect(-.45, .68, .9 * (1 - e.unitMorph.remainingTicks / e.unitMorph.totalTicks), .08).fill(0xe5bd85);
  }
  if (e.siegeTransition) {
    const progress = 1 - e.siegeTransition.remainingTicks / e.siegeTransition.totalTicks;
    g.circle(0, 0, 0.75).stroke({ color: 0xffca75, width: 0.06, alpha: 0.65 });
    g.rect(-0.5, 0.55, 1, 0.08).fill(0x253642); g.rect(-0.5, 0.55, progress, 0.08).fill(0xffca75);
  }
  if (e.energy !== undefined) {
    const width = 1;
    g.rect(-width / 2, -h / 2 - 0.42, width, 0.08).fill(0x172327);
    g.rect(-width / 2, -h / 2 - 0.42, width * e.energy / (e.maxEnergy ?? 200), 0.08).fill(0xc28cff);
  }
  return true;
}
export function drawResource(g: Graphics, kind: "mineral" | "gas"): void {
  g.clear();
  if (kind === "mineral") {
    g.ellipse(0, 0.3, 0.6, 0.22).fill(0x15333f);
    for (const [x, y, h] of [
      [-0.33, 0.1, 0.65],
      [0.04, 0.18, 0.9],
      [0.4, 0.26, 0.62],
    ]) {
      g.poly([
        x - 0.21,
        y,
        x - 0.12,
        y - h * 0.75,
        x + 0.03,
        y - h,
        x + 0.2,
        y - h * 0.7,
        x + 0.19,
        y,
        x,
        y + 0.14,
      ])
        .fill(0x4ea8d1)
        .stroke({ color: 0x9be8ee, width: 0.04 });
      g.poly([
        x + 0.03,
        y - h,
        x + 0.2,
        y - h * 0.7,
        x + 0.19,
        y,
        x,
        y + 0.14,
      ]).fill(0x27739c);
    }
  } else {
    g.poly([
      -0.6, 0.2, -0.4, -0.35, 0.1, -0.45, 0.6, -0.1, 0.55, 0.4, -0.1, 0.55,
    ])
      .fill(0x556450)
      .stroke({ color: 0x91a373, width: 0.06 });
    g.ellipse(0, 0.08, 0.35, 0.22).fill(0x133f30);
    g.circle(0, -0.15, 0.24).fill({ color: 0x85c975, alpha: 0.6 });
    g.circle(0.1, -0.45, 0.15).fill({ color: 0xb9e38e, alpha: 0.35 });
  }
}
