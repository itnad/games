import { scoreDice } from "./dice-scoring.js";

const STRAIGHT_WINDOWS = [
  [1, 2, 3, 4],
  [2, 3, 4, 5],
  [3, 4, 5, 6],
];

function holdOneOfEach(dice, values) {
  const remaining = new Set(values);
  return dice.map((die) => {
    if (!remaining.has(die)) return false;
    remaining.delete(die);
    return true;
  });
}

/**
 * Locks combinations that cannot improve safely by rerolling.
 * @param {number[]} dice
 */
export function shouldAiStop(dice) {
  const { name } = scoreDice(dice);
  return name === "다섯 주사위!" || name === "라지 스트레이트" || name === "풀하우스";
}

/**
 * Chooses dice to keep using the current scoring table.
 * @param {number[]} dice
 * @returns {boolean[]}
 */
export function chooseAiHeld(dice) {
  if (shouldAiStop(dice)) return dice.map(() => true);

  const counts = dice.reduce((map, die) => {
    map[die] = (map[die] ?? 0) + 1;
    return map;
  }, {});
  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  if (groups[0].count >= 3) {
    return dice.map((die) => die === groups[0].value);
  }

  const smallStraight = STRAIGHT_WINDOWS.find((window) =>
    window.every((value) => counts[value]),
  );
  if (smallStraight) return holdOneOfEach(dice, smallStraight);

  const pairs = groups.filter((group) => group.count === 2);
  if (pairs.length) {
    const pairValues = new Set(pairs.slice(0, 2).map((group) => group.value));
    return dice.map((die) => pairValues.has(die));
  }

  const bestRun = [...STRAIGHT_WINDOWS]
    .map((window) => window.filter((value) => counts[value]))
    .sort((a, b) => b.length - a.length || b.reduce((sum, value) => sum + value, 0) - a.reduce((sum, value) => sum + value, 0))[0];
  if (bestRun.length >= 3) return holdOneOfEach(dice, bestRun);

  const highest = Math.max(...dice);
  return dice.map((die) => die === highest);
}

/**
 * @param {number[]} dice
 * @param {boolean[]} held
 */
export function describeAiHeld(dice, held) {
  const kept = dice.filter((_, index) => held[index]);
  const values = [...new Set(kept)].sort((a, b) => a - b);
  if (values.length === 1) return `${values[0]} 주사위 ${kept.length}개`;
  return `${values.join("·")} 눈 ${kept.length}개`;
}
