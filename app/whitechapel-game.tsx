"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WC_CROSSINGS,
  WC_CROSSING_EDGES,
  WC_LOCATIONS,
  WC_NIGHTS,
  WC_PATROL_STARTS,
  WC_STREET_LINKS,
  wcAdjacentLocations,
  wcAdvanceCandidates,
  wcBeginHunt,
  wcChooseJackMove,
  wcCreateGame,
  wcPoliceMoves,
  wcPrepareNextNight,
} from "./whitechapel-engine";

type Difficulty = "rookie" | "inspector";
type MoveType = "normal" | "coach" | "alley" | "double-event";
type Police = { id: string; crossing: string; color: string; name: string };
type GameState = ReturnType<typeof wcCreateGame> & {
  police: Police[];
  selectedPolice: string | null;
  phase: "patrol" | "jack" | "police-move" | "police-action" | "night-end" | "over";
  winner: "police" | "jack" | null;
};

const POLICE_META = [
  { id: "blue", color: "#4c7294", name: "애버라인" },
  { id: "red", color: "#a34b43", name: "왓킨스" },
  { id: "green", color: "#59765c", name: "리드" },
  { id: "yellow", color: "#b68c3d", name: "러스크" },
  { id: "brown", color: "#725648", name: "스완슨" },
];

const TUTORIAL = [
  ["첫 번째 밤: 순찰", "노란 테두리의 교차점에서 경찰 다섯 명의 시작 위치를 고르세요. 붉은 원은 사건이 발생할 수 있는 장소입니다."],
  ["잭의 숨은 이동", "잭은 번호가 적힌 원 사이를 이동합니다. 정확한 위치는 보이지 않고 일반·마차·골목 이동 기록만 남습니다."],
  ["경찰 이동", "경찰은 검은 교차점 사이를 0~2칸 움직입니다. 잭은 일반 이동으로 경찰이 있는 교차점을 통과할 수 없습니다."],
  ["수색과 체포", "수색은 잭이 그날 지나간 장소에서 단서를 찾습니다. 체포는 잭의 현재 장소를 정확히 선택해야 성공합니다."],
  ["네 번의 밤", "잭이 15수 안에 은신처에 도착하는 것을 막으세요. 세 번째 밤에는 두 사건 중 실제 출발점을 추리해야 합니다."],
];

const RULES = [
  ["게임 목표", "경찰은 네 번째 밤이 끝나기 전에 잭의 현재 위치를 체포하거나 은신처 귀환을 막아야 합니다."],
  ["잭의 이동", "번호 장소 사이를 비밀리에 이동합니다. 경찰이 있는 교차점은 일반 이동으로 통과할 수 없습니다."],
  ["경찰의 이동", "각 경찰은 검은 교차점 사이를 최대 2칸 움직이고, 다른 경찰과 같은 교차점에서 끝낼 수 없습니다."],
  ["단서 수색", "인접한 번호 장소를 차례로 확인합니다. 그날 밤 잭이 지나간 장소라면 단서가 공개되고 행동이 끝납니다."],
  ["체포", "인접한 번호 장소 하나를 지목합니다. 그곳이 잭의 현재 위치라면 경찰이 즉시 승리합니다."],
  ["특수 이동", "마차는 연속 두 장소를 지나며 봉쇄를 통과합니다. 골목은 같은 건물 블록 둘레의 다른 장소로 이동합니다."],
  ["구현 판본", "Fantasy Flight Games 개정판의 4개 밤·15수·수색·체포·특수 이동을 적용했습니다. 195개 장소와 지옥 단계의 비밀 토큰 운영은 모바일 1인용 지도·자동 사건 준비로 압축한 웹 재구성판입니다."],
];

function lineStyle(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return {
    left: `${from.x}%`,
    top: `${from.y}%`,
    width: `${Math.hypot(dx, dy)}%`,
    transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`,
  };
}

function moveLabel(type: MoveType) {
  if (type === "coach") return "마차";
  if (type === "alley") return "골목";
  if (type === "double-event") return "이중 사건";
  return "일반";
}

function applyJackMove(current: GameState): GameState {
  if (current.phase !== "jack" || current.winner || current.jack.location == null) return current;
  const move = wcChooseJackMove({
    location: current.jack.location,
    hideout: current.hideout,
    policeCrossings: current.police.map((piece) => piece.crossing),
    coaches: current.jack.coaches,
    alleys: current.jack.alleys,
    movesUsed: current.jack.movesUsed,
    difficulty: current.difficulty,
  });
  if (!move) {
    return { ...current, phase: "over", winner: "police", message: "모든 도주로를 봉쇄했습니다. 경찰이 승리했습니다!" };
  }

  const type = move.type as MoveType;
  const used = move.path.length;
  const movesUsed = current.jack.movesUsed + used;
  const route = [...current.jack.route, ...move.path];
  const candidates = wcAdvanceCandidates(
    current.candidates,
    type,
    current.police.map((piece) => piece.crossing),
  );
  const jack = {
    ...current.jack,
    location: move.to,
    movesUsed,
    route,
    coaches: current.jack.coaches - (type === "coach" ? 1 : 0),
    alleys: current.jack.alleys - (type === "alley" ? 1 : 0),
  };
  const log = [...current.log, { move: movesUsed, type, label: moveLabel(type) }];

  if (move.to === current.hideout && type === "normal") {
    if (current.night === 4) {
      return { ...current, jack, candidates, log, phase: "over", winner: "jack", message: "네 번째 밤까지 잭이 은신처로 돌아갔습니다." };
    }
    return { ...current, jack, candidates, log, phase: "night-end", message: `${current.night}번째 밤, 잭이 은신처로 사라졌습니다.` };
  }
  if (movesUsed >= WC_NIGHTS[current.night - 1].maxMoves) {
    return { ...current, jack, candidates, log, phase: "over", winner: "police", message: "15번째 이동까지 은신처에 도착하지 못했습니다!" };
  }

  return {
    ...current,
    jack,
    candidates,
    log,
    phase: "police-move",
    movedPolice: [],
    actedPolice: [],
    selectedPolice: null,
    message: `${movesUsed}번째 도주 기록: ${moveLabel(type)} 이동. 경찰을 움직이세요.`,
  };
}

export function WhitechapelGame({ onExit }: { onExit: () => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty>("inspector");
  const [game, setGame] = useState<GameState | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const [actionMode, setActionMode] = useState<"search" | "arrest">("search");
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    if (game?.phase !== "jack") return;
    const timer = window.setTimeout(() => setGame((current) => current ? applyJackMove(current) : current), 800);
    return () => window.clearTimeout(timer);
  }, [game?.phase, game?.night, game?.jack.movesUsed]);

  const startGame = () => {
    setGame(wcCreateGame(difficulty) as GameState);
    setShowCandidates(false);
    setActionMode("search");
  };

  const togglePatrol = (crossing: string) => {
    setGame((current) => {
      if (!current || current.phase !== "patrol" || !WC_PATROL_STARTS.includes(crossing)) return current;
      const index = current.police.findIndex((piece) => piece.crossing === crossing);
      if (index >= 0) {
        return { ...current, police: current.police.filter((_, item) => item !== index) };
      }
      if (current.police.length >= 5) return { ...current, message: "다섯 명을 모두 배치했습니다. 수사를 시작하세요." };
      const meta = POLICE_META.find((candidate) => !current.police.some((piece) => piece.id === candidate.id))!;
      return {
        ...current,
        police: [...current.police, { ...meta, crossing }],
        message: current.police.length === 4 ? "배치 완료. 수사 시작 버튼을 누르세요." : `${current.police.length + 1}/5 배치`,
      };
    });
  };

  const beginHunt = () => {
    setGame((current) => current && current.police.length === 5 ? wcBeginHunt(current) as GameState : current);
  };

  const selectedPolice = game?.police.find((piece) => piece.id === game.selectedPolice) ?? null;
  const policeMoveOptions = useMemo(() => {
    if (!game || !selectedPolice || game.phase !== "police-move") return [];
    return wcPoliceMoves(
      selectedPolice.crossing,
      game.police.filter((piece) => piece.id !== selectedPolice.id).map((piece) => piece.crossing),
      2,
    );
  }, [game, selectedPolice]);
  const policeMoveIds = new Set(policeMoveOptions.map((option) => option.id));
  const adjacentActionLocations = selectedPolice ? wcAdjacentLocations(selectedPolice.crossing) : [];

  const selectPolice = (id: string) => {
    setGame((current) => {
      if (!current || !["police-move", "police-action"].includes(current.phase)) return current;
      const completed = current.phase === "police-move" ? current.movedPolice : current.actedPolice;
      if (completed.includes(id)) return current;
      return { ...current, selectedPolice: current.selectedPolice === id ? null : id, searched: [] };
    });
  };

  const completePoliceMoves = (current: GameState, id: string, crossing: string) => {
    const movedPolice = [...current.movedPolice, id];
    const police = current.police.map((piece) => piece.id === id ? { ...piece, crossing } : piece);
    return {
      ...current,
      police,
      movedPolice,
      selectedPolice: null,
      phase: movedPolice.length === current.police.length ? "police-action" as const : current.phase,
      message: movedPolice.length === current.police.length
        ? "모든 경찰이 이동했습니다. 수색 또는 체포 행동을 선택하세요."
        : `${movedPolice.length}/5 이동 완료`,
    };
  };

  const movePolice = (crossing: string) => {
    setGame((current) => {
      if (!current || current.phase !== "police-move" || !current.selectedPolice || !policeMoveIds.has(crossing)) return current;
      if (current.police.some((piece) => piece.crossing === crossing && piece.id !== current.selectedPolice)) return current;
      return completePoliceMoves(current as GameState, current.selectedPolice, crossing);
    });
  };

  const stayPolice = () => {
    setGame((current) => {
      if (!current || current.phase !== "police-move" || !current.selectedPolice) return current;
      const piece = current.police.find((item) => item.id === current.selectedPolice);
      return piece ? completePoliceMoves(current as GameState, piece.id, piece.crossing) : current;
    });
  };

  const completeAction = (current: GameState, id: string, message: string) => {
    const actedPolice = [...current.actedPolice, id];
    return {
      ...current,
      actedPolice,
      // Negative searches are not persistent markers in the official game.
      // Reset them so another officer or a later turn may inspect the place.
      searched: [],
      selectedPolice: null,
      phase: actedPolice.length === current.police.length ? "jack" as const : current.phase,
      message: actedPolice.length === current.police.length ? "수사 행동 종료. 잭이 다시 움직입니다." : message,
    };
  };

  const actAtLocation = (location: number) => {
    setGame((current) => {
      if (!current || current.phase !== "police-action" || !current.selectedPolice) return current;
      const piece = current.police.find((item) => item.id === current.selectedPolice);
      if (!piece || !wcAdjacentLocations(piece.crossing).includes(location)) return current;
      if (actionMode === "arrest") {
        if (current.jack.location === location) {
          return { ...current, phase: "over", winner: "police", candidates: [location], message: `${location}번 장소에서 잭을 체포했습니다!` };
        }
        return completeAction(
          { ...current, candidates: current.candidates.filter((candidate) => candidate !== location) } as GameState,
          piece.id,
          `${location}번 장소에는 잭이 없습니다.`,
        );
      }

      if (current.searched.includes(location)) return current;
      const searched = [...current.searched, location];
      if (current.jack.route.includes(location)) {
        return completeAction(
          { ...current, searched, clues: [...new Set([...current.clues, location])] } as GameState,
          piece.id,
          `${location}번 장소에서 단서를 발견했습니다.`,
        );
      }
      const remaining = wcAdjacentLocations(piece.crossing).filter((id) => !searched.includes(id));
      if (!remaining.length) {
        return completeAction({ ...current, searched } as GameState, piece.id, "인접한 모든 장소를 확인했지만 단서가 없습니다.");
      }
      return { ...current, searched, message: `${location}번에는 단서가 없습니다. 다른 인접 장소를 계속 수색할 수 있습니다.` };
    });
  };

  const endSearch = () => {
    setGame((current) => {
      if (!current || current.phase !== "police-action" || !current.selectedPolice) return current;
      return completeAction(current as GameState, current.selectedPolice, "수색을 종료했습니다.");
    });
  };

  const nextNight = () => setGame((current) => current ? wcPrepareNextNight(current) as GameState : current);

  const routeStyle = (link: { crossing: string; location: number }) => {
    const crossing = WC_CROSSINGS.find((item) => item.id === link.crossing)!;
    const location = WC_LOCATIONS[link.location - 1];
    return lineStyle(location, crossing);
  };

  return (
    <main className="wc-shell">
      <header className="wc-header">
        <button onClick={onExit} aria-label="게임 목록으로 돌아가기">←</button>
        <div><small>paperoid · 1888 LONDON</small><strong>화이트채플</strong></div>
        <button onClick={() => setRulesOpen(true)}>게임 방법</button>
      </header>

      {!game ? (
        <section className="wc-lobby">
          <div className="wc-title-panel">
            <span>LETTERS FROM THE FOG</span>
            <h1>WHITE<br /><em>CHAPEL</em></h1>
            <p>1888년 런던. 다섯 명의 수사관을 지휘해 안개 속 범인의 흔적을 찾으세요.</p>
            <div className="wc-case-stamp">CASE FILE<br /><b>1888</b></div>
          </div>
          <div className="wc-lobby-board" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ left: `${10 + (index % 6) * 16}%`, top: `${10 + Math.floor(index / 6) * 36}%` }} />)}
            <span className="one">27</span><span className="two">?</span><span className="three">68</span>
            <b>WHITECHAPEL DISTRICT</b>
          </div>
          <div className="wc-start-card">
            <small>SOLO INVESTIGATION</small>
            <h2>경찰 수사팀 대 AI 잭</h2>
            <p>네 번의 밤 동안 같은 은신처로 돌아가는 범인의 경로를 추리합니다.</p>
            <fieldset>
              <legend>AI 난이도</legend>
              <label className={difficulty === "rookie" ? "active" : ""}>
                <input type="radio" checked={difficulty === "rookie"} onChange={() => setDifficulty("rookie")} />
                <b>초급</b><span>경로 선택에 빈틈이 있습니다</span>
              </label>
              <label className={difficulty === "inspector" ? "active" : ""}>
                <input type="radio" checked={difficulty === "inspector"} onChange={() => setDifficulty("inspector")} />
                <b>숙련</b><span>봉쇄와 귀환 거리를 계산합니다</span>
              </label>
            </fieldset>
            <button className="wc-primary" onClick={startGame}>수사 시작</button>
            <button className="wc-link" onClick={() => setTutorialStep(0)}>5단계 튜토리얼 보기 →</button>
          </div>
        </section>
      ) : (
        <>
          <section className="wc-night-header">
            <div className="wc-night-number"><span>NIGHT</span><b>{game.night}</b><em>/ 4</em></div>
            <div>
              <small>{WC_NIGHTS[game.night - 1].date}</small>
              <strong>{game.phase === "patrol" ? "지옥의 밤 · 순찰 배치" : game.phase === "jack" ? "안개 속 도주" : game.phase === "night-end" ? "밤의 종료" : game.phase === "over" ? "사건 종결" : "괴물 사냥"}</strong>
              <p>{game.message}</p>
            </div>
            <div className="wc-jack-supply">
              <span>마차 <b>{game.jack.coaches}</b></span>
              <span>골목 <b>{game.jack.alleys}</b></span>
              <span>이동 <b>{game.jack.movesUsed}/15</b></span>
            </div>
          </section>

          {(game.phase === "night-end" || game.phase === "over") && (
            <section className={`wc-outcome ${game.winner ?? "escaped"}`}>
              <span>{game.winner === "police" ? "✓" : game.winner === "jack" ? "J" : "☾"}</span>
              <div>
                <small>{game.phase === "night-end" ? `NIGHT ${game.night} CLOSED` : "CASE CLOSED"}</small>
                <h2>{game.phase === "night-end" ? "잭이 이번 밤을 빠져나갔습니다" : game.winner === "police" ? "경찰이 화이트채플을 지켰습니다" : "잭이 네 번의 밤을 살아남았습니다"}</h2>
              </div>
              <button onClick={game.phase === "night-end" ? nextNight : startGame}>{game.phase === "night-end" ? "다음 밤 준비" : "새 사건 시작"}</button>
            </section>
          )}

          <section className="wc-game-layout">
            <aside className="wc-record-panel">
              <header><small>JACK&apos;S MOVEMENT</small><h2>도주 기록지</h2></header>
              <div className="wc-track">
                {Array.from({ length: 15 }, (_, index) => {
                  const move = index + 1;
                  const entry = game.log.find((item) => item.move === move);
                  return (
                    <div key={move} className={entry ? `filled ${entry.type}` : ""}>
                      <span>{move}</span>
                      <b>{entry ? entry.type === "coach" ? "♞" : entry.type === "alley" ? "↝" : entry.type === "double-event" ? "Ⅱ" : "•" : ""}</b>
                      <small>{entry ? moveLabel(entry.type as MoveType) : ""}</small>
                    </div>
                  );
                })}
              </div>
              <div className="wc-night-tabs">
                {WC_NIGHTS.map((night) => <span key={night.night} className={night.night === game.night ? "active" : night.night < game.night ? "done" : ""}>{night.night}</span>)}
              </div>
              <section>
                <small>공개된 단서</small>
                <div className="wc-clue-list">{game.clues.length ? game.clues.map((clue) => <b key={clue}>{clue}</b>) : <p>아직 발견된 단서가 없습니다.</p>}</div>
              </section>
            </aside>

            <div className="wc-board-card">
              <div className="wc-board-toolbar">
                <div><small>WHITECHAPEL DISTRICT</small><strong>수사 지도</strong></div>
                <label>후보 장소<input type="checkbox" checked={showCandidates} onChange={(event) => setShowCandidates(event.target.checked)} /><i /></label>
                <span>{game.phase === "patrol" ? `${game.police.length}/5 배치` : `후보 ${game.candidates.length}`}</span>
              </div>
              <div className="wc-board-viewport">
                <div className="wc-board" role="application" aria-label="화이트채플 수사 지도">
                  <div className="wc-thames">RIVER THAMES</div>
                  {["SPITALFIELDS", "WHITECHAPEL", "MILE END", "ALDGATE"].map((name, index) => <b key={name} className={`wc-district d${index + 1}`}>{name}</b>)}
                  {WC_CROSSING_EDGES.map((edge) => {
                    const from = WC_CROSSINGS.find((item) => item.id === edge.a)!;
                    const to = WC_CROSSINGS.find((item) => item.id === edge.b)!;
                    return <i key={`${edge.a}-${edge.b}`} className="wc-cross-edge" style={lineStyle(from, to)} />;
                  })}
                  {WC_STREET_LINKS.map((link) => <i key={`${link.crossing}-${link.location}`} className="wc-street-link" style={routeStyle(link)} />)}
                  {WC_LOCATIONS.map((location) => {
                    const isWoman = game.women.includes(location.id) && game.phase === "patrol";
                    const isCrime = game.allCrimes.includes(location.id);
                    const isClue = game.clues.includes(location.id);
                    const candidate = showCandidates && game.candidates.includes(location.id);
                    const actionable = game.phase === "police-action" && adjacentActionLocations.includes(location.id);
                    const revealJack = game.phase === "over" && game.jack.location === location.id;
                    return (
                      <button
                        key={location.id}
                        className={["wc-location", isWoman ? "woman" : "", isCrime ? "crime" : "", isClue ? "clue" : "", candidate ? "candidate" : "", actionable ? `actionable ${actionMode}` : "", revealJack ? "jack" : ""].filter(Boolean).join(" ")}
                        style={{ left: `${location.x}%`, top: `${location.y}%` }}
                        onClick={() => actionable && actAtLocation(location.id)}
                        disabled={!actionable}
                        aria-label={`${location.id}번 장소${actionable ? ` ${actionMode === "search" ? "수색" : "체포 시도"}` : ""}`}
                      >
                        <span>{location.id}</span>
                        {isWoman && <i>♙</i>}
                        {isCrime && <i>†</i>}
                        {isClue && <em>×</em>}
                        {revealJack && <b>J</b>}
                      </button>
                    );
                  })}
                  {WC_CROSSINGS.map((crossing) => {
                    const police = game.police.find((piece) => piece.crossing === crossing.id);
                    const patrolSpot = game.phase === "patrol" && WC_PATROL_STARTS.includes(crossing.id);
                    const moveTarget = game.phase === "police-move" && game.selectedPolice && policeMoveIds.has(crossing.id) && !police;
                    return (
                      <button
                        key={crossing.id}
                        className={["wc-crossing", patrolSpot ? "patrol" : "", police ? "occupied" : "", moveTarget ? "move-target" : ""].filter(Boolean).join(" ")}
                        style={{ left: `${crossing.x}%`, top: `${crossing.y}%` }}
                        onClick={() => patrolSpot ? togglePatrol(crossing.id) : moveTarget ? movePolice(crossing.id) : undefined}
                        disabled={!patrolSpot && !moveTarget}
                        aria-label={patrolSpot ? "순찰 배치 지점" : moveTarget ? "경찰 이동 지점" : "교차점"}
                      >
                        {police && <b style={{ background: police.color }}>{police.name.slice(0, 1)}</b>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p>↔ 지도를 손가락으로 움직여 번호 장소와 검은 교차점을 확인하세요</p>
            </div>

            <aside className="wc-command-panel">
              <header><small>POLICE COMMAND</small><h2>수사 지휘</h2></header>
              {game.phase === "patrol" ? (
                <div className="wc-patrol-instruction">
                  <span>{game.police.length}<small>/ 5</small></span>
                  <h3>순찰 위치 선택</h3>
                  <p>지도에 노란 테두리로 표시된 교차점을 선택하세요.</p>
                  <button className="wc-primary" disabled={game.police.length !== 5} onClick={beginHunt}>배치 확정 · 수사 시작</button>
                </div>
              ) : (
                <>
                  <div className="wc-police-list">
                    {game.police.map((piece) => {
                      const completed = game.phase === "police-move" ? game.movedPolice.includes(piece.id) : game.actedPolice.includes(piece.id);
                      return (
                        <button key={piece.id} className={`${game.selectedPolice === piece.id ? "selected" : ""} ${completed ? "done" : ""}`} onClick={() => selectPolice(piece.id)} disabled={!["police-move", "police-action"].includes(game.phase) || completed}>
                          <i style={{ background: piece.color }}>{piece.name.slice(0, 1)}</i>
                          <span><b>{piece.name}</b><small>{piece.crossing.replace("c", "")} 교차점</small></span>
                          <em>{completed ? "완료" : game.selectedPolice === piece.id ? "선택됨" : "선택"}</em>
                        </button>
                      );
                    })}
                  </div>
                  {game.phase === "police-move" && (
                    <div className="wc-command-actions">
                      <p>{selectedPolice ? "지도에서 빛나는 교차점을 고르세요." : "움직일 경찰을 선택하세요."}</p>
                      <button onClick={stayPolice} disabled={!selectedPolice}>현재 위치에서 대기</button>
                    </div>
                  )}
                  {game.phase === "police-action" && (
                    <div className="wc-command-actions">
                      <div className="wc-action-tabs">
                        <button className={actionMode === "search" ? "active" : ""} onClick={() => setActionMode("search")}>단서 수색</button>
                        <button className={actionMode === "arrest" ? "active" : ""} onClick={() => setActionMode("arrest")}>체포 시도</button>
                      </div>
                      <p>{selectedPolice ? `지도에서 ${actionMode === "search" ? "노란" : "붉은"} 표시 장소를 고르세요.` : "행동할 경찰을 선택하세요."}</p>
                      {actionMode === "search" && <button onClick={endSearch} disabled={!selectedPolice}>수색 종료</button>}
                    </div>
                  )}
                </>
              )}
              <div className="wc-legend">
                <span><i className="circle" /> 잭의 번호 장소</span>
                <span><i className="cross" /> 경찰 교차점</span>
                <span><i className="crime" /> 사건 현장</span>
                <span><i className="clue" /> 발견한 단서</span>
              </div>
            </aside>
          </section>
        </>
      )}

      {tutorialStep !== null && (
        <div className="wc-modal-backdrop" role="dialog" aria-modal="true">
          <section className="wc-tutorial">
            <button className="wc-close" onClick={() => setTutorialStep(null)}>×</button>
            <div className={`wc-tutorial-art step-${tutorialStep + 1}`}>
              <span>27</span><i /><b>?</b><i /><em>×</em>
            </div>
            <small>INVESTIGATION LESSON {tutorialStep + 1}/5</small>
            <h2>{TUTORIAL[tutorialStep][0]}</h2>
            <p>{TUTORIAL[tutorialStep][1]}</p>
            <div className="wc-tutorial-dots">{TUTORIAL.map((_, index) => <i key={index} className={index === tutorialStep ? "active" : ""} />)}</div>
            <div className="wc-modal-actions">
              <button disabled={tutorialStep === 0} onClick={() => setTutorialStep(Math.max(0, tutorialStep - 1))}>이전</button>
              <button onClick={() => tutorialStep === 4 ? setTutorialStep(null) : setTutorialStep(tutorialStep + 1)}>{tutorialStep === 4 ? "수사 준비 완료" : "다음"}</button>
            </div>
          </section>
        </div>
      )}

      {rulesOpen && (
        <div className="wc-modal-backdrop" role="dialog" aria-modal="true">
          <section className="wc-rules">
            <button className="wc-close" onClick={() => setRulesOpen(false)}>×</button>
            <small>OFFICIAL CASE PROCEDURE</small>
            <h2>게임 방법</h2>
            <p>원작의 네 번의 밤과 숨은 이동 구조를 1인용 AI 대전에 맞게 구성했습니다.</p>
            <div>{RULES.map(([title, body], index) => <article key={title}><span>{index + 1}</span><div><b>{title}</b><p>{body}</p></div></article>)}</div>
            <button className="wc-primary" onClick={() => setRulesOpen(false)}>확인</button>
          </section>
        </div>
      )}
    </main>
  );
}
