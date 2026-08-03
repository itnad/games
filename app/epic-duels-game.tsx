"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { withKoreanObject } from "./korean-particles.js";
import {
  EPIC_DUELS_MAPS,
  EPIC_DUELS_TEAMS,
  epicCardValue,
  epicCreateMatch,
  epicDraw,
  epicMovementRoll,
  epicReachableCells,
  epicResolveCombat,
  epicValidTargets,
  epicWinner,
} from "./epic-duels-engine.js";

type Position = [number, number];
type DuelCard = {
  uid: string;
  name: string;
  character: "major" | "minor";
  type: "basic" | "power" | "special";
  attack: number | "hand" | null;
  defense: number | "hand" | "all" | null;
  effect: string;
  text: string;
  target?: string;
  free?: boolean;
};
type Figure = {
  id: string;
  role: "major" | "minor";
  name: string;
  mark: string;
  hp: number;
  maxHp: number;
  ranged: boolean;
  pos: Position;
  alive: boolean;
  stunned: boolean;
};
type DuelPlayer = {
  id: number;
  teamId: string;
  team: (typeof EPIC_DUELS_TEAMS)[number];
  figures: Figure[];
  deck: DuelCard[];
  hand: DuelCard[];
  discard: DuelCard[];
  recycles: number;
  skipActions: number;
  blockDraw: boolean;
};
type Match = {
  mapId: string;
  players: DuelPlayer[];
  current: number;
  round: number;
  winner: number | "draw" | null;
  log: string[];
};
type MoveRoll = { value: number; all: boolean };
type PendingCombat = {
  attackerId: string;
  defenderId: string;
  attackCardUid: string;
  attackerSide: number;
};
type Phase = "setup" | "move" | "action" | "replace-draw" | "target" | "defend" | "ai" | "game-over";

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function Topbar({ onExit }: { onExit: () => void }) {
  return (
    <header className="game-topbar epic-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup"><BrandMark /><div><span>paperoid</span><strong>스타워즈 에픽 듀얼</strong></div></div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

function cardStat(value: DuelCard["attack"] | DuelCard["defense"]) {
  if (value === "all") return "★";
  if (value === "hand") return "손패";
  return value ?? "—";
}

function CombatCard({
  card,
  selected,
  disabled,
  onClick,
}: {
  card: DuelCard;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={`epic-card ${card.type} ${selected ? "selected" : ""}`} disabled={disabled} onClick={onClick}>
      <small>{card.character === "major" ? "MAIN" : "ALLY"}</small>
      <strong>{card.name}</strong>
      {card.type !== "special" && <div><b>A {cardStat(card.attack)}</b><b>D {cardStat(card.defense)}</b></div>}
      {card.type === "special" && <span className="epic-special-mark">SPECIAL</span>}
      <p>{card.text || "기본 공격·방어 카드"}</p>
    </button>
  );
}

function teamIcon(team: (typeof EPIC_DUELS_TEAMS)[number]) {
  if (team.side === "light") return "✦";
  if (team.side === "dark") return "◆";
  return "⌖";
}

function cloneMatch(match: Match): Match {
  return structuredClone(match);
}

function findFigure(match: Match, figureId: string) {
  for (const player of match.players) {
    const figure = player.figures.find((item) => item.id === figureId);
    if (figure) return { player, figure };
  }
  return null;
}

function removeCard(player: DuelPlayer, uid: string) {
  const card = player.hand.find((item) => item.uid === uid);
  if (!card) return null;
  player.hand = player.hand.filter((item) => item.uid !== uid);
  player.discard.push(card);
  return card;
}

function drawInto(match: Match, side: number, count: number) {
  // Card effects and AI draws cannot open the human replacement picker. Keep
  // the official ten-card limit by discarding before each forced draw.
  for (let index = 0; index < count; index += 1) {
    if (match.players[side].hand.length >= 10) {
      const discarded = match.players[side].hand.shift();
      if (discarded) match.players[side].discard.push(discarded);
    }
    const result = epicDraw(match.players[side], 1);
    match.players[side] = result.player;
    if (result.exhaustedTwice) {
      const own = match.players[side].figures.find((figure) => figure.role === "major")!;
      const rival = match.players[1 - side].figures.find((figure) => figure.role === "major")!;
      const ownDamage = own.maxHp - own.hp;
      const rivalDamage = rival.maxHp - rival.hp;
      match.winner = ownDamage === rivalDamage ? "draw" : ownDamage < rivalDamage ? side : 1 - side;
      break;
    }
  }
}

function hurt(match: Match, figureId: string, amount: number) {
  const found = findFigure(match, figureId);
  if (!found || !found.figure.alive) return;
  found.figure.hp = Math.max(0, found.figure.hp - amount);
  if (found.figure.hp === 0) {
    found.figure.alive = false;
    found.figure.stunned = false;
  }
}

function heal(figure: Figure | undefined, amount: number) {
  if (figure?.alive) figure.hp = Math.min(figure.maxHp, figure.hp + amount);
}

function nearestEmpty(match: Match, figure: Figure, toward: Figure | null, far = false) {
  const cells = epicReachableCells(match, figure.id, 8) as Position[];
  if (!cells.length) return figure.pos;
  const target = toward?.pos ?? [4, 4];
  return [...cells].sort((a, b) => {
    const da = Math.abs(a[0] - target[0]) + Math.abs(a[1] - target[1]);
    const db = Math.abs(b[0] - target[0]) + Math.abs(b[1] - target[1]);
    return far ? db - da : da - db;
  })[0];
}

function killCheck(match: Match) {
  if (match.winner === null) match.winner = epicWinner(match);
  if (typeof match.winner === "number") match.log.unshift(`${match.players[match.winner].team.major.name} 팀이 결투에서 승리했습니다.`);
  if (match.winner === "draw") match.log.unshift("양쪽 주인공이 받은 피해가 같아 무승부입니다.");
}

export function EpicDuelsGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [playerTeamId, setPlayerTeamId] = useState("luke");
  const [aiTeamId, setAiTeamId] = useState("vader");
  const [mapId, setMapId] = useState("carbon");
  const [match, setMatch] = useState<Match | null>(null);
  const [moveRoll, setMoveRoll] = useState<MoveRoll | null>(null);
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null);
  const [movedIds, setMovedIds] = useState<string[]>([]);
  const [actions, setActions] = useState(2);
  const [pendingCardUid, setPendingCardUid] = useState<string | null>(null);
  const [pendingCombat, setPendingCombat] = useState<PendingCombat | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const player = match?.players[0];
  const ai = match?.players[1];
  const selectedCard = player?.hand.find((card) => card.uid === pendingCardUid) ?? null;
  const activeMap = EPIC_DUELS_MAPS.find((map) => map.id === (match?.mapId ?? mapId))!;

  const reachable = useMemo(() => {
    if (!match || phase !== "move" || !selectedFigureId || !moveRoll) return [];
    return epicReachableCells(match, selectedFigureId, moveRoll.value) as Position[];
  }, [match, moveRoll, phase, selectedFigureId]);

  const targetIds = useMemo(() => {
    if (!match || phase !== "target" || !selectedCard) return [];
    if (selectedCard.type !== "special") {
      const roleFigures = player!.figures.filter((figure) => figure.alive && figure.role === selectedCard.character);
      const attacker = roleFigures.find((figure) => figure.id === selectedFigureId) ?? roleFigures[0];
      return attacker ? epicValidTargets(match, attacker.id) as string[] : [];
    }
    const enemies = ai!.figures.filter((figure) => figure.alive);
    if (selectedCard.target === "enemy-minor") return enemies.filter((figure) => figure.role === "minor").map((figure) => figure.id);
    if (selectedCard.target === "adjacent") {
      const actor = player!.figures.find((figure) => figure.alive && figure.role === selectedCard.character) ?? player!.figures[0];
      return enemies.filter((figure) => Math.max(Math.abs(figure.pos[0] - actor.pos[0]), Math.abs(figure.pos[1] - actor.pos[1])) === 1).map((figure) => figure.id);
    }
    return enemies.map((figure) => figure.id);
  }, [ai, match, phase, player, selectedCard, selectedFigureId]);

  function beginHumanTurn(nextMatch: Match) {
    const prepared = cloneMatch(nextMatch);
    prepared.current = 0;
    prepared.round += 1;
    prepared.players[0].figures.forEach((figure) => {
      if (figure.stunned && prepared.players[0].hand.length >= 3) {
        const released = prepared.players[0].hand.splice(0, 3);
        prepared.players[0].discard.push(...released);
        figure.stunned = false;
      }
    });
    const roll = epicMovementRoll();
    prepared.players[0].skipActions = 0;
    setMatch(prepared);
    setMoveRoll(roll);
    setSelectedFigureId(null);
    setMovedIds([]);
    setActions(Math.max(1, 2 - nextMatch.players[0].skipActions));
    setPendingCardUid(null);
    setPhase("move");
  }

  function startGame() {
    const next = epicCreateMatch(playerTeamId, aiTeamId, mapId) as Match;
    next.round = 0;
    beginHumanTurn(next);
  }

  function moveFigure(figureId: string, position: Position) {
    if (!match || phase !== "move") return;
    const allowed = reachable.some(([row, column]) => row === position[0] && column === position[1]);
    if (!allowed || selectedFigureId !== figureId) return;
    const next = cloneMatch(match);
    const figure = findFigure(next, figureId)!.figure;
    figure.pos = position;
    const nextMoved = [...movedIds, figureId];
    setMatch(next);
    setMovedIds(nextMoved);
    setSelectedFigureId(null);
    if (!moveRoll?.all) setPhase("action");
  }

  function clickCell(row: number, column: number) {
    if (!match) return;
    const occupant = match.players.flatMap((side) => side.figures).find((figure) => figure.alive && figure.pos[0] === row && figure.pos[1] === column);
    if (occupant) {
      if (phase === "move" && occupant.id.startsWith("0-") && !movedIds.includes(occupant.id)) {
        setSelectedFigureId(occupant.id);
      } else if (phase === "action" && occupant.id.startsWith("0-")) {
        setSelectedFigureId(occupant.id);
      } else if (phase === "target" && targetIds.includes(occupant.id)) {
        resolveTarget(occupant.id);
      }
      return;
    }
    if (phase === "move" && selectedFigureId) moveFigure(selectedFigureId, [row, column]);
  }

  function finishMovement() {
    if (phase === "move") {
      setSelectedFigureId(player?.figures.find((figure) => figure.alive)?.id ?? null);
      setPhase("action");
    }
  }

  function finishHumanAction(next: Match, spent = 1) {
    killCheck(next);
    if (next.winner !== null) {
      setMatch(next);
      setPhase("game-over");
      return;
    }
    const remaining = actions - spent;
    setMatch(next);
    setActions(remaining);
    setPendingCardUid(null);
    if (remaining <= 0) setPhase("ai");
    else setPhase("action");
  }

  function drawCard() {
    if (!match || phase !== "action" || actions <= 0) return;
    const next = cloneMatch(match);
    if (next.players[0].blockDraw) {
      next.players[0].blockDraw = false;
      next.log.unshift("명상 효과로 이번 카드 뽑기가 막혔습니다.");
    } else if (next.players[0].hand.length >= 10) {
      setPhase("replace-draw");
      return;
    } else {
      drawInto(next, 0, 1);
      next.log.unshift("카드 한 장을 뽑았습니다.");
    }
    finishHumanAction(next);
  }

  function replaceAndDraw(cardUid: string) {
    if (!match || phase !== "replace-draw") return;
    const next = cloneMatch(match);
    const discarded = removeCard(next.players[0], cardUid);
    if (!discarded) return;
    drawInto(next, 0, 1);
    next.log.unshift(`${withKoreanObject(discarded.name)} 버리고 새 카드 한 장을 뽑았습니다.`);
    finishHumanAction(next);
  }

  function chooseCard(card: DuelCard) {
    if (!match || phase !== "action") return;
    if (card.character === "minor" && card.type !== "special" && !player!.figures.some((figure) => figure.role === "minor" && figure.alive)) {
      const next = cloneMatch(match);
      removeCard(next.players[0], card.uid);
      heal(next.players[0].figures.find((figure) => figure.role === "major"), 1);
      next.log.unshift("쓰러진 동료의 카드로 주인공이 1회복했습니다.");
      finishHumanAction(next);
      return;
    }
    if (card.type === "special") {
      if (card.target && card.target !== "none") {
        setPendingCardUid(card.uid);
        setPhase("target");
      } else {
        playSpecial(card, null);
      }
      return;
    }
    const candidates = player!.figures.filter((figure) => figure.alive && !figure.stunned && figure.role === card.character);
    const attacker = candidates.find((figure) => figure.id === selectedFigureId) ?? candidates[0];
    if (!attacker || !(epicValidTargets(match, attacker.id) as string[]).length) return;
    setSelectedFigureId(attacker.id);
    setPendingCardUid(card.uid);
    setPhase("target");
  }

  function resolveTarget(targetId: string) {
    if (!match || !selectedCard) return;
    if (selectedCard.type === "special") playSpecial(selectedCard, targetId);
    else attackWithCard(selectedCard, targetId);
  }

  function playSpecial(card: DuelCard, targetId: string | null) {
    if (!match) return;
    const next = cloneMatch(match);
    const own = next.players[0];
    const rival = next.players[1];
    removeCard(own, card.uid);
    const actor = own.figures.find((figure) => figure.alive && figure.role === card.character) ?? own.figures.find((figure) => figure.alive)!;
    const enemy = targetId ? findFigure(next, targetId)?.figure : rival.figures.find((figure) => figure.alive && figure.role === "major");
    const randomDiscard = (count: number, predicate: (item: DuelCard) => boolean = () => true) => {
      const cards = rival.hand.filter(predicate).slice(0, count);
      rival.hand = rival.hand.filter((item) => !cards.some((cardItem) => cardItem.uid === item.uid));
      rival.discard.push(...cards);
    };

    if (["minor-seven", "minor-six", "damage-four"].includes(card.effect) && enemy) {
      hurt(next, enemy.id, card.effect === "minor-seven" ? 7 : card.effect === "minor-six" ? 6 : 4);
    } else if (card.effect === "blast-four" && enemy) {
      for (const figure of next.players.flatMap((side) => side.figures).filter((figure) => figure.alive && Math.max(Math.abs(figure.pos[0] - enemy.pos[0]), Math.abs(figure.pos[1] - enemy.pos[1])) <= 1)) hurt(next, figure.id, 4);
    } else if (["cable", "push-one", "push-three"].includes(card.effect) && enemy) {
      const damage = card.effect === "cable" ? 2 : card.effect === "push-one" ? 1 : 3;
      hurt(next, enemy.id, damage);
      if (card.effect === "cable") rival.skipActions += 1;
      else enemy.pos = nearestEmpty(next, enemy, actor, true);
    } else if (card.effect === "lightning" && enemy) {
      hurt(next, enemy.id, 3);
      randomDiscard(1);
    } else if (card.effect === "stun" && enemy) {
      enemy.stunned = true;
    } else if (card.effect === "draw-three") drawInto(next, 0, 3);
    else if (card.effect === "discard-random-two") randomDiscard(2);
    else if (card.effect === "discard-all") randomDiscard(rival.hand.length);
    else if (card.effect === "discard-specials") randomDiscard(rival.hand.length, (item) => item.type === "special");
    else if (card.effect === "damage-all-two") rival.figures.filter((figure) => figure.alive).forEach((figure) => hurt(next, figure.id, 2));
    else if (["ranged-all-two", "ranged-all-four"].includes(card.effect)) {
      const damage = card.effect === "ranged-all-two" ? 2 : 4;
      (epicValidTargets(next, actor.id) as string[]).forEach((id) => hurt(next, id, damage));
      if (card.effect === "ranged-all-two") {
        own.deck = [...own.deck, ...own.discard];
        own.discard = [];
      }
    } else if (card.effect === "adjacent-all-two") {
      next.players.flatMap((side) => side.figures).filter((figure) => figure.alive && figure.id !== actor.id && Math.max(Math.abs(figure.pos[0] - actor.pos[0]), Math.abs(figure.pos[1] - actor.pos[1])) === 1).forEach((figure) => hurt(next, figure.id, 2));
    } else if (card.effect === "calm") {
      actor.pos = nearestEmpty(next, actor, null);
      if (!own.hand.length) drawInto(next, 0, 5);
    } else if (card.effect === "protect-padme") {
      heal(own.figures.find((figure) => figure.role === "minor"), own.figures.find((figure) => figure.role === "major")?.alive ? 4 : 2);
    } else if (card.effect === "heal-minor-three") {
      const minor = own.figures.find((figure) => figure.role === "minor");
      heal(minor, 3);
      if (minor) minor.pos = nearestEmpty(next, minor, rival.figures.find((figure) => figure.alive) ?? null, true);
    }
    else if (card.effect === "heal-luke-three") heal(own.figures.find((figure) => figure.role === "major"), 3);
    else if (card.effect === "move-major-draw") {
      actor.pos = nearestEmpty(next, actor, null);
      drawInto(next, 0, 1);
    } else if (card.effect === "move-both-draw-two" || card.effect === "move-team") {
      own.figures.filter((figure) => figure.alive).forEach((figure) => { figure.pos = nearestEmpty(next, figure, rival.figures.find((item) => item.alive) ?? null); });
      if (card.effect === "move-both-draw-two") drawInto(next, 0, 2);
    } else if (card.effect === "teleport-major" || card.effect === "minor-arrival") {
      actor.pos = nearestEmpty(next, actor, enemy ?? null);
    } else if (card.effect === "foresee") drawInto(next, 0, 1);
    else if (card.effect === "meditate") {
      heal(actor, 4);
      rival.blockDraw = true;
    } else if (card.effect === "swap-guard") {
      const guard = own.figures.find((figure) => figure.alive && figure.role === "minor");
      if (guard) [actor.pos, guard.pos] = [guard.pos, actor.pos];
    } else if (card.effect === "force-balance") {
      own.discard.push(...own.hand); own.hand = [];
      rival.discard.push(...rival.hand); rival.hand = [];
      drawInto(next, 0, 3); drawInto(next, 1, 3);
    } else if (card.effect === "recover-discard") {
      const recovered = own.discard.find((item) => item.uid !== card.uid);
      if (recovered) {
        own.discard = own.discard.filter((item) => item.uid !== recovered.uid);
        own.hand.push(recovered);
      }
    } else if (card.effect === "find-bowcaster") {
      const found = own.deck.find((item) => item.name === "Bowcaster Attack");
      if (found) {
        own.deck = own.deck.filter((item) => item.uid !== found.uid);
        own.hand.push(found);
      }
    } else if (card.effect === "discard-high-attacks") {
      for (const side of next.players) {
        const thrown = side.hand.filter((item) => Number(item.attack ?? 0) > 1);
        side.hand = side.hand.filter((item) => !thrown.some((discarded) => discarded.uid === item.uid));
        side.discard.push(...thrown);
      }
    } else if (card.effect === "inspect-discard") randomDiscard(1);

    next.log.unshift(`${card.name} 사용 · ${card.text}`);
    finishHumanAction(next, card.free ? 0 : 1);
  }

  function attackWithCard(card: DuelCard, defenderId: string) {
    if (!match) return;
    const next = cloneMatch(match);
    const attacker = next.players[0].figures.find((figure) => figure.id === selectedFigureId)
      ?? next.players[0].figures.find((figure) => figure.alive && figure.role === card.character)!;
    const defender = findFigure(next, defenderId)!.figure;
    const aiDefense = next.players[1].hand
      .filter((item) => item.character === defender.role && item.type !== "special" && epicCardValue(item, "defense", next.players[1].hand.length - 1) > 0)
      .sort((a, b) => epicCardValue(a, "defense", next.players[1].hand.length - 1) - epicCardValue(b, "defense", next.players[1].hand.length - 1))[0];
    resolveCombat(next, 0, attacker.id, defender.id, card.uid, aiDefense?.uid ?? null);
  }

  function resolveCombat(next: Match, attackerSide: number, attackerId: string, defenderId: string, attackUid: string, defenseUid: string | null) {
    const defenderSide = 1 - attackerSide;
    const attackerOwner = next.players[attackerSide];
    const defenderOwner = next.players[defenderSide];
    const attackCard = attackerOwner.hand.find((item) => item.uid === attackUid)!;
    const defenseCard = defenderOwner.hand.find((item) => item.uid === defenseUid) ?? null;
    const attacker = findFigure(next, attackerId)!.figure;
    const defender = findFigure(next, defenderId)!.figure;
    const minorDead = !attackerOwner.figures.some((figure) => figure.role === "minor" && figure.alive);
    const result = epicResolveCombat(attacker, defender, attackCard, defenseCard, {
      attackerHandCount: attackerOwner.hand.length - 1,
      defenderHandCount: defenderOwner.hand.length - (defenseCard ? 1 : 0),
      minorDead,
    });
    removeCard(attackerOwner, attackUid);
    if (defenseCard) removeCard(defenderOwner, defenseCard.uid);
    hurt(next, defenderId, result.damage);
    hurt(next, attackerId, result.reflected);

    const defeated = !defender.alive;
    if (attackCard.effect === "draw-one") drawInto(next, attackerSide, 1);
    if (attackCard.effect === "draw-two") drawInto(next, attackerSide, 2);
    if (attackCard.effect === "draw-three") drawInto(next, attackerSide, attackCard.name === "Missile Launch" && next.mapId === "kamino" ? 4 : 3);
    if (attackCard.effect === "kill-draw-three" && defeated) drawInto(next, attackerSide, 3);
    if (attackCard.effect === "life-steal") heal(attacker, result.damage);
    if (attackCard.effect === "discard-to-one") {
      const extras = attackerOwner.hand.slice(1);
      attackerOwner.hand = attackerOwner.hand.slice(0, 1);
      attackerOwner.discard.push(...extras);
    }
    if (attackCard.effect === "damage-discard" && result.damage) {
      const discarded = defenderOwner.hand.shift();
      if (discarded) defenderOwner.discard.push(discarded);
    }
    if (attackCard.effect === "cycle-one" && attackerOwner.hand.length) {
      const cycled = attackerOwner.hand.shift()!;
      attackerOwner.discard.push(cycled);
      drawInto(next, attackerSide, 1);
    }
    if (attackCard.effect === "greedo-risk" && !defeated) {
      const greedo = attackerOwner.figures.find((figure) => figure.role === "minor");
      if (greedo) hurt(next, greedo.id, greedo.hp);
    }
    if (["retreat-six", "retreat-five", "retreat-any"].includes(attackCard.effect)) {
      attacker.pos = nearestEmpty(next, attacker, defender, true);
    }
    if (attackCard.effect === "scatter") {
      next.players.flatMap((side) => side.figures).filter((figure) => figure.alive && figure.id !== attacker.id).forEach((figure) => {
        figure.pos = nearestEmpty(next, figure, attacker, true);
      });
    }
    if (defenseCard?.effect === "draw-one") drawInto(next, defenderSide, 1);
    next.log.unshift(`${attacker.name} ${result.attack} 대 ${defender.name} ${result.defense} · ${result.damage}피해`);
    killCheck(next);

    if (attackerSide === 0) finishHumanAction(next, attackCard.effect === "free-attack" ? 0 : 1);
    else {
      setMatch(next);
      if (next.winner !== null) setPhase("game-over");
      else {
        drawInto(next, 1, 1);
        beginHumanTurn(next);
      }
    }
  }

  function chooseDefense(cardUid: string | null) {
    if (!match || !pendingCombat) return;
    const next = cloneMatch(match);
    const combat = pendingCombat;
    setPendingCombat(null);
    resolveCombat(next, combat.attackerSide, combat.attackerId, combat.defenderId, combat.attackCardUid, cardUid);
  }

  function runAiTurn() {
    if (!match || phase !== "ai") return;
    const next = cloneMatch(match);
    next.current = 1;
    const roll = epicMovementRoll();
    const aiPlayer = next.players[1];
    const enemies = next.players[0].figures.filter((figure) => figure.alive);
    aiPlayer.figures.forEach((figure) => {
      if (figure.stunned && aiPlayer.hand.length >= 3) {
        const released = aiPlayer.hand.splice(0, 3);
        aiPlayer.discard.push(...released);
        figure.stunned = false;
      }
    });
    const movers = roll.all ? aiPlayer.figures.filter((figure) => figure.alive && !figure.stunned) : [aiPlayer.figures.find((figure) => figure.alive && !figure.stunned)!].filter(Boolean);
    for (const figure of movers) {
      const target = [...enemies].sort((a, b) => Math.abs(a.pos[0] - figure.pos[0]) + Math.abs(a.pos[1] - figure.pos[1]) - (Math.abs(b.pos[0] - figure.pos[0]) + Math.abs(b.pos[1] - figure.pos[1])))[0];
      const cells = epicReachableCells(next, figure.id, roll.value) as Position[];
      if (cells.length && target) figure.pos = [...cells].sort((a, b) => Math.abs(a[0] - target.pos[0]) + Math.abs(a[1] - target.pos[1]) - (Math.abs(b[0] - target.pos[0]) + Math.abs(b[1] - target.pos[1])))[0];
    }

    const directSpecial = aiPlayer.hand.find((card) =>
      ["minor-seven", "minor-six", "damage-four", "lightning", "damage-all-two", "ranged-all-two", "ranged-all-four"].includes(card.effect),
    );
    if (directSpecial) {
      removeCard(aiPlayer, directSpecial.uid);
      if (["minor-seven", "minor-six"].includes(directSpecial.effect)) {
        const target = enemies.find((figure) => figure.role === "minor") ?? enemies[0];
        if (target) hurt(next, target.id, directSpecial.effect === "minor-seven" ? 7 : 6);
      } else if (directSpecial.effect === "damage-all-two") {
        enemies.forEach((figure) => hurt(next, figure.id, 2));
      } else if (["ranged-all-two", "ranged-all-four"].includes(directSpecial.effect)) {
        const actor = aiPlayer.figures.find((figure) => figure.alive && figure.role === directSpecial.character) ?? aiPlayer.figures[0];
        const damage = directSpecial.effect === "ranged-all-two" ? 2 : 4;
        (epicValidTargets(next, actor.id) as string[]).forEach((id) => hurt(next, id, damage));
      } else {
        const target = enemies.find((figure) => figure.role === "major") ?? enemies[0];
        if (target) hurt(next, target.id, directSpecial.effect === "lightning" ? 3 : 4);
        if (directSpecial.effect === "lightning") {
          const thrown = next.players[0].hand.shift();
          if (thrown) next.players[0].discard.push(thrown);
        }
      }
      next.log.unshift(`${aiPlayer.team.major.name} 팀이 ${withKoreanObject(directSpecial.name)} 사용했습니다.`);
      killCheck(next);
      if (next.winner !== null) {
        setMatch(next);
        setPhase("game-over");
        return;
      }
    }

    const options = aiPlayer.hand.flatMap((card) => {
      if (card.type === "special") return [];
      const actors = aiPlayer.figures.filter((figure) => figure.alive && !figure.stunned && figure.role === card.character);
      return actors.flatMap((attacker) => (epicValidTargets(next, attacker.id) as string[]).map((defenderId) => ({
        card, attacker, defenderId, value: epicCardValue(card, "attack", aiPlayer.hand.length - 1),
      })));
    }).sort((a, b) => b.value - a.value);

    if (options[0]) {
      const attack = options[0];
      setMatch(next);
      setPendingCombat({ attackerId: attack.attacker.id, defenderId: attack.defenderId, attackCardUid: attack.card.uid, attackerSide: 1 });
      setPhase("defend");
    } else {
      if (!aiPlayer.blockDraw) drawInto(next, 1, directSpecial ? 1 : 2);
      else aiPlayer.blockDraw = false;
      next.log.unshift(`${aiPlayer.team.major.name} 팀이 전열을 정비했습니다.`);
      beginHumanTurn(next);
    }
  }

  useEffect(() => {
    if (phase !== "ai") return;
    const timer = window.setTimeout(runAiTurn, 650);
    return () => window.clearTimeout(timer);
  });

  const defenseOptions = useMemo(() => {
    if (!match || !pendingCombat) return [];
    const defender = findFigure(match, pendingCombat.defenderId)?.figure;
    if (!defender) return [];
    return match.players[0].hand.filter((card) => card.character === defender.role && card.type !== "special" && epicCardValue(card, "defense", match.players[0].hand.length - 1) > 0);
  }, [match, pendingCombat]);

  return (
    <main className="game-shell epic-shell">
      <Topbar onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel epic-info">
          <div><span className="eyebrow">MOVE · DRAW · DUEL</span><h1>은하의 운명을 건<br />전설적인 결투</h1><p>주인공과 동료를 움직이고 공격·방어 카드를 읽어 상대 주인공을 쓰러뜨리세요.</p></div>
          {match ? (
            <div className="epic-side-status">
              <div><span>라운드</span><b>{match.round}</b></div>
              <div><span>내 손패</span><b>{player?.hand.length ?? 0}/10</b></div>
              <div><span>남은 행동</span><b>{phase === "action" ? actions : "—"}</b></div>
            </div>
          ) : <div className="epic-side-note"><span>원작 구성</span><b>12개 팀 · 4개 전장</b><small>AI 1:1 대전</small></div>}
          <button className="epic-rules-button" onClick={() => setRulesOpen(true)}>ⓘ 게임 방법과 카드 규칙</button>
        </aside>

        <div className="board-panel epic-board-panel">
          {phase === "setup" ? (
            <section className="epic-setup">
              <div className="epic-setup-heading"><span>CHOOSE YOUR DESTINY</span><h2>결투에 나설<br />두 팀을 선택하세요</h2><p>12개 원작 팀은 각각 다른 체력, 31장 덱과 특수 능력을 가집니다.</p></div>
              <div className="epic-team-columns">
                <section><header><span>PLAYER 1</span><strong>내 팀</strong></header><div>{EPIC_DUELS_TEAMS.map((team) => <button key={team.id} className={playerTeamId === team.id ? "active" : ""} style={{ "--team-color": team.color } as CSSProperties} onClick={() => setPlayerTeamId(team.id)}><i>{teamIcon(team)}</i><span><strong>{team.major.name}</strong><small>{team.minors.map((minor) => minor.name.replace(/ \d$/, "")).join(" · ")}</small></span><b>{team.major.hp}</b></button>)}</div></section>
                <section><header><span>OPPONENT</span><strong>AI 팀</strong></header><div>{EPIC_DUELS_TEAMS.map((team) => <button key={team.id} className={aiTeamId === team.id ? "active" : ""} style={{ "--team-color": team.color } as CSSProperties} onClick={() => setAiTeamId(team.id)}><i>{teamIcon(team)}</i><span><strong>{team.major.name}</strong><small>{team.minors.map((minor) => minor.name.replace(/ \d$/, "")).join(" · ")}</small></span><b>{team.major.hp}</b></button>)}</div></section>
              </div>
              <section className="epic-map-picker"><header><span>BATTLEFIELD</span><strong>전장 선택</strong></header><div>{EPIC_DUELS_MAPS.map((map) => <button key={map.id} className={mapId === map.id ? "active" : ""} onClick={() => setMapId(map.id)}><i>{map.id === "kamino" ? "☂" : map.id === "geonosis" ? "◉" : map.id === "carbon" ? "▥" : "♛"}</i><span><strong>{map.name}</strong><small>{map.subtitle}</small></span></button>)}</div></section>
              <button className="epic-start-button" onClick={startGame}>에픽 듀얼 시작 <span>→</span></button>
            </section>
          ) : match && (
            <>
              <section className="epic-versus">
                {[player!, ai!].map((duelist, side) => <article key={duelist.id} className={side === 0 ? "player" : "enemy"} style={{ "--team-color": duelist.team.color } as CSSProperties}><span>{side === 0 ? "PLAYER" : "AI"}</span><strong>{duelist.team.major.name}</strong><div>{duelist.figures.map((figure) => <i key={figure.id} className={!figure.alive ? "dead" : ""}>{figure.mark}<small>{figure.hp}/{figure.maxHp}</small></i>)}</div><b>{duelist.hand.length}장</b></article>)}
                <em>VS</em>
              </section>

              <header className="epic-turn-head">
                <div><span>{activeMap.name}</span><h2>{phase === "move" ? "캐릭터를 이동하세요" : phase === "action" ? `행동을 선택하세요 · ${actions}회 남음` : phase === "replace-draw" ? "버리고 교체할 카드 한 장을 고르세요" : phase === "target" ? "대상을 선택하세요" : phase === "defend" ? "공격을 방어하세요" : phase === "ai" ? "AI가 전술을 계산합니다" : "결투 종료"}</h2></div>
                {moveRoll && phase === "move" && <div className={`epic-roll ${moveRoll.all ? "all" : ""}`}><b>{moveRoll.value}</b><span>{moveRoll.all ? "ALL MOVE" : "ONE MOVE"}</span></div>}
              </header>

              <section className={`epic-arena ${activeMap.id}`}>
                <div className="epic-grid" role="grid" aria-label={`${activeMap.name} 9 곱하기 9 전장`}>
                  {Array.from({ length: 81 }, (_, index) => {
                    const row = Math.floor(index / 9);
                    const column = index % 9;
                    const obstacle = activeMap.obstacles.some(([r, c]) => r === row && c === column);
                    const figure = match.players.flatMap((side) => side.figures).find((item) => item.alive && item.pos[0] === row && item.pos[1] === column);
                    const canMove = reachable.some(([r, c]) => r === row && c === column);
                    const canTarget = Boolean(figure && targetIds.includes(figure.id));
                    return <button key={index} role="gridcell" className={`${obstacle ? "obstacle" : ""} ${canMove ? "reachable" : ""} ${canTarget ? "target" : ""}`} disabled={obstacle} onClick={() => clickCell(row, column)}>{obstacle && <span className="epic-obstacle">◆</span>}{figure && <span className={`epic-figure side-${figure.id.startsWith("0-") ? 0 : 1} ${selectedFigureId === figure.id ? "selected" : ""} ${figure.stunned ? "stunned" : ""}`} style={{ "--figure-color": match.players[figure.id.startsWith("0-") ? 0 : 1].team.color } as CSSProperties}><b>{figure.mark}</b><small>{figure.hp}</small></span>}</button>;
                  })}
                </div>
              </section>

              {phase === "move" && <div className="epic-move-actions"><p>{moveRoll?.all ? "살아 있는 캐릭터를 각각 한 번씩 이동할 수 있습니다." : "이동할 캐릭터 하나와 도착 칸을 선택하세요."}</p><button onClick={finishMovement}>이동 완료 · 행동 단계로</button></div>}

              {(phase === "action" || phase === "replace-draw") && (
                <section className="epic-hand">
                  <header><div><span>YOUR HAND</span><strong>{phase === "replace-draw" ? "손패 제한 · 10장" : "내 전투 카드"}</strong></div><div>{phase === "action" ? <><button onClick={drawCard}>＋ 카드 뽑기</button><button onClick={() => setPhase("ai")}>턴 종료</button></> : <button onClick={() => setPhase("action")}>교체 취소</button>}</div></header>
                  <p>{phase === "replace-draw" ? "공식 규칙에 따라 카드 한 장을 버린 뒤 새 카드 한 장을 뽑습니다." : "전장에서 공격할 캐릭터를 먼저 선택하면 해당 캐릭터의 사용 가능한 공격을 확인하기 쉽습니다."}</p>
                  <div>{player!.hand.map((card) => <CombatCard key={card.uid} card={card} onClick={() => phase === "replace-draw" ? replaceAndDraw(card.uid) : chooseCard(card)} />)}</div>
                </section>
              )}

              {phase === "target" && selectedCard && (
                <section className="epic-prompt"><span>⌖</span><div><small>선택한 카드</small><h3>{selectedCard.name}</h3><p>{targetIds.length ? "빛나는 적 기물을 선택하세요." : "현재 선택할 수 있는 대상이 없습니다."}</p></div><button onClick={() => { setPendingCardUid(null); setPhase("action"); }}>취소</button></section>
              )}

              {phase === "defend" && pendingCombat && (
                <section className="epic-defense">
                  <header><span>⚠ INCOMING ATTACK</span><h3>{findFigure(match, pendingCombat.attackerId)?.figure.name}의 공격!</h3><p>방어 카드를 한 장 내거나 피해를 그대로 받을 수 있습니다.</p></header>
                  <div>{defenseOptions.map((card) => <CombatCard key={card.uid} card={card} onClick={() => chooseDefense(card.uid)} />)}</div>
                  <button onClick={() => chooseDefense(null)}>방어하지 않기</button>
                </section>
              )}

              {phase === "game-over" && (
                <section className="epic-result"><span>{match.winner === "draw" ? "◇" : match.winner === 0 ? "✦" : "◆"}</span><div><small>DUEL COMPLETE</small><h2>{match.winner === "draw" ? "무승부" : `${match.players[match.winner ?? 0].team.major.name} 팀 승리`}</h2><p>{match.winner === "draw" ? "두 번째 덱 소진 때 양쪽 주인공이 받은 피해가 같았습니다." : "상대 주인공의 체력이 모두 소진되었습니다."}</p></div><button onClick={startGame}>같은 조합으로 다시 결투</button><button className="secondary" onClick={() => setPhase("setup")}>팀 다시 선택</button></section>
              )}

              <section className="epic-log"><strong>BATTLE LOG</strong><div>{match.log.slice(0, 6).map((entry, index) => <span key={`${entry}-${index}`}>{entry}</span>)}</div></section>
            </>
          )}
        </div>
      </section>

      {rulesOpen && (
        <div className="epic-modal-backdrop" onClick={() => setRulesOpen(false)}>
          <section className="epic-rules-modal" role="dialog" aria-modal="true" aria-labelledby="epic-rules-title" onClick={(event) => event.stopPropagation()}>
            <header><div><span>HOW TO PLAY</span><h2 id="epic-rules-title">에픽 듀얼 게임 방법</h2></div><button onClick={() => setRulesOpen(false)}>×</button></header>
            <div className="epic-rule-grid">
              <article><b>1</b><div><strong>이동 주사위</strong><p>3·4·5 면은 캐릭터 하나, ALL 2·3·4 면은 내 모든 캐릭터를 표시된 칸 수까지 이동시킵니다.</p></div></article>
              <article><b>2</b><div><strong>행동 두 번</strong><p>이동 후 카드 뽑기, 공격·특수 카드 사용, 쓰러진 동료 카드로 회복 중 두 행동을 합니다.</p></div></article>
              <article><b>3</b><div><strong>공격과 방어</strong><p>공격자는 카드를 내고 방어자는 같은 캐릭터의 카드를 선택합니다. 공격−방어 차이만큼 피해를 받습니다.</p></div></article>
              <article><b>4</b><div><strong>사거리</strong><p>근접 캐릭터는 인접한 적을, 원거리 캐릭터는 장애물과 다른 캐릭터에 막히지 않는 직선상의 적을 공격합니다.</p></div></article>
            </div>
            <div className="epic-card-guide"><span><b>A</b> 공격력</span><span><b>D</b> 방어력</span><span><b>★</b> 피해 완전 방어</span><span><b>손패</b> 남은 카드 수만큼</span></div>
            <p className="epic-rule-note">각 팀의 덱은 기본 전투 카드 19장과 고유 능력 카드 12장, 총 31장입니다. 손패가 10장일 때 뽑기 행동을 하면 먼저 한 장을 버리고 교체합니다. 덱을 두 번 소진하면 주인공이 받은 피해가 적은 쪽이 이기며, 피해가 같으면 무승부입니다.</p>
            <button className="epic-modal-close" onClick={() => setRulesOpen(false)}>확인하고 계속하기</button>
          </section>
        </div>
      )}
    </main>
  );
}
