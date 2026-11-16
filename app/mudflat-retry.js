export const SECRET_RETRY_HOLD_MS = 3_000;
export const MUDFLAT_RESCUE_COST_RATE = .3;

export function createStageEntryCheckpoint(campaign) {
  return {
    ...campaign,
    levels: { ...campaign.levels }, equipment: { ...campaign.equipment },
    inventory: { ...campaign.inventory }, lastHaul: { ...campaign.lastHaul },
  };
}

export function mudflatRescueCost(coins) {
  return Math.max(0, Math.ceil(Math.max(0, Math.floor(coins)) * MUDFLAT_RESCUE_COST_RATE));
}

export function createRescueRetryCampaign(checkpoint) {
  const rescueCost = mudflatRescueCost(checkpoint.coins);
  const campaign = createStageEntryCheckpoint(checkpoint);
  campaign.coins = Math.max(0, campaign.coins - rescueCost);
  campaign.hp = campaign.maxHp;
  campaign.pendingSkillDiscovery = false;
  return { campaign, rescueCost };
}

// A release performs the ordinary action once. The browser's subsequent click
// must never turn a completed long hold into a second, stat-resetting retry.
export function createRetryHold(onShort, onLong, schedule = (fn, ms) => globalThis.setTimeout(fn, ms), cancelTimer = (id) => globalThis.clearTimeout(id)) {
  let timer = null;
  let active = false;
  let suppressClick = false;
  const clear = () => { if (timer !== null) cancelTimer(timer); timer = null; };
  return {
    start() {
      if (active) return;
      active = true; suppressClick = false;
      timer = schedule(() => {
        timer = null;
        if (!active) return;
        active = false; suppressClick = true;
        onLong();
      }, SECRET_RETRY_HOLD_MS);
    },
    release() {
      const wasActive = active;
      clear(); active = false; suppressClick = true;
      if (wasActive) onShort();
    },
    cancel() {
      clear();
      if (active) suppressClick = true;
      active = false;
    },
    click() {
      if (suppressClick) { suppressClick = false; return; }
      onShort();
    },
  };
}
