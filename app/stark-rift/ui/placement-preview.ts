import type { BattleMap } from "../data/maps";
import type { RenderSnapshot } from "../worker/render-snapshot";
import { economyDefinition } from "../data/economy-catalog";
import { circleRect } from "../economy/footprints";
export type PlacementPreview = {
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  status: "valid" | "blocked" | "warning";
  reason: string;
};
export function previewBuilding(
  map: BattleMap,
  snapshot: RenderSnapshot,
  actorId: number,
  definitionId: string,
  point: { x: number; y: number },
): PlacementPreview | null {
  const d = economyDefinition(definitionId),
    e = snapshot.economy;
  if (!d || !e) return null;
  let tileX = Math.floor(point.x / 256) - Math.floor(d.width / 2),
    tileY = Math.floor(point.y / 256) - Math.floor(d.height / 2),
    geyserId: string | null = null;
  if (d.gasBuilding) {
    const gas = map.resourceNodes
      .filter(
        (n) =>
          n.kind === "gas" &&
          (n.x * 256 + 128 - point.x) ** 2 + (n.y * 256 + 128 - point.y) ** 2 <=
            768 ** 2,
      )
      .sort(
        (a, b) =>
          (a.x * 256 + 128 - point.x) ** 2 +
            (a.y * 256 + 128 - point.y) ** 2 -
            (b.x * 256 + 128 - point.x) ** 2 -
            (b.y * 256 + 128 - point.y) ** 2 || a.id.localeCompare(b.id),
      )[0];
    if (gas) {
      tileX = gas.x - Math.floor(d.width / 2);
      tileY = gas.y - Math.floor(d.height / 2);
      geyserId = gas.id;
    }
  }
  const out: PlacementPreview = {
      tileX,
      tileY,
      width: d.width,
      height: d.height,
      status: "valid",
      reason: "건설 가능",
    },
    block = (reason: string) => ({
      ...out,
      status: "blocked" as const,
      reason,
    }),
    rect = {
      x: tileX * 256,
      y: tileY * 256,
      width: d.width * 256,
      height: d.height * 256,
    };
  if (
    tileX < 0 ||
    tileY < 0 ||
    tileX + d.width > map.widthTiles ||
    tileY + d.height > map.heightTiles
  )
    return block("지도 경계");
  if (e.minerals < d.minerals || e.gas < d.gas) return block("자원 부족");
  if (
    d.requires.some(
      (id) =>
        !e.structures.some(
          (b) =>
            b.completed &&
            snapshot.entities.find((ent) => ent.id === b.entityId)
              ?.definitionId === id,
        ),
    )
  )
    return block("선행 건물 필요");
  if (d.gasBuilding && !geyserId) return block("가스 분출구를 선택하세요");
  const creep = new Set(e.creepCells);
  for (let y = tileY; y < tileY + d.height; y++)
    for (let x = tileX; x < tileX + d.width; x++) {
      const c = y * map.widthTiles + x,
        node = map.resourceNodes.find((n) => n.x === x && n.y === y),
        depleted =
          node?.kind === "mineral" &&
          e.resources.some((r) => r.nodeId === node.id && r.amount === 0);
      if (snapshot.visibility[c] !== 2) return block("시야 밖");
      if (!map.buildable[c] && node?.id !== geyserId && !depleted)
        return block("건설 불가 지형");
      if (d.creep && !creep.has(c)) return block("크립 필요");
      if (d.faction !== "zerg" && creep.has(c))
        return block("크립 위 건설 불가");
    }
  if (
    d.power &&
    !e.structures.some((b) => {
      if (
        !b.completed ||
        snapshot.entities.find((ent) => ent.id === b.entityId)?.definitionId !==
          "protoss-pylon"
      )
        return false;
      const dx = (tileX + d.width / 2 - b.tileX - 1) * 256,
        dy = (tileY + d.height / 2 - b.tileY - 1) * 256,
        row = Math.floor((Math.abs(dy) - (dy < 0 ? 1 : 0)) / 256);
      return (
        row < 5 && Math.abs(dx) - (dx < 0 ? 1 : 0) < [8, 8, 7, 6, 3][row] * 256
      );
    })
  )
    return block("파일런 동력 필요");
  for (const ent of snapshot.entities) {
    if (ent.id === actorId || ent.layer === "air") continue;
    const ed = economyDefinition(ent.definitionId);
    if (ed?.kind === "building") {
      if (
        Math.abs(ent.x - (rect.x + rect.width / 2)) <
          (ed.width + d.width) * 128 &&
        Math.abs(ent.y - (rect.y + rect.height / 2)) <
          (ed.height + d.height) * 128
      )
        return block("건물과 겹침");
    } else if (circleRect(ent.x, ent.y, ent.radius, rect))
      return block("유닛과 겹침");
  }
  const actor = snapshot.entities.find((ent) => ent.id === actorId);
  if (actor && Math.hypot(actor.x - point.x, actor.y - point.y) > 8 * 256)
    return {
      ...out,
      status: "warning",
      reason: "먼 건설 지점 · 이동 경로 확인 필요",
    };
  return out;
}
