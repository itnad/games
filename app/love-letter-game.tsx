"use client";

import { useEffect, useMemo, useState } from "react";
import { withKoreanTopic } from "./korean-particles.js";
import {
  LOVE_LETTER_CARD_DEFS,
  loveLetterBuildDeck,
  loveLetterCardDef,
  loveLetterFavorTarget,
  loveLetterMustPlay,
  loveLetterRoundWinners,
  loveLetterSpyBonus,
  loveLetterValidTargets,
} from "./love-letter-engine.js";

type Theme = "classic" | "cookie";
type Phase = "setup" | "turn" | "ai" | "target" | "guess" | "chancellor" | "round-over" | "game-over";
type Card = { uid: string; value: number };
type Player = {
  id: number;
  name: string;
  avatar: string;
  hand: Card[];
  discarded: Card[];
  alive: boolean;
  protected: boolean;
  favors: number;
};
type Pending = { card: Card; targetId: number | null };
type Peek = { playerId: number; value: number } | null;
type State = {
  phase: Phase;
  theme: Theme;
  totalPlayers: number;
  players: Player[];
  deck: Card[];
  setAside: Card | null;
  faceupRemoved: Card[];
  currentIndex: number;
  pending: Pending | null;
  peek: Peek;
  round: number;
  nextStarter: number;
  roundWinners: number[];
  gameWinners: number[];
  message: string;
  detail: string;
  log: string[];
  actionId: number;
};

const AI_NAMES = ["로즈", "테오", "미라", "루카", "노아"];
const AI_COOKIE_NAMES = ["딸기크림", "민트젤리", "레몬슈가", "코코칩", "블루소다"];
const AI_AVATARS = ["R", "T", "M", "L", "N"];

function cardName(card: Card | number, theme: Theme) {
  const value = typeof card === "number" ? card : card.value;
  const def = loveLetterCardDef(value);
  return theme === "cookie" ? def.cookie : def.classic;
}

function makePlayers(total: number, theme: Theme): Player[] {
  return Array.from({ length: total }, (_, index) => ({
    id: index,
    name: index === 0 ? "나" : (theme === "cookie" ? AI_COOKIE_NAMES[index - 1] : AI_NAMES[index - 1]),
    avatar: index === 0 ? "ME" : AI_AVATARS[index - 1],
    hand: [],
    discarded: [],
    alive: true,
    protected: false,
    favors: 0,
  }));
}

function activeDraw(
  state: Omit<State, "phase" | "message" | "detail">,
  index: number,
): State {
  const players = state.players.map((player) =>
    player.id === index ? { ...player, protected: false } : player,
  );
  const deck = [...state.deck];
  const card = deck.shift();
  const drawnPlayers = players.map((player) =>
    player.id === index && card ? { ...player, hand: [...player.hand, card] } : player,
  );
  const human = index === 0;
  return {
    ...state,
    players: drawnPlayers,
    deck,
    peek: human ? null : state.peek,
    currentIndex: index,
    phase: human ? "turn" : "ai",
    message: human ? "당신의 차례입니다" : `${drawnPlayers[index].name}의 차례`,
    detail: human ? "두 장 중 한 장을 사용하세요." : "AI가 공개된 카드와 남은 확률을 계산하고 있습니다.",
  };
}

function newRound(players: Player[], theme: Theme, totalPlayers: number, round: number, starter: number): State {
  const deck = loveLetterBuildDeck() as Card[];
  const setAside = deck.shift() ?? null;
  const faceupRemoved = totalPlayers === 2 ? deck.splice(0, 3) : [];
  const readyPlayers = players.map((player) => ({
    ...player,
    hand: [deck.shift()!],
    discarded: [],
    alive: true,
    protected: false,
  }));
  const base = {
    theme,
    totalPlayers,
    players: readyPlayers,
    deck,
    setAside,
    faceupRemoved,
    currentIndex: starter,
    pending: null,
    peek: null,
    round,
    nextStarter: starter,
    roundWinners: [],
    gameWinners: [],
    log: [],
    actionId: round,
  };
  return activeDraw(base, starter);
}

function setupState(): State {
  return {
    phase: "setup",
    theme: "classic",
    totalPlayers: 4,
    players: [],
    deck: [],
    setAside: null,
    faceupRemoved: [],
    currentIndex: 0,
    pending: null,
    peek: null,
    round: 1,
    nextStarter: 0,
    roundWinners: [],
    gameWinners: [],
    message: "테마와 참가 인원을 선택하세요",
    detail: "AI 참가자는 선택한 인원에 맞춰 자동으로 참여합니다.",
    log: [],
    actionId: 0,
  };
}

function alivePlayers(players: Player[]) {
  return players.filter((player) => player.alive);
}

function eliminate(players: Player[], playerId: number) {
  return players.map((player) =>
    player.id === playerId
      ? { ...player, alive: false, protected: false, discarded: [...player.discarded, ...player.hand], hand: [] }
      : player,
  );
}

function finishRound(state: State, players: Player[], logEntry?: string): State {
  const winners = loveLetterRoundWinners(players);
  const spyId = loveLetterSpyBonus(players);
  const updatedPlayers = players.map((player) => ({
    ...player,
    favors: player.favors + (winners.includes(player.id) ? 1 : 0) + (player.id === spyId ? 1 : 0),
  }));
  const target = loveLetterFavorTarget(state.totalPlayers);
  const gameWinners = updatedPlayers.filter((player) => player.favors >= target).map((player) => player.id);
  const winnerNames = winners.map((id) => updatedPlayers[id].name).join(", ");
  return {
    ...state,
    players: updatedPlayers,
    phase: gameWinners.length ? "game-over" : "round-over",
    pending: null,
    peek: null,
    roundWinners: winners,
    gameWinners,
    nextStarter: winners[0] ?? 0,
    message: gameWinners.length ? `${gameWinners.map((id) => updatedPlayers[id].name).join(", ")} 최종 승리` : `${winnerNames} 라운드 승리`,
    detail: spyId === null ? "가장 높은 카드를 지킨 플레이어가 호감 토큰을 얻었습니다." : `${withKoreanTopic(updatedPlayers[spyId].name)} 첩자 보너스 토큰도 얻었습니다.`,
    log: logEntry ? [logEntry, ...state.log].slice(0, 12) : state.log,
    actionId: state.actionId + 1,
  };
}

function nextAliveIndex(players: Player[], currentIndex: number) {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (currentIndex + offset) % players.length;
    if (players[index].alive) return index;
  }
  return currentIndex;
}

function advanceTurn(state: State, players: Player[], deck: Card[], setAside: Card | null, entry: string): State {
  const log = [entry, ...state.log].slice(0, 12);
  if (alivePlayers(players).length <= 1 || deck.length === 0) {
    return finishRound({ ...state, deck, setAside, log }, players);
  }
  const nextIndex = nextAliveIndex(players, state.currentIndex);
  return activeDraw(
    {
      ...state,
      players,
      deck,
      setAside,
      pending: null,
      peek: state.peek,
      log,
      actionId: state.actionId + 1,
    },
    nextIndex,
  );
}

function discardFromHand(player: Player, card: Card) {
  return {
    ...player,
    hand: player.hand.filter((held) => held.uid !== card.uid),
    discarded: [...player.discarded, card],
  };
}

function chooseAiPlay(player: Player) {
  const forced = loveLetterMustPlay(player.hand);
  if (forced) return player.hand.find((card) => card.uid === forced)!;
  const playable = player.hand.filter((card) => card.value !== 9);
  if (!playable.length) return player.hand[0];
  const weights: Record<number, number> = { 0: 2, 1: 7, 2: 5, 3: 5, 4: 6, 5: 4, 6: 7, 7: 3, 8: 1 };
  return [...playable].sort((a, b) =>
    (weights[b.value] + Math.random() * 3) - (weights[a.value] + Math.random() * 3),
  )[0];
}

function chooseAiTarget(state: State, cardValue: number, actorId: number) {
  const valid = loveLetterValidTargets(state.players, actorId, cardValue) as number[];
  if (!valid.length) return null;
  const others = valid.filter((id) => id !== actorId);
  const pool = others.length ? others : valid;
  if (cardValue === 5) {
    const dangerous = pool.find((id) => state.players[id].discarded.some((card) => card.value >= 7));
    if (dangerous !== undefined) return dangerous;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function aiGuardGuess(state: State, actor: Player) {
  const publicCounts = Object.fromEntries(LOVE_LETTER_CARD_DEFS.map((def) => [def.value, 0])) as Record<number, number>;
  for (const player of state.players) {
    for (const card of player.discarded) publicCounts[card.value] += 1;
  }
  for (const card of actor.hand) publicCounts[card.value] += 1;
  const candidates = LOVE_LETTER_CARD_DEFS
    .filter((def) => def.value !== 1)
    .flatMap((def) => Array.from({ length: Math.max(0, ({ 0: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1, 8: 1, 9: 1 } as Record<number, number>)[def.value] - publicCounts[def.value]) }, () => def.value));
  return candidates[Math.floor(Math.random() * candidates.length)] ?? 9;
}

function applyTargetEffect(state: State, actorId: number, card: Card, targetId: number, guardGuess?: number): State {
  let players = state.players;
  const deck = [...state.deck];
  let setAside = state.setAside;
  const actor = players[actorId];
  const target = players[targetId];
  let entry = `${actor.name} · ${cardName(card, state.theme)} → ${target.name}`;
  let peek = state.peek;

  if (card.value === 1 && guardGuess !== undefined) {
    const correct = target.hand[0]?.value === guardGuess;
    if (correct) players = eliminate(players, targetId);
    entry += ` · ${cardName(guardGuess, state.theme)} ${correct ? "적중" : "실패"}`;
  } else if (card.value === 2) {
    if (actorId === 0 && target.hand[0]) peek = { playerId: targetId, value: target.hand[0].value };
    entry += actorId === 0 ? " · 손패 확인" : " · 비밀 확인";
  } else if (card.value === 3) {
    const actorValue = players[actorId].hand[0]?.value ?? -1;
    const targetValue = players[targetId].hand[0]?.value ?? -1;
    if (actorValue < targetValue) players = eliminate(players, actorId);
    else if (targetValue < actorValue) players = eliminate(players, targetId);
    entry += actorValue === targetValue ? " · 무승부" : ` · ${actorValue < targetValue ? actor.name : target.name} 탈락`;
  } else if (card.value === 5) {
    const discarded = target.hand[0];
    players = players.map((player) =>
      player.id === targetId && discarded ? { ...player, hand: [], discarded: [...player.discarded, discarded] } : player,
    );
    if (discarded?.value === 9) {
      players = eliminate(players, targetId);
      entry += " · 최고 카드가 버려져 탈락";
    } else {
      const replacement = deck.shift() ?? setAside;
      if (deck.length === 0 && replacement === setAside) setAside = null;
      players = players.map((player) =>
        player.id === targetId && player.alive && replacement ? { ...player, hand: [replacement] } : player,
      );
      entry += " · 손패 교체";
    }
  } else if (card.value === 7) {
    const actorHand = players[actorId].hand;
    const targetHand = players[targetId].hand;
    players = players.map((player) =>
      player.id === actorId ? { ...player, hand: targetHand } : player.id === targetId ? { ...player, hand: actorHand } : player,
    );
    entry += " · 손패 교환";
  }

  return advanceTurn({ ...state, peek }, players, deck, setAside, entry);
}

function resolvePlayedCard(state: State, actorId: number, card: Card, ai = false): State {
  let players = state.players.map((player) =>
    player.id === actorId ? discardFromHand(player, card) : player,
  );
  const actor = players[actorId];
  const entry = `${actor.name} · ${cardName(card, state.theme)}`;

  if (card.value === 9) {
    players = eliminate(players, actorId);
    return advanceTurn(state, players, state.deck, state.setAside, `${entry} · 즉시 탈락`);
  }
  if (card.value === 4) {
    players = players.map((player) => player.id === actorId ? { ...player, protected: true } : player);
    return advanceTurn(state, players, state.deck, state.setAside, `${entry} · 다음 차례까지 보호`);
  }
  if (card.value === 6) {
    const deck = [...state.deck];
    const extras = deck.splice(0, Math.min(2, deck.length));
    players = players.map((player) => player.id === actorId ? { ...player, hand: [...player.hand, ...extras] } : player);
    if (!extras.length) return advanceTurn(state, players, deck, state.setAside, `${entry} · 덱이 비어 효과 없음`);
    if (!ai) {
      return {
        ...state,
        players,
        deck,
        phase: "chancellor",
        pending: { card, targetId: null },
        message: "한 장을 선택해 남기세요",
        detail: "선택하지 않은 카드는 덱 아래로 돌아갑니다.",
        log: [entry, ...state.log].slice(0, 12),
        actionId: state.actionId + 1,
      };
    }
    const aiHand = players[actorId].hand;
    const keep = [...aiHand].sort((a, b) => b.value - a.value)[0];
    const bottom = aiHand.filter((held) => held.uid !== keep.uid);
    players = players.map((player) => player.id === actorId ? { ...player, hand: [keep] } : player);
    return advanceTurn(state, players, [...deck, ...bottom], state.setAside, `${entry} · 카드 재정리`);
  }
  if ([1, 2, 3, 5, 7].includes(card.value)) {
    const targets = loveLetterValidTargets(players, actorId, card.value) as number[];
    if (!targets.length) return advanceTurn(state, players, state.deck, state.setAside, `${entry} · 선택 가능한 대상 없음`);
    const nextState = { ...state, players };
    if (ai) {
      const targetId = chooseAiTarget(nextState, card.value, actorId);
      if (targetId === null) return advanceTurn(nextState, players, state.deck, state.setAside, entry);
      const guess = card.value === 1 ? aiGuardGuess(nextState, players[actorId]) : undefined;
      return applyTargetEffect(nextState, actorId, card, targetId, guess);
    }
    return {
      ...nextState,
      phase: "target",
      pending: { card, targetId: null },
      message: "효과를 적용할 대상을 선택하세요",
      detail: card.value === 5 ? "보호되지 않은 상대 또는 자신을 선택할 수 있습니다." : "보호 상태가 아닌 상대를 선택할 수 있습니다.",
      actionId: state.actionId + 1,
    };
  }
  return advanceTurn(state, players, state.deck, state.setAside, entry);
}

function LetterCard({
  card,
  theme,
  playable = false,
  forced = false,
  small = false,
  onClick,
}: {
  card: Card;
  theme: Theme;
  playable?: boolean;
  forced?: boolean;
  small?: boolean;
  onClick?: () => void;
}) {
  const def = loveLetterCardDef(card.value);
  return (
    <button
      type="button"
      className={`letter-card ${theme} value-${card.value} ${small ? "small" : ""} ${playable ? "playable" : ""} ${forced ? "forced" : ""}`}
      onClick={onClick}
      disabled={!playable}
      aria-label={`${cardName(card, theme)} ${card.value}, ${def.effect}`}
    >
      <span className="letter-card-value">{card.value}</span>
      <i className="letter-card-icon" aria-hidden="true">{theme === "cookie" ? (card.value === 9 ? "♛" : "●") : def.icon}</i>
      <strong>{cardName(card, theme)}</strong>
      {!small && <p>{def.effect}</p>}
      <small>{({ 0: 2, 1: 6, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 1, 8: 1, 9: 1 } as Record<number, number>)[card.value]}장</small>
    </button>
  );
}

function OpponentCard({ player, active, theme, reveal }: { player: Player; active: boolean; theme: Theme; reveal: boolean }) {
  return (
    <article className={`letter-opponent ${active ? "active" : ""} ${!player.alive ? "out" : ""} ${player.protected ? "protected" : ""}`}>
      <div className="letter-avatar">{theme === "cookie" ? "●" : player.avatar}</div>
      <div><strong>{player.name}</strong><span>{player.alive ? player.protected ? "보호 중" : active ? "생각 중" : "대기" : "라운드 탈락"}</span></div>
      <b>♥ {player.favors}</b>
      <div className="letter-hidden-hand">
        {player.hand.map((card) => reveal ? <LetterCard key={card.uid} card={card} theme={theme} small /> : <i key={card.uid}>✉</i>)}
      </div>
      <div className="letter-discards">
        {player.discarded.slice(-5).map((card) => <span key={card.uid} title={cardName(card, theme)}>{card.value}</span>)}
      </div>
    </article>
  );
}

function LoveLetterTopbar({ onExit }: { onExit: () => void }) {
  return (
    <header className="game-topbar love-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup"><span className="love-mini-mark">♥</span><div><span>paperoid</span><strong>러브레터</strong></div></div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

export function LoveLetterGame({ onExit }: { onExit: () => void }) {
  const [theme, setTheme] = useState<Theme>("classic");
  const [totalPlayers, setTotalPlayers] = useState(4);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [state, setState] = useState<State>(setupState);

  useEffect(() => {
    if (state.phase !== "ai") return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.phase !== "ai") return current;
        const actor = current.players[current.currentIndex];
        return resolvePlayedCard(current, actor.id, chooseAiPlay(actor), true);
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.currentIndex, state.actionId]);

  const active = state.players[state.currentIndex];
  const forcedUid = active?.id === 0 ? loveLetterMustPlay(active.hand) : null;
  const validTargets = useMemo(
    () => state.pending ? loveLetterValidTargets(state.players, 0, state.pending.card.value) as number[] : [],
    [state.pending, state.players],
  );
  const favorTarget = loveLetterFavorTarget(state.totalPlayers);

  function start() {
    const players = makePlayers(totalPlayers, theme);
    setState(newRound(players, theme, totalPlayers, 1, 0));
  }

  function playHuman(card: Card) {
    if (state.phase !== "turn" || state.currentIndex !== 0) return;
    if (forcedUid && card.uid !== forcedUid) return;
    setState((current) => resolvePlayedCard(current, 0, card));
  }

  function chooseTarget(targetId: number) {
    if (state.phase !== "target" || !state.pending || !validTargets.includes(targetId)) return;
    if (state.pending.card.value === 1) {
      setState((current) => ({
        ...current,
        phase: "guess",
        pending: { ...current.pending!, targetId },
        message: `${current.players[targetId].name}의 카드를 추측하세요`,
        detail: "경비병은 다른 경비병을 지목할 수 없습니다.",
      }));
      return;
    }
    setState((current) => applyTargetEffect(current, 0, current.pending!.card, targetId));
  }

  function chooseGuess(value: number) {
    if (state.phase !== "guess" || state.pending?.targetId === null || !state.pending) return;
    setState((current) => applyTargetEffect(current, 0, current.pending!.card, current.pending!.targetId!, value));
  }

  function keepChancellor(uid: string) {
    if (state.phase !== "chancellor") return;
    setState((current) => {
      const human = current.players[0];
      const keep = human.hand.find((card) => card.uid === uid)!;
      const bottom = human.hand.filter((card) => card.uid !== uid);
      const players = current.players.map((player) => player.id === 0 ? { ...player, hand: [keep] } : player);
      return advanceTurn(current, players, [...current.deck, ...bottom], current.setAside, `나 · ${cardName(6, current.theme)} 카드 재정리`);
    });
  }

  function nextRound() {
    setState((current) => newRound(current.players, current.theme, current.totalPlayers, current.round + 1, current.nextStarter));
  }

  return (
    <main className={`game-shell love-letter-shell ${state.theme}`}>
      <LoveLetterTopbar onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel love-info">
          <div><span className="eyebrow">RISK & DEDUCTION</span><h1>한 장의 비밀,<br />한 번의 선택</h1><p>두 장 중 하나를 내고 효과를 적용하세요. 상대의 손패를 추리하며 마지막까지 살아남거나 가장 높은 카드를 지키면 됩니다.</p></div>
          {state.phase === "setup" ? (
            <div className="love-side-note"><span>게임 시간</span><strong>약 15~20분</strong><small>AI 포함 2~6인</small></div>
          ) : (
            <div className="love-score-side">
              <div><span>ROUND</span><strong>{state.round}</strong></div>
              <div><span>목표 호감</span><strong>{favorTarget}</strong></div>
              <div><span>나의 호감</span><strong>{state.players[0]?.favors ?? 0}</strong></div>
            </div>
          )}
          <button className="love-rules-button" onClick={() => setRulesOpen(true)}>ⓘ 카드 효과와 게임 방법</button>
        </aside>

        <div className="board-panel love-board-panel">
          {state.phase === "setup" ? (
            <section className="love-welcome">
              <div className="love-seal" aria-hidden="true">♥<i>✉</i></div>
              <span>DRAW ONE · PLAY ONE</span>
              <h2>러브레터</h2>
              <p>같은 추리 규칙을 두 가지 분위기로 즐길 수 있습니다. 선택한 테마는 카드 이름과 게임 화면 전체에 적용됩니다.</p>
              <div className="love-theme-options">
                <button className={theme === "classic" ? "classic active" : "classic"} onClick={() => setTheme("classic")}>
                  <i>♕</i><strong>왕궁 클래식</strong><span>봉인과 서신, 우아한 궁정 테마</span>
                </button>
                <button className={theme === "cookie" ? "cookie active" : "cookie"} onClick={() => setTheme("cookie")}>
                  <i>●</i><strong>쿠키런 러브레터 테마</strong><span>달콤한 쿠키 왕국 팬 테마</span>
                </button>
              </div>
              <div className="love-player-picker">
                <span>참가 인원</span>
                <div>{[2,3,4,5,6].map((count) => <button key={count} className={totalPlayers === count ? "active" : ""} onClick={() => setTotalPlayers(count)}>{count}</button>)}</div>
                <small>나 1명 + AI {totalPlayers - 1}명</small>
              </div>
              <button className="love-start" onClick={start}>편지 보내기 <span>→</span></button>
              <small className="love-fan-note">쿠키런 러브레터 테마는 공식 원화를 복제하지 않은 비공식 팬 테마이며, 원작과 같은 21장 규칙을 사용합니다.</small>
            </section>
          ) : (
            <>
              <section className="love-status" role="status">
                <span>{state.theme === "cookie" ? "●" : "♥"}</span>
                <div><strong>{state.message}</strong><small>{state.detail}</small></div>
                <button onClick={() => setRulesOpen(true)}>규칙</button>
              </section>

              <section className="love-opponents" aria-label="AI 참가자">
                {state.players.slice(1).map((player) => <OpponentCard key={player.id} player={player} active={state.currentIndex === player.id && state.phase === "ai"} theme={state.theme} reveal={state.phase === "round-over" || state.phase === "game-over"} />)}
              </section>

              <section className="love-table">
                <div className="love-deck-zone">
                  <div className="love-deck-stack"><i>✉</i><b>{state.deck.length}</b></div>
                  <span>남은 편지</span>
                </div>
                <div className="love-round-center">
                  <span>ROUND {state.round}</span>
                  <strong>{alivePlayers(state.players).length}<small>명 생존</small></strong>
                  <p>먼저 호감 {favorTarget}개</p>
                </div>
                <div className="love-removed-zone">
                  <div>{state.faceupRemoved.length ? state.faceupRemoved.map((card) => <span key={card.uid}>{card.value}</span>) : <i>?</i>}</div>
                  <span>{state.totalPlayers === 2 ? "공개 제외" : "비공개 제외"}</span>
                </div>
              </section>

              {state.peek && (
                <section className="love-peek">
                  <span>몰래 확인한 편지</span>
                  <strong>{state.players[state.peek.playerId].name}의 손패는 {cardName(state.peek.value, state.theme)} {state.peek.value}</strong>
                </section>
              )}

              {state.phase === "target" && state.pending && (
                <section className="love-choice-panel">
                  <header><span>1</span><div><strong>대상 선택</strong><small>{cardName(state.pending.card, state.theme)} 효과를 적용합니다.</small></div></header>
                  <div>{state.players.filter((player) => validTargets.includes(player.id)).map((player) => <button key={player.id} onClick={() => chooseTarget(player.id)}><i>{player.id === 0 ? "ME" : player.avatar}</i><strong>{player.name}</strong><small>{player.id === 0 ? "나 자신" : player.protected ? "보호 중" : "선택 가능"}</small></button>)}</div>
                </section>
              )}

              {state.phase === "guess" && state.pending && (
                <section className="love-choice-panel guess">
                  <header><span>2</span><div><strong>카드 추측</strong><small>경비병을 제외한 카드 한 장을 지목하세요.</small></div></header>
                  <div>{LOVE_LETTER_CARD_DEFS.filter((def) => def.value !== 1).map((def) => <button key={def.value} onClick={() => chooseGuess(def.value)}><i>{def.value}</i><strong>{state.theme === "cookie" ? def.cookie : def.classic}</strong></button>)}</div>
                </section>
              )}

              {state.phase === "chancellor" && (
                <section className="love-choice-panel chancellor">
                  <header><span>3</span><div><strong>남길 카드 선택</strong><small>나머지 두 장은 덱 아래로 돌아갑니다.</small></div></header>
                  <div>{state.players[0].hand.map((card) => <LetterCard key={card.uid} card={card} theme={state.theme} playable onClick={() => keepChancellor(card.uid)} />)}</div>
                </section>
              )}

              <section className={`love-human-area ${!state.players[0]?.alive ? "out" : ""}`}>
                <header><div><span>나의 손패</span><strong>{state.players[0]?.protected ? "수호 중" : state.phase === "turn" ? "사용할 카드를 선택하세요" : state.players[0]?.alive ? "차례를 기다리는 중" : "이번 라운드 탈락"}</strong></div><b>♥ {state.players[0]?.favors ?? 0}/{favorTarget}</b></header>
                <div className="love-hand">
                  {state.players[0]?.hand.map((card) => (
                    <LetterCard
                      key={card.uid}
                      card={card}
                      theme={state.theme}
                      playable={state.phase === "turn" && (!forcedUid || forcedUid === card.uid)}
                      forced={forcedUid === card.uid}
                      onClick={() => playHuman(card)}
                    />
                  ))}
                </div>
                {forcedUid && state.phase === "turn" && <p>백작 카드는 왕 또는 왕자와 함께 들고 있어 반드시 사용해야 합니다.</p>}
                <div className="love-my-discards">{state.players[0]?.discarded.map((card) => <span key={card.uid} title={cardName(card, state.theme)}>{card.value}</span>)}</div>
              </section>

              {(state.phase === "round-over" || state.phase === "game-over") && (
                <section className={`love-result ${state.phase}`}>
                  <span>{state.theme === "cookie" ? "●" : "♥"}</span>
                  <div><small>{state.phase === "game-over" ? "FINAL FAVOR" : `ROUND ${state.round} COMPLETE`}</small><h2>{state.message}</h2><p>{state.detail}</p></div>
                  {state.phase === "round-over" ? <button onClick={nextRound}>다음 라운드</button> : <button onClick={() => { const players = makePlayers(state.totalPlayers, state.theme); setState(newRound(players, state.theme, state.totalPlayers, 1, 0)); }}>같은 설정으로 다시 플레이</button>}
                  <button className="secondary" onClick={() => setState(setupState())}>설정으로</button>
                </section>
              )}

              <section className="love-log">
                <strong>공개 기록</strong>
                <div>{state.log.length ? state.log.slice(0,6).map((entry,index) => <span key={`${entry}-${index}`}>{entry}</span>) : <span>아직 사용된 카드가 없습니다.</span>}</div>
              </section>
            </>
          )}
        </div>
      </section>

      {rulesOpen && (
        <div className="love-modal-backdrop" onClick={() => setRulesOpen(false)}>
          <section className="love-rules" role="dialog" aria-modal="true" aria-labelledby="love-rules-title" onClick={(event) => event.stopPropagation()}>
            <header><div><span>HOW TO PLAY</span><h2 id="love-rules-title">러브레터 게임 방법</h2></div><button onClick={() => setRulesOpen(false)}>×</button></header>
            <div className="love-rule-summary">
              <article><b>1</b><div><strong>한 장 뽑고 한 장 사용</strong><p>항상 손패 한 장을 남기며 사용한 카드는 모두에게 공개됩니다.</p></div></article>
              <article><b>2</b><div><strong>추리하고 살아남기</strong><p>마지막 생존자가 되거나 덱이 끝났을 때 가장 높은 카드를 가진 사람이 라운드에서 승리합니다.</p></div></article>
              <article><b>3</b><div><strong>호감 토큰 모으기</strong><p>인원에 따라 필요한 토큰 수가 달라지며, 먼저 목표에 도달하면 최종 승리합니다.</p></div></article>
            </div>
            <div className="love-card-reference">
              {LOVE_LETTER_CARD_DEFS.map((def) => <article key={def.value}><b>{def.value}</b><div><strong>{state.theme === "cookie" ? def.cookie : def.classic}</strong><p>{def.effect}</p></div><span>{({0:2,1:6,2:2,3:2,4:2,5:2,6:2,7:1,8:1,9:1} as Record<number,number>)[def.value]}장</span></article>)}
            </div>
            <button className="love-rules-close" onClick={() => setRulesOpen(false)}>확인하고 계속하기</button>
          </section>
        </div>
      )}
    </main>
  );
}
