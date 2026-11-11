import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import { economyDefinition, ECONOMY_UPGRADES } from "../data/economy-catalog";
/** Cross references and paid reservations are validated both after a tick and before restoring a save. */
export function validEconomy(s: SimulationState): boolean {
  const e = s.economy,
    es = s.entities;
  if (!e.enabled)
    return (
      !e.workers.length &&
      !e.structures.length &&
      !e.resources.length &&
      !e.upgrades.length &&
      !e.creepCells.length &&
      e.nextCreepTick === 0
    );
  const idx = (id: number) => es.id.indexOf(id),
    owner = (id: number) => es.owner[idx(id)],
    def = (id: number) => economyDefinition(es.definitionId[idx(id)]);
  if (
    es.id.some(
      (id, i) =>
        !def(id) ||
        def(id)!.kind !== es.kind[i] ||
        !s.players[es.owner[i]] ||
        def(id)!.faction !== s.players[es.owner[i]].faction,
    )
  )
    return false;
  const unique = (ids: (number | string)[]) => new Set(ids).size === ids.length;
  if (
    !unique(e.workers.map((w) => w.entityId)) ||
    !unique(e.structures.map((b) => b.entityId)) ||
    !unique(e.resources.map((r) => r.nodeId))
  )
    return false;
  if (
    e.workers.length !== es.kind.filter((k) => k === "worker").length ||
    e.structures.length !== es.kind.filter((k) => k === "building").length
  )
    return false;
  for (const w of e.workers) {
    if (
      new Set(w.buildQueue).size !== w.buildQueue.length ||
      w.buildQueue.includes(w.buildingId ?? -1) ||
      w.buildQueue.some(
        (id) =>
          !e.structures.some(
            (b) =>
              b.entityId === id &&
              b.builderId === w.entityId &&
              owner(id) === owner(w.entityId) &&
              b.completedTick < 0,
          ),
      )
    )
      return false;
    if (def(w.entityId)?.kind !== "worker" || w.cargoGas + w.cargoMinerals > 8)
      return false;
    if (
      w.resourceId !== null &&
      !e.resources.some((r) => r.nodeId === w.resourceId)
    )
      return false;
    if (
      w.homeId !== null &&
      !e.structures.some(
        (b) =>
          b.entityId === w.homeId &&
          owner(b.entityId) === owner(w.entityId) &&
          def(b.entityId)?.headquarters,
      )
    )
      return false;
    if (
      w.buildingId !== null &&
      !e.structures.some(
        (b) =>
          b.entityId === w.buildingId &&
          b.builderId === w.entityId &&
          owner(b.entityId) === owner(w.entityId),
      )
    )
      return false;
    if (
      ((w.task === "constructing" || w.task === "toBuild") &&
        w.buildingId === null) ||
      (w.task === "harvesting" &&
        (!w.resourceId ||
          !e.resources.some(
            (r) => r.nodeId === w.resourceId && r.occupiedBy === w.entityId,
          )))
    )
      return false;
  }
  for (const r of e.resources)
    if (
      r.occupiedBy !== null &&
      !e.workers.some(
        (w) =>
          w.entityId === r.occupiedBy &&
          w.task === "harvesting" &&
          w.resourceId === r.nodeId,
      )
    )
      return false;
  const jobs: number[] = [],
    researchKeys: string[] = [];
  for (const b of e.structures) {
    const d = def(b.entityId);
    if (
      !d ||
      d.kind !== "building" ||
      d.width !== b.width ||
      d.height !== b.height ||
      d.ticks !== b.totalTicks ||
      b.completedTick > s.tick ||
      (b.completedTick >= 0 && (!b.started || b.remainingTicks !== 0)) ||
      (!b.started && b.completedTick !== -1)
    )
      return false;
    if (
      b.builderId !== null &&
      !e.workers.some(
        (w) =>
          w.entityId === b.builderId &&
          (w.buildingId === b.entityId || w.buildQueue.includes(b.entityId)) &&
          owner(w.entityId) === owner(b.entityId),
      )
    )
      return false;
    if (
      b.addonParentId !== null &&
      !e.structures.some(
        (p) =>
          p.entityId === b.addonParentId &&
          def(p.entityId)?.id === d.addonParent &&
          owner(p.entityId) === owner(b.entityId),
      )
    )
      return false;
    if (
      b.geyserId !== null &&
      (!d.gasBuilding || !e.resources.some((r) => r.nodeId === b.geyserId))
    )
      return false;
    if (b.repeatUnitId !== null) {
      const repeat = economyDefinition(b.repeatUnitId);
      if (!repeat || repeat.kind === "building" || repeat.producer !== d.id)
        return false;
    }
    if (
      (b.queue.length && b.completedTick < 0) ||
      (b.research && b.completedTick < 0)
    )
      return false;
    for (const q of b.queue) {
      const unit = economyDefinition(q.definitionId);
      if (
        !unit ||
        unit.kind === "building" ||
        unit.producer !== d.id ||
        q.count !== unit.batch ||
        q.supplyHalf !== unit.supply * unit.batch ||
        q.totalTicks !== unit.ticks ||
        q.minerals !== unit.minerals ||
        q.gas !== unit.gas
      )
        return false;
      jobs.push(q.id);
    }
    if (b.research) {
      const r = b.research,
        t = ECONOMY_UPGRADES.find((t) => t.id === r.technologyId);
      if (
        !t ||
        t.producer !== d.id ||
        r.level !== 1 ||
        r.totalTicks !== t.ticks ||
        r.minerals !== t.minerals ||
        r.gas !== t.gas
      )
        return false;
      researchKeys.push(owner(b.entityId) + ":" + t.id);
      jobs.push(r.id);
    }
    if (d.id !== "zerg-hatchery" && b.larva !== 0) return false;
  }
  for (const u of e.upgrades) {
    const t = ECONOMY_UPGRADES.find((t) => t.id === u.technologyId);
    if (
      !s.players[u.playerId] ||
      !t ||
      t.faction !== s.players[u.playerId].faction ||
      u.level !== 1
    )
      return false;
    researchKeys.push(u.playerId + ":" + u.technologyId);
  }
  if (
    !unique(jobs) ||
    jobs.some((id) => id >= s.counters.nextEventId) ||
    !unique(researchKeys)
  )
    return false;
  for (const p of s.players) {
    let used = 0,
      cap = 0;
    for (const id of es.id)
      if (owner(id) === p.id && es.health[idx(id)] > 0) {
        const d = def(id)!;
        used += d.supply;
        const b = e.structures.find((b) => b.entityId === id);
        if (!b || b.completedTick >= 0) cap += d.provides;
      }
    for (const b of e.structures)
      if (owner(b.entityId) === p.id)
        used += b.queue.reduce((n, q) => n + q.supplyHalf, 0);
    if (p.supplyUsedHalf !== used || p.supplyCapHalf !== Math.min(200, cap))
      return false;
  }
  return true;
}
export function economyFitsMap(s: SimulationState, map: BattleMap): boolean {
  if (!s.economy.enabled) return true;
  const e = s.economy;
  const inside = (p: { x: number; y: number }) =>
    p.x >= 0 &&
    p.y >= 0 &&
    p.x < map.widthTiles * 256 &&
    p.y < map.heightTiles * 256;
  return (
    e.resources.length === map.resourceNodes.length &&
    e.resources.every((r) => {
      const n = map.resourceNodes.find((n) => n.id === r.nodeId);
      return !!n && r.amount <= n.amount;
    }) &&
    e.creepCells.every((c) => c < map.widthTiles * map.heightTiles) &&
    e.workers.every(
      (w) =>
        (w.goal === null || inside(w.goal)) &&
        (w.regionId === null || map.regions.some((r) => r.id === w.regionId)),
    ) &&
    e.structures.every(
      (b) =>
        b.tileX + b.width <= map.widthTiles &&
        b.tileY + b.height <= map.heightTiles &&
        (b.rally === null || inside(b.rally)) &&
        (b.geyserId === null ||
          map.resourceNodes.some(
            (n) =>
              n.id === b.geyserId &&
              n.kind === "gas" &&
              n.x >= b.tileX &&
              n.x < b.tileX + b.width &&
              n.y >= b.tileY &&
              n.y < b.tileY + b.height,
          )),
    )
  );
}
