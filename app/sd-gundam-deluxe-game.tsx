"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { withKoreanAnd, withKoreanDirection, withKoreanObject, withKoreanSubject, withKoreanTopic } from "./korean-particles.js";
import {
  SD_FORTRESS_BONUSES,
  SD_FORTRESS_CANNONS,
  SD_FORTRESS_OBSTACLES,
  SD_FORTRESS_SIZE,
  SD_SPACE_BASES,
  SD_SPACE_ROUTE_LENGTH,
  sdCaptureResult,
  sdCreateSpaceGame,
  sdDrawCards,
  sdDuelResult,
  sdFortressCannonCells,
  sdFortressCreateGame,
  sdFortressReachable,
  sdFortressResolveBattle,
  sdSpaceKind,
} from "./sd-gundam-deluxe-engine.js";

type Mode = "space" | "fortress";
type BattleCard = { id: string; name: string; hp: number };
type SpaceBase = (typeof SD_SPACE_BASES)[number] & { owner: number | null };
type SpacePlayer = {
  id: number;
  name: string;
  color: string;
  position: number;
  hand: BattleCard[];
  bases: string[];
  skip: boolean;
};
type SpaceGame = {
  players: SpacePlayer[];
  deck: BattleCard[];
  discard: BattleCard[];
  bases: SpaceBase[];
  current: number;
  turn: number;
  log: string[];
  winner: number | null;
};
type PendingSpace =
  | { type: "base"; baseId: string }
  | { type: "duel"; rivalId: number };
type FortressPiece = { id: string; side: number; position: number[]; alive: boolean };
type FortressGame = {
  pieces: FortressPiece[];
  playerCount: number;
  deck: BattleCard[];
  discard: BattleCard[];
  current: number;
  round: number;
  winner: number | null;
  log: string[];
};
type FortressPhase = "roll" | "move" | "ai" | "over";

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function Topbar({ onExit }: { onExit: () => void }) {
  return (
    <header className="game-topbar sd-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup"><BrandMark /><div><span>paperoid</span><strong>SD 건담 디럭스</strong></div></div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

function cloneSpace(game: SpaceGame) {
  return structuredClone(game) as SpaceGame;
}

function scorePlayer(game: SpaceGame, player: SpacePlayer) {
  return player.bases.reduce(
    (sum, id) => sum + (game.bases.find((base) => base.id === id)?.points ?? 0),
    0,
  );
}

function drawToThree(game: SpaceGame, player: SpacePlayer) {
  const draw = sdDrawCards(game.deck, game.discard, Math.max(0, 3 - player.hand.length));
  game.deck = draw.deck;
  game.discard = draw.discard;
  player.hand.push(...draw.cards);
}

function endSpaceTurn(game: SpaceGame) {
  const capturedAll = game.bases.every((base) => base.owner !== null);
  if (capturedAll || game.turn >= 80) {
    game.winner = [...game.players].sort((a, b) => scorePlayer(game, b) - scorePlayer(game, a))[0].id;
    game.log.unshift(capturedAll ? "모든 기지의 점령이 끝났습니다." : "80턴이 지나 점수를 계산합니다.");
    return;
  }
  let next = (game.current + 1) % game.players.length;
  if (next === 0) game.turn += 1;
  if (game.players[next].skip) {
    game.players[next].skip = false;
    game.log.unshift(`${withKoreanTopic(game.players[next].name)} 대결 패배로 한 번 쉽니다.`);
    next = (next + 1) % game.players.length;
    if (next === 0) game.turn += 1;
  }
  game.current = next;
}

function chooseCaptureCards(hand: BattleCard[], hp: number) {
  const combos: BattleCard[][] = [];
  for (let mask = 1; mask < (1 << hand.length); mask += 1) {
    const cards = hand.filter((_, index) => mask & (1 << index));
    if (cards.reduce((sum, card) => sum + card.hp, 0) > hp) combos.push(cards);
  }
  return combos.sort(
    (a, b) =>
      a.reduce((sum, card) => sum + card.hp, 0) - b.reduce((sum, card) => sum + card.hp, 0) ||
      a.length - b.length,
  )[0] ?? [];
}

function resolveAiSpaceTurn(game: SpaceGame) {
  const next = cloneSpace(game);
  const player = next.players[next.current];
  const roll = 1 + Math.floor(Math.random() * 6);
  player.position = (player.position + roll) % SD_SPACE_ROUTE_LENGTH;
  next.log.unshift(`${withKoreanSubject(player.name)} ${roll}칸 이동했습니다.`);
  const kind = sdSpaceKind(player.position);
  const base = next.bases.find((item) => item.position === player.position);
  if (kind === "base" && base?.owner === null) {
    const cards = chooseCaptureCards(player.hand, base.hp);
    if (cards.length) {
      const ids = new Set(cards.map((card) => card.id));
      player.hand = player.hand.filter((card) => !ids.has(card.id));
      next.discard.push(...cards);
      base.owner = player.id;
      player.bases.push(base.id);
      next.log.unshift(`${withKoreanSubject(player.name)} ${withKoreanObject(base.name)} 점령했습니다.`);
      drawToThree(next, player);
    } else {
      next.log.unshift(`${withKoreanSubject(player.name)} ${base.name} 공략을 보류했습니다.`);
    }
  } else if (kind === "service") {
    drawToThree(next, player);
    next.log.unshift(`${withKoreanSubject(player.name)} MS 정비소에서 손패를 보급했습니다.`);
  } else if (kind === "event") {
    const draw = sdDrawCards(next.deck, next.discard, 1);
    next.deck = draw.deck;
    next.discard = draw.discard;
    if (draw.cards[0]) player.hand.push(draw.cards[0]);
    next.log.unshift(`${withKoreanSubject(player.name)} 작전 카드 효과로 전투 카드 1장을 얻었습니다.`);
  } else if (kind === "duel") {
    const rivals = next.players.filter((item) => item.id !== player.id && item.position === player.position);
    const rival = rivals[0];
    if (rival && player.hand.length && rival.hand.length) {
      const card = [...player.hand].sort((a, b) => b.hp - a.hp)[0];
      const rivalCard = rival.hand[Math.floor(Math.random() * rival.hand.length)];
      const result = sdDuelResult(card, rivalCard);
      player.hand = player.hand.filter((item) => item.id !== card.id);
      rival.hand = rival.hand.filter((item) => item.id !== rivalCard.id);
      next.discard.push(card, rivalCard);
      if (result.winner === 0) rival.skip = true;
      if (result.winner === 1) player.skip = true;
      next.log.unshift(
        result.winner === null
          ? `${withKoreanAnd(player.name)} ${rival.name}의 대결이 무승부입니다.`
          : `${withKoreanSubject(result.winner === 0 ? player.name : rival.name)} 대결에서 이겼습니다.`,
      );
      drawToThree(next, player);
      drawToThree(next, rival);
    }
  }
  endSpaceTurn(next);
  return next;
}

function SpaceCard({
  card,
  selected,
  onClick,
}: {
  card: BattleCard;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`sd-battle-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <small>BATTLE CARD</small>
      <span aria-hidden="true">✦</span>
      <strong>{card.name}</strong>
      <b>HP {card.hp}</b>
    </button>
  );
}

function SpaceBoard({
  game,
  onRoll,
  rolling,
}: {
  game: SpaceGame;
  onRoll: () => void;
  rolling: boolean;
}) {
  const nodes = Array.from({ length: SD_SPACE_ROUTE_LENGTH });
  return (
    <>
      <div className="sd-space-score">
        {game.players.map((player) => (
          <article key={player.id} className={game.current === player.id ? "active" : ""} style={{ "--pilot": player.color } as CSSProperties}>
            <i>{player.id === 0 ? "나" : "AI"}</i>
            <span><strong>{player.name}</strong><small>기지 {player.bases.length} · {scorePlayer(game, player)}점</small></span>
          </article>
        ))}
      </div>
      <div className="sd-space-board">
        <div className="sd-space-core">
          <span>SPACE</span><strong>기지 쟁탈전</strong><small>{game.bases.filter((base) => base.owner !== null).length}/{game.bases.length} 점령</small>
        </div>
        {nodes.map((_, position) => {
          const angle = (position / SD_SPACE_ROUTE_LENGTH) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 42;
          const y = 50 + Math.sin(angle) * 42;
          const base = game.bases.find((item) => item.position === position);
          const kind = sdSpaceKind(position);
          const players = game.players.filter((player) => player.position === position);
          return (
            <div
              key={position}
              className={`sd-space-node ${kind} ${base?.owner !== null && base?.owner !== undefined ? "captured" : ""}`}
              style={{ left: `${x}%`, top: `${y}%`, "--owner": base?.owner !== null && base?.owner !== undefined ? game.players[base.owner].color : "#71849d" } as CSSProperties}
              title={base ? `${base.name} · HP ${base.hp} · ${base.points}점` : kind}
            >
              <span>{base ? base.points : kind === "service" ? "MS" : kind === "duel" ? "VS" : kind === "event" ? "!" : position === 0 ? "S" : "·"}</span>
              {base && <small>{base.name}</small>}
              <div className="sd-pilots">
                {players.map((player) => <i key={player.id} style={{ background: player.color }}>{player.id === 0 ? "나" : player.id}</i>)}
              </div>
            </div>
          );
        })}
      </div>
      {!game.winner && game.current === 0 && (
        <button className="sd-roll-button" onClick={onRoll} disabled={rolling}>
          <span aria-hidden="true">⬡</span>{rolling ? "룰렛 회전 중…" : "룰렛 돌리기"}
        </button>
      )}
    </>
  );
}

function RulesModal({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const spaceRules = [
    ["목표", "룰렛으로 말을 옮기고 기지를 점령해, 모든 기지가 점령됐을 때 가장 높은 점수를 얻습니다."],
    ["이동", "나온 수만큼 전진합니다. 디지털판의 갈림길은 가장 짧은 우주 항로로 자동 안내됩니다."],
    ["기지", "전투 카드 HP 합계가 기지 HP보다 커야 점령합니다. 사용한 카드는 버리고 다시 3장까지 보급합니다."],
    ["MS 칸", "손패가 3장이 되도록 전투 카드를 보급합니다."],
    ["대결", "같은 위치의 상대와 카드 1장씩 공개합니다. 낮은 쪽은 다음 차례를 한 번 쉽니다."],
    ["종료", "모든 기지가 점령되면 기지 카드 점수를 합산합니다. 동점이면 기지 수가 많은 쪽이 앞섭니다."],
  ];
  const fortressRules = [
    ["목표", "각 진영 9개 말을 지휘해 상대 말을 모두 제거하면 승리합니다."],
    ["룰렛", "나온 수만큼 서로 다른 말을 움직입니다. 말 하나는 가로·세로로 최대 5칸 이동합니다."],
    ["대결", "상대가 있는 칸으로 이동하면 양쪽이 전투 카드를 공개합니다. HP가 낮은 말이 제거되고 동점은 다시 뽑습니다."],
    ["보너스 칸", "+20, +30 칸에서 싸우는 말은 해당 수치만큼 전투 HP를 더합니다."],
    ["메가 입자포", "입자포 칸에 선 말은 다음 차례부터 방향을 정해 발사할 수 있습니다. 사선 위 말은 아군도 제거됩니다."],
    ["장애물", "장애물 칸에는 들어갈 수 없고 입자포 사격도 장애물에서 멈춥니다."],
  ];
  return (
    <div className="sd-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="sd-rules-modal" role="dialog" aria-modal="true" aria-labelledby="sd-rules-title" onClick={(event) => event.stopPropagation()}>
        <header><div><span>ORIGINAL MANUAL GUIDE</span><h2 id="sd-rules-title">{mode === "space" ? "SIDE A · 우주편" : "SIDE B · 요새편"} 게임 방법</h2></div><button onClick={onClose} aria-label="닫기">×</button></header>
        <div className="sd-rule-list">
          {(mode === "space" ? spaceRules : fortressRules).map(([title, text], index) => (
            <article key={title}><b>{index + 1}</b><div><strong>{title}</strong><p>{text}</p></div></article>
          ))}
        </div>
        <p className="sd-rule-note">첨부된 7쪽 매뉴얼을 기준으로 재구성했습니다. 원본 보드·카드 PDF가 제공되면 기지 배치와 카드 수치를 더 정확하게 보정할 수 있습니다.</p>
        <button className="sd-modal-close" onClick={onClose}>확인하고 게임하기</button>
      </section>
    </div>
  );
}

function SpaceGameView({ playerCount, onReset }: { playerCount: number; onReset: () => void }) {
  const [game, setGame] = useState<SpaceGame>(() => sdCreateSpaceGame(playerCount) as SpaceGame);
  const [rolling, setRolling] = useState(false);
  const [die, setDie] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingSpace | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (game.current === 0 || game.winner !== null || pending) return;
    const timer = window.setTimeout(() => setGame((current) => resolveAiSpaceTurn(current)), 720);
    return () => window.clearTimeout(timer);
  }, [game, pending]);

  function finishHuman(next: SpaceGame) {
    endSpaceTurn(next);
    setPending(null);
    setSelected([]);
    setGame(next);
  }

  function roll() {
    if (game.current !== 0 || game.winner !== null) return;
    setRolling(true);
    const value = 1 + Math.floor(Math.random() * 6);
    setDie(value);
    window.setTimeout(() => {
      const next = cloneSpace(game);
      const player = next.players[0];
      player.position = (player.position + value) % SD_SPACE_ROUTE_LENGTH;
      next.log.unshift(`내 말이 ${value}칸 이동했습니다.`);
      const kind = sdSpaceKind(player.position);
      const base = next.bases.find((item) => item.position === player.position);
      const rival = next.players.find((item) => item.id !== 0 && item.position === player.position);
      setGame(next);
      setRolling(false);
      if (kind === "base" && base?.owner === null) setPending({ type: "base", baseId: base.id });
      else if (kind === "duel" && rival && player.hand.length && rival.hand.length) setPending({ type: "duel", rivalId: rival.id });
      else {
        if (kind === "service") {
          drawToThree(next, player);
          next.log.unshift("MS 정비소에서 손패를 3장까지 보급했습니다.");
        }
        if (kind === "event") {
          const draw = sdDrawCards(next.deck, next.discard, 1);
          next.deck = draw.deck;
          next.discard = draw.discard;
          if (draw.cards[0]) player.hand.push(draw.cards[0]);
          next.log.unshift("작전 효과로 전투 카드 1장을 얻었습니다.");
        }
        finishHuman(next);
      }
    }, 520);
  }

  function resolvePending() {
    if (!pending || !selected.length) return;
    const next = cloneSpace(game);
    const player = next.players[0];
    const cards = player.hand.filter((card) => selected.includes(card.id));
    if (pending.type === "base") {
      const base = next.bases.find((item) => item.id === pending.baseId)!;
      const result = sdCaptureResult(cards, base);
      if (!result.success) {
        next.log.unshift(`${result.total} HP로는 ${base.name}(HP ${base.hp})을 점령할 수 없습니다.`);
        setGame(next);
        return;
      }
      base.owner = 0;
      player.bases.push(base.id);
      next.log.unshift(`${withKoreanObject(base.name)} ${result.total} HP로 점령했습니다.`);
    } else {
      const rival = next.players[pending.rivalId];
      const card = cards[0];
      const aiCard = [...rival.hand].sort((a, b) => b.hp - a.hp)[0];
      const result = sdDuelResult(card, aiCard);
      rival.hand = rival.hand.filter((item) => item.id !== aiCard.id);
      next.discard.push(aiCard);
      if (result.winner === 0) rival.skip = true;
      if (result.winner === 1) player.skip = true;
      next.log.unshift(
        result.winner === null
          ? `${card.hp} 대 ${aiCard.hp}, 무승부입니다.`
          : `${result.winner === 0 ? "내가" : withKoreanSubject(rival.name)} ${result.first} 대 ${withKoreanDirection(result.second)} 승리했습니다.`,
      );
      drawToThree(next, rival);
    }
    const used = new Set(cards.map((card) => card.id));
    player.hand = player.hand.filter((card) => !used.has(card.id));
    next.discard.push(...cards);
    drawToThree(next, player);
    finishHuman(next);
  }

  const currentBase = pending?.type === "base" ? game.bases.find((base) => base.id === pending.baseId) : null;
  const winner = game.winner === null ? null : game.players[game.winner];
  return (
    <>
      <div className="sd-turn-banner">
        <span>TURN {game.turn}</span>
        <strong>{winner ? `${winner.name} 승리` : game.current === 0 ? "내 차례" : `${game.players[game.current].name} 작전 중`}</strong>
        <small>{die ? `최근 룰렛 ${die}` : "룰렛을 돌려 항로를 이동하세요"}</small>
      </div>
      <SpaceBoard game={game} onRoll={roll} rolling={rolling} />
      {pending && (
        <section className="sd-card-action">
          <header>
            <div><span>{pending.type === "base" ? "BASE ATTACK" : "PLAYER DUEL"}</span><strong>{pending.type === "base" ? `${currentBase?.name} · 필요 HP ${currentBase?.hp} 초과` : `${withKoreanAnd(game.players[pending.rivalId].name)} 대결`}</strong></div>
            <b>선택 {game.players[0].hand.filter((card) => selected.includes(card.id)).reduce((sum, card) => sum + card.hp, 0)} HP</b>
          </header>
          <div className="sd-card-row">
            {game.players[0].hand.map((card) => (
              <SpaceCard
                key={card.id}
                card={card}
                selected={selected.includes(card.id)}
                onClick={() => setSelected((current) =>
                  pending.type === "duel"
                    ? [card.id]
                    : current.includes(card.id) ? current.filter((id) => id !== card.id) : [...current, card.id]
                )}
              />
            ))}
          </div>
          <div className="sd-card-buttons">
            <button onClick={() => finishHuman(cloneSpace(game))}>이번에는 지나가기</button>
            <button onClick={resolvePending} disabled={!selected.length}>{pending.type === "base" ? "기지 공략" : "카드 공개"}</button>
          </div>
        </section>
      )}
      {winner && (
        <section className="sd-final">
          <span>MISSION COMPLETE</span><h2>{withKoreanSubject(winner.name)} 우주편에서 승리했습니다</h2>
          <p>{winner.bases.length}개 기지 · {scorePlayer(game, winner)}점</p>
          <button onClick={onReset}>새 게임 설정</button>
        </section>
      )}
      <div className="sd-log">{game.log.slice(0, 4).map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div>
    </>
  );
}

function sameCell(position: number[], row: number, column: number) {
  return position[0] === row && position[1] === column;
}

function drawBattlePair(game: FortressGame) {
  const draw = sdDrawCards(game.deck, game.discard, 2);
  game.deck = draw.deck;
  game.discard = draw.discard;
  if (draw.cards.length < 2) return null;
  game.discard.push(...draw.cards);
  return draw.cards;
}

function fortressCount(game: FortressGame, side: number) {
  return game.pieces.filter((piece) => piece.alive && piece.side === side).length;
}

function fortressWinCheck(game: FortressGame) {
  const activeSides = Array.from({ length: game.playerCount }, (_, side) => side)
    .filter((side) => fortressCount(game, side) > 0);
  if (activeSides.length === 1) game.winner = activeSides[0];
}

function nextFortressSide(game: FortressGame) {
  let next = game.current;
  for (let index = 0; index < game.playerCount; index += 1) {
    next = (next + 1) % game.playerCount;
    if (fortressCount(game, next) > 0) {
      if (next === 0) game.round += 1;
      game.current = next;
      return;
    }
  }
}

function battleOnCell(game: FortressGame, attacker: FortressPiece, defender: FortressPiece, destination: number[]) {
  let pair = drawBattlePair(game);
  let result = pair ? sdFortressResolveBattle(pair[0], pair[1], destination, defender.position) : { attack: 0, defense: 0, winner: null };
  let repeats = 0;
  while (result.winner === null && repeats < 5) {
    pair = drawBattlePair(game);
    if (!pair) break;
    result = sdFortressResolveBattle(pair[0], pair[1], destination, defender.position);
    repeats += 1;
  }
  if (result.winner === 0) {
    defender.alive = false;
    attacker.position = destination;
  } else if (result.winner === 1) {
    attacker.alive = false;
  }
  game.log.unshift(
    result.winner === null
      ? "연속 무승부로 양쪽 말이 자리를 지켰습니다."
      : `${result.attack} 대 ${result.defense}, ${withKoreanSubject(result.winner === 0 ? "공격 말" : "방어 말")} 이겼습니다.`,
  );
  fortressWinCheck(game);
}

function resolveAiFortress(game: FortressGame) {
  const next = structuredClone(game) as FortressGame;
  const side = next.current;
  const roll = 1 + Math.floor(Math.random() * 6);
  const moved = new Set<string>();
  for (let step = 0; step < roll; step += 1) {
    const pieces = next.pieces.filter((piece) => piece.alive && piece.side === side && !moved.has(piece.id));
    if (!pieces.length || next.winner !== null) break;
    const enemies = next.pieces.filter((piece) => piece.alive && piece.side !== side);
    let choice: { piece: FortressPiece; position: number[]; enemy: FortressPiece | null } | null = null;
    for (const piece of pieces) {
      const reachable = sdFortressReachable(next, piece.id, 5) as number[][];
      const target = enemies.find((enemy) => reachable.some((cell) => sameCell(cell, enemy.position[0], enemy.position[1])));
      if (target) {
        choice = { piece, position: [...target.position], enemy: target };
        break;
      }
      const nearest = [...reachable].sort((a, b) => {
        const aDistance = Math.min(...enemies.map((enemy) => Math.abs(a[0] - enemy.position[0]) + Math.abs(a[1] - enemy.position[1])));
        const bDistance = Math.min(...enemies.map((enemy) => Math.abs(b[0] - enemy.position[0]) + Math.abs(b[1] - enemy.position[1])));
        return aDistance - bDistance;
      })[0];
      if (nearest && !choice) choice = { piece, position: nearest, enemy: null };
    }
    if (!choice) break;
    moved.add(choice.piece.id);
    if (choice.enemy) battleOnCell(next, choice.piece, choice.enemy, choice.position);
    else choice.piece.position = choice.position;
  }
  next.log.unshift(`${withKoreanSubject(["AI", side].join(" "))} 룰렛 ${withKoreanDirection(roll)} ${moved.size}개 말을 움직였습니다.`);
  nextFortressSide(next);
  return next;
}

function FortressGameView({ playerCount, onReset }: { playerCount: number; onReset: () => void }) {
  const [game, setGame] = useState<FortressGame>(() => sdFortressCreateGame(playerCount) as FortressGame);
  const [phase, setPhase] = useState<FortressPhase>("roll");
  const [roll, setRoll] = useState<number | null>(null);
  const [movesLeft, setMovesLeft] = useState(0);
  const [moved, setMoved] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reachable = useMemo(
    () => selectedId && phase === "move" ? sdFortressReachable(game, selectedId, 5) as number[][] : [],
    [game, phase, selectedId],
  );

  useEffect(() => {
    if (phase !== "ai" || game.winner !== null) return;
    const timer = window.setTimeout(() => {
      const next = resolveAiFortress(game);
      setGame(next);
      setRoll(null);
      setMoved([]);
      setSelectedId(null);
      setPhase(next.winner === null ? (next.current === 0 ? "roll" : "ai") : "over");
    }, 850);
    return () => window.clearTimeout(timer);
  }, [game, phase]);

  function startMoves() {
    const value = 1 + Math.floor(Math.random() * 6);
    setRoll(value);
    setMovesLeft(Math.min(value, fortressCount(game, 0)));
    setMoved([]);
    setSelectedId(null);
    setPhase("move");
  }

  function finishMoves(next = game) {
    const prepared = structuredClone(next) as FortressGame;
    if (prepared.winner === null) nextFortressSide(prepared);
    setGame(prepared);
    setSelectedId(null);
    setPhase(prepared.winner === null ? (prepared.current === 0 ? "roll" : "ai") : "over");
  }

  function handleCellClick(row: number, column: number) {
    if (phase !== "move") return;
    const own = game.pieces.find((piece) => piece.alive && piece.side === 0 && sameCell(piece.position, row, column));
    if (own && !moved.includes(own.id)) {
      setSelectedId((current) => current === own.id ? null : own.id);
      return;
    }
    if (!selectedId || !reachable.some((cell) => sameCell(cell, row, column))) return;
    const next = structuredClone(game) as FortressGame;
    const piece = next.pieces.find((item) => item.id === selectedId)!;
    const enemy = next.pieces.find((item) => item.alive && item.side !== 0 && sameCell(item.position, row, column));
    if (enemy) battleOnCell(next, piece, enemy, [row, column]);
    else piece.position = [row, column];
    const nextMoved = [...moved, selectedId];
    const left = movesLeft - 1;
    setMoved(nextMoved);
    setMovesLeft(left);
    setSelectedId(null);
    setGame(next);
    if (left <= 0 || next.winner !== null) finishMoves(next);
  }

  function fire(direction: "up" | "down" | "left" | "right") {
    if (!selectedId) return;
    const next = structuredClone(game) as FortressGame;
    const shooter = next.pieces.find((piece) => piece.id === selectedId)!;
    const range = 1 + Math.floor(Math.random() * 6);
    const cells = sdFortressCannonCells(shooter.position, direction, range) as number[][];
    const victims = next.pieces.filter((piece) => piece.alive && cells.some((cell) => sameCell(cell, piece.position[0], piece.position[1])));
    victims.forEach((piece) => { piece.alive = false; });
    next.log.unshift(`메가 입자포를 ${range}칸 발사해 ${victims.length}개 말을 제거했습니다.`);
    fortressWinCheck(next);
    const left = movesLeft - 1;
    setMoved((current) => [...current, selectedId]);
    setMovesLeft(left);
    setSelectedId(null);
    setGame(next);
    if (left <= 0 || next.winner !== null) finishMoves(next);
  }

  const selected = game.pieces.find((piece) => piece.id === selectedId);
  const canFire = selected && game.round > 1 && SD_FORTRESS_CANNONS.some((cell) => sameCell(selected.position, cell[0], cell[1]));
  return (
    <>
      <div className="sd-turn-banner fortress">
        <span>ROUND {game.round}</span>
        <strong>{game.winner !== null ? `${game.winner === 0 ? "내 부대" : `AI ${game.winner}`} 승리` : phase === "ai" ? `AI ${game.current} 작전 중` : "내 작전"}</strong>
        <small>{Array.from({ length: game.playerCount }, (_, side) => `${side === 0 ? "나" : `AI ${side}`} ${fortressCount(game, side)}`).join(" · ")} {roll ? `· 룰렛 ${roll}` : ""}</small>
      </div>
      <div className="sd-fortress-board" role="grid" aria-label="9 곱하기 9 요새 전투판">
        {Array.from({ length: SD_FORTRESS_SIZE * SD_FORTRESS_SIZE }, (_, index) => {
          const row = Math.floor(index / SD_FORTRESS_SIZE);
          const column = index % SD_FORTRESS_SIZE;
          const obstacle = SD_FORTRESS_OBSTACLES.some((cell) => sameCell(cell, row, column));
          const cannon = SD_FORTRESS_CANNONS.some((cell) => sameCell(cell, row, column));
          const bonus = SD_FORTRESS_BONUSES.find((cell) => cell.row === row && cell.column === column);
          const piece = game.pieces.find((item) => item.alive && sameCell(item.position, row, column));
          const isReachable = reachable.some((cell) => sameCell(cell, row, column));
          return (
            <button
              key={index}
              role="gridcell"
              className={`${obstacle ? "obstacle" : ""} ${cannon ? "cannon" : ""} ${bonus ? "bonus" : ""} ${isReachable ? "reachable" : ""}`}
              onClick={() => handleCellClick(row, column)}
              disabled={phase !== "move" || obstacle}
              aria-label={`${row + 1}행 ${column + 1}열${piece ? `, ${piece.side === 0 ? "내" : "AI"} 말` : ""}`}
            >
              {obstacle && <span className="sd-asteroid">◆</span>}
              {cannon && <span className="sd-cannon">◎<small>입자포</small></span>}
              {bonus && <span className="sd-bonus">+{bonus.value}</span>}
              {piece && <i className={`sd-unit side-${piece.side} ${selectedId === piece.id ? "selected" : ""}`}><b>{piece.side === 0 ? "G" : `A${piece.side}`}</b><small>{piece.id.split("-")[1]}</small></i>}
            </button>
          );
        })}
      </div>
      {phase === "roll" && <button className="sd-roll-button" onClick={startMoves}><span aria-hidden="true">⬡</span>룰렛 돌리기</button>}
      {phase === "move" && (
        <div className="sd-fortress-actions">
          <p><strong>{movesLeft}개 말</strong>을 더 움직이세요. {selectedId ? "밝게 표시된 칸을 선택하세요." : "아직 움직이지 않은 내 말을 선택하세요."}</p>
          {canFire && <div><button onClick={() => fire("up")}>↑</button><button onClick={() => fire("left")}>←</button><button onClick={() => fire("right")}>→</button><button onClick={() => fire("down")}>↓</button></div>}
          <button onClick={() => finishMoves()}>이동 마침</button>
        </div>
      )}
      {game.winner !== null && (
        <section className="sd-final">
          <span>FORTRESS CLEARED</span><h2>{game.winner === 0 ? "내 SD 부대가 승리했습니다" : "AI가 요새를 장악했습니다"}</h2>
          <p>상대 진영의 말을 모두 제거했습니다.</p><button onClick={onReset}>새 게임 설정</button>
        </section>
      )}
      <div className="sd-log">{game.log.slice(0, 4).map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div>
    </>
  );
}

export function SdGundamDeluxeGame({ onExit }: { onExit: () => void }) {
  const [mode, setMode] = useState<Mode>("space");
  const [playerCount, setPlayerCount] = useState(4);
  const [fortressPlayers, setFortressPlayers] = useState(2);
  const [started, setStarted] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [session, setSession] = useState(0);
  function reset() {
    setStarted(false);
    setSession((value) => value + 1);
  }
  return (
    <main className="game-shell sd-shell">
      <Topbar onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel sd-info">
          <div><span className="eyebrow">JOLLY GAME NO.38</span><h1>우주와 요새의<br />SD 대전</h1><p>첨부 매뉴얼의 두 가지 게임을 AI 대전으로 재구성했습니다.</p></div>
          <div className="sd-mode-summary">
            <article className={mode === "space" ? "active" : ""}><span>SIDE A</span><strong>우주편</strong><small>기지 점령 · 점수 승부</small></article>
            <article className={mode === "fortress" ? "active" : ""}><span>SIDE B</span><strong>요새편</strong><small>9개 말 · 전멸 승부</small></article>
          </div>
          <button className="sd-rules-button" onClick={() => setRulesOpen(true)}>ⓘ 게임 방법</button>
        </aside>
        <div className="board-panel sd-board-panel">
          {!started ? (
            <section className="sd-setup">
              <header><span>SELECT MISSION</span><h2>플레이할 전장을 선택하세요</h2><p>두 모드는 같은 전투 카드를 사용하지만 목표와 말의 운용 방식이 완전히 다릅니다.</p></header>
              <div className="sd-mode-picker">
                <button className={mode === "space" ? "active" : ""} onClick={() => setMode("space")}><i>◉</i><span><small>SIDE A</small><strong>우주편</strong><em>룰렛으로 항로를 돌며 기지 HP를 넘어 점령하세요.</em></span><b>기지전</b></button>
                <button className={mode === "fortress" ? "active" : ""} onClick={() => setMode("fortress")}><i>▦</i><span><small>SIDE B</small><strong>요새편</strong><em>9개 말을 옮기고 지형과 입자포로 상대를 제거하세요.</em></span><b>전멸전</b></button>
              </div>
              {mode === "space" && (
                <div className="sd-player-picker"><span>참가 인원</span><div>{[2,3,4,5,6].map((count) => <button key={count} className={playerCount === count ? "active" : ""} onClick={() => setPlayerCount(count)}>{count}인</button>)}</div><small>나 1명 + AI {playerCount - 1}명</small></div>
              )}
              {mode === "fortress" && (
                <div className="sd-player-picker"><span>참가 인원</span><div>{[2,3,4].map((count) => <button key={count} className={fortressPlayers === count ? "active" : ""} onClick={() => setFortressPlayers(count)}>{count}인</button>)}</div><small>나 1명 + AI {fortressPlayers - 1}명</small></div>
              )}
              <button className="sd-start-button" onClick={() => setStarted(true)}><span>{mode === "space" ? `${playerCount}인 우주편` : `${fortressPlayers}인 요새편`} 시작</span><b>→</b></button>
              <button className="sd-setup-rules" onClick={() => setRulesOpen(true)}>먼저 게임 방법 확인</button>
            </section>
          ) : mode === "space" ? (
            <SpaceGameView key={`space-${session}`} playerCount={playerCount} onReset={reset} />
          ) : (
            <FortressGameView key={`fortress-${session}`} playerCount={fortressPlayers} onReset={reset} />
          )}
        </div>
      </section>
      {rulesOpen && <RulesModal mode={mode} onClose={() => setRulesOpen(false)} />}
    </main>
  );
}
