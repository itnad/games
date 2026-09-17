// Only the hidden route entry applies this preset. Ordinary starts stay fresh.
export function withSecretExpeditionSkills(campaign) {
  if (campaign.mode !== "normal") return campaign;
  return {
    ...campaign,
    levels: { ...campaign.levels, electric: 5, basket: 5, rocker: 5, "cast-net": 1 },
  };
}
