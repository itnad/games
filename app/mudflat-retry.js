export const SECRET_RETRY_HOLD_MS = 3_000;

// This backup lives only on the defeat screen; it is not a resumable camp save.
export function createDefeatRetrySnapshot(campaign, runtime) {
  return {
    campaign: {
      ...campaign, mode: runtime.mode, stage: runtime.stage,
      hp: runtime.player.maxHp, maxHp: runtime.player.maxHp, baseMaxHp: runtime.player.baseMaxHp,
      level: runtime.level, xp: runtime.xp, nextXp: runtime.nextXp,
      levels: { ...runtime.levels }, equipment: { ...runtime.equipment },
      inventory: { ...campaign.inventory }, lastHaul: { ...campaign.lastHaul },
      pendingSkillDiscovery: false,
    },
    progress: {
      basket: { ...runtime.basket }, caught: runtime.caught, catchScore: runtime.catchScore,
      bossCaught: runtime.bossCaught, rocksFlipped: runtime.rocksFlipped,
    },
    playerSpeed: runtime.player.speed,
  };
}

export function restoreDefeatRetryRuntime(freshRuntime, saved) {
  return {
    ...freshRuntime, ...saved.progress, basket: { ...saved.progress.basket },
    // A boss already collected must not be awarded a second time in this stage.
    bossSpawned: saved.progress.bossCaught,
    player: {
      ...freshRuntime.player, hp: saved.campaign.maxHp, maxHp: saved.campaign.maxHp,
      baseMaxHp: saved.campaign.baseMaxHp, speed: saved.playerSpeed,
    },
  };
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
