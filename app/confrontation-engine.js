import { withKoreanObject } from "./korean-particles.js";

export const CONFRONTATION_SIDES = ["dawn", "shadow"];

export const CONFRONTATION_LEVELS = [
  [{ id: "dawn-hold", name: "새벽 성채", x: 0, capacity: 4, terrain: "hold" }],
  [
    { id: "sunfield", name: "해뜰 들판", x: -2, capacity: 2, terrain: "plain" },
    { id: "silverwood", name: "은빛 숲", x: -1, capacity: 2, terrain: "forest" },
    { id: "quiet-road", name: "고요한 길", x: 0, capacity: 2, terrain: "plain" },
    { id: "moon-pass", name: "달빛 고개", x: 1, capacity: 2, terrain: "plain" },
    { id: "green-hill", name: "푸른 언덕", x: 2, capacity: 2, terrain: "plain" },
  ],
  [
    { id: "frost-peak", name: "서리 봉우리", x: -1.5, capacity: 1, terrain: "mountain" },
    { id: "glass-ravine", name: "유리 협곡", x: -0.5, capacity: 2, terrain: "plain" },
    { id: "forgotten-river", name: "잊힌 강", x: 0.5, capacity: 2, terrain: "river" },
    { id: "mist-peak", name: "안개 봉우리", x: 1.5, capacity: 1, terrain: "mountain" },
  ],
  [
    { id: "star-gate", name: "별의 문", x: -2, capacity: 2, terrain: "plain" },
    { id: "old-ford", name: "고대 나루", x: -1, capacity: 2, terrain: "river" },
    { id: "echo-peak", name: "메아리 산", x: 0, capacity: 1, terrain: "mountain" },
    { id: "stone-hall", name: "돌의 회랑", x: 1, capacity: 2, terrain: "plain" },
    { id: "storm-road", name: "폭풍 길", x: 2, capacity: 2, terrain: "plain" },
  ],
  [
    { id: "iron-peak", name: "무쇠 봉우리", x: -1.5, capacity: 1, terrain: "mountain" },
    { id: "ashen-vale", name: "잿빛 골짜기", x: -0.5, capacity: 2, terrain: "plain" },
    { id: "black-river", name: "검은 강", x: 0.5, capacity: 2, terrain: "river" },
    { id: "thorn-peak", name: "가시 봉우리", x: 1.5, capacity: 1, terrain: "mountain" },
  ],
  [
    { id: "ember-field", name: "불씨 벌판", x: -2, capacity: 2, terrain: "plain" },
    { id: "ravenwood", name: "까마귀 숲", x: -1, capacity: 2, terrain: "forest" },
    { id: "night-road", name: "밤의 길", x: 0, capacity: 2, terrain: "plain" },
    { id: "red-pass", name: "붉은 고개", x: 1, capacity: 2, terrain: "plain" },
    { id: "dusk-hill", name: "황혼 언덕", x: 2, capacity: 2, terrain: "plain" },
  ],
  [{ id: "shadow-hold", name: "그림자 요새", x: 0, capacity: 4, terrain: "hold" }],
];

export const CONFRONTATION_REGIONS = CONFRONTATION_LEVELS.flatMap((regions, level) =>
  regions.map((region) => ({ ...region, level })),
);

export const CONFRONTATION_CHARACTERS = {
  dawn: [
    { role: "빛의 운반자", sigil: "✦", strength: 1, ability: "bearer", text: "그림자 요새에 도착하면 즉시 승리합니다." },
    { role: "길잡이", sigil: "⌁", strength: 2, ability: "swift", text: "공격할 때 힘 +2를 얻습니다." },
    { role: "산의 벗", sigil: "△", strength: 2, ability: "mountain", text: "산악 지역에서 힘 +2를 얻습니다." },
    { role: "치유사", sigil: "✚", strength: 3, ability: "recover", text: "전투에서 승리하면 가장 낮은 숫자 카드를 회수합니다." },
    { role: "달의 사수", sigil: "➶", strength: 3, ability: "giantSlayer", text: "기본 힘 6 이상인 적을 상대하면 힘 +2를 얻습니다." },
    { role: "돌의 수호자", sigil: "⬟", strength: 4, ability: "mountain", text: "산악 지역에서 힘 +2를 얻습니다." },
    { role: "별의 현자", sigil: "◉", strength: 4, ability: "silence", text: "상대 기물의 특수 능력을 무효화합니다." },
    { role: "새벽 대장", sigil: "♜", strength: 5, ability: "brave", text: "공격하거나 수비할 때 힘 +1을 얻습니다." },
    { role: "태양의 용사", sigil: "☀", strength: 6, ability: "steadfast", text: "힘이 같으면 혼자 살아남습니다." },
  ],
  shadow: [
    { role: "심연의 군주", sigil: "♛", strength: 9, ability: "none", text: "특수 능력 없이 압도적인 힘을 지녔습니다." },
    { role: "어둠의 폭군", sigil: "♚", strength: 7, ability: "none", text: "특수 능력 없이 강력한 힘을 지녔습니다." },
    { role: "밤의 칼날", sigil: "☾", strength: 6, ability: "swift", text: "공격할 때 힘 +2를 얻습니다." },
    { role: "침묵의 야수", sigil: "◆", strength: 5, ability: "silence", text: "상대 기물의 특수 능력을 무효화합니다." },
    { role: "검은 주술사", sigil: "✧", strength: 5, ability: "hex", text: "상대의 전투 카드 보너스를 1 낮춥니다." },
    { role: "빛 사냥꾼", sigil: "⌖", strength: 4, ability: "hunter", text: "빛의 운반자를 상대하면 힘 +4를 얻습니다." },
    { role: "그림자 기사", sigil: "♞", strength: 4, ability: "brave", text: "공격하거나 수비할 때 힘 +1을 얻습니다." },
    { role: "산의 잠복자", sigil: "▲", strength: 3, ability: "mountain", text: "산악 지역에서 힘 +2를 얻습니다." },
    { role: "복수의 망령", sigil: "☠", strength: 2, ability: "vengeance", text: "패배하면 승리한 적도 함께 제거합니다." },
  ],
};

export const CONFRONTATION_CARDS = [
  ...[1, 2, 3, 4, 5, 6].map((value) => ({
    id: `power-${value}`,
    name: `힘 ${value}`,
    kind: "power",
    value,
    text: `기물의 힘에 ${withKoreanObject(value)} 더합니다.`,
  })),
  { id: "guard", name: "수호", kind: "guard", value: 0, text: "상대 숫자 카드의 보너스를 무효화합니다." },
  { id: "surge", name: "돌격", kind: "surge", value: 0, text: "공격 중이면 +3, 수비 중이면 +1을 얻습니다." },
  { id: "retreat", name: "후퇴", kind: "retreat", value: 0, text: "가능하면 아군 방향의 인접 지역으로 물러납니다." },
];

export function confrontationRegion(regionId) {
  return CONFRONTATION_REGIONS.find((region) => region.id === regionId) ?? null;
}

export function confrontationConnected(fromId, toId) {
  const from = confrontationRegion(fromId);
  const to = confrontationRegion(toId);
  if (!from || !to) return false;
  if (Math.abs(from.level - to.level) !== 1) return false;
  if (from.terrain === "hold" || to.terrain === "hold") return true;
  return Math.abs(from.x - to.x) <= 0.6;
}

export function confrontationMoveTargets(piece, pieces, options = {}) {
  if (!piece?.alive) return [];
  const from = confrontationRegion(piece.regionId);
  if (!from) return [];
  const direction = piece.side === "dawn" ? 1 : -1;
  const targetLevel = from.level + direction;
  const targets = CONFRONTATION_LEVELS[targetLevel] ?? [];
  const regular = targets
    .filter((target) => {
      if (!confrontationConnected(from.id, target.id)) return false;
      const friendlyCount = pieces.filter(
        (other) => other.alive && other.side === piece.side && other.regionId === target.id,
      ).length;
      return friendlyCount < target.capacity;
    })
    .map((target) => ({ ...target, level: targetLevel }));

  if (
    options.includeTunnel !== false &&
    piece.side === "dawn" &&
    from.id === "moon-pass"
  ) {
    const tunnel = confrontationRegion("stone-hall");
    const friendlyCount = pieces.filter(
      (other) => other.alive && other.side === piece.side && other.regionId === tunnel.id,
    ).length;
    if (friendlyCount < tunnel.capacity) regular.push(tunnel);
  }

  return regular;
}

export function confrontationRetreatTargets(piece, pieces) {
  if (!piece?.alive) return [];
  const from = confrontationRegion(piece.regionId);
  if (!from) return [];
  const direction = piece.side === "dawn" ? -1 : 1;
  const targetLevel = from.level + direction;
  return (CONFRONTATION_LEVELS[targetLevel] ?? [])
    .filter((target) => {
      if (!confrontationConnected(from.id, target.id)) return false;
      const friendlyCount = pieces.filter(
        (other) => other.alive && other.side === piece.side && other.regionId === target.id,
      ).length;
      const enemyCount = pieces.filter(
        (other) => other.alive && other.side !== piece.side && other.regionId === target.id,
      ).length;
      return friendlyCount < target.capacity && enemyCount === 0;
    })
    .map((target) => ({ ...target, level: targetLevel }));
}

function cardBonus(card, isAttacker, opponentCard, opponentAbility) {
  if (!card) return 0;
  if (card.kind === "power") {
    if (opponentCard?.kind === "guard") return 0;
    return Math.max(0, card.value - (opponentAbility === "hex" ? 1 : 0));
  }
  if (card.kind === "surge") return isAttacker ? 3 : 1;
  return 0;
}

function abilityBonus(piece, opponent, region, isAttacker, silenced) {
  if (silenced) return 0;
  if (piece.ability === "swift" && isAttacker) return 2;
  if (piece.ability === "mountain" && region?.terrain === "mountain") return 2;
  if (piece.ability === "giantSlayer" && opponent.strength >= 6) return 2;
  if (piece.ability === "hunter" && opponent.ability === "bearer") return 4;
  if (piece.ability === "brave") return 1;
  return 0;
}

export function confrontationResolveCombat(attacker, defender, attackerCard, defenderCard, regionId) {
  const region = confrontationRegion(regionId);
  const attackerSilenced = defender.ability === "silence";
  const defenderSilenced = attacker.ability === "silence";
  const attackerAbility = abilityBonus(attacker, defender, region, true, attackerSilenced);
  const defenderAbility = abilityBonus(defender, attacker, region, false, defenderSilenced);
  const attackerTotal =
    attacker.strength +
    attackerAbility +
    cardBonus(attackerCard, true, defenderCard, defenderSilenced ? "none" : defender.ability);
  const defenderTotal =
    defender.strength +
    defenderAbility +
    cardBonus(defenderCard, false, attackerCard, attackerSilenced ? "none" : attacker.ability);

  let defeated;
  if (attackerTotal > defenderTotal) defeated = [defender.id];
  else if (defenderTotal > attackerTotal) defeated = [attacker.id];
  else if (attacker.ability === "steadfast" && !attackerSilenced) defeated = [defender.id];
  else if (defender.ability === "steadfast" && !defenderSilenced) defeated = [attacker.id];
  else defeated = [attacker.id, defender.id];

  const attackerFalls = defeated.includes(attacker.id);
  const defenderFalls = defeated.includes(defender.id);
  if (attackerFalls !== defenderFalls) {
    const loser = attackerFalls ? attacker : defender;
    const winner = attackerFalls ? defender : attacker;
    const loserSilenced = attackerFalls ? attackerSilenced : defenderSilenced;
    if (loser.ability === "vengeance" && !loserSilenced) defeated.push(winner.id);
  }

  return {
    attackerTotal,
    defenderTotal,
    attackerAbility,
    defenderAbility,
    defeated: [...new Set(defeated)],
  };
}

export function confrontationWinner(pieces, movedPiece = null) {
  const bearer = pieces.find((piece) => piece.side === "dawn" && piece.ability === "bearer");
  if (!bearer?.alive) return "shadow";
  if (bearer.regionId === "shadow-hold") return "dawn";
  const shadowInvaders = pieces.filter(
    (piece) => piece.alive && piece.side === "shadow" && piece.regionId === "dawn-hold",
  ).length;
  if (shadowInvaders >= 3) return "shadow";
  if (movedPiece?.ability === "bearer" && movedPiece.regionId === "shadow-hold") return "dawn";
  return null;
}

export function createConfrontationPieces(random = Math.random) {
  const shuffle = (items) => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  };

  return CONFRONTATION_SIDES.flatMap((side) => {
    const definitions = shuffle(CONFRONTATION_CHARACTERS[side]);
    const home = side === "dawn" ? "dawn-hold" : "shadow-hold";
    const front = side === "dawn" ? CONFRONTATION_LEVELS[1] : CONFRONTATION_LEVELS[5];
    return definitions.map((definition, index) => ({
      ...definition,
      id: `${side}-${index}`,
      side,
      regionId: index < 4 ? home : front[index - 4].id,
      alive: true,
    }));
  });
}

export function confrontationHasLegalMove(side, pieces) {
  return pieces.some(
    (piece) =>
      piece.alive &&
      piece.side === side &&
      confrontationMoveTargets(piece, pieces).length > 0,
  );
}
