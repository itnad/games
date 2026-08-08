export function distributeRemainingGemsAcrossCards(path, remaining) {
  const treasureTotal = path.reduce(
    (sum, card) => sum + (card.type === "treasure" ? card.remaining : 0),
    0,
  );
  let gemsToPlace = Math.min(Math.max(0, remaining), treasureTotal);
  const distributed = path.map((card) => card.type === "treasure" ? { ...card, remaining: 0 } : card);
  const highestStack = Math.max(0, ...path.map((card) => card.type === "treasure" ? card.remaining : 0));

  for (let layer = 0; layer < highestStack && gemsToPlace > 0; layer += 1) {
    for (let index = 0; index < path.length && gemsToPlace > 0; index += 1) {
      const original = path[index];
      const target = distributed[index];
      if (original.type !== "treasure" || target.type !== "treasure" || original.remaining <= layer) continue;
      target.remaining += 1;
      gemsToPlace -= 1;
    }
  }

  return distributed;
}
