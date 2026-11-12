import { isEmbarked } from "../abilities/special-state";
import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import type { CommandFailureCode } from "../core/commands";
import {
  economyDefinition,
  type EconomyDefinition,
} from "../data/economy-catalog";
import { circleRect, tileWalkable } from "./footprints";
import {
  buildingRect,
  complete,
  definitionOf,
  indexOf,
  localVisibility,
  meetsRequirements,
  psiPower,
  structureOf,
} from "./helpers";
export type Placement = {
  tileX: number;
  tileY: number;
  geyserId: string | null;
  addonParentId: number | null;
};
export function placementAt(
  s: SimulationState,
  map: BattleMap,
  actor: number,
  d: EconomyDefinition,
  x: number,
  y: number,
): Placement {
  let tileX = Math.floor(x / 256) - Math.floor(d.width / 2),
    tileY = Math.floor(y / 256) - Math.floor(d.height / 2),
    geyserId: string | null = null,
    addonParentId: number | null = null;
  if (d.gasBuilding) {
    const gas = map.resourceNodes
      .filter(
        (n) =>
          n.kind === "gas" &&
          (n.x * 256 + 128 - x) ** 2 + (n.y * 256 + 128 - y) ** 2 <= 768 ** 2,
      )
      .sort(
        (a, b) =>
          (a.x * 256 + 128 - x) ** 2 +
            (a.y * 256 + 128 - y) ** 2 -
            (b.x * 256 + 128 - x) ** 2 -
            (b.y * 256 + 128 - y) ** 2 || a.id.localeCompare(b.id),
      )[0];
    if (gas) {
      tileX = gas.x - Math.floor(d.width / 2);
      tileY = gas.y - Math.floor(d.height / 2);
      geyserId = gas.id;
    }
  }
  if (d.addonParent) {
    const b = structureOf(s, actor);
    if (b) {
      tileX = b.tileX + b.width;
      tileY = b.tileY + b.height - d.height;
      addonParentId = b.entityId;
    }
  }
  return { tileX, tileY, geyserId, addonParentId };
}
export function placementFailure(
  s: SimulationState,
  map: BattleMap,
  owner: number,
  actor: number,
  d: EconomyDefinition,
  p: Placement,
  ignore = 0,
  ignoreUnits = false,
): CommandFailureCode | null {
  if (d.kind !== "building" || s.players[owner]?.faction !== d.faction)
    return "invalid_target";
  if (!meetsRequirements(s, owner, d)) return "missing_prerequisite";
  const rect = {
      x: p.tileX * 256,
      y: p.tileY * 256,
      width: d.width * 256,
      height: d.height * 256,
    },
    visibility = localVisibility(s, map, owner),
    creep = new Set(s.economy.creepCells);
  if (
    p.tileX < 0 ||
    p.tileY < 0 ||
    p.tileX + d.width > map.widthTiles ||
    p.tileY + d.height > map.heightTiles
  )
    return "out_of_range";
  if (d.gasBuilding && !p.geyserId) return "invalid_target";
  if (
    d.addonParent &&
    (!p.addonParentId ||
      !complete(structureOf(s, p.addonParentId)!) ||
      s.economy.structures.some(
        (b) => b.entityId !== ignore && b.addonParentId === p.addonParentId,
      ))
  )
    return "missing_prerequisite";
  for (let y = p.tileY; y < p.tileY + d.height; y++)
    for (let x = p.tileX; x < p.tileX + d.width; x++) {
      const cell = y * map.widthTiles + x,
        node = map.resourceNodes.find((n) => n.x === x && n.y === y);
      const permittedGas = node?.id === p.geyserId;
      const depleted =
        node?.kind === "mineral" &&
        s.economy.resources.find((r) => r.nodeId === node.id)?.amount === 0;
      if (!visibility[cell]) return "invalid_target";
      if (!map.buildable[cell] && !permittedGas && !depleted) return "blocked";
      if (
        (d.creep && !creep.has(cell)) ||
        (d.faction !== "zerg" && creep.has(cell))
      )
        return "missing_prerequisite";
    }
  if (
    d.power &&
    !psiPower(s, owner, rect.x + rect.width / 2, rect.y + rect.height / 2)
  )
    return "missing_prerequisite";
  for (const b of s.economy.structures)
    if (b.entityId !== ignore) {
      const r = buildingRect(b);
      if (
        rect.x < r.x + r.width &&
        rect.x + rect.width > r.x &&
        rect.y < r.y + r.height &&
        rect.y + rect.height > r.y
      )
        return "blocked";
    }
  if (!ignoreUnits)
    for (let i = 0; i < s.entities.id.length; i++)
      if (
        s.entities.id[i] !== actor &&
        s.entities.id[i] !== ignore &&
        s.entities.health[i] > 0 &&
        !isEmbarked(s, s.entities.id[i]) &&
        s.entities.layer[i] === "ground" &&
        s.entities.kind[i] !== "building" &&
        circleRect(s.entities.x[i], s.entities.y[i], s.entities.radius[i], rect)
      )
        return "blocked";
  return null;
}
