"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  MINIVILLE_ESTABLISHMENTS,
  MINIVILLE_LANDMARKS,
  minivilleApplyTrade,
  minivilleApplyTvStation,
  minivilleBuildLandmark,
  minivilleBuyEstablishment,
  minivilleCanBuildLandmark,
  minivilleCanBuyEstablishment,
  minivilleCreateMarket,
  minivilleCreatePlayer,
  minivilleEstablishment,
  minivilleHasLandmark,
  minivilleOwns,
  minivilleResolveBaseIncome,
  minivilleWinner,
} from "./miniville-engine.js";

type Phase = "setup" | "roll" | "reroll" | "tv" | "trade" | "build" | "ai" | "game-over";
type Special = "tv" | "trade";
type CityPlayer = {
  id: number;
  name: string;
  coins: number;
  cards: Record<string, number>;
  landmarks: string[];
};
type State = {
  phase: Phase;
  totalPlayers: number;
  players: CityPlayer[];
  market: Record<string, number>;
  current: number;
  dice: number[];
  roll: number | null;
  pendingSpecials: Special[];
  tradeGiveId: string | null;
  extraTurn: boolean;
  winner: number | null;
  message: string;
  detail: string;
  log: string[];
  actionId: number;
};

const AI_NAMES = ["모리 시장", "하나 시장", "루프 시장"];
const PLAYER_COLORS = ["#ec795f", "#4e9ed2", "#e5ac3e", "#6bb58d"];

function setupState(): State {
  return {
    phase: "setup",
    totalPlayers: 3,
    players: [],
    market: minivilleCreateMarket(),
    current: 0,
    dice: [],
    roll: null,
    pendingSpecials: [],
    tradeGiveId: null,
    extraTurn: false,
    winner: null,
    message: "새로운 도시의 시장이 되어보세요",
    detail: "참가 인원을 정하면 AI 시장들이 함께 도시를 건설합니다.",
    log: [],
    actionId: 0,
  };
}

function rollDice(count: number) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

function nextPlayer(state: State, players: CityPlayer[], entry: string): State {
  const winner = minivilleWinner(players);
  if (winner !== null) {
    return {
      ...state,
      players,
      winner,
      phase: "game-over",
      message: `${players[winner].name}의 미니빌 완성!`,
      detail: "네 개의 랜드마크를 가장 먼저 완성했습니다.",
      log: [entry, ...state.log].slice(0, 14),
      actionId: state.actionId + 1,
    };
  }

  if (state.extraTurn) {
    const human = state.current === 0;
    return {
      ...state,
      players,
      phase: human ? "roll" : "ai",
      dice: [],
      roll: null,
      pendingSpecials: [],
      tradeGiveId: null,
      extraTurn: false,
      message: `${players[state.current].name}의 추가 턴`,
      detail: "놀이공원 효과로 같은 시장이 한 번 더 진행합니다.",
      log: [entry, ...state.log].slice(0, 14),
      actionId: state.actionId + 1,
    };
  }

  const current = (state.current + 1) % players.length;
  const human = current === 0;
  return {
    ...state,
    players,
    current,
    phase: human ? "roll" : "ai",
    dice: [],
    roll: null,
    pendingSpecials: [],
    tradeGiveId: null,
    extraTurn: false,
    message: human ? "내 차례입니다" : `${players[current].name}의 차례`,
    detail: human ? "주사위를 굴려 도시 수입을 받으세요." : "AI 시장이 도시 계획을 검토하고 있습니다.",
    log: [entry, ...state.log].slice(0, 14),
    actionId: state.actionId + 1,
  };
}

function humanBuildPhase(state: State, players: CityPlayer[], events: string[]): State {
  const roller = players[0];
  const specials: Special[] = [];
  if (state.roll === 6 && minivilleOwns(roller, "tv-station")) specials.push("tv");
  if (state.roll === 6 && minivilleOwns(roller, "business-center")) specials.push("trade");
  const first = specials[0];
  return {
    ...state,
    players,
    pendingSpecials: specials,
    phase: first === "tv" ? "tv" : first === "trade" ? "trade" : "build",
    message: first === "tv" ? "방송국의 대상을 고르세요" : first === "trade" ? "교환할 건물을 고르세요" : "건설 단계",
    detail: first ? "특수 건물 효과를 처리한 뒤 한 번 건설할 수 있습니다." : "건물 또는 랜드마크 하나를 건설하거나 이번 턴을 마치세요.",
    log: events.length ? [`나 · ${state.roll} · ${events.join(", ")}`, ...state.log].slice(0, 14) : state.log,
  };
}

function resolveHumanIncome(state: State): State {
  const result = minivilleResolveBaseIncome(state.players, 0, state.roll);
  return humanBuildPhase(state, result.players, result.events);
}

function aiCardScore(card: (typeof MINIVILLE_ESTABLISHMENTS)[number]) {
  const colorBoost = card.color === "purple" ? 6 : card.color === "blue" ? 2.5 : card.color === "red" ? 2 : 3;
  const rollReach = card.rolls.length * 1.2;
  return colorBoost + rollReach + card.income * 1.4 - card.cost * 0.22 + Math.random();
}

function aiTrade(players: CityPlayer[], actorId: number) {
  const actor = players[actorId];
  const owned = MINIVILLE_ESTABLISHMENTS.filter((card) => card.color !== "purple" && (actor.cards[card.id] ?? 0) > 0)
    .sort((a, b) => aiCardScore(a) - aiCardScore(b));
  const targets = players.filter((player) => player.id !== actorId).flatMap((player) =>
    MINIVILLE_ESTABLISHMENTS
      .filter((card) => card.color !== "purple" && (player.cards[card.id] ?? 0) > 0)
      .map((card) => ({ player, card })),
  ).sort((a, b) => aiCardScore(b.card) - aiCardScore(a.card));
  if (!owned[0] || !targets[0] || aiCardScore(targets[0].card) <= aiCardScore(owned[0])) {
    return { players, entry: null };
  }
  return {
    players: minivilleApplyTrade(players, actorId, targets[0].player.id, owned[0].id, targets[0].card.id),
    entry: `${owned[0].name}↔${targets[0].card.name}`,
  };
}

function aiPurchase(state: State, players: CityPlayer[]) {
  const actor = players[state.current];
  const landmarkOrder = ["station", "mall", "amusement", "radio"];
  const targetId = landmarkOrder.find((id) => !minivilleHasLandmark(actor, id));
  if (targetId && minivilleCanBuildLandmark(actor, targetId)) {
    const result = minivilleBuildLandmark(players, actor.id, targetId);
    const landmark = MINIVILLE_LANDMARKS.find((item) => item.id === targetId)!;
    return { players: result.players, market: state.market, purchase: `${landmark.name} 완성` };
  }

  const target = MINIVILLE_LANDMARKS.find((landmark) => landmark.id === targetId);
  if (target && actor.coins >= target.cost - 2) return { players, market: state.market, purchase: "건설 자금 저축" };

  const options = MINIVILLE_ESTABLISHMENTS.filter((card) =>
    minivilleCanBuyEstablishment(actor, state.market, card.id),
  ).sort((a, b) => aiCardScore(b) - aiCardScore(a));
  if (!options[0]) return { players, market: state.market, purchase: "건설 생략" };
  const result = minivilleBuyEstablishment(players, state.market, actor.id, options[0].id);
  return { players: result.players, market: result.market, purchase: `${options[0].name} 건설` };
}

function resolveAiTurn(state: State): State {
  const actor = state.players[state.current];
  const count = minivilleHasLandmark(actor, "station") ? 2 : 1;
  let dice = rollDice(count);
  let roll = dice.reduce((sum, value) => sum + value, 0);
  const activatesOwn = MINIVILLE_ESTABLISHMENTS.some((card) =>
    card.rolls.includes(roll) && (actor.cards[card.id] ?? 0) > 0,
  );
  if (minivilleHasLandmark(actor, "radio") && !activatesOwn) {
    dice = rollDice(count);
    roll = dice.reduce((sum, value) => sum + value, 0);
  }
  const extraTurn = count === 2 && dice[0] === dice[1] && minivilleHasLandmark(actor, "amusement");
  const income = minivilleResolveBaseIncome(state.players, actor.id, roll);
  let players = income.players;
  const specialEvents = [];

  if (roll === 6 && minivilleOwns(players[actor.id], "tv-station")) {
    const target = players.filter((player) => player.id !== actor.id).sort((a, b) => b.coins - a.coins)[0];
    const tv = minivilleApplyTvStation(players, actor.id, target.id);
    players = tv.players;
    if (tv.paid) specialEvents.push(`방송국 +${tv.paid}`);
  }
  if (roll === 6 && minivilleOwns(players[actor.id], "business-center")) {
    const trade = aiTrade(players, actor.id);
    players = trade.players;
    if (trade.entry) specialEvents.push(`교환 ${trade.entry}`);
  }

  const purchase = aiPurchase({ ...state, extraTurn }, players);
  const details = [...income.events, ...specialEvents, purchase.purchase].join(" · ");
  return nextPlayer(
    { ...state, market: purchase.market, dice, roll, extraTurn },
    purchase.players,
    `${actor.name} · ${dice.join("+")}=${roll} · ${details}`,
  );
}

function EstablishmentCard({
  card,
  count,
  supply,
  buyable,
  onBuy,
}: {
  card: (typeof MINIVILLE_ESTABLISHMENTS)[number];
  count?: number;
  supply?: number;
  buyable?: boolean;
  onBuy?: () => void;
}) {
  return (
    <button
      type="button"
      className={`mini-establishment ${card.color} ${buyable ? "buyable" : ""} ${supply === 0 ? "sold-out" : ""}`}
      onClick={onBuy}
      disabled={!buyable}
      aria-label={`${card.name}, 활성화 ${card.rolls.join(" 또는 ")}, 비용 ${card.cost}코인. ${card.effect}`}
    >
      <span className="mini-roll-number">{card.rolls.join("·")}</span>
      <i aria-hidden="true">{card.icon}</i>
      <strong>{card.name}</strong>
      <p>{card.effect}</p>
      <span className="mini-card-cost">● {card.cost}</span>
      {count !== undefined && count > 1 && <b className="mini-owned-count">×{count}</b>}
      {supply !== undefined && <small className="mini-supply-count">{supply}장</small>}
    </button>
  );
}

function MinivilleTopbar({ onExit }: { onExit: () => void }) {
  return (
    <header className="game-topbar mini-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup"><span className="mini-mini-mark">▦</span><div><span>paperoid</span><strong>미니빌</strong></div></div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

export function MinivilleGame({ onExit }: { onExit: () => void }) {
  const [totalPlayers, setTotalPlayers] = useState(3);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [state, setState] = useState<State>(setupState);

  useEffect(() => {
    if (state.phase !== "ai") return;
    const timer = window.setTimeout(() => setState((current) => current.phase === "ai" ? resolveAiTurn(current) : current), 950);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.actionId]);

  const human = state.players[0];
  const ownedCards = useMemo(() =>
    human ? MINIVILLE_ESTABLISHMENTS.filter((card) => (human.cards[card.id] ?? 0) > 0) : [],
  [human]);

  function start() {
    const players = Array.from({ length: totalPlayers }, (_, id) =>
      minivilleCreatePlayer(id, id === 0 ? "나" : AI_NAMES[id - 1]),
    );
    setState({
      ...setupState(),
      phase: "roll",
      totalPlayers,
      players,
      market: minivilleCreateMarket(),
      message: "내 차례입니다",
      detail: "주사위를 굴려 첫 수입을 받아보세요.",
      actionId: 1,
    });
  }

  function rollHuman(count: number) {
    if (state.phase !== "roll") return;
    const dice = rollDice(count);
    const roll = dice.reduce((sum, value) => sum + value, 0);
    const extraTurn = count === 2 && dice[0] === dice[1] && minivilleHasLandmark(state.players[0], "amusement");
    const canReroll = minivilleHasLandmark(state.players[0], "radio");
    const rolled = {
      ...state,
      dice,
      roll,
      extraTurn,
      phase: canReroll ? "reroll" as const : state.phase,
      message: `${dice.join(" + ")} = ${roll}`,
      detail: canReroll ? "라디오 타워로 한 번 다시 굴리거나 이 결과를 확정하세요." : "활성화된 건물의 수입을 계산합니다.",
      actionId: state.actionId + 1,
    };
    setState(canReroll ? rolled : resolveHumanIncome(rolled));
  }

  function rerollHuman() {
    if (state.phase !== "reroll") return;
    const dice = rollDice(state.dice.length);
    const roll = dice.reduce((sum, value) => sum + value, 0);
    const extraTurn = dice.length === 2 && dice[0] === dice[1] && minivilleHasLandmark(state.players[0], "amusement");
    setState(resolveHumanIncome({
      ...state,
      dice,
      roll,
      extraTurn,
      message: `${dice.join(" + ")} = ${roll}`,
      detail: "다시 굴린 결과를 적용합니다.",
      actionId: state.actionId + 1,
    }));
  }

  function keepRoll() {
    if (state.phase === "reroll") setState(resolveHumanIncome(state));
  }

  function chooseTvTarget(targetId: number) {
    if (state.phase !== "tv") return;
    const result = minivilleApplyTvStation(state.players, 0, targetId);
    const rest = state.pendingSpecials.slice(1);
    setState({
      ...state,
      players: result.players,
      pendingSpecials: rest,
      phase: rest[0] === "trade" ? "trade" : "build",
      message: rest[0] === "trade" ? "교환할 건물을 고르세요" : "건설 단계",
      detail: `${state.players[targetId].name}에게 ${result.paid}코인을 받았습니다.`,
      log: [`나 · 방송국 · ${state.players[targetId].name}에게 ${result.paid}코인`, ...state.log].slice(0, 14),
    });
  }

  function finishTrade(targetId?: number, receiveId?: string) {
    if (state.phase !== "trade") return;
    const players = targetId !== undefined && receiveId && state.tradeGiveId
      ? minivilleApplyTrade(state.players, 0, targetId, state.tradeGiveId, receiveId)
      : state.players;
    const traded = players !== state.players;
    setState({
      ...state,
      players,
      pendingSpecials: [],
      tradeGiveId: null,
      phase: "build",
      message: "건설 단계",
      detail: traded ? "건물 교환을 마쳤습니다. 이제 한 번 건설할 수 있습니다." : "교환을 생략했습니다. 이제 한 번 건설할 수 있습니다.",
    });
  }

  function buyEstablishment(id: string) {
    if (state.phase !== "build") return;
    const card = minivilleEstablishment(id);
    const result = minivilleBuyEstablishment(state.players, state.market, 0, id);
    if (!result.bought) return;
    setState(nextPlayer({ ...state, market: result.market }, result.players, `나 · ${card.name} 건설`));
  }

  function buildLandmark(id: string) {
    if (state.phase !== "build") return;
    const landmark = MINIVILLE_LANDMARKS.find((item) => item.id === id)!;
    const result = minivilleBuildLandmark(state.players, 0, id);
    if (!result.built) return;
    setState(nextPlayer(state, result.players, `나 · ${landmark.name} 완성`));
  }

  function skipBuild() {
    if (state.phase === "build") setState(nextPlayer(state, state.players, "나 · 건설 생략"));
  }

  const canRollTwo = human && minivilleHasLandmark(human, "station");
  const ordinaryOwned = ownedCards.filter((card) => card.color !== "purple");

  return (
    <main className="game-shell miniville-shell">
      <MinivilleTopbar onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel mini-info">
          <div><span className="eyebrow">ROLL · EARN · BUILD</span><h1>주사위로<br />자라는 작은 도시</h1><p>누군가 굴린 숫자가 내 건물을 활성화합니다. 수입을 모아 네 개의 랜드마크를 가장 먼저 완성하세요.</p></div>
          {state.phase === "setup" ? (
            <div className="mini-side-note"><span>게임 시간</span><strong>약 25~35분</strong><small>AI 포함 2~4인</small></div>
          ) : (
            <div className="mini-side-score">
              <div><span>내 코인</span><strong>{human?.coins ?? 0}</strong></div>
              <div><span>랜드마크</span><strong>{human?.landmarks.length ?? 0}/4</strong></div>
              <div><span>보유 건물</span><strong>{human ? Object.values(human.cards).reduce((sum, count) => sum + count, 0) : 0}</strong></div>
            </div>
          )}
          <button className="mini-rules-button" onClick={() => setRulesOpen(true)}>ⓘ 게임 방법과 건물 효과</button>
        </aside>

        <div className="board-panel miniville-board-panel">
          {state.phase === "setup" ? (
            <section className="mini-welcome" data-game-menu>
              <div className="mini-town-art" aria-hidden="true">
                <i className="house one">▰</i><i className="house two">▰</i><i className="tower">▥</i><span>☀</span>
              </div>
              <span>WELCOME, MAYOR!</span>
              <h2>미니빌</h2>
              <p>작은 밀밭과 빵집에서 출발해 모두가 부러워할 도시를 만들어보세요.</p>
              <div className="mini-player-picker">
                <strong>참가 인원</strong>
                <div>{[2, 3, 4].map((count) => <button key={count} className={totalPlayers === count ? "active" : ""} onClick={() => setTotalPlayers(count)}>{count}인</button>)}</div>
                <small>나 1명 + AI {totalPlayers - 1}명</small>
              </div>
              <button className="mini-start-button" onClick={start}>시장 취임하기 <span>→</span></button>
            </section>
          ) : (
            <>
              <section className="mini-status" role="status">
                <div className="mini-turn-badge" style={{ "--player": PLAYER_COLORS[state.current] } as CSSProperties}>{state.current === 0 ? "ME" : `AI ${state.current}`}</div>
                <div><strong>{state.message}</strong><small>{state.detail}</small></div>
                <div className="mini-dice-display">
                  {state.dice.length ? state.dice.map((die, index) => <b key={`${die}-${index}`}>{["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][die]}</b>) : <span>—</span>}
                </div>
              </section>

              <section className="mini-opponents" aria-label="AI 도시">
                {state.players.slice(1).map((player) => (
                  <article key={player.id} className={state.current === player.id ? "active" : ""}>
                    <span style={{ background: PLAYER_COLORS[player.id] }}>{player.name.slice(0, 1)}</span>
                    <div><strong>{player.name}</strong><small>건물 {Object.values(player.cards).reduce((sum, count) => sum + count, 0)} · 랜드마크 {player.landmarks.length}/4</small></div>
                    <b>● {player.coins}</b>
                    <div className="mini-opponent-landmarks">{MINIVILLE_LANDMARKS.map((landmark) => <i key={landmark.id} className={player.landmarks.includes(landmark.id) ? "built" : ""}>{landmark.icon}</i>)}</div>
                  </article>
                ))}
              </section>

              {state.phase === "tv" && (
                <section className="mini-choice-panel">
                  <header><span>📺</span><div><strong>방송국</strong><small>코인을 받을 상대 도시를 선택하세요.</small></div></header>
                  <div>{state.players.slice(1).map((player) => <button key={player.id} onClick={() => chooseTvTarget(player.id)}><b>{player.name}</b><span>● {player.coins} → 최대 5코인</span></button>)}</div>
                </section>
              )}

              {state.phase === "trade" && (
                <section className="mini-choice-panel trade">
                  <header><span>🏢</span><div><strong>비즈니스 센터</strong><small>{state.tradeGiveId ? "상대에게서 받을 건물 한 장을 선택하세요." : "먼저 내가 내어줄 일반 건물 한 장을 선택하세요."}</small></div><button onClick={() => finishTrade()}>교환 생략</button></header>
                  {!state.tradeGiveId ? (
                    <div>{ordinaryOwned.map((card) => <button key={card.id} onClick={() => setState((current) => ({ ...current, tradeGiveId: card.id }))}><b>{card.icon} {card.name}</b><span>보유 {human.cards[card.id]}장</span></button>)}</div>
                  ) : (
                    <div>{state.players.slice(1).flatMap((player) => MINIVILLE_ESTABLISHMENTS.filter((card) => card.color !== "purple" && (player.cards[card.id] ?? 0) > 0).map((card) => <button key={`${player.id}-${card.id}`} onClick={() => finishTrade(player.id, card.id)}><b>{card.icon} {card.name}</b><span>{player.name} · {player.cards[card.id]}장</span></button>))}</div>
                  )}
                </section>
              )}

              <section className="mini-my-city">
                <header><div><span>MY MINIVILLE</span><strong>나의 도시</strong></div><b>● {human?.coins ?? 0}</b></header>
                <div className="mini-landmark-row">
                  {MINIVILLE_LANDMARKS.map((landmark) => {
                    const built = minivilleHasLandmark(human, landmark.id);
                    const buyable = state.phase === "build" && minivilleCanBuildLandmark(human, landmark.id);
                    return <button key={landmark.id} className={`${built ? "built" : ""} ${buyable ? "buyable" : ""}`} disabled={!buyable} onClick={() => buildLandmark(landmark.id)}><i>{landmark.icon}</i><strong>{landmark.name}</strong><small>{built ? "완성" : `● ${landmark.cost}`}</small></button>;
                  })}
                </div>
                <div className="mini-owned-city">
                  {ownedCards.map((card) => <EstablishmentCard key={card.id} card={card} count={human.cards[card.id]} />)}
                </div>
              </section>

              <section className="mini-market">
                <header><div><span>CITY MARKET</span><strong>건물 시장</strong></div><small>{state.phase === "build" ? "구입할 건물 한 장을 선택하세요" : "내 건물과 시장을 비교해 다음 계획을 세워보세요"}</small></header>
                <div>{MINIVILLE_ESTABLISHMENTS.map((card) => <EstablishmentCard key={card.id} card={card} supply={state.market[card.id]} buyable={state.phase === "build" && minivilleCanBuyEstablishment(human, state.market, card.id)} onBuy={() => buyEstablishment(card.id)} />)}</div>
              </section>

              <section className="mini-action-dock">
                {state.phase === "roll" && (
                  <div className="mini-roll-actions">
                    <button onClick={() => rollHuman(1)}><span>⚄</span><strong>주사위 1개 굴리기</strong><small>1~6 건물 중심</small></button>
                    {canRollTwo && <button onClick={() => rollHuman(2)}><span>⚃ ⚂</span><strong>주사위 2개 굴리기</strong><small>합계 2~12 사용</small></button>}
                  </div>
                )}
                {state.phase === "reroll" && <div className="mini-reroll-actions"><button onClick={keepRoll}>이 결과 사용</button><button className="primary" onClick={rerollHuman}>↻ 다시 굴리기</button></div>}
                {state.phase === "build" && <button className="mini-skip-build" onClick={skipBuild}>이번 턴 건설하지 않고 마치기 →</button>}
                {state.phase === "ai" && <div className="mini-ai-thinking"><i /><span>AI 시장이 주사위를 굴리고 있습니다</span></div>}
              </section>

              {state.phase === "game-over" && (
                <section className="mini-game-result">
                  <span>🏙</span><div><small>MINIVILLE COMPLETE</small><h2>{state.message}</h2><p>{state.detail}</p></div>
                  <button onClick={() => { const players = Array.from({ length: state.totalPlayers }, (_, id) => minivilleCreatePlayer(id, id === 0 ? "나" : AI_NAMES[id - 1])); setState({ ...setupState(), phase: "roll", totalPlayers: state.totalPlayers, players, message: "내 차례입니다", detail: "새 도시 건설을 시작합니다.", actionId: state.actionId + 1 }); }}>같은 인원으로 다시 플레이</button>
                  <button className="secondary" onClick={() => setState(setupState())}>설정으로</button>
                </section>
              )}

              <section className="mini-log"><strong>도시 소식</strong><div>{state.log.length ? state.log.slice(0, 7).map((entry, index) => <span key={`${entry}-${index}`}>{entry}</span>) : <span>아직 첫 주사위를 굴리지 않았습니다.</span>}</div></section>
            </>
          )}
        </div>
      </section>

      {rulesOpen && (
        <div className="mini-modal-backdrop" onClick={() => setRulesOpen(false)}>
          <section className="mini-rules-modal" role="dialog" aria-modal="true" aria-labelledby="mini-rules-title" onClick={(event) => event.stopPropagation()}>
            <header><div><span>HOW TO PLAY</span><h2 id="mini-rules-title">미니빌 게임 방법</h2></div><button onClick={() => setRulesOpen(false)}>×</button></header>
            <div className="mini-rule-steps">
              <article><b>1</b><div><strong>주사위 굴리기</strong><p>활성화 숫자와 일치하는 건물이 수입을 만듭니다. 기차역 완성 후에는 1개와 2개 중 선택합니다.</p></div></article>
              <article><b>2</b><div><strong>수입 받기</strong><p>빨강 건물 지불을 먼저 처리하고, 파랑·초록 수입과 보라 특수 효과를 순서대로 적용합니다.</p></div></article>
              <article><b>3</b><div><strong>한 번 건설하기</strong><p>턴 끝에 건물 또는 랜드마크 하나를 살 수 있습니다. 네 랜드마크를 모두 완성하면 즉시 승리합니다.</p></div></article>
            </div>
            <div className="mini-color-guide"><span className="blue">파랑 · 모든 사람의 턴</span><span className="green">초록 · 내 턴</span><span className="red">빨강 · 상대 턴</span><span className="purple">보라 · 내 턴 특수 효과</span></div>
            <div className="mini-rule-cards">{MINIVILLE_ESTABLISHMENTS.map((card) => <article key={card.id} className={card.color}><b>{card.rolls.join("·")}</b><i>{card.icon}</i><div><strong>{card.name}</strong><p>{card.effect}</p></div><span>● {card.cost}</span></article>)}</div>
            <button className="mini-rules-close" onClick={() => setRulesOpen(false)}>확인하고 계속하기</button>
          </section>
        </div>
      )}
    </main>
  );
}
