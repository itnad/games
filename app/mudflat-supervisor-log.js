export const MUDFLAT_SUPERVISOR_LOG_KEY = "paperoid-mudflat-supervisor-log-v1";
export const MUDFLAT_SUPERVISOR_LOG_LIMIT = 800;

export function createMudflatSupervisorLog({ buildId, startedAt, campaign, seed }) {
  return {
    formatVersion: 1,
    buildId,
    startedAt: new Date(startedAt).toISOString(),
    seed,
    initialCampaign: {
      stage: campaign.stage,
      level: campaign.level,
      hp: campaign.hp,
      maxHp: campaign.maxHp,
      coins: campaign.coins,
      levels: { ...(campaign.levels ?? {}) },
      equipment: { ...(campaign.equipment ?? {}) },
    },
    entries: [],
  };
}

export function appendMudflatSupervisorLog(log, entry) {
  if (!log || !entry) return log;
  log.entries.push({ sequence: (log.entries.at(-1)?.sequence ?? 0) + 1, ...entry });
  if (log.entries.length > MUDFLAT_SUPERVISOR_LOG_LIMIT) {
    log.entries.splice(0, log.entries.length - MUDFLAT_SUPERVISOR_LOG_LIMIT);
  }
  return log;
}

export function serializeMudflatSupervisorLog(log, exportedAt = Date.now()) {
  if (!log) return "";
  return JSON.stringify({ ...log, exportedAt: new Date(exportedAt).toISOString() }, null, 2);
}
