// A live expedition is separate from the between-stage camp save. Never
// rebuild its world on resume: pickups, hit histories and tide clocks matter.
export const MUDFLAT_ACTIVE_RUN_KEY = "paperoid-mudflat-survivor-active-run-v1";
export const MUDFLAT_AUTOSAVE_MS = 5_000;

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const positive = (value) => finite(value) && value > 0;
const countMap = (value) => record(value) && Object.values(value).every((n) => Number.isInteger(n) && n >= 0);
const point = (value) => record(value) && finite(value.x) && finite(value.y);
const numericFields = (value, fields) => fields.split(" ").every((key) => finite(value[key]));
const ENTITY_FIELDS = {
  creatures: "hp maxHp speed size xp score saltHit hitFlash phase age movementAngle movementClock",
  pickups: "xp age visualX visualY fromX fromY pullTime pullDuration", projectiles: "vx vy damage life",
  harpoons: "vx vy damage distance maxDistance angle",
  netSlams: "life maxLife damage radius headDepth range angle targetId",
  castNets: "originX originY angle radius damage holdSeconds age duration",
  rocks: "radius tone", clamHoles: "radius progress", clamReveals: "life maxLife",
  mudPrints: "life maxLife angle side", bursts: "life maxLife size", floatTexts: "life", fallingRocks: "life maxLife radius",
};

function safeJson(value) {
  if (typeof value === "number") return finite(value);
  if (!value || typeof value !== "object") return true;
  return Object.entries(value).every(([key, item]) => !["__proto__", "constructor", "prototype"].includes(key) && safeJson(item));
}

// Require all fields from the current runtime, so incompatible saves fail
// closed rather than producing NaN timers or silently resetting equipment.
function matchesShape(value, template) {
  if (Array.isArray(template)) return Array.isArray(value);
  if (template === null) return value === null || record(value);
  if (record(template)) return record(value) && Object.entries(template).every(([key, item]) => matchesShape(value[key], item));
  return typeof value === typeof template && (typeof template !== "number" || finite(value));
}

export function encodeMudflatRun(campaign, runtime, choiceIds = [], nextSequence = 1, savedAt = Date.now()) {
  if (!campaign || !runtime || runtime.ended || !positive(runtime.player?.hp)) return null;
  const currentCampaign = {
    ...campaign, mode: runtime.mode, stage: runtime.stage,
    hp: runtime.player.hp, maxHp: runtime.player.maxHp, baseMaxHp: runtime.player.baseMaxHp,
    level: runtime.level, xp: runtime.xp, nextXp: runtime.nextXp,
    levels: runtime.levels, equipment: runtime.equipment,
  };
  return JSON.stringify({
    version: 1, savedAt, campaign: currentCampaign, choiceIds, nextSequence,
    runtime: {
      ...runtime, paused: true, ended: false,
      player: { ...runtime.player, walking: false },
      harpoons: runtime.harpoons.map((shot) => ({ ...shot, hitIds: [...shot.hitIds] })),
      castNets: runtime.castNets.map((net) => ({ ...net, caughtIds: [...net.caughtIds] })),
    },
  });
}

export function decodeMudflatRun(serialized, makeRuntime) {
  try {
    const save = JSON.parse(serialized ?? "null");
    if (!record(save) || save.version !== 1 || !positive(save.savedAt) || !safeJson(save)) return null;
    const { campaign, runtime } = save;
    if (!record(campaign) || campaign.version !== 1 || !["normal", "kids"].includes(campaign.mode)
      || typeof campaign.characterId !== "string" || !Number.isInteger(campaign.stage) || campaign.stage < 1
      || !numericFields(campaign, "coins hp maxHp baseMaxHp level xp nextXp lastSaleValue totalScore")
      || campaign.coins < 0 || !positive(campaign.hp) || !positive(campaign.maxHp) || campaign.hp > campaign.maxHp
      || ![campaign.levels, campaign.equipment, campaign.inventory, campaign.lastHaul].every(countMap)) return null;
    if (!record(runtime) || runtime.ended !== false || runtime.stage !== campaign.stage || runtime.mode !== campaign.mode
      || !matchesShape(runtime, makeRuntime(campaign)) || !positive(runtime.player.hp)
      || runtime.player.hp > runtime.player.maxHp || runtime.elapsed < 0
      || ![runtime.levels, runtime.equipment, runtime.basket].every(countMap)) return null;
    for (const [key, fields] of Object.entries(ENTITY_FIELDS)) {
      if (!Array.isArray(runtime[key]) || !runtime[key].every((entity) => point(entity) && Number.isInteger(entity.id) && entity.id > 0 && numericFields(entity, fields))) return null;
    }
    if (!runtime.creatures.every((creature) => typeof creature.type === "string" && typeof creature.name === "string"
      && ["chase", "still", "wander", "flee", "oval"].includes(creature.movement))) return null;
    if (!runtime.clamHoles.every((hole) => (hole.kind === undefined || ["clam", "gaebul"].includes(hole.kind))
      && (hole.angle === undefined || finite(hole.angle)))) return null;
    if (!runtime.pickups.every((pickup) => ["spawn", "idle", "pull", "arrived"].includes(pickup.phase) && Array.isArray(pickup.trail) && pickup.trail.every(point))) return null;
    if (!runtime.floatTexts.every((text) => typeof text.text === "string" && typeof text.color === "string")) return null;
    if (!Array.isArray(save.choiceIds) || save.choiceIds.length > 3 || !save.choiceIds.every((id) => typeof id === "string")
      || new Set(save.choiceIds).size !== save.choiceIds.length || !Number.isInteger(save.nextSequence) || save.nextSequence < 1) return null;
    for (const [items, key] of [[runtime.harpoons, "hitIds"], [runtime.castNets, "caughtIds"]]) {
      for (const item of items) {
        if (!Array.isArray(item[key]) || !item[key].every((id) => Number.isInteger(id) && id > 0)) return null;
        item[key] = new Set(item[key]);
      }
    }
    if (!runtime.castNets.every((net) => Array.isArray(net.caughtPoints) && net.caughtPoints.every(point))) return null;
    // Account for IDs of removed creatures still referenced by a net/harpoon.
    for (const key of Object.keys(ENTITY_FIELDS)) {
      for (const item of runtime[key]) {
        save.nextSequence = Math.max(save.nextSequence, item.id + 1);
        for (const id of item.hitIds ?? item.caughtIds ?? []) save.nextSequence = Math.max(save.nextSequence, id + 1);
      }
    }
    runtime.paused = true;
    runtime.player.walking = false;
    return save;
  } catch { return null; }
}

// Obtain storage inside the try block: some browsers throw even on access.
export function readMudflatRun(makeRuntime, getStorage = () => window.localStorage) {
  try { return decodeMudflatRun(getStorage().getItem(MUDFLAT_ACTIVE_RUN_KEY), makeRuntime); }
  catch { return null; }
}

export function writeMudflatRun(campaign, runtime, choiceIds, nextSequence, getStorage = () => window.localStorage) {
  try {
    const serialized = encodeMudflatRun(campaign, runtime, choiceIds, nextSequence);
    if (!serialized) return false;
    getStorage().setItem(MUDFLAT_ACTIVE_RUN_KEY, serialized);
    return true;
  } catch { return false; }
}

export function clearMudflatRun(getStorage = () => window.localStorage) {
  try { getStorage().removeItem(MUDFLAT_ACTIVE_RUN_KEY); return true; }
  catch { return false; }
}
