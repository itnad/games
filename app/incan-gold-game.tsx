"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type ExitProps = { onExit: () => void };
type Hazard = "뱀" | "전갈" | "용암" | "낙석" | "가시";
type Explorer = {
  id: number;
  name: string;
  trait: string;
  chest: number;
  pack: number;
  relics: number[];
  active: boolean;
};
type TreasureCard = { id: string; type: "treasure"; value: number; remaining: number };
type HazardCard = { id: string; type: "hazard"; hazard: Hazard };
type RelicCard = { id: string; type: "relic"; value: number };
type ExpeditionCard = TreasureCard | HazardCard | RelicCard;
type Choice = "continue" | "leave";
type Phase = "setup" | "decision" | "resolving" | "round-end" | "game-over";
type GameState = {
  round: number;
  phase: Phase;
  players: Explorer[];
  deck: ExpeditionCard[];
  preparedDeck: ExpeditionCard[];
  path: ExpeditionCard[];
  choices: Record<number, Choice>;
  message: string;
  detail: string;
  actionId: number;
  bustedHazard: Hazard | null;
};

const TREASURE_VALUES = [1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17];
const HAZARDS: Hazard[] = ["뱀", "전갈", "용암", "낙석", "가시"];
const RELIC_VALUES = [5, 7, 8, 10, 12];
const AI_TRAITS = ["신중형", "균형형", "대담형", "계산형", "직감형", "승부사", "탐험가"];
const AI_NAMES = ["루나", "토토", "미로", "코코", "보라", "도도", "누리"];
const PLAYER_COLORS = ["#7a4de0", "#de6f49", "#368d7a", "#d39b37", "#4f7fc4", "#c45d80", "#647a3f", "#7a5a46"];
const HAZARD_ICONS: Record<Hazard, string> = {
  뱀: "〰",
  전갈: "♏",
  용암: "♨",
  낙석: "●",
  가시: "✦",
};

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function baseDeck(): ExpeditionCard[] {
  const treasures: TreasureCard[] = TREASURE_VALUES.map((value, index) => ({
    id: `treasure-${index}`,
    type: "treasure",
    value,
    remaining: 0,
  }));
  const hazards: HazardCard[] = HAZARDS.flatMap((hazard) =>
    Array.from({ length: 3 }, (_, index) => ({
      id: `hazard-${hazard}-${index}`,
      type: "hazard" as const,
      hazard,
    })),
  );
  return [...treasures, ...hazards];
}

function relicCard(round: number): RelicCard {
  return { id: `relic-${round}`, type: "relic", value: RELIC_VALUES[round - 1] };
}

function makePlayers(total: number): Explorer[] {
  return Array.from({ length: total }, (_, id) => ({
    id,
    name: id === 0 ? "나" : AI_NAMES[id - 1],
    trait: id === 0 ? "플레이어" : AI_TRAITS[id - 1],
    chest: 0,
    pack: 0,
    relics: [],
    active: true,
  }));
}

function emptyState(total = 4): GameState {
  return {
    round: 0,
    phase: "setup",
    players: makePlayers(total),
    deck: [],
    preparedDeck: [],
    path: [],
    choices: {},
    message: "탐험대를 꾸려 보세요",
    detail: "공식 규칙은 3~8명이 함께 탐험합니다",
    actionId: 0,
    bustedHazard: null,
  };
}

function score(player: Explorer) {
  return player.chest + player.relics.reduce((sum, value) => sum + value, 0);
}

function countHazards(path: ExpeditionCard[]) {
  return path.reduce<Partial<Record<Hazard, number>>>((counts, card) => {
    if (card.type === "hazard") counts[card.hazard] = (counts[card.hazard] ?? 0) + 1;
    return counts;
  }, {});
}

function trailGems(path: ExpeditionCard[]) {
  return path.reduce((sum, card) => sum + (card.type === "treasure" ? card.remaining : 0), 0);
}

function aiChoice(state: GameState, player: Explorer): Choice {
  const shownHazards = countHazards(state.path);
  const dangerCopies = state.deck.filter(
    (card) => card.type === "hazard" && Boolean(shownHazards[card.hazard]),
  ).length;
  const bustRisk = state.deck.length ? dangerCopies / state.deck.length : 1;
  const activeCount = state.players.filter((entry) => entry.active).length;
  const looseShare = Math.floor(trailGems(state.path) / Math.max(1, activeCount));
  const relicBonus = state.path.some((card) => card.type === "relic") ? 5 : 0;
  const atRisk = player.pack + looseShare + relicBonus;
  const traitBias: Record<string, number> = {
    신중형: -0.13,
    균형형: 0,
    대담형: 0.14,
    계산형: -0.03,
    직감형: 0.06,
    승부사: 0.18,
    탐험가: 0.11,
  };
  const pressure = atRisk / 38 + bustRisk * 1.35 - (traitBias[player.trait] ?? 0);
  const jitter = Math.random() * 0.34 - 0.17;
  return pressure + jitter > 0.74 ? "leave" : "continue";
}

function finishRound(
  state: GameState,
  players: Explorer[],
  path: ExpeditionCard[],
  reason: string,
  bustedHazard: Hazard | null,
  triggeredCardId?: string,
): GameState {
  const returnedCards = path.filter(
    (card) => card.type !== "relic" && card.id !== triggeredCardId,
  ).map((card) => card.type === "treasure" ? { ...card, remaining: 0 } : card);
  const preparedDeck = shuffle([...state.deck, ...returnedCards]);
  const gameOver = state.round >= 5;
  return {
    ...state,
    players: players.map((player) => ({ ...player, active: false, pack: 0 })),
    path,
    preparedDeck,
    phase: gameOver ? "game-over" : "round-end",
    choices: {},
    message: gameOver ? "다섯 번의 탐험이 끝났어요" : `${state.round}/5 탐험 종료`,
    detail: reason,
    bustedHazard,
    actionId: state.actionId + 1,
  };
}

function revealNext(state: GameState): GameState {
  if (!state.deck.length) {
    const activeIds = state.players.filter((player) => player.active).map((player) => player.id);
    return resolveDeparture({
      ...state,
      choices: Object.fromEntries(activeIds.map((id) => [id, "leave"])),
    });
  }

  const [drawn, ...deck] = state.deck;
  const activePlayers = state.players.filter((player) => player.active);
  const path = [...state.path, drawn];

  if (drawn.type === "treasure") {
    const share = Math.floor(drawn.value / activePlayers.length);
    const remaining = drawn.value % activePlayers.length;
    const placedCard: TreasureCard = { ...drawn, remaining };
    return {
      ...state,
      deck,
      path: [...state.path, placedCard],
      players: state.players.map((player) =>
        player.active ? { ...player, pack: player.pack + share } : player,
      ),
      phase: "decision",
      choices: {},
      message: `${drawn.value}개의 보석을 발견했어요`,
      detail: `탐험가마다 ${share}개씩 나누고 ${remaining}개는 길에 남았습니다`,
      bustedHazard: null,
    };
  }

  if (drawn.type === "relic") {
    return {
      ...state,
      deck,
      path,
      phase: "decision",
      choices: {},
      message: `${drawn.value}점 유물을 발견했어요`,
      detail: "다음 선택에서 혼자 귀환하면 유물을 가져갑니다",
      bustedHazard: null,
    };
  }

  const previousCopy = state.path.some(
    (card) => card.type === "hazard" && card.hazard === drawn.hazard,
  );
  if (!previousCopy) {
    return {
      ...state,
      deck,
      path,
      phase: "decision",
      choices: {},
      message: `${drawn.hazard} 위험이 나타났어요`,
      detail: "같은 위험이 한 번 더 나오면 탐험이 즉시 끝납니다",
      bustedHazard: null,
    };
  }

  const lost = activePlayers.reduce((sum, player) => sum + player.pack, 0);
  const players = state.players.map((player) =>
    player.active ? { ...player, pack: 0 } : player,
  );
  return finishRound(
    { ...state, deck },
    players,
    path,
    `${drawn.hazard}이 두 번째로 나타나 미보관 보석 ${lost}개를 잃었습니다`,
    drawn.hazard,
    drawn.id,
  );
}

function redistributeTrail(path: ExpeditionCard[], remaining: number) {
  let placed = false;
  return path.map((card) => {
    if (card.type !== "treasure") return card;
    if (!placed && remaining > 0) {
      placed = true;
      return { ...card, remaining };
    }
    return { ...card, remaining: 0 };
  });
}

function resolveDeparture(state: GameState): GameState {
  const leavers = state.players.filter(
    (player) => player.active && state.choices[player.id] === "leave",
  );
  const looseGems = trailGems(state.path);
  const share = leavers.length ? Math.floor(looseGems / leavers.length) : 0;
  const remainder = looseGems - share * leavers.length;
  const soloLeaver = leavers.length === 1 ? leavers[0].id : null;
  const foundRelics = soloLeaver === null
    ? []
    : state.path.flatMap((card) => card.type === "relic" ? [card.value] : []);
  let path = redistributeTrail(state.path, remainder);
  if (soloLeaver !== null) path = path.filter((card) => card.type !== "relic");

  const players = state.players.map((player) => {
    if (!leavers.some((leaver) => leaver.id === player.id)) return player;
    return {
      ...player,
      chest: player.chest + player.pack + share,
      pack: 0,
      relics: player.id === soloLeaver ? [...player.relics, ...foundRelics] : player.relics,
      active: false,
    };
  });
  const stillInside = players.filter((player) => player.active);

  if (!stillInside.length) {
    const relicText = foundRelics.length ? ` · 유물 ${foundRelics.join(", ")}점 획득` : "";
    return finishRound(
      state,
      players,
      path,
      `모두 안전하게 귀환했습니다${relicText}`,
      null,
    );
  }

  return revealNext({
    ...state,
    players,
    path,
    phase: "decision",
    choices: {},
    message: leavers.length
      ? `${leavers.map((player) => player.name).join("·")} 귀환`
      : "모두 더 깊이 들어갑니다",
    detail: leavers.length
      ? `귀환자마다 길의 보석 ${share}개를 추가로 확보했습니다`
      : "다음 탐험 카드를 공개합니다",
    actionId: state.actionId + 1,
  });
}

function startGame(total: number) {
  const initial: GameState = {
    ...emptyState(total),
    round: 1,
    phase: "decision",
    players: makePlayers(total),
    deck: shuffle([...baseDeck(), relicCard(1)]),
    message: "1/5 첫 탐험을 시작합니다",
    detail: "첫 번째 동굴 카드를 공개합니다",
  };
  return revealNext(initial);
}

function nextRound(state: GameState) {
  const round = state.round + 1;
  const players = state.players.map((player) => ({ ...player, active: true, pack: 0 }));
  const next: GameState = {
    ...state,
    round,
    players,
    deck: shuffle([...state.preparedDeck, relicCard(round)]),
    preparedDeck: [],
    path: [],
    choices: {},
    phase: "decision",
    message: `${round}/5 탐험을 시작합니다`,
    detail: "새로운 동굴 입구로 이동했습니다",
    bustedHazard: null,
    actionId: state.actionId + 1,
  };
  return revealNext(next);
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function GameTopbar({ onExit }: ExitProps) {
  return (
    <header className="game-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup">
        <BrandMark />
        <div><span>PLAYROOM</span><strong>잉카 골드</strong></div>
      </div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

function ChoiceBadge({ choice }: { choice?: Choice }) {
  if (!choice) return <span className="incan-choice waiting">생각 중</span>;
  return (
    <span className={`incan-choice ${choice}`}>
      {choice === "continue" ? "더 간다" : "귀환"}
    </span>
  );
}

function CardView({ card, latest }: { card: ExpeditionCard; latest: boolean }) {
  if (card.type === "treasure") {
    return (
      <article className={`cave-card treasure ${latest ? "latest" : ""}`}>
        <span className="card-kind">GEMS</span>
        <strong>{card.value}</strong>
        <i aria-hidden="true">◆</i>
        {card.remaining > 0 && <small>길에 {card.remaining}</small>}
      </article>
    );
  }
  if (card.type === "hazard") {
    return (
      <article className={`cave-card hazard ${latest ? "latest" : ""}`}>
        <span className="card-kind">DANGER</span>
        <strong aria-hidden="true">{HAZARD_ICONS[card.hazard]}</strong>
        <b>{card.hazard}</b>
      </article>
    );
  }
  return (
    <article className={`cave-card relic ${latest ? "latest" : ""}`}>
      <span className="card-kind">RELIC</span>
      <strong>{card.value}</strong>
      <i aria-hidden="true">✦</i>
      <b>유물</b>
    </article>
  );
}

export function IncanGoldGame({ onExit }: ExitProps) {
  const [totalPlayers, setTotalPlayers] = useState(4);
  const [state, setState] = useState<GameState>(() => emptyState(4));

  useEffect(() => {
    if (state.phase !== "resolving") return;
    const timer = window.setTimeout(() => {
      setState((current) => current.phase === "resolving" ? resolveDeparture(current) : current);
    }, 950);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.actionId]);

  useEffect(() => {
    if (state.phase !== "decision" || state.players[0]?.active) return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.phase !== "decision" || current.players[0]?.active) return current;
        const choices = Object.fromEntries(
          current.players
            .filter((player) => player.active)
            .map((player) => [player.id, aiChoice(current, player)]),
        );
        return {
          ...current,
          choices,
          phase: "resolving",
          message: "남은 탐험가들이 선택했습니다",
          detail: "잠시 후 선택을 공개합니다",
          actionId: current.actionId + 1,
        };
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.actionId, state.players]);

  const ranking = useMemo(
    () => [...state.players].sort((a, b) => score(b) - score(a)),
    [state.players],
  );
  const playerActive = state.players[0]?.active;
  const pathRelics = state.path.filter((card) => card.type === "relic");
  const visibleHazards = countHazards(state.path);
  const winners = ranking.filter((player) => score(player) === score(ranking[0]));

  function choose(choice: Choice) {
    setState((current) => {
      if (current.phase !== "decision" || !current.players[0]?.active) return current;
      const choices: Record<number, Choice> = { 0: choice };
      current.players.forEach((player) => {
        if (player.id > 0 && player.active) choices[player.id] = aiChoice(current, player);
      });
      return {
        ...current,
        choices,
        phase: "resolving",
        message: choice === "leave" ? "귀환을 선택했어요" : "더 깊이 들어갑니다",
        detail: "모든 탐험가의 선택을 동시에 공개합니다",
        actionId: current.actionId + 1,
      };
    });
  }

  function updateTotal(next: number) {
    setTotalPlayers(next);
    setState(emptyState(next));
  }

  return (
    <main className="game-shell incan-shell">
      <GameTopbar onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel incan-info">
          <div>
            <span className="eyebrow">PUSH YOUR LUCK</span>
            <h1>한 걸음 더,<br />아니면 귀환?</h1>
            <p>동굴이 깊어질수록 보물도 커지지만 같은 위험을 두 번 만나면 이번 탐험의 보석을 모두 잃습니다.</p>
          </div>

          {state.phase === "setup" ? (
            <div className="incan-setup-count">
              <span>탐험 인원</span>
              <strong>{totalPlayers}명</strong>
              <div>
                {Array.from({ length: 6 }, (_, index) => index + 3).map((count) => (
                  <button
                    key={count}
                    className={totalPlayers === count ? "active" : ""}
                    onClick={() => updateTotal(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <small>나 1명 + AI {totalPlayers - 1}명</small>
            </div>
          ) : (
            <div className="incan-progress">
              <div><span>ROUND</span><strong>{state.round}/5</strong></div>
              <div><span>길의 보석</span><strong>{trailGems(state.path)}</strong></div>
              <div><span>공개 유물</span><strong>{pathRelics.length}</strong></div>
            </div>
          )}

          <div className="incan-mini-rules">
            <span>같은 위험 2장</span>
            <strong>미보관 보석 전부 손실</strong>
          </div>
        </aside>

        <div className="board-panel incan-board-panel">
          {state.phase === "setup" ? (
            <section className="incan-welcome">
              <div className="incan-torch" aria-hidden="true"><span>✦</span></div>
              <span className="incan-kicker">TACORA EXPEDITION</span>
              <h2>보물을 챙겨<br />무사히 돌아오세요</h2>
              <p>AI마다 위험을 감수하는 성향이 다릅니다. 공식 규칙에 맞춰 최소 3명부터 탐험할 수 있어요.</p>
              <ol>
                <li><b>1</b><span>보물을 모두와 나눠 갖습니다</span></li>
                <li><b>2</b><span>계속 탐험하거나 귀환합니다</span></li>
                <li><b>3</b><span>같은 위험이 두 번이면 보석을 잃습니다</span></li>
              </ol>
              <button className="incan-start" onClick={() => setState(startGame(totalPlayers))}>
                탐험 시작 <span aria-hidden="true">→</span>
              </button>
            </section>
          ) : (
            <>
              <div className="incan-status" role="status">
                <div className={`incan-round-seal ${state.bustedHazard ? "danger" : ""}`}>
                  {state.bustedHazard ? "!" : state.round}
                </div>
                <div>
                  <strong>{state.message}</strong>
                  <span>{state.detail}</span>
                </div>
                <details className="incan-rules">
                  <summary>ⓘ 규칙</summary>
                  <div>
                    <p><b>보석</b> 현재 동굴에 남은 사람끼리 나누며 나머지는 길에 둡니다.</p>
                    <p><b>귀환</b> 손의 보석과 길의 몫을 보관함에 넣어 안전하게 만듭니다.</p>
                    <p><b>위험</b> 같은 종류가 두 번째 나오면 남아 있던 사람은 손의 보석을 잃습니다.</p>
                    <p><b>유물 변형</b> IELLO 2016 규칙의 5·7·8·10·12점 유물을 사용하며, 혼자 귀환한 경우에만 길의 유물을 모두 획득합니다.</p>
                    <p><b>동점</b> 5번째 탐험 뒤 총점이 같으면 해당 탐험가들이 공동 승리합니다.</p>
                  </div>
                </details>
              </div>

              <section className="incan-scoreboard" aria-label="탐험가 현황">
                {state.players.map((player) => (
                  <article
                    key={player.id}
                    className={`${player.id === 0 ? "human" : ""} ${player.active ? "inside" : "camp"}`}
                    style={{ "--explorer-color": PLAYER_COLORS[player.id] } as CSSProperties}
                  >
                    <span className="explorer-avatar">{player.id === 0 ? "나" : player.name.slice(0, 1)}</span>
                    <div>
                      <strong>{player.name}</strong>
                      <small>{player.active ? player.trait : "캠프 귀환"}</small>
                    </div>
                    {state.phase === "resolving" && player.active
                      ? <ChoiceBadge choice={state.choices[player.id]} />
                      : <span className={`explorer-place ${player.active ? "inside" : "camp"}`}>
                          {player.active ? "동굴" : "안전"}
                        </span>}
                    <dl>
                      <div><dt>손</dt><dd>◆ {player.pack}</dd></div>
                      <div><dt>보관</dt><dd>{score(player)}</dd></div>
                    </dl>
                  </article>
                ))}
              </section>

              <div className="incan-hazard-strip" aria-label="현재 위험">
                {HAZARDS.map((hazard) => (
                  <span key={hazard} className={visibleHazards[hazard] ? "seen" : ""}>
                    <i aria-hidden="true">{HAZARD_ICONS[hazard]}</i>
                    {hazard}
                    <b>{visibleHazards[hazard] ?? 0}/2</b>
                  </span>
                ))}
              </div>

              <section className="cave-path" aria-label="공개된 동굴 길">
                <div className="cave-entrance">
                  <span>입구</span>
                  <small>{state.round}/5</small>
                </div>
                {state.path.map((card, index) => (
                  <CardView key={`${card.id}-${index}`} card={card} latest={index === state.path.length - 1} />
                ))}
                {!state.path.length && <p>동굴 카드를 공개하는 중입니다…</p>}
              </section>

              {state.phase === "game-over" && (
                <section className="incan-result">
                  <span>FINAL RANKING</span>
                  <h2>
                    {winners.length > 1
                      ? `${winners.map((player) => player.name).join("·")} 공동 승리!`
                      : ranking[0]?.id === 0
                        ? "가장 많은 보물을 모았어요!"
                        : `${ranking[0]?.name}가 승리했어요`}
                  </h2>
                  <div>
                    {ranking.map((player, index) => (
                      <p key={player.id} className={player.id === 0 ? "human" : ""}>
                        <b>{index + 1}</b><span>{player.name}</span><strong>{score(player)}점</strong>
                      </p>
                    ))}
                  </div>
                </section>
              )}

              <div className="incan-actions">
                {state.phase === "decision" && playerActive && (
                  <>
                    <button className="go-deeper" onClick={() => choose("continue")}>
                      <span aria-hidden="true">✦</span>
                      <div><strong>더 들어간다</strong><small>위험을 감수하고 다음 카드 확인</small></div>
                    </button>
                    <button className="return-camp" onClick={() => choose("leave")}>
                      <span aria-hidden="true">⌂</span>
                      <div><strong>캠프로 돌아간다</strong><small>현재 보석을 안전하게 보관</small></div>
                    </button>
                  </>
                )}
                {state.phase === "decision" && !playerActive && (
                  <div className="incan-spectating"><span>◌</span> AI 탐험을 관전하고 있습니다</div>
                )}
                {state.phase === "resolving" && (
                  <div className="incan-spectating"><span>◌</span> 선택을 공개하는 중입니다</div>
                )}
                {state.phase === "round-end" && (
                  <button className="incan-next-round" onClick={() => setState((current) => nextRound(current))}>
                    {state.round + 1}/5 다음 탐험 시작 <span aria-hidden="true">→</span>
                  </button>
                )}
                {state.phase === "game-over" && (
                  <button className="incan-next-round" onClick={() => setState(startGame(totalPlayers))}>
                    같은 인원으로 다시 플레이 <span aria-hidden="true">↻</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
