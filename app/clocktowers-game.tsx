"use client";

import { useEffect, useMemo, useReducer, useState } from "react";

type ExitProps = { onExit: () => void };
type CardKind = "story" | "clock" | "roof";
type Animal = "none" | "mouse" | "cat";
type RoofColor = "ruby" | "amber" | "emerald" | "sapphire" | "violet";

type TowerCard = {
  id: string;
  kind: CardKind;
  floors?: 1 | 2;
  animal?: Animal;
  color?: RoofColor;
};

type Tower = {
  id: number;
  stories: TowerCard[];
  clock?: TowerCard;
  roof?: TowerCard;
};

type Player = {
  id: number;
  name: string;
  isHuman: boolean;
  hand: TowerCard[];
  towers: Tower[];
};

type Decks = Record<CardKind, TowerCard[]>;
type RoofProgress = Record<RoofColor, number | null>;
type Phase = "setup" | "play" | "draw" | "ai" | "over";

type GameState = {
  phase: Phase;
  players: Player[];
  decks: Decks;
  roofProgress: RoofProgress;
  activeIndex: number;
  selectedCardId: string | null;
  nextTowerId: number;
  turn: number;
  message: string;
  history: string[];
};

type Action =
  | { type: "START"; playerCount: number }
  | { type: "SELECT"; cardId: string }
  | { type: "PLAY"; target: number | "new" }
  | { type: "DISCARD" }
  | { type: "DRAW"; deck: CardKind }
  | { type: "AI_TURN" };

const COLORS: RoofColor[] = ["ruby", "amber", "emerald", "sapphire", "violet"];
const COLOR_NAMES: Record<RoofColor, string> = {
  ruby: "루비",
  amber: "호박",
  emerald: "에메랄드",
  sapphire: "사파이어",
  violet: "바이올렛",
};
const KIND_NAMES: Record<CardKind, string> = { story: "층", clock: "시계", roof: "지붕" };
const AI_NAMES = ["루나", "모모", "토토"];

const INITIAL_STATE: GameState = {
  phase: "setup",
  players: [],
  decks: { story: [], clock: [], roof: [] },
  roofProgress: { ruby: null, amber: null, emerald: null, sapphire: null, violet: null },
  activeIndex: 0,
  selectedCardId: null,
  nextTowerId: 1,
  turn: 1,
  message: "함께 건설할 AI 수를 정하세요.",
  history: [],
};

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function makeGame(playerCount: number): GameState {
  let cardId = 0;
  const card = (value: Omit<TowerCard, "id">): TowerCard => ({ ...value, id: `ct-${cardId += 1}` });
  const storyDeck = shuffled(Array.from({ length: 30 }, (_, index) => card({
    kind: "story",
    floors: index % 3 === 0 ? 2 : 1,
    animal: index % 10 === 0 ? "cat" : index % 4 === 0 ? "mouse" : "none",
  }))).slice(5);
  const clockDeck = shuffled(Array.from({ length: 18 }, (_, index) => card({
    kind: "clock",
    animal: index < 9 ? "mouse" : "none",
  })));
  const roofDeck = shuffled(COLORS.flatMap((color) =>
    Array.from({ length: 4 }, () => card({ kind: "roof", color })),
  )).slice(3);

  const players = Array.from({ length: playerCount }, (_, index): Player => ({
    id: index,
    name: index === 0 ? "나" : AI_NAMES[index - 1],
    isHuman: index === 0,
    hand: [
      card({ kind: "story", floors: 1, animal: "cat" }),
      card({ kind: "story", floors: 1, animal: "mouse" }),
      card({ kind: "clock", animal: "mouse" }),
    ],
    towers: [],
  }));

  return {
    ...INITIAL_STATE,
    phase: "play",
    players,
    decks: { story: storyDeck, clock: clockDeck, roof: roofDeck },
    message: "손의 카드 한 장을 골라 탑에 놓거나 버리세요.",
    history: [`${playerCount}인 건설 대결을 시작했습니다.`],
  };
}

function towerHeight(tower: Tower) {
  return tower.stories.reduce((sum, item) => sum + (item.floors ?? 0), 0);
}

function isComplete(tower: Tower) {
  return Boolean(tower.roof);
}

function towerAnimals(tower: Tower) {
  const animals = [...tower.stories, tower.clock].filter(Boolean).map((item) => item?.animal);
  return {
    mouse: animals.includes("mouse"),
    cat: animals.includes("cat"),
  };
}

function towerPoints(tower: Tower) {
  if (!isComplete(tower)) return 0;
  const { mouse, cat } = towerAnimals(tower);
  if (!mouse && !cat) return 5;
  if (!mouse && cat) return 4;
  if (mouse && cat) return 3;
  return 2;
}

function playerScore(player: Player) {
  return player.towers.reduce((sum, tower) => sum + towerPoints(tower), 0);
}

function highestMouseLevel(player: Player) {
  let highest = 0;
  for (const tower of player.towers.filter(isComplete)) {
    let level = 0;
    for (const story of tower.stories) {
      level += story.floors ?? 0;
      if (story.animal === "mouse") highest = Math.max(highest, level);
    }
    if (tower.clock?.animal === "mouse") highest = Math.max(highest, level + 1);
  }
  return highest;
}

function comparePlayers(a: Player, b: Player) {
  return playerScore(b) - playerScore(a) || highestMouseLevel(b) - highestMouseLevel(a);
}

function validRoofHeight(tower: Tower, color: RoofColor, progress: RoofProgress) {
  const height = towerHeight(tower);
  return progress[color] === null ? height === 1 || height === 2 : height === progress[color];
}

function canPlace(card: TowerCard, tower: Tower, progress: RoofProgress) {
  if (tower.roof) return false;
  if (card.kind === "story") return !tower.clock;
  if (card.kind === "clock") return tower.stories.length > 0 && !tower.clock;
  if (!tower.clock || !card.color) return false;
  return validRoofHeight(tower, card.color, progress);
}

function hasCards(decks: Decks) {
  return Object.values(decks).some((deck) => deck.length > 0);
}

function nextTurn(state: GameState): GameState {
  const anyHands = state.players.some((player) => player.hand.length > 0);
  if (!hasCards(state.decks) && !anyHands) {
    return { ...state, phase: "over", selectedCardId: null, message: "모든 공사가 끝났습니다. 완성된 탑의 점수를 확인하세요." };
  }

  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const nextIndex = (state.activeIndex + offset) % state.players.length;
    if (state.players[nextIndex].hand.length > 0 || hasCards(state.decks)) {
      const player = state.players[nextIndex];
      return {
        ...state,
        activeIndex: nextIndex,
        phase: player.isHuman ? "play" : "ai",
        selectedCardId: null,
        turn: state.turn + 1,
        message: player.isHuman ? "손의 카드 한 장을 골라 탑에 놓거나 버리세요." : `${player.name}가 탑을 설계하고 있습니다…`,
      };
    }
  }
  return { ...state, phase: "over", selectedCardId: null };
}

function removeCard(player: Player, cardId: string) {
  return { ...player, hand: player.hand.filter((card) => card.id !== cardId) };
}

function placeCard(state: GameState, playerIndex: number, card: TowerCard, target: number | "new") {
  const players = [...state.players];
  let player = removeCard(players[playerIndex], card.id);
  let nextTowerId = state.nextTowerId;
  let roofProgress = { ...state.roofProgress };

  if (target === "new") {
    player = {
      ...player,
      towers: [...player.towers, { id: nextTowerId, stories: [card] }],
    };
    nextTowerId += 1;
  } else {
    player = {
      ...player,
      towers: player.towers.map((tower) => {
        if (tower.id !== target) return tower;
        if (card.kind === "story") return { ...tower, stories: [...tower.stories, card] };
        if (card.kind === "clock") return { ...tower, clock: card };
        if (card.color) roofProgress[card.color] = towerHeight(tower) + 1;
        return { ...tower, roof: card };
      }),
    };
  }
  players[playerIndex] = player;
  const label = card.kind === "roof" ? `${COLOR_NAMES[card.color!]} 지붕` : KIND_NAMES[card.kind];
  const log = `${player.name}: ${label} 카드를 ${target === "new" ? "새 탑에" : "탑에"} 놓았습니다.`;
  return { ...state, players, roofProgress, nextTowerId, selectedCardId: null, history: [log, ...state.history].slice(0, 8) };
}

function chooseAiMove(state: GameState, player: Player) {
  const moves: Array<{ card: TowerCard; target: number | "new"; value: number }> = [];
  player.hand.forEach((card) => {
    if (card.kind === "story") moves.push({ card, target: "new", value: card.animal === "none" ? 2 : 1 });
    player.towers.forEach((tower) => {
      if (!canPlace(card, tower, state.roofProgress)) return;
      let value = 3;
      if (card.kind === "clock") value = towerHeight(tower) >= 2 ? 6 : 4;
      if (card.kind === "story") value = towerHeight(tower) < 4 ? 4 : 1;
      if (card.kind === "roof") value = 13 + towerPoints({ ...tower, roof: card });
      moves.push({ card, target: tower.id, value: value + Math.random() * 1.5 });
    });
  });
  return moves.sort((a, b) => b.value - a.value)[0] ?? null;
}

function chooseAiDeck(state: GameState, player: Player) {
  const options = (Object.keys(state.decks) as CardKind[]).filter((kind) => state.decks[kind].length > 0);
  if (!options.length) return null;
  const needsClock = player.towers.some((tower) => tower.stories.length && !tower.clock);
  const needsRoof = player.towers.some((tower) => tower.clock && !tower.roof);
  const preferred = needsRoof && options.includes("roof") ? "roof" : needsClock && options.includes("clock") ? "clock" : "story";
  return options.includes(preferred) ? preferred : options[0];
}

function reducer(state: GameState, action: Action): GameState {
  if (action.type === "START") return makeGame(action.playerCount);
  if (action.type === "SELECT") {
    if (state.phase !== "play") return state;
    return { ...state, selectedCardId: state.selectedCardId === action.cardId ? null : action.cardId };
  }
  if (action.type === "PLAY") {
    if (state.phase !== "play") return state;
    const player = state.players[state.activeIndex];
    const selected = player.hand.find((card) => card.id === state.selectedCardId);
    if (!selected) return state;
    if (action.target === "new" && selected.kind !== "story") return state;
    const tower = action.target === "new" ? null : player.towers.find((item) => item.id === action.target);
    if (tower && !canPlace(selected, tower, state.roofProgress)) return state;
    const placed = placeCard(state, state.activeIndex, selected, action.target);
    if (hasCards(placed.decks)) return { ...placed, phase: "draw", message: "공개 더미 하나를 골라 카드를 보충하세요." };
    return nextTurn(placed);
  }
  if (action.type === "DISCARD") {
    if (state.phase !== "play") return state;
    const player = state.players[state.activeIndex];
    const selected = player.hand.find((card) => card.id === state.selectedCardId);
    if (!selected) return state;
    const players = [...state.players];
    players[state.activeIndex] = removeCard(player, selected.id);
    const discarded = {
      ...state,
      players,
      selectedCardId: null,
      history: [`${player.name}: ${KIND_NAMES[selected.kind]} 카드를 버렸습니다.`, ...state.history].slice(0, 8),
    };
    if (hasCards(discarded.decks)) return { ...discarded, phase: "draw", message: "공개 더미 하나를 골라 카드를 보충하세요." };
    return nextTurn(discarded);
  }
  if (action.type === "DRAW") {
    if (state.phase !== "draw" || !state.decks[action.deck].length) return state;
    const drawn = state.decks[action.deck][0];
    const decks = { ...state.decks, [action.deck]: state.decks[action.deck].slice(1) };
    const players = [...state.players];
    const player = players[state.activeIndex];
    players[state.activeIndex] = { ...player, hand: [...player.hand, drawn] };
    return nextTurn({
      ...state,
      decks,
      players,
      history: [`${player.name}: ${KIND_NAMES[action.deck]} 더미에서 카드를 가져왔습니다.`, ...state.history].slice(0, 8),
    });
  }
  if (action.type === "AI_TURN") {
    if (state.phase !== "ai") return state;
    const player = state.players[state.activeIndex];
    const move = chooseAiMove(state, player);
    let resolved = state;
    if (move) {
      resolved = placeCard(state, state.activeIndex, move.card, move.target);
    } else if (player.hand.length) {
      const discarded = player.hand[0];
      const players = [...state.players];
      players[state.activeIndex] = removeCard(player, discarded.id);
      resolved = {
        ...state,
        players,
        history: [`${player.name}: ${KIND_NAMES[discarded.kind]} 카드를 버렸습니다.`, ...state.history].slice(0, 8),
      };
    }
    const activePlayer = resolved.players[resolved.activeIndex];
    const deckKind = chooseAiDeck(resolved, activePlayer);
    if (deckKind) {
      const drawn = resolved.decks[deckKind][0];
      const decks = { ...resolved.decks, [deckKind]: resolved.decks[deckKind].slice(1) };
      const players = [...resolved.players];
      players[resolved.activeIndex] = { ...activePlayer, hand: [...activePlayer.hand, drawn] };
      resolved = {
        ...resolved,
        decks,
        players,
        history: [`${activePlayer.name}: ${KIND_NAMES[deckKind]} 더미에서 카드를 가져왔습니다.`, ...resolved.history].slice(0, 8),
      };
    }
    return nextTurn(resolved);
  }
  return state;
}

function PartCard({ card, compact = false }: { card: TowerCard; compact?: boolean }) {
  return (
    <span className={`ct-part-card ${card.kind} ${card.color ?? ""} ${compact ? "compact" : ""}`}>
      {card.kind === "story" && (
        <>
          <b>{card.floors === 2 ? "▥  ▥" : "▥"}</b>
          <small>{card.floors}층</small>
        </>
      )}
      {card.kind === "clock" && <b className="ct-clock-face">Ⅻ<br /><i>◷</i></b>}
      {card.kind === "roof" && <b className="ct-roof-shape" />}
      {card.animal === "mouse" && <em aria-label="생쥐">🐭</em>}
      {card.animal === "cat" && <em aria-label="고양이">🐈</em>}
    </span>
  );
}

function TowerView({
  tower,
  selected,
  legal,
  onClick,
}: {
  tower: Tower;
  selected: boolean;
  legal: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`ct-tower ${isComplete(tower) ? "complete" : ""} ${legal ? "legal" : ""} ${selected ? "selected" : ""}`}
      type="button"
      disabled={!onClick || !legal}
      onClick={onClick}
      aria-label={`${towerHeight(tower)}층 탑${isComplete(tower) ? `, ${towerPoints(tower)}점` : ""}`}
    >
      <span className="ct-tower-stack">
        {tower.roof && <PartCard card={tower.roof} compact />}
        {tower.clock && <PartCard card={tower.clock} compact />}
        {[...tower.stories].reverse().map((card) => <PartCard key={card.id} card={card} compact />)}
      </span>
      <span className="ct-tower-meta">
        <b>{towerHeight(tower)}층</b>
        {isComplete(tower) ? <em>{towerPoints(tower)}점</em> : <em>공사 중</em>}
      </span>
    </button>
  );
}

function DeckCard({ kind, deck, canDraw, onDraw }: { kind: CardKind; deck: TowerCard[]; canDraw: boolean; onDraw: () => void }) {
  const top = deck[0];
  return (
    <button className={`ct-deck ${canDraw ? "ready" : ""}`} type="button" disabled={!canDraw || !top} onClick={onDraw}>
      <span className="ct-deck-top">{top ? <PartCard card={top} /> : <b>비었음</b>}</span>
      <span><strong>{KIND_NAMES[kind]} 더미</strong><small>{deck.length}장 남음</small></span>
    </button>
  );
}

export function ClocktowersGame({ onExit }: ExitProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    if (state.phase !== "ai") return;
    const timer = window.setTimeout(() => dispatch({ type: "AI_TURN" }), 720);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.turn]);

  const human = state.players[0];
  const active = state.players[state.activeIndex];
  const selectedCard = human?.hand.find((card) => card.id === state.selectedCardId) ?? null;
  const ranking = useMemo(() => [...state.players].sort(comparePlayers), [state.players]);
  const winners = useMemo(() => ranking.filter((player) => playerScore(player) === playerScore(ranking[0]) && highestMouseLevel(player) === highestMouseLevel(ranking[0])), [ranking]);

  if (state.phase === "setup") {
    return (
      <main className="ct-shell setup">
        <header className="ct-topbar">
          <button onClick={onExit} aria-label="게임 목록으로 돌아가기">←</button>
          <div><span>PLAYROOM</span><strong>시계탑</strong></div>
          <button onClick={() => setRulesOpen(true)}>게임 방법</button>
        </header>
        <section className="ct-setup-card">
          <div className="ct-setup-art" aria-hidden="true">
            <span className="tower one">◇<b>Ⅻ</b><i>▥</i><i>▥</i></span>
            <span className="tower two">◇<b>Ⅻ</b><i>▥</i></span>
            <span className="moon">☾</span>
          </div>
          <div className="ct-setup-copy">
            <span className="ct-kicker">CLOCKTOWERS · 2004</span>
            <h1>도시의 시간을<br />가장 높이 쌓으세요</h1>
            <p>층을 올리고 시계를 단 뒤, 색깔별 높이 규칙에 맞는 지붕으로 탑을 완성하세요. 고양이는 생쥐 피해를 줄여줍니다.</p>
            <div className="ct-player-options" aria-label="참가 인원 선택">
              {[2, 3, 4].map((count) => (
                <button key={count} onClick={() => dispatch({ type: "START", playerCount: count })}>
                  <strong>{count}인 게임</strong>
                  <span>나 + AI {count - 1}명</span>
                </button>
              ))}
            </div>
          </div>
        </section>
        <RulesLayer open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </main>
    );
  }

  return (
    <main className="ct-shell">
      <header className="ct-topbar">
        <button onClick={onExit} aria-label="게임 목록으로 돌아가기">←</button>
        <div><span>PLAYROOM</span><strong>시계탑</strong></div>
        <button onClick={() => setRulesOpen(true)}>게임 방법</button>
      </header>

      <section className="ct-score-strip">
        {state.players.map((player, index) => (
          <article key={player.id} className={`${index === state.activeIndex ? "active" : ""} ${player.isHuman ? "human" : ""}`}>
            <span>{player.isHuman ? "나" : "AI"}</span>
            <strong>{player.name}</strong>
            <b>{playerScore(player)}점</b>
          </article>
        ))}
      </section>

      <section className="ct-status-bar">
        <span>{state.turn}번째 차례</span>
        <div><strong>{state.phase === "over" ? "건설 완료" : `${active.name}의 차례`}</strong><p>{state.message}</p></div>
        <button onClick={() => dispatch({ type: "START", playerCount: state.players.length })}>새 게임</button>
      </section>

      <section className="ct-roof-market" aria-label="색깔별 다음 탑 높이">
        <header><strong>도시 높이 규칙</strong><span>같은 색은 다음 탑이 정확히 한 층 높아야 합니다</span></header>
        <div>
          {COLORS.map((color) => (
            <article key={color} className={color}>
              <i aria-hidden="true" />
              <span>{COLOR_NAMES[color]}<b>{state.roofProgress[color] === null ? "첫 탑 1·2층" : `다음 ${state.roofProgress[color]}층`}</b></span>
            </article>
          ))}
        </div>
      </section>

      <section className="ct-opponents" aria-label="AI 건설 현황">
        {state.players.slice(1).map((player) => (
          <article key={player.id} className="ct-player-board opponent">
            <header><div><span>AI 건축가</span><strong>{player.name}</strong></div><p>손패 {player.hand.length}장 · 완성 {player.towers.filter(isComplete).length}개</p></header>
            <div className="ct-tower-row">
              {player.towers.length ? player.towers.map((tower) => <TowerView key={tower.id} tower={tower} legal={false} selected={false} />) : <span className="ct-empty-site">아직 세운 탑이 없습니다</span>}
            </div>
          </article>
        ))}
      </section>

      <section className="ct-market">
        <header><span>공개 카드 시장</span><strong>{state.phase === "draw" ? "가져올 더미를 선택하세요" : "다음 카드를 미리 확인하세요"}</strong></header>
        <div className="ct-deck-row">
          {(["story", "clock", "roof"] as CardKind[]).map((kind) => (
            <DeckCard key={kind} kind={kind} deck={state.decks[kind]} canDraw={state.phase === "draw"} onDraw={() => dispatch({ type: "DRAW", deck: kind })} />
          ))}
        </div>
      </section>

      <section className="ct-player-board human">
        <header>
          <div><span>내 건설 구역</span><strong>{state.phase === "play" ? "놓을 위치를 선택하세요" : state.phase === "draw" ? "카드를 보충하세요" : "상대의 차례입니다"}</strong></div>
          <p>완성된 탑 {human.towers.filter(isComplete).length}개 · 현재 {playerScore(human)}점</p>
        </header>
        <div className="ct-tower-row human-row">
          {selectedCard?.kind === "story" && (
            <button className="ct-new-tower" onClick={() => dispatch({ type: "PLAY", target: "new" })}><span>＋</span><strong>새 탑 시작</strong></button>
          )}
          {human.towers.length ? human.towers.map((tower) => (
            <TowerView
              key={tower.id}
              tower={tower}
              selected={false}
              legal={Boolean(selectedCard && canPlace(selectedCard, tower, state.roofProgress))}
              onClick={selectedCard ? () => dispatch({ type: "PLAY", target: tower.id }) : undefined}
            />
          )) : !selectedCard && <span className="ct-empty-site">층 카드를 골라 첫 번째 탑을 시작하세요</span>}
        </div>
      </section>

      <section className="ct-hand-panel">
        <header><div><span>내 손패</span><strong>{selectedCard ? `${KIND_NAMES[selectedCard.kind]} 카드 선택됨` : "사용할 카드 한 장을 고르세요"}</strong></div>{selectedCard && <button onClick={() => dispatch({ type: "DISCARD" })}>선택 카드 버리기</button>}</header>
        <div className="ct-hand-row">
          {human.hand.map((card) => (
            <button
              key={card.id}
              className={state.selectedCardId === card.id ? "selected" : ""}
              disabled={state.phase !== "play"}
              onClick={() => dispatch({ type: "SELECT", cardId: card.id })}
            >
              <PartCard card={card} />
              <span>{card.kind === "story" ? `${card.floors}층 카드` : card.kind === "clock" ? "시계 카드" : `${COLOR_NAMES[card.color!]} 지붕`}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ct-log">
        <strong>건설 기록</strong>
        <p>{state.history[0]}</p>
      </section>

      {state.phase === "over" && (
        <div className="ct-result-layer" role="dialog" aria-modal="true" aria-labelledby="ct-result-title">
          <section>
            <span className="ct-kicker">CITY COMPLETE</span>
            <h2 id="ct-result-title">{winners.length > 1 ? `${winners.map((player) => player.name).join(" · ")} 공동 승리` : ranking[0].isHuman ? "도시 최고의 건축가예요!" : `${ranking[0].name}가 승리했어요`}</h2>
            <p>완성하지 못한 탑은 점수에서 제외했습니다.</p>
            <ol>{ranking.map((player, index) => <li key={player.id}><b>{index + 1}</b><span>{player.name}<small>완성 {player.towers.filter(isComplete).length}개</small></span><strong>{playerScore(player)}점</strong></li>)}</ol>
            <div className="ct-score-legend"><span>동물 없음 5점</span><span>고양이만 4점</span><span>둘 다 3점</span><span>생쥐만 2점</span></div>
            <button onClick={() => dispatch({ type: "START", playerCount: state.players.length })}>같은 인원으로 다시 하기</button>
            <button className="secondary" onClick={onExit}>게임 목록으로</button>
          </section>
        </div>
      )}
      <RulesLayer open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </main>
  );
}

function RulesLayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="ct-rules-layer" role="presentation" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="ct-rules-title" onClick={(event) => event.stopPropagation()}>
        <button className="ct-rules-close" onClick={onClose} aria-label="게임 방법 닫기">×</button>
        <span className="ct-kicker">HOW TO BUILD</span>
        <h2 id="ct-rules-title">시계탑 게임 방법</h2>
        <div className="ct-rule-grid">
          <article><b>1</b><h3>카드 한 장 사용</h3><p>차례마다 손에서 카드 한 장을 탑에 놓습니다. 놓을 곳이 없다면 카드를 버릴 수 있습니다.</p></article>
          <article><b>2</b><h3>층 → 시계 → 지붕</h3><p>탑은 층 카드 한 장 이상으로 시작합니다. 시계를 놓은 뒤에는 지붕만 올릴 수 있습니다.</p></article>
          <article><b>3</b><h3>색깔별 높이 경쟁</h3><p>한 색의 첫 지붕은 1층 또는 2층 탑에 놓습니다. 다음 같은 색 지붕은 직전보다 정확히 한 층 높은 탑에만 놓습니다.</p></article>
          <article><b>4</b><h3>공개 더미에서 보충</h3><p>카드를 사용한 뒤 층·시계·지붕 중 공개된 맨 위 카드 한 장을 가져옵니다.</p></article>
        </div>
        <aside><strong>점수</strong><span>동물 없음 5점 · 고양이만 4점 · 고양이와 생쥐 3점 · 생쥐만 2점</span></aside>
        <p className="ct-rules-note">모든 더미와 손패가 소진되면 종료합니다. 완성되지 않은 탑은 0점이며, 완성 탑의 총점이 가장 높은 건축가가 승리합니다. 동점이면 완성 탑 안에서 가장 높은 위치에 생쥐를 둔 사람이 앞섭니다.</p>
        <button className="ct-rules-confirm" onClick={onClose}>확인하고 시작하기</button>
      </section>
    </div>
  );
}
