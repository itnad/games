/**
 * Scores the best matching lower-section Yahtzee combination.
 * Pair and two-pair are not official Yahtzee categories, so those rolls
 * fall back to Chance and score the sum of all five dice.
 *
 * @param {number[]} dice
 * @returns {{ score: number, name: string }}
 */
export function scoreDice(dice) {
  const counts = Object.values(dice.reduce((map, die) => {
    map[die] = (map[die] ?? 0) + 1;
    return map;
  }, {})).sort((a, b) => b - a);
  const unique = [...new Set(dice)].sort((a, b) => a - b).join("");
  const sum = dice.reduce((total, die) => total + die, 0);

  if (counts[0] === 5) return { score: 50, name: "다섯 주사위!" };
  if (unique === "12345" || unique === "23456") return { score: 40, name: "라지 스트레이트" };
  if (unique.includes("1234") || unique.includes("2345") || unique.includes("3456")) {
    return { score: 30, name: "스몰 스트레이트" };
  }
  if (counts[0] === 3 && counts[1] === 2) return { score: 25, name: "풀하우스" };
  if (counts[0] === 4) return { score: sum, name: "포카드" };
  if (counts[0] === 3) return { score: sum, name: "트리플" };
  return { score: sum, name: "찬스" };
}
