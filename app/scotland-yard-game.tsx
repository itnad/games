"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { withKoreanSubject } from "./korean-particles.js";
import {
  SY_EDGES,
  SY_MAX_ROUNDS,
  SY_NODES,
  SY_REVEAL_MOVES,
  SY_TRANSPORTS,
  syAdvanceCandidates,
  syChooseMrXMove,
  syCreateInitialState,
  syLegalMoves,
  syShouldDouble,
  syShouldUseBlack,
} from "./scotland-yard-engine";

type Transport = "taxi" | "bus" | "underground" | "ferry" | "black";
type Difficulty = "rookie" | "inspector";
type PlayerPiece = {
  id: string;
  name: string;
  node: number;
  kind: "detective" | "bobby";
  tickets: Record<"taxi" | "bus" | "underground", number>;
};
type LogEntry = {
  move: number;
  ticket: Transport;
  revealedNode: number | null;
  double: boolean;
};
type GameState = {
  round: number;
  moveNumber: number;
  phase: "ai" | "detectives" | "over";
  winner: "detectives" | "mr-x" | null;
  message: string;
  selectedId: string | null;
  movedIds: string[];
  detectives: PlayerPiece[];
  mrX: { node: number; blackTickets: number; doubleTickets: number };
  candidates: number[];
  log: LogEntry[];
};

const TUTORIAL = [
  {
    kicker: "STEP 1 · 탐정팀",
    title: "네 명을 한 팀처럼 지휘하세요",
    body: "셜록과 아이리스는 이동할 때 티켓을 사용합니다. 순경 둘은 티켓 없이 이동하지만 수상 노선은 이용할 수 없습니다.",
  },
  {
    kicker: "STEP 2 · 이동 기록",
    title: "티켓이 미스터 X의 흔적입니다",
    body: "AI의 실제 위치는 숨겨집니다. 이동 기록에 공개되는 택시·버스·지하철 티켓을 보고 가능한 위치를 좁혀 보세요.",
  },
  {
    kicker: "STEP 3 · 공개 라운드",
    title: "3·8·13·18·24번째 이동에 모습을 드러냅니다",
    body: "공개 순간의 역 번호를 기억하고 여러 방향에서 포위하세요. 지도에서 후보 표시를 켜면 추리 가능한 역을 확인할 수 있습니다.",
  },
  {
    kicker: "STEP 4 · 특수 티켓",
    title: "검은 티켓과 더블 무브를 경계하세요",
    body: "검은 티켓은 교통수단을 숨기고 수상 노선도 허용합니다. 더블 무브는 미스터 X가 연속 두 번 이동하게 합니다.",
  },
];

const RULE_ROWS = [
  ["탐정 이동", "말을 하나씩 선택해 연결된 역으로 이동합니다. 탐정은 해당 교통 티켓을 1장 사용합니다."],
  ["미스터 X", "항상 먼저 이동하며 실제 위치 대신 사용한 티켓만 공개합니다."],
  ["공개 시점", "이동 기록의 3·8·13·18·24번째 칸에서 도착 역을 공개합니다."],
  ["탐정 승리", "아무 탐정 말이나 미스터 X와 같은 역에 도착하거나 AI가 이동할 수 없으면 승리합니다."],
  ["AI 승리", "미스터 X가 이동 기록의 마지막인 24번째 이동 뒤에도 잡히지 않거나 탐정팀 전체가 이동할 수 없으면 승리합니다."],
  ["구현 판본", "Ravensburger 클래식 규칙의 이동·티켓·공개·더블 무브·승패 구조를 적용하고, 지도와 역 연결은 모바일 AI 대전에 맞게 재구성했습니다."],
];

function transportLabel(transport: Transport) {
  return SY_TRANSPORTS[transport]?.label ?? transport;
}

function edgeStyle(edge: { a: number; b: number }) {
  const from = SY_NODES[edge.a - 1];
  const to = SY_NODES[edge.b - 1];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  return {
    left: `${from.x}%`,
    top: `${from.y}%`,
    width: `${length}%`,
    transform: `rotate(${Math.atan2(dy, dx) * (180 / Math.PI)}deg)`,
  };
}

function applyAiTurn(current: GameState, difficulty: Difficulty): GameState {
  if (current.phase !== "ai" || current.winner) return current;
  const detectiveNodes = current.detectives.map((piece) => piece.node);
  const wantsDouble = syShouldDouble({
    node: current.mrX.node,
    detectiveNodes,
    moveNumber: current.moveNumber,
    doubleTickets: current.mrX.doubleTickets,
  });
  const maxLegs = wantsDouble ? 2 : 1;
  let node = current.mrX.node;
  let candidates = current.candidates;
  let blackTickets = current.mrX.blackTickets;
  let moveNumber = current.moveNumber;
  const additions: LogEntry[] = [];

  for (let leg = 0; leg < maxLegs && moveNumber < 24; leg += 1) {
    const move = syChooseMrXMove({
      node,
      detectiveNodes,
      difficulty,
      blackTickets,
    });
    if (!move) {
      if (!additions.length) {
        return {
          ...current,
          phase: "over",
          winner: "detectives",
          message: "미스터 X의 퇴로를 모두 막았습니다!",
        };
      }
      break;
    }

    const useBlack = syShouldUseBlack({
      move,
      candidates,
      detectiveNodes,
      blackTickets,
    });
    const ticket = useBlack ? "black" : (move.transport as Transport);
    if (useBlack) blackTickets -= 1;
    node = move.to;
    moveNumber += 1;
    const revealed = SY_REVEAL_MOVES.includes(moveNumber);
    candidates = revealed
      ? [node]
      : syAdvanceCandidates(candidates, ticket, detectiveNodes);
    additions.push({
      move: moveNumber,
      ticket,
      revealedNode: revealed ? node : null,
      double: wantsDouble,
    });
  }

  const usedDouble = additions.length === 2;
  const latest = additions.at(-1);
  const revealText = latest?.revealedNode
    ? ` 미스터 X가 ${latest.revealedNode}번 역에서 포착됐습니다.`
    : "";
  const doubleText = usedDouble ? "더블 무브! 연속 두 번 이동했습니다." : "미스터 X가 이동했습니다.";

  return {
    ...current,
    phase: "detectives",
    selectedId: null,
    movedIds: [],
    moveNumber,
    mrX: {
      node,
      blackTickets,
      doubleTickets: current.mrX.doubleTickets - (usedDouble ? 1 : 0),
    },
    candidates,
    log: [...current.log, ...additions],
    message: `${doubleText}${revealText}`,
  };
}

function winnerCopy(winner: GameState["winner"]) {
  return winner === "detectives"
    ? { title: "탐정팀이 승리했습니다!", body: "미스터 X의 도주 경로를 완벽하게 포위했습니다." }
    : { title: "미스터 X가 탈출했습니다", body: "이동 기록을 다시 살펴보고 다음 수사에서 포위망을 좁혀 보세요." };
}

export function ScotlandYardGame({ onExit }: { onExit: () => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty>("inspector");
  const [game, setGame] = useState<GameState | null>(null);
  const [showCandidates, setShowCandidates] = useState(true);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const mapViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (game?.phase !== "ai") return;
    const timer = window.setTimeout(() => {
      setGame((current) => current ? applyAiTurn(current, difficulty) : current);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [difficulty, game?.phase, game?.round]);

  const occupied = useMemo(
    () => game?.detectives.map((piece) => piece.node) ?? [],
    [game?.detectives],
  );
  const selected = game?.detectives.find((piece) => piece.id === game.selectedId) ?? null;
  const legalMoves = useMemo(() => {
    if (!game || !selected || game.phase !== "detectives" || game.movedIds.includes(selected.id)) {
      return [];
    }
    return syLegalMoves(selected.node, {
      tickets: selected.tickets,
      occupied: occupied.filter((node) => node !== selected.node),
      isBobby: selected.kind === "bobby",
    }) as { to: number; transport: Exclude<Transport, "black" | "ferry"> }[];
  }, [game, occupied, selected]);
  const moveMap = useMemo(() => {
    const map = new Map<number, (typeof legalMoves)[number][]>();
    for (const move of legalMoves) map.set(move.to, [...(map.get(move.to) ?? []), move]);
    return map;
  }, [legalMoves]);

  const startGame = () => {
    setGame(syCreateInitialState() as GameState);
    setShowCandidates(true);
    window.setTimeout(() => {
      mapViewportRef.current?.scrollTo({ left: 220, top: 80, behavior: "smooth" });
    }, 100);
  };

  const selectPiece = (id: string) => {
    setGame((current) => {
      if (!current || current.phase !== "detectives" || current.movedIds.includes(id)) return current;
      return {
        ...current,
        selectedId: current.selectedId === id ? null : id,
        message: current.selectedId === id
          ? "선택을 취소했습니다. 움직일 말을 고르세요."
          : "빛나는 역 중 이동할 곳을 선택하세요.",
      };
    });
  };

  const finishDetectivePhase = (next: GameState) => {
    const remaining = next.detectives.filter((piece) => !next.movedIds.includes(piece.id));
    const canAnyoneMove = remaining.some((piece) =>
      syLegalMoves(piece.node, {
        tickets: piece.tickets,
        occupied: next.detectives.filter((other) => other.id !== piece.id).map((other) => other.node),
        isBobby: piece.kind === "bobby",
      }).length > 0,
    );
    if (next.movedIds.length < next.detectives.length && canAnyoneMove) return next;

    if (next.moveNumber >= SY_MAX_ROUNDS) {
      return {
        ...next,
        phase: "over" as const,
        winner: "mr-x" as const,
        selectedId: null,
        message: "24번째 이동까지 미스터 X를 잡지 못했습니다.",
      };
    }
    return {
      ...next,
      round: next.round + 1,
      phase: "ai" as const,
      selectedId: null,
      movedIds: [],
      message: "미스터 X가 다음 이동을 준비합니다.",
    };
  };

  const movePiece = (to: number) => {
    if (!selected || !game || !moveMap.has(to)) return;
    const option = moveMap.get(to)![0];
    setGame((current) => {
      if (!current || current.phase !== "detectives") return current;
      const moving = current.detectives.find((piece) => piece.id === selected.id);
      if (!moving || current.movedIds.includes(moving.id)) return current;
      const captures = to === current.mrX.node;
      const detectives = current.detectives.map((piece) => {
        if (piece.id !== moving.id) return piece;
        const tickets = piece.kind === "bobby"
          ? piece.tickets
          : { ...piece.tickets, [option.transport]: piece.tickets[option.transport] - 1 };
        return { ...piece, node: to, tickets };
      });
      if (captures) {
        return {
          ...current,
          detectives,
          phase: "over",
          winner: "detectives",
          selectedId: null,
          candidates: [to],
          message: `${withKoreanSubject(moving.name)} ${to}번 역에서 미스터 X를 체포했습니다!`,
        };
      }
      const next = {
        ...current,
        detectives,
        selectedId: null,
        movedIds: [...current.movedIds, moving.id],
        candidates: current.candidates.filter((id) => id !== to),
        message: `${moving.name}: ${to}번 역 수색 완료`,
      };
      return finishDetectivePhase(next);
    });
  };

  const passBlockedPieces = () => {
    setGame((current) => {
      if (!current || current.phase !== "detectives") return current;
      const blockedIds = current.detectives
        .filter((piece) => !current.movedIds.includes(piece.id))
        .filter((piece) =>
          syLegalMoves(piece.node, {
            tickets: piece.tickets,
            occupied: current.detectives.filter((other) => other.id !== piece.id).map((other) => other.node),
            isBobby: piece.kind === "bobby",
          }).length === 0,
        )
        .map((piece) => piece.id);
      if (!blockedIds.length) return current;
      return finishDetectivePhase({
        ...current,
        movedIds: [...current.movedIds, ...blockedIds],
        message: "이동할 수 없는 말은 이번 라운드를 쉽니다.",
      });
    });
  };

  const revealedNow = game?.log.at(-1)?.revealedNode ?? null;
  const gameResult = game?.winner ? winnerCopy(game.winner) : null;

  return (
    <main className="sy-game-shell">
      <header className="sy-topbar">
        <button className="sy-back" onClick={onExit} aria-label="게임 목록으로 돌아가기">←</button>
        <div className="sy-brand">
          <span>PLAYROOM ORIGINAL</span>
          <strong>스코틀랜드 야드</strong>
        </div>
        <button className="sy-rules-button" onClick={() => setRulesOpen(true)}>게임 방법</button>
      </header>

      {!game ? (
        <section className="sy-lobby">
          <div className="sy-lobby-copy">
            <span className="sy-eyebrow">HIDDEN MOVEMENT · AI 대전</span>
            <h1>밤의 도시에서<br />미스터 X를 추적하세요</h1>
            <p>네 명의 탐정팀을 지휘해 AI의 이동 티켓을 분석하고 24번째 이동 전에 포위망을 완성하세요.</p>
          </div>
          <div className="sy-lobby-map" aria-hidden="true">
            <i className="route route-one" />
            <i className="route route-two" />
            <i className="route route-three" />
            <span className="station s-one">18</span>
            <span className="station s-two">?</span>
            <span className="station s-three">71</span>
            <b>CASE<br />NO. 24</b>
          </div>
          <div className="sy-setup-card">
            <div>
              <span className="sy-setup-number">01</span>
              <div><strong>내 역할</strong><small>탐정팀 지휘관 · 말 4개 조종</small></div>
              <span className="sy-fixed">고정</span>
            </div>
            <fieldset>
              <legend><span className="sy-setup-number">02</span> AI 난이도</legend>
              <label className={difficulty === "rookie" ? "active" : ""}>
                <input type="radio" checked={difficulty === "rookie"} onChange={() => setDifficulty("rookie")} />
                <strong>신입 도망자</strong><small>가끔 가까운 길을 선택합니다</small>
              </label>
              <label className={difficulty === "inspector" ? "active" : ""}>
                <input type="radio" checked={difficulty === "inspector"} onChange={() => setDifficulty("inspector")} />
                <strong>노련한 미스터 X</strong><small>거리와 퇴로를 함께 계산합니다</small>
              </label>
            </fieldset>
            <button className="sy-primary" onClick={startGame}><span>⌖</span> 수사 시작</button>
            <button className="sy-tutorial-link" onClick={() => setTutorialStep(0)}>처음이라면 튜토리얼 보기 →</button>
          </div>
        </section>
      ) : (
        <>
          <section className={`sy-case-status ${game.phase === "ai" ? "ai-turn" : ""}`}>
            <div>
              <span className="sy-round">이동 {game.moveNumber}/{SY_MAX_ROUNDS}</span>
              <div>
                <small>{game.phase === "ai" ? "AI 이동 중" : game.phase === "over" ? "사건 종료" : "탐정팀 차례"}</small>
                <strong>{game.message}</strong>
              </div>
            </div>
            <div className="sy-x-resources">
              <span>검은 티켓 <b>{game.mrX.blackTickets}</b></span>
              <span>더블 <b>{game.mrX.doubleTickets}</b></span>
            </div>
          </section>

          {gameResult && (
            <section className={`sy-result ${game.winner}`}>
              <span>{game.winner === "detectives" ? "✓" : "X"}</span>
              <div><h2>{gameResult.title}</h2><p>{gameResult.body}</p></div>
              <button onClick={startGame}>같은 설정으로 다시 수사</button>
            </section>
          )}

          <section className="sy-investigation-layout">
            <aside className="sy-log-panel">
              <div className="sy-panel-heading">
                <div><small>TRAVEL LOG</small><h2>미스터 X 이동 기록</h2></div>
                <span>{game.moveNumber}/24</span>
              </div>
              <div className="sy-log-grid">
                {Array.from({ length: 24 }, (_, index) => {
                  const move = index + 1;
                  const entry = game.log.find((item) => item.move === move);
                  const isReveal = SY_REVEAL_MOVES.includes(move);
                  return (
                    <div key={move} className={`sy-log-cell ${isReveal ? "reveal" : ""} ${entry ? "filled" : ""}`}>
                      <small>{move}</small>
                      <b style={entry ? { background: SY_TRANSPORTS[entry.ticket].color } : undefined}>
                        {entry ? SY_TRANSPORTS[entry.ticket].icon : isReveal ? "⌖" : "·"}
                      </b>
                      {entry?.revealedNode && <em>{entry.revealedNode}번</em>}
                    </div>
                  );
                })}
              </div>
              <div className="sy-log-legend">
                {(["taxi", "bus", "underground", "black"] as Transport[]).map((id) => (
                  <span key={id}><i style={{ background: SY_TRANSPORTS[id].color }} />{transportLabel(id)}</span>
                ))}
              </div>
            </aside>

            <div className="sy-map-card">
              <div className="sy-map-toolbar">
                <div>
                  <small>NIGHT CITY MAP</small>
                  <strong>수사 지도</strong>
                </div>
                <label>
                  후보 역 표시
                  <input type="checkbox" checked={showCandidates} onChange={(event) => setShowCandidates(event.target.checked)} />
                  <i />
                </label>
                <span>후보 {game.candidates.length}곳</span>
              </div>
              <div className="sy-map-viewport" ref={mapViewportRef}>
                <div className="sy-map" role="application" aria-label="스코틀랜드 야드 수사 지도">
                  <div className="sy-river"><span>RIVER NOCTURNE</span></div>
                  <div className="sy-park park-one">NORTH PARK</div>
                  <div className="sy-park park-two">VICTORIA GARDEN</div>
                  {SY_EDGES.map((edge, index) => (
                    <i
                      key={`${edge.a}-${edge.b}-${edge.transport}-${index}`}
                      className={`sy-edge ${edge.transport}`}
                      style={edgeStyle(edge)}
                    />
                  ))}
                  {SY_NODES.map((node) => {
                    const pieces = game.detectives.filter((piece) => piece.node === node.id);
                    const available = moveMap.has(node.id);
                    const candidate = showCandidates && game.candidates.includes(node.id);
                    const showX = game.phase === "over" && game.mrX.node === node.id;
                    const showReveal = revealedNow === node.id && game.phase !== "over";
                    return (
                      <button
                        key={node.id}
                        className={[
                          "sy-station",
                          available ? "available" : "",
                          candidate ? "candidate" : "",
                          showReveal ? "x-revealed" : "",
                          showX ? "x-final" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ left: `${node.x}%`, top: `${node.y}%` }}
                        onClick={() => available && movePiece(node.id)}
                        disabled={!available}
                        aria-label={`${node.id}번 역${available ? "으로 이동" : ""}`}
                      >
                        <span>{node.id}</span>
                        {(showX || showReveal) && <b className="sy-mr-x">X</b>}
                        {pieces.map((piece) => (
                          <b key={piece.id} className={`sy-map-piece ${piece.kind} ${game.selectedId === piece.id ? "selected" : ""}`}>
                            {piece.kind === "detective" ? piece.name.slice(0, 1) : "순"}
                          </b>
                        ))}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="sy-pan-hint">↔ 지도를 드래그해 이동하고 확대해서 경로를 확인하세요</p>
            </div>

            <aside className="sy-squad-panel">
              <div className="sy-panel-heading">
                <div><small>DETECTIVE SQUAD</small><h2>내 수사팀</h2></div>
                <span>{game.movedIds.length}/4 이동</span>
              </div>
              <div className="sy-piece-list">
                {game.detectives.map((piece, index) => {
                  const moved = game.movedIds.includes(piece.id);
                  return (
                    <button
                      key={piece.id}
                      className={`${game.selectedId === piece.id ? "selected" : ""} ${moved ? "moved" : ""}`}
                      onClick={() => selectPiece(piece.id)}
                      disabled={game.phase !== "detectives" || moved}
                    >
                      <i>{piece.kind === "detective" ? index + 1 : "P"}</i>
                      <span>
                        <strong>{piece.name}</strong>
                        <small>{piece.node}번 역 · {piece.kind === "bobby" ? "티켓 무료" : "탐정"}</small>
                      </span>
                      <em>{moved ? "수색 완료" : game.selectedId === piece.id ? "선택됨" : "선택"}</em>
                      {piece.kind === "detective" && (
                        <div className="sy-tickets">
                          <b className="taxi">T {piece.tickets.taxi}</b>
                          <b className="bus">B {piece.tickets.bus}</b>
                          <b className="underground">U {piece.tickets.underground}</b>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <button className="sy-skip-blocked" onClick={passBlockedPieces} disabled={game.phase !== "detectives"}>
                이동 불가 말 자동 대기
              </button>
              <p>한 라운드에 네 말을 각각 한 번씩 움직입니다.</p>
            </aside>
          </section>
        </>
      )}

      {tutorialStep !== null && (
        <div className="sy-modal-backdrop" role="dialog" aria-modal="true" aria-label="스코틀랜드 야드 튜토리얼">
          <section className="sy-tutorial-modal">
            <button className="sy-close" onClick={() => setTutorialStep(null)} aria-label="닫기">×</button>
            <div className={`sy-tutorial-visual step-${tutorialStep + 1}`}>
              <span className="detective">D</span><i /><span className="mystery">?</span><i /><span className="reveal">⌖</span>
            </div>
            <small>{TUTORIAL[tutorialStep].kicker}</small>
            <h2>{TUTORIAL[tutorialStep].title}</h2>
            <p>{TUTORIAL[tutorialStep].body}</p>
            <div className="sy-tutorial-progress">
              {TUTORIAL.map((_, index) => <i key={index} className={index === tutorialStep ? "active" : ""} />)}
            </div>
            <div className="sy-modal-actions">
              <button disabled={tutorialStep === 0} onClick={() => setTutorialStep((step) => Math.max(0, (step ?? 0) - 1))}>이전</button>
              <button onClick={() => tutorialStep === TUTORIAL.length - 1 ? setTutorialStep(null) : setTutorialStep(tutorialStep + 1)}>
                {tutorialStep === TUTORIAL.length - 1 ? "시작하기" : "다음"}
              </button>
            </div>
          </section>
        </div>
      )}

      {rulesOpen && (
        <div className="sy-modal-backdrop" role="dialog" aria-modal="true" aria-label="게임 방법">
          <section className="sy-rules-modal">
            <button className="sy-close" onClick={() => setRulesOpen(false)} aria-label="닫기">×</button>
            <small>HOW TO PLAY</small>
            <h2>게임 방법과 승리 조건</h2>
            <p className="sy-rules-intro">현재판의 숨은 이동 규칙을 1인용 AI 대전에 맞게 구성했습니다.</p>
            <div>
              {RULE_ROWS.map(([title, body], index) => (
                <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><p>{body}</p></div></article>
              ))}
            </div>
            <button className="sy-primary" onClick={() => setRulesOpen(false)}>확인</button>
          </section>
        </div>
      )}
    </main>
  );
}
