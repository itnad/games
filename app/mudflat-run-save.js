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
const campaignShape = (value) => record(value) && value.version === 1 && ["normal", "kids"].includes(value.mode)
  && typeof value.characterId === "string" && Number.isInteger(value.stage) && value.stage >= 1
  && numericFields(value, "coins hp maxHp baseMaxHp level xp nextXp lastSaleValue totalScore")
  && value.coins >= 0 && positive(value.hp) && positive(value.maxHp) && value.hp <= value.maxHp
  && [value.levels, value.equipment, value.inventory, value.lastHaul].every(countMap)
  && (value.activeSkills === undefined || (Array.isArray(value.activeSkills) && value.activeSkills.every((id) => typeof id === "string")))
  && (value.gemsCollected === undefined || (Number.isInteger(value.gemsCollected) && value.gemsCollected >= 0))
  && (value.digsCompleted === undefined || (Number.isInteger(value.digsCompleted) && value.digsCompleted >= 0))
  && (value.hitByCrab === undefined || typeof value.hitByCrab === "boolean")
  && (value.hitByShrimp === undefined || typeof value.hitByShrimp === "boolean")
  && (value.hitByRock === undefined || typeof value.hitByRock === "boolean")
  && (value.hitByTide === undefined || typeof value.hitByTide === "boolean");
const copyCampaign = (campaign) => ({ ...campaign, levels: { ...campaign.levels }, equipment: { ...campaign.equipment }, inventory: { ...campaign.inventory }, lastHaul: { ...campaign.lastHaul }, ...(Array.isArray(campaign.activeSkills) ? { activeSkills: [...campaign.activeSkills] } : {}) });
const ENTITY_FIELDS = {
  creatures: "hp maxHp speed size xp score saltHit hitFlash phase age movementAngle movementClock",
  pickups: "xp age visualX visualY fromX fromY pullTime pullDuration", projectiles: "vx vy damage life",
  harpoons: "vx vy damage distance maxDistance angle",
  fireballs: "vx vy age life damage splash wobblePhase baseAngle", flameRays: "angle age length width",
  frostPatches: "radius age life", frostWaves: "age radius",
  netSlams: "life maxLife damage radius headDepth range angle targetId",
  castNets: "originX originY angle radius damage holdSeconds age duration",
  rocks: "radius tone", clamHoles: "radius progress", hoeBots: "targetHoleId digClock facing", clamReveals: "life maxLife",
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

export function encodeMudflatRun(campaign, runtime, choiceIds = [], nextSequence = 1, savedAt = Date.now(), stageEntryCampaign = campaign) {
  if (!campaign || !runtime || runtime.ended || !positive(runtime.player?.hp)) return null;
  const currentCampaign = {
    ...campaign, mode: runtime.mode, stage: runtime.stage,
    hp: runtime.player.hp, maxHp: runtime.player.maxHp, baseMaxHp: runtime.player.baseMaxHp,
    level: runtime.level, xp: runtime.xp, nextXp: runtime.nextXp,
    // The campaign keeps the whole skill inventory; runtime.levels holds only
    // the active skills that affect the live expedition.
    levels: runtime.skillInventory ?? runtime.levels, equipment: runtime.equipment,
    ...(Array.isArray(runtime.activeSkills) ? { activeSkills: [...runtime.activeSkills] } : {}),
    ...(Number.isInteger(runtime.gemsCollected) ? { gemsCollected: runtime.gemsCollected } : {}),
    ...(Number.isInteger(runtime.digsCompleted) ? { digsCompleted: runtime.digsCompleted } : {}),
    ...(typeof runtime.hitByCrab === "boolean" ? { hitByCrab: runtime.hitByCrab } : {}),
    ...(typeof runtime.hitByShrimp === "boolean" ? { hitByShrimp: runtime.hitByShrimp } : {}),
    ...(typeof runtime.hitByRock === "boolean" ? { hitByRock: runtime.hitByRock } : {}),
    ...(typeof runtime.hitByTide === "boolean" ? { hitByTide: runtime.hitByTide } : {}),
  };
  return JSON.stringify({
    version: 1, savedAt, campaign: currentCampaign, stageEntryCampaign: copyCampaign(stageEntryCampaign), choiceIds, nextSequence,
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
    if (!campaignShape(campaign)) return null;
    const stageEntryCampaign = save.stageEntryCampaign ?? campaign;
    if (!campaignShape(stageEntryCampaign) || stageEntryCampaign.mode !== campaign.mode || stageEntryCampaign.stage !== campaign.stage
      || stageEntryCampaign.characterId !== campaign.characterId) return null;
    save.stageEntryCampaign = copyCampaign(stageEntryCampaign);
    if (!record(runtime) || runtime.ended !== false || runtime.stage !== campaign.stage || runtime.mode !== campaign.mode) return null;
    const runtimeTemplate = makeRuntime(campaign, save.savedAt);
    // Older active-run autosaves did not know about the interactive first-run
    // guide. It is an opening tutorial layer, so backfill it from the current
    // runtime template instead of discarding an otherwise valid expedition.
    if (!finite(runtime.tutorialElapsed)) runtime.tutorialElapsed = 0;
    if (!("firstMoveGuide" in runtime)) runtime.firstMoveGuide = runtimeTemplate.firstMoveGuide;
    if (!Number.isInteger(runtime.seed)) runtime.seed = runtimeTemplate.seed;
    if (!Number.isInteger(runtime.rngState)) runtime.rngState = runtime.seed;
    if (typeof runtime.mosquitoRunEnabled !== "boolean") runtime.mosquitoRunEnabled = runtimeTemplate.mosquitoRunEnabled;
    // A resumed expedition must not replay the new stage-opening migration.
    if (!finite(runtime.openingWaveRemaining)) runtime.openingWaveRemaining = 0;
    // Silent stage events were added after the first active-run format. Resume
    // old runs with the current stage timers rather than rejecting the save or
    // firing every event immediately on the first frame.
    for (const key of ["pufferEventClock", "crabRushClock", "mudZombieClock", "jellyfishClock", "jellyPoisonSeconds", "jellyPoisonTickClock"]) {
      if (!finite(runtime[key])) runtime[key] = runtimeTemplate[key];
    }
    if (typeof runtime.mudZombieTriggered !== "boolean") runtime.mudZombieTriggered = runtimeTemplate.mudZombieTriggered;
    // Saves made before the skill inventory kept only the active levels. Treat
    // them as the whole inventory and derive the active list the old way.
    if (!countMap(runtime.skillInventory)) runtime.skillInventory = { ...runtime.levels };
    if (!Array.isArray(runtime.activeSkills)) runtime.activeSkills = [...runtimeTemplate.activeSkills];
    // 소쿠리의 달인과 보석 집계는 뒤에 추가됐다. 예전 저장은 캠페인 값과 완충 상태로 보완한다.
    if (!Number.isInteger(runtime.gemsCollected) || runtime.gemsCollected < 0) runtime.gemsCollected = runtimeTemplate.gemsCollected;
    for (const key of ["guardBasketPullClock", "guardBasketRechargeClock", "guardBasketFlashLife", "guardBasketInvulnerable"]) {
      if (!finite(runtime[key]) || runtime[key] < 0) runtime[key] = 0;
    }
    if (!Number.isInteger(runtime.guardBasketCharges) || runtime.guardBasketCharges < 0) runtime.guardBasketCharges = runtimeTemplate.guardBasketCharges;
    // 호미봇과 호미질 집계도 뒤에 추가됐다. 예전 저장은 로봇 없음·캠페인 값으로 보완한다.
    if (!Number.isInteger(runtime.digsCompleted) || runtime.digsCompleted < 0) runtime.digsCompleted = runtimeTemplate.digsCompleted;
    if (typeof runtime.hitByCrab !== "boolean") runtime.hitByCrab = runtimeTemplate.hitByCrab;
    if (typeof runtime.hitByShrimp !== "boolean") runtime.hitByShrimp = runtimeTemplate.hitByShrimp;
    if (typeof runtime.hitByRock !== "boolean") runtime.hitByRock = runtimeTemplate.hitByRock;
    if (typeof runtime.hitByTide !== "boolean") runtime.hitByTide = runtimeTemplate.hitByTide;
    // 빙결 계열도 뒤에 추가됐다.
    if (!Array.isArray(runtime.frostPatches)) runtime.frostPatches = [];
    if (!Array.isArray(runtime.frostWaves)) runtime.frostWaves = [];
    for (const key of ["frostTrailClock", "frostTickClock", "frostWaveClock"]) {
      if (!finite(runtime[key])) runtime[key] = 0;
    }
    if (!Array.isArray(runtime.hoeBots)) runtime.hoeBots = [];
    // 건곤대나이 타이머도 뒤에 추가됐다.
    if (!finite(runtime.rockLiftClock)) runtime.rockLiftClock = runtimeTemplate.rockLiftClock;
    if (!finite(runtime.rockLiftEffect) || runtime.rockLiftEffect < 0) runtime.rockLiftEffect = 0;
    // 뻘권 타이머·연출·연쇄 식별값도 뒤에 추가됐다.
    for (const key of ["smashClock", "smashEffect", "smashAngle"]) {
      if (!finite(runtime[key])) runtime[key] = 0;
    }
    if (!Number.isInteger(runtime.smashCastId) || runtime.smashCastId < 0) runtime.smashCastId = 0;
    // 파이어볼·화염 방사도 뒤에 추가됐다.
    if (!Array.isArray(runtime.fireballs)) runtime.fireballs = [];
    if (!Array.isArray(runtime.flameRays)) runtime.flameRays = [];
    for (const key of ["fireballClock", "fireballSpacingClock", "flameBurstClock"]) {
      if (!finite(runtime[key])) runtime[key] = 0;
    }
    if (!Number.isInteger(runtime.fireballQueue) || runtime.fireballQueue < 0) runtime.fireballQueue = 0;
    // Older active-run autosaves did not know about stage-five deep-mud
    // visuals/state. They are cosmetic or transient, so backfill defaults
    // instead of discarding an otherwise valid expedition.
    if (!Array.isArray(runtime.mudPrints)) runtime.mudPrints = [];
    for (const key of ["deepMudGauge", "deepMudLock", "deepMudStepClock"]) {
      if (!finite(runtime[key])) runtime[key] = 0;
    }
    if (!matchesShape(runtime, runtimeTemplate) || !positive(runtime.player.hp)
      || runtime.player.hp > runtime.player.maxHp || runtime.elapsed < 0 || runtime.tutorialElapsed < 0
      || ![runtime.levels, runtime.skillInventory, runtime.equipment, runtime.basket].every(countMap)
      || !runtime.activeSkills.every((id) => typeof id === "string")) return null;
    if (runtime.firstMoveGuide !== null) {
      if (!record(runtime.firstMoveGuide) || !["move", "catch", "dig", "avoid", "done"].includes(runtime.firstMoveGuide.step)
        || !numericFields(runtime.firstMoveGuide, "stepClock catchCreatureId digHoleId avoidRockId")
        || ![runtime.firstMoveGuide.moveTarget, runtime.firstMoveGuide.catchPoint, runtime.firstMoveGuide.digPoint, runtime.firstMoveGuide.avoidRockPoint, runtime.firstMoveGuide.avoidTarget].every(point)) return null;
    }
    for (const [key, fields] of Object.entries(ENTITY_FIELDS)) {
      if (!Array.isArray(runtime[key]) || !runtime[key].every((entity) => point(entity) && Number.isInteger(entity.id) && entity.id > 0 && numericFields(entity, fields))) return null;
    }
    if (!runtime.creatures.every((creature) => typeof creature.type === "string" && typeof creature.name === "string"
      && ["chase", "still", "wander", "flee", "oval"].includes(creature.movement))) return null;
    if (!runtime.creatures.every((creature) => (creature.eventKind === undefined || ["puffer-rush", "crab-line", "mud-zombie", "jellyfish"].includes(creature.eventKind))
      && ["chargeX", "chargeY", "eventLife", "emergeSeconds", "knockbackX", "knockbackY", "knockbackLife", "knockbackDamage", "knockbackRockBonus", "knockbackCast", "slowUntil", "slowFactor"].every((key) => creature[key] === undefined || finite(creature[key]))
      && (creature.knockbackChain === undefined || typeof creature.knockbackChain === "boolean")
      && (creature.uncollectible === undefined || typeof creature.uncollectible === "boolean"))) return null;
    if (!runtime.hoeBots.every((unit) => ["follow", "move", "dig"].includes(unit.phase) && Number.isInteger(unit.targetHoleId) && unit.targetHoleId >= 0)) return null;
    if (!runtime.rocks.every((rock) => (rock.lift === undefined || (finite(rock.lift) && rock.lift >= 0)) && (rock.impact === undefined || finite(rock.impact)))) return null;
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

export function writeMudflatRun(campaign, runtime, choiceIds, nextSequence, getStorage = () => window.localStorage, stageEntryCampaign = campaign) {
  try {
    const serialized = encodeMudflatRun(campaign, runtime, choiceIds, nextSequence, Date.now(), stageEntryCampaign);
    if (!serialized) return false;
    getStorage().setItem(MUDFLAT_ACTIVE_RUN_KEY, serialized);
    return true;
  } catch { return false; }
}

export function clearMudflatRun(getStorage = () => window.localStorage) {
  try { getStorage().removeItem(MUDFLAT_ACTIVE_RUN_KEY); return true; }
  catch { return false; }
}
