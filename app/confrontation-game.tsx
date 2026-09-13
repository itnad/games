"use client";

import { useEffect, useMemo, useState } from "react";
import { withKoreanAnd, withKoreanSubject } from "./korean-particles.js";
import {
  CONFRONTATION_CARDS,
  CONFRONTATION_LEVELS,
  confrontationHasLegalMove,
  confrontationMoveTargets,
  confrontationRegion,
  confrontationResolveCombat,
  confrontationRetreatTargets,
  confrontationWinner,
  createConfrontationPieces,
} from "./confrontation-engine.js";

type Side = "dawn" | "shadow";
type Difficulty = "apprentice" | "tactician";
type Phase = "setup" | "playing" | "battle" | "game-over";

type Piece = {
  id: string;
  side: Side;
  role: string;
  sigil: string;
  strength: number;
  ability: string;
  text: string;
  regionId: string;
  alive: boolean;
};

type CombatCard = {
  id: string;
  name: string;
  kind: "power" | "guard" | "surge" | "retreat";
  value: number;
  text: string;
};

type Battle = {
  attackerId: string;
  defenderId: string;
  regionId: string;
  aiCardId: string;
};

type GameState = {
  phase: Phase;
  humanSide: Side;
  difficulty: Difficulty;
  pieces: Piece[];
  turnSide: Side;
  selectedPieceId: string | null;
  hands: Record<Side, string[]>;
  battle: Battle | null;
  revealedIds: string[];
  winner: Side | null;
  message: string;
  detail: string;
  history: string[];
  turn: number;
  actionId: number;
};

const ALL_CARD_IDS = CONFRONTATION_CARDS.map((card: CombatCard) => card.id);
const SIDE_LABEL: Record<Side, string> = { dawn: "새벽 원정대", shadow: "그림자 군세" };

function cardById(id: string) {
  return CONFRONTATION_CARDS.find((card: CombatCard) => card.id === id) as CombatCard;
}

function sideOpponent(side: Side): Side {
  return side === "dawn" ? "shadow" : "dawn";
}

function freshState(humanSide: Side, difficulty: Difficulty): GameState {
  return {
    phase: "playing",
    humanSide,
    difficulty,
    pieces: createConfrontationPieces() as Piece[],
    turnSide: "shadow",
    selectedPieceId: null,
    hands: { dawn: [...ALL_CARD_IDS], shadow: [...ALL_CARD_IDS] },
    battle: null,
    revealedIds: [],
    winner: null,
    message: humanSide === "shadow" ? "당신이 먼저 움직입니다" : "그림자 군세가 먼저 움직입니다",
    detail: "기물을 골라 밝게 표시된 전진 지역으로 이동하세요.",
    history: [],
    turn: 1,
    actionId: 1,
  };
}

function setupState(): GameState {
  return {
    ...freshState("dawn", "tactician"),
    phase: "setup",
    pieces: [],
    message: "진영을 선택하세요",
    detail: "양 진영은 승리 조건과 기물의 능력이 서로 다릅니다.",
  };
}

function ensureHands(state: GameState) {
  if (state.hands.dawn.length || state.hands.shadow.length) return state.hands;
  return { dawn: [...ALL_CARD_IDS], shadow: [...ALL_CARD_IDS] };
}

function chooseAiCard(
  state: GameState,
  aiPiece: Piece,
  enemyPiece: Piece,
  aiIsAttacker: boolean,
  cards: string[],
) {
  const available = cards.map(cardById);
  const retreat = available.find((card) => card.kind === "retreat");
  const guard = available.find((card) => card.kind === "guard");
  const surge = available.find((card) => card.kind === "surge");
  const powers = available.filter((card) => card.kind === "power").sort((a, b) => a.value - b.value);
  const estimatedEnemy = state.difficulty === "apprentice" ? 4 : 5;
  const gap = estimatedEnemy - aiPiece.strength;

  if (aiPiece.ability === "bearer" && retreat && aiPiece.strength < enemyPiece.strength) return retreat.id;
  if (gap >= 3 && retreat && Math.random() < 0.48) return retreat.id;
  if (enemyPiece.strength >= 6 && guard && Math.random() < 0.38) return guard.id;
  if (aiIsAttacker && surge && gap >= -1 && gap <= 3) return surge.id;
  if (powers.length) {
    const target = Math.max(1, Math.min(6, gap + 3));
    const best = powers.reduce((pick, card) =>
      Math.abs(card.value - target) < Math.abs(pick.value - target) ? card : pick,
    );
    if (state.difficulty === "apprentice" && Math.random() < 0.35) {
      return powers[Math.floor(Math.random() * powers.length)].id;
    }
    return best.id;
  }
  return available[Math.floor(Math.random() * available.length)].id;
}

function prepareBattle(state: GameState, attackerId: string, defenderId: string): GameState {
  const hands = ensureHands(state);
  const attacker = state.pieces.find((piece) => piece.id === attackerId)!;
  const defender = state.pieces.find((piece) => piece.id === defenderId)!;
  const aiPiece = attacker.side === state.humanSide ? defender : attacker;
  const humanPiece = attacker.side === state.humanSide ? attacker : defender;
  const aiCardId = chooseAiCard(
    { ...state, hands },
    aiPiece,
    humanPiece,
    attacker.side !== state.humanSide,
    hands[aiPiece.side],
  );
  return {
    ...state,
    hands,
    phase: "battle",
    battle: { attackerId, defenderId, regionId: attacker.regionId, aiCardId },
    revealedIds: [attackerId, defenderId],
    selectedPieceId: null,
    message: `${withKoreanAnd(attacker.role)} ${defender.role}의 대결`,
    detail: "AI는 이미 카드를 선택했습니다. 사용할 전투 카드를 고르세요.",
    actionId: state.actionId + 1,
  };
}

function finishTurn(state: GameState, pieces: Piece[], historyEntry?: string): GameState {
  const nextSide = sideOpponent(state.turnSide);
  const winner = confrontationWinner(pieces);
  if (winner) {
    return {
      ...state,
      pieces,
      phase: "game-over",
      winner,
      battle: null,
      revealedIds: [],
      selectedPieceId: null,
      message: `${SIDE_LABEL[winner]}의 승리`,
      detail: winner === "dawn" ? "빛의 운반자가 적 요새에 도착했습니다." : "원정이 저지되었습니다.",
      history: historyEntry ? [historyEntry, ...state.history].slice(0, 8) : state.history,
      actionId: state.actionId + 1,
    };
  }
  if (!confrontationHasLegalMove(nextSide, pieces)) {
    const blockedWinner = sideOpponent(nextSide);
    return {
      ...state,
      pieces,
      phase: "game-over",
      winner: blockedWinner,
      battle: null,
      revealedIds: [],
      selectedPieceId: null,
      message: `${SIDE_LABEL[blockedWinner]}의 승리`,
      detail: `${withKoreanSubject(SIDE_LABEL[nextSide])} 더 이상 전진할 수 없습니다.`,
      history: historyEntry ? [historyEntry, ...state.history].slice(0, 8) : state.history,
      actionId: state.actionId + 1,
    };
  }
  return {
    ...state,
    pieces,
    phase: "playing",
    turnSide: nextSide,
    selectedPieceId: null,
    battle: null,
    revealedIds: [],
    message: nextSide === state.humanSide ? "당신의 차례입니다" : `${withKoreanSubject(SIDE_LABEL[nextSide])} 움직입니다`,
    detail: nextSide === state.humanSide ? "기물을 골라 전진 지역을 선택하세요." : "AI가 지형과 남은 전투 카드를 계산하고 있습니다.",
    history: historyEntry ? [historyEntry, ...state.history].slice(0, 8) : state.history,
    turn: state.turn + 1,
    actionId: state.actionId + 1,
  };
}

function selectDefender(pieces: Piece[], attacker: Piece) {
  const defenders = pieces.filter(
    (piece) => piece.alive && piece.side !== attacker.side && piece.regionId === attacker.regionId,
  );
  return defenders[Math.floor(Math.random() * defenders.length)] ?? null;
}

function performMove(state: GameState, pieceId: string, regionId: string): GameState {
  const movedPieces = state.pieces.map((piece) => piece.id === pieceId ? { ...piece, regionId } : piece);
  const moved = movedPieces.find((piece) => piece.id === pieceId)!;
  const instantWinner = confrontationWinner(movedPieces, moved);
  const region = confrontationRegion(regionId);
  if (instantWinner) {
    return {
      ...state,
      pieces: movedPieces,
      phase: "game-over",
      winner: instantWinner,
      selectedPieceId: null,
      message: `${SIDE_LABEL[instantWinner]}의 승리`,
      detail: instantWinner === "dawn" ? "빛의 운반자가 그림자 요새에 도착했습니다." : "그림자 군세가 성채를 장악했습니다.",
      history: [`${moved.role} → ${region?.name}`, ...state.history].slice(0, 8),
      actionId: state.actionId + 1,
    };
  }
  const defender = selectDefender(movedPieces, moved);
  if (defender) {
    return prepareBattle({ ...state, pieces: movedPieces }, moved.id, defender.id);
  }
  return finishTurn(state, movedPieces, `${SIDE_LABEL[moved.side]} · ${moved.role} → ${region?.name}`);
}

function recoverCard(hands: Record<Side, string[]>, piece: Piece | undefined, defeated: string[]) {
  if (!piece || piece.ability !== "recover" || defeated.includes(piece.id)) return hands;
  const missingPower = CONFRONTATION_CARDS
    .filter((card: CombatCard) => card.kind === "power" && !hands[piece.side].includes(card.id))
    .sort((a: CombatCard, b: CombatCard) => a.value - b.value)[0] as CombatCard | undefined;
  if (!missingPower) return hands;
  return { ...hands, [piece.side]: [...hands[piece.side], missingPower.id] };
}

function resolveBattle(state: GameState, humanCardId: string): GameState {
  const battle = state.battle!;
  const attacker = state.pieces.find((piece) => piece.id === battle.attackerId)!;
  const defender = state.pieces.find((piece) => piece.id === battle.defenderId)!;
  const attackerCard = cardById(attacker.side === state.humanSide ? humanCardId : battle.aiCardId);
  const defenderCard = cardById(defender.side === state.humanSide ? humanCardId : battle.aiCardId);
  let pieces = state.pieces;
  let hands: Record<Side, string[]> = {
    dawn: state.hands.dawn.filter((id) => id !== (state.humanSide === "dawn" ? humanCardId : battle.aiCardId)),
    shadow: state.hands.shadow.filter((id) => id !== (state.humanSide === "shadow" ? humanCardId : battle.aiCardId)),
  };

  const shadowPiece = attacker.side === "shadow" ? attacker : defender;
  const shadowCard = attacker.side === "shadow" ? attackerCard : defenderCard;
  const dawnPiece = attacker.side === "dawn" ? attacker : defender;
  const dawnCard = attacker.side === "dawn" ? attackerCard : defenderCard;
  const retreatOrder = [
    { piece: shadowPiece, card: shadowCard },
    { piece: dawnPiece, card: dawnCard },
  ];
  const retreating = retreatOrder.find(({ piece, card }) =>
    card.kind === "retreat" && confrontationRetreatTargets(piece, pieces).length > 0,
  );
  if (retreating) {
    const target = confrontationRetreatTargets(retreating.piece, pieces)[0];
    pieces = pieces.map((piece) =>
      piece.id === retreating.piece.id ? { ...piece, regionId: target.id } : piece,
    );
    const entry = `${retreating.piece.role} 후퇴 · ${target.name}`;
    return finishTurn({ ...state, hands }, pieces, entry);
  }

  const result = confrontationResolveCombat(attacker, defender, attackerCard, defenderCard, battle.regionId);
  pieces = pieces.map((piece) => result.defeated.includes(piece.id) ? { ...piece, alive: false } : piece);
  const winnerPiece = result.defeated.includes(attacker.id) ? defender : attacker;
  hands = recoverCard(hands, winnerPiece, result.defeated);
  const region = confrontationRegion(battle.regionId);
  const entry = `${attacker.role} ${result.attackerTotal} : ${result.defenderTotal} ${defender.role} · ${result.defeated.length > 1 ? "동시 제거" : `${pieces.find((piece) => piece.id === result.defeated[0])?.role} 제거`}`;
  const winner = confrontationWinner(pieces);
  if (winner) {
    return {
      ...state,
      pieces,
      hands,
      phase: "game-over",
      winner,
      battle: null,
      revealedIds: [],
      message: `${SIDE_LABEL[winner]}의 승리`,
      detail: winner === "shadow" ? "빛의 운반자가 전장에서 쓰러졌습니다." : "원정대가 목적지에 도착했습니다.",
      history: [entry, ...state.history].slice(0, 8),
      actionId: state.actionId + 1,
    };
  }

  const survivingAttacker = pieces.find((piece) => piece.id === attacker.id && piece.alive);
  if (survivingAttacker) {
    const nextDefender = selectDefender(pieces, survivingAttacker);
    if (nextDefender) {
      return prepareBattle(
        {
          ...state,
          pieces,
          hands,
          history: [entry, ...state.history].slice(0, 8),
          message: `${region?.name}에서 대결이 계속됩니다`,
        },
        survivingAttacker.id,
        nextDefender.id,
      );
    }
  }
  return finishTurn({ ...state, hands }, pieces, entry);
}

function chooseAiMove(state: GameState) {
  const candidates = state.pieces.flatMap((piece) => {
    if (!piece.alive || piece.side !== state.turnSide) return [];
    return confrontationMoveTargets(piece, state.pieces).map((target: { id: string; level: number }) => {
      const enemies = state.pieces.filter(
        (other) => other.alive && other.side !== piece.side && other.regionId === target.id,
      ).length;
      const progress = piece.side === "dawn" ? target.level : 6 - target.level;
      let score = progress * 9 + enemies * (piece.strength >= 5 ? 6 : -2);
      if (piece.ability === "bearer") score += progress * 7;
      if (piece.side === "shadow" && target.id === "dawn-hold") score += 24;
      if (piece.side === "dawn" && target.id === "shadow-hold" && piece.ability === "bearer") score += 100;
      const noise = state.difficulty === "apprentice" ? Math.random() * 30 : Math.random() * 8;
      return { piece, target, score: score + noise };
    });
  });
  return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
}

function PieceToken({
  piece,
  visible,
  selected,
  recent,
  disabled,
  onClick,
}: {
  piece: Piece;
  visible: boolean;
  selected: boolean;
  recent: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`confront-piece ${piece.side} ${visible ? "visible" : "hidden"} ${selected ? "selected" : ""} ${recent ? "revealed" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={visible ? `${piece.role}, 힘 ${piece.strength}` : "정체를 알 수 없는 상대 기물"}
      title={visible ? `${piece.role} · 힘 ${piece.strength} · ${piece.text}` : "상대에게 숨겨진 기물"}
    >
      <span>{visible ? piece.sigil : "?"}</span>
      {visible && <small>{piece.strength}</small>}
    </button>
  );
}

function ConfrontationTopbar({ onExit }: { onExit: () => void }) {
  return (
    <header className="game-topbar confrontation-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup">
        <span className="confront-mini-sigil" aria-hidden="true">✦</span>
        <div><span>paperoid</span><strong>빛과 그림자의 대결</strong></div>
      </div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

export function ConfrontationGame({ onExit }: { onExit: () => void }) {
  const [humanSide, setHumanSide] = useState<Side>("dawn");
  const [difficulty, setDifficulty] = useState<Difficulty>("tactician");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [state, setState] = useState<GameState>(setupState);

  useEffect(() => {
    if (state.phase !== "playing" || state.turnSide === state.humanSide) return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.phase !== "playing" || current.turnSide === current.humanSide) return current;
        const move = chooseAiMove(current);
        if (!move) {
          const winner = current.humanSide;
          return {
            ...current,
            phase: "game-over",
            winner,
            message: `${SIDE_LABEL[winner]}의 승리`,
            detail: "AI가 더 이상 전진할 수 없습니다.",
            actionId: current.actionId + 1,
          };
        }
        return performMove(current, move.piece.id, move.target.id);
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.turnSide, state.humanSide, state.actionId]);

  const selectedPiece = state.pieces.find((piece) => piece.id === state.selectedPieceId) ?? null;
  const legalTargets = useMemo(
    () => selectedPiece ? confrontationMoveTargets(selectedPiece, state.pieces).map((region: { id: string }) => region.id) : [],
    [selectedPiece, state.pieces],
  );
  const battleAttacker = state.battle ? state.pieces.find((piece) => piece.id === state.battle!.attackerId) : null;
  const battleDefender = state.battle ? state.pieces.find((piece) => piece.id === state.battle!.defenderId) : null;
  const humanCards = state.hands[state.humanSide].map(cardById);
  const dawnAlive = state.pieces.filter((piece) => piece.alive && piece.side === "dawn").length;
  const shadowAlive = state.pieces.filter((piece) => piece.alive && piece.side === "shadow").length;

  function start() {
    setState(freshState(humanSide, difficulty));
  }

  function pickPiece(piece: Piece) {
    if (state.phase !== "playing" || state.turnSide !== state.humanSide || piece.side !== state.humanSide) return;
    setState((current) => ({
      ...current,
      selectedPieceId: current.selectedPieceId === piece.id ? null : piece.id,
      message: current.selectedPieceId === piece.id ? "선택을 취소했습니다" : `${piece.role} 선택`,
      detail: current.selectedPieceId === piece.id ? "다른 기물을 선택할 수 있습니다." : piece.text,
    }));
  }

  function moveTo(regionId: string) {
    if (!state.selectedPieceId || !legalTargets.includes(regionId)) return;
    setState((current) => performMove(current, current.selectedPieceId!, regionId));
  }

  return (
    <main className="game-shell confrontation-shell">
      <ConfrontationTopbar onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel confrontation-info">
          <div>
            <span className="eyebrow">HIDDEN MOVEMENT</span>
            <h1>정체를 숨기고<br />운명을 움직이세요</h1>
            <p>상대 기물의 정체는 전투가 시작될 때만 드러납니다. 약한 목적 기물을 지키면서, 상대의 카드와 배치를 기억하세요.</p>
          </div>
          {state.phase === "setup" ? (
            <div className="confront-side-summary">
              <span>게임 방식</span>
              <strong>AI 1:1 · 비대칭 전략</strong>
              <small>약 15~25분</small>
            </div>
          ) : (
            <div className="confront-score-summary">
              <div><span>TURN</span><strong>{state.turn}</strong></div>
              <div><span>새벽 생존</span><strong>{dawnAlive}/9</strong></div>
              <div><span>그림자 생존</span><strong>{shadowAlive}/9</strong></div>
            </div>
          )}
          <button className="confront-rule-button" onClick={() => setRulesOpen(true)}>ⓘ 게임 방법과 승리 조건</button>
        </aside>

        <div className="board-panel confrontation-board-panel">
          {state.phase === "setup" ? (
            <section className="confront-welcome" data-game-menu>
              <div className="confront-emblem" aria-hidden="true"><i>✦</i><b>VS</b><i>◆</i></div>
              <span>ASYMMETRIC HIDDEN STRATEGY</span>
              <h2>빛과 그림자의 대결</h2>
              <p>크니치아의 숨은 기물 대결 구조를 바탕으로, 독자적인 세계와 능력으로 다시 만든 paperoid 버전입니다.</p>
              <div className="confront-setup-grid">
                <fieldset>
                  <legend>나의 진영</legend>
                  <button className={humanSide === "dawn" ? "active dawn" : "dawn"} onClick={() => setHumanSide("dawn")}>
                    <b>✦ 새벽 원정대</b><span>운반자를 적 요새까지 호위</span>
                  </button>
                  <button className={humanSide === "shadow" ? "active shadow" : "shadow"} onClick={() => setHumanSide("shadow")}>
                    <b>◆ 그림자 군세</b><span>운반자 제거 또는 성채 침입</span>
                  </button>
                </fieldset>
                <fieldset>
                  <legend>AI 난이도</legend>
                  <button className={difficulty === "apprentice" ? "active" : ""} onClick={() => setDifficulty("apprentice")}>
                    <b>견습</b><span>카드 선택에 실수가 있습니다</span>
                  </button>
                  <button className={difficulty === "tactician" ? "active" : ""} onClick={() => setDifficulty("tactician")}>
                    <b>전술가</b><span>지형과 카드 효율을 계산합니다</span>
                  </button>
                </fieldset>
              </div>
              <button className="confront-start" onClick={start}>대결 시작 <span aria-hidden="true">→</span></button>
            </section>
          ) : (
            <>
              <section className="confront-status" role="status">
                <span className={`confront-turn-mark ${state.turnSide}`}>{state.turnSide === "dawn" ? "✦" : "◆"}</span>
                <div><strong>{state.message}</strong><span>{state.detail}</span></div>
                <button onClick={() => setRulesOpen(true)}>규칙</button>
              </section>

              <section className="confront-map-wrap">
                <div className="confront-goal shadow"><span>그림자의 본거지</span><b>◆</b></div>
                <div className="confront-map" aria-label="빛과 그림자의 대결 지도">
                  {[...CONFRONTATION_LEVELS].reverse().map((level, reverseIndex) => {
                    const levelIndex = CONFRONTATION_LEVELS.length - 1 - reverseIndex;
                    return (
                      <div className={`confront-level level-${levelIndex}`} key={levelIndex}>
                        {level.map((region: { id: string; name: string; terrain: string; capacity: number }) => {
                          const occupants = state.pieces.filter((piece) => piece.alive && piece.regionId === region.id);
                          const target = legalTargets.includes(region.id);
                          const isBattle = state.battle?.regionId === region.id;
                          return (
                            <div
                              key={region.id}
                              className={`confront-region ${region.terrain} ${target ? "target" : ""} ${isBattle ? "battle" : ""}`}
                              onClick={() => target && moveTo(region.id)}
                              role={target ? "button" : undefined}
                              tabIndex={target ? 0 : undefined}
                              onKeyDown={(event) => {
                                if (target && (event.key === "Enter" || event.key === " ")) moveTo(region.id);
                              }}
                            >
                              <span className="confront-region-name">{region.name}</span>
                              <small>{region.terrain === "mountain" ? "△ 1" : region.terrain === "hold" ? `성채 ${region.capacity}` : `● ${region.capacity}`}</small>
                              <div className="confront-occupants">
                                {occupants.map((piece) => {
                                  const visible = piece.side === state.humanSide || state.revealedIds.includes(piece.id);
                                  return (
                                    <PieceToken
                                      key={piece.id}
                                      piece={piece}
                                      visible={visible}
                                      selected={piece.id === state.selectedPieceId}
                                      recent={state.revealedIds.includes(piece.id)}
                                      disabled={piece.side !== state.humanSide || state.phase !== "playing" || state.turnSide !== state.humanSide}
                                      onClick={() => pickPiece(piece)}
                                    />
                                  );
                                })}
                              </div>
                              {target && <i className="confront-target-pulse">이동</i>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  <span className="confront-tunnel" aria-hidden="true">달빛 지하길 · 원정대 전용</span>
                </div>
                <div className="confront-goal dawn"><b>✦</b><span>새벽의 본거지</span></div>
              </section>

              {state.phase === "battle" && battleAttacker && battleDefender && (
                <section className="confront-battle-panel">
                  <header><span>SECRET BATTLE</span><h2>전투 카드 선택</h2><p>AI는 이미 선택을 마쳤습니다.</p></header>
                  <div className="confront-duel">
                    <div className={battleAttacker.side}>
                      <PieceToken piece={battleAttacker} visible selected={false} recent disabled onClick={() => {}} />
                      <span>공격</span><strong>{battleAttacker.role}</strong><small>기본 힘 {battleAttacker.strength}</small>
                    </div>
                    <b>VS</b>
                    <div className={battleDefender.side}>
                      <PieceToken piece={battleDefender} visible selected={false} recent disabled onClick={() => {}} />
                      <span>수비</span><strong>{battleDefender.role}</strong><small>기본 힘 {battleDefender.strength}</small>
                    </div>
                  </div>
                  <div className="confront-card-hand">
                    {humanCards.map((card) => (
                      <button key={card.id} className={card.kind} onClick={() => setState((current) => resolveBattle(current, card.id))}>
                        <span>{card.kind === "power" ? card.value : card.kind === "guard" ? "◈" : card.kind === "surge" ? "⚡" : "↩"}</span>
                        <strong>{card.name}</strong>
                        <small>{card.text}</small>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {selectedPiece && state.phase === "playing" && (
                <section className="confront-selected-card">
                  <span className={`confront-selected-sigil ${selectedPiece.side}`}>{selectedPiece.sigil}</span>
                  <div><strong>{selectedPiece.role} · 힘 {selectedPiece.strength}</strong><small>{selectedPiece.text}</small></div>
                  <button onClick={() => setState((current) => ({ ...current, selectedPieceId: null }))}>선택 취소</button>
                </section>
              )}

              {state.phase === "game-over" && (
                <section className={`confront-result ${state.winner}`}>
                  <span>{state.winner === "dawn" ? "✦" : "◆"}</span>
                  <div><small>CONFRONTATION COMPLETE</small><h2>{state.message}</h2><p>{state.detail}</p></div>
                  <button onClick={() => setState(freshState(state.humanSide, state.difficulty))}>같은 진영으로 다시 플레이</button>
                  <button className="secondary" onClick={() => setState(setupState())}>진영 다시 선택</button>
                </section>
              )}

              <section className="confront-ledger">
                <div>
                  <strong>전투 카드</strong>
                  <span>나 {state.hands[state.humanSide].length}/9 · AI {state.hands[sideOpponent(state.humanSide)].length}/9</span>
                </div>
                <ol>
                  {state.history.length ? state.history.slice(0, 4).map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>) : <li>아직 이동 기록이 없습니다.</li>}
                </ol>
              </section>
            </>
          )}
        </div>
      </section>

      {rulesOpen && (
        <div className="confront-modal-backdrop" onClick={() => setRulesOpen(false)}>
          <section className="confront-rules" role="dialog" aria-modal="true" aria-labelledby="confront-rules-title" onClick={(event) => event.stopPropagation()}>
            <header><div><span>HOW TO PLAY</span><h2 id="confront-rules-title">게임 방법</h2></div><button onClick={() => setRulesOpen(false)} aria-label="규칙 닫기">×</button></header>
            <div className="confront-rule-grid">
              <article><b>1</b><div><strong>정체를 숨긴 9개 기물</strong><p>내 기물만 확인할 수 있습니다. 상대 기물은 전투가 벌어질 때 잠시 공개됩니다.</p></div></article>
              <article><b>2</b><div><strong>한 차례에 한 칸 전진</strong><p>자기 진영 반대편으로 이어진 인접 지역만 이동합니다. 산악 지역에는 진영별 기물 하나만 들어갑니다.</p></div></article>
              <article><b>3</b><div><strong>전투 카드는 동시에 공개</strong><p>기본 힘과 숫자·전술 카드, 지형·기물 능력을 합산합니다. 낮은 쪽이 제거되고 동점이면 둘 다 제거됩니다.</p></div></article>
              <article><b>4</b><div><strong>카드 기억하기</strong><p>사용한 카드는 버립니다. 양측이 9장을 모두 사용하면 전체 카드가 다시 손으로 돌아옵니다.</p></div></article>
            </div>
            <div className="confront-win-rules">
              <div className="dawn"><span>✦</span><strong>새벽 원정대 승리</strong><p>빛의 운반자를 그림자 요새까지 이동시킵니다.</p></div>
              <div className="shadow"><span>◆</span><strong>그림자 군세 승리</strong><p>빛의 운반자를 제거하거나 새벽 성채에 기물 3개를 침입시킵니다.</p></div>
            </div>
            <p className="confront-adaptation-note">공식 일러스트·고유 캐릭터·카드 문구를 사용하지 않은 독자적 재해석입니다.</p>
            <button className="confront-rules-close" onClick={() => setRulesOpen(false)}>확인하고 계속하기</button>
          </section>
        </div>
      )}
    </main>
  );
}
