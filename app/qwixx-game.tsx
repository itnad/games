"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { withKoreanObject, withKoreanSubject } from "./korean-particles.js";
import {
  QWIXX_COLORS,
  QWIXX_ROWS,
  qwixxApplyMark,
  qwixxCanMark,
  qwixxCellIndex,
  qwixxCrossScore,
  qwixxPlayerScore,
} from "./qwixx-engine.js";

type ExitProps = { onExit: () => void };
type Color = "red" | "yellow" | "green" | "blue";
type Marks = Record<Color, number[]>;
type Player = {
  id: number;
  name: string;
  style: string;
  marks: Marks;
  locks: Color[];
  penalties: number;
};
type Dice = {
  white: [number, number];
  colors: Record<Color, number>;
};
type Phase = "setup" | "ready" | "common" | "personal" | "ai-resolving" | "game-over";
type QwixxState = {
  phase: Phase;
  players: Player[];
  activeIndex: number;
  turn: number;
  dice: Dice | null;
  locked: Color[];
  aiCommon: Record<number, Color | null>;
  activeUsedCommon: boolean;
  message: string;
  detail: string;
  history: string[];
  actionId: number;
};

const COLOR_LABELS: Record<Color, string> = {
  red: "빨강",
  yellow: "노랑",
  green: "초록",
  blue: "파랑",
};
const PLAYER_NAMES = ["나", "루나", "모모", "토토", "코코"];
const PLAYER_STYLES = ["플레이어", "균형형", "안정형", "도전형", "계산형"];
const PLAYER_ACCENTS = ["#7a53d6", "#d45951", "#4c8f77", "#d4a03f", "#4d78b8"];
const DIE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

type QwixxLearningItem = {
  title: string;
  body: string;
};

type QwixxTutorialStep = QwixxLearningItem & {
  visual: string;
  note: string;
};

const QWIXX_RULES: QwixxLearningItem[] = [
  {
    title: "게임 목표",
    body: "네 색 줄에 숫자를 전략적으로 체크해 점수를 쌓으세요. 게임이 끝나면 네 줄의 점수 합계에서 실패 점수를 뺀 최종 점수가 가장 높은 사람이 승리합니다.",
  },
  {
    title: "네 색 줄의 방향",
    body: "빨강·노랑은 2에서 12로, 초록·파랑은 12에서 2로 진행합니다. 모든 줄은 화면의 왼쪽에서 오른쪽으로만 체크합니다.",
  },
  {
    title: "1단계 · 공용 합",
    body: "매번 흰 주사위 두 개의 합을 만듭니다. 현재 선수뿐 아니라 모든 참가자가 원하는 한 색 줄에 이 숫자를 체크하거나 건너뜁니다.",
  },
  {
    title: "2단계 · 개인 조합",
    body: "현재 선수만 흰 주사위 하나와 색 주사위 하나를 더해, 그 색의 줄에 한 번 더 체크할 수 있습니다.",
  },
  {
    title: "건너뛴 숫자",
    body: "오른쪽 숫자를 먼저 체크하면 그 왼쪽 숫자에는 다시 돌아갈 수 없습니다. 큰 도약은 미래의 선택지를 줄입니다.",
  },
  {
    title: "줄 잠금",
    body: "한 줄에 마지막 숫자를 제외하고 최소 5개를 체크한 뒤 마지막 12 또는 2를 체크하면 자물쇠도 체크하고 해당 색 주사위를 제거합니다.",
  },
  {
    title: "실패와 종료",
    body: "현재 선수가 공용·개인 행동을 모두 사용하지 않으면 실패 1회로 −5점입니다. 두 줄이 잠기거나 누군가 실패 4회가 되면 끝납니다.",
  },
  {
    title: "점수 계산",
    body: "한 줄의 체크 수가 1·2·3·4·5·6개면 1·3·6·10·15·21점입니다. 잠금 표시도 체크 1개로 세며, 마지막에 실패 점수를 뺍니다.",
  },
];

const QWIXX_TUTORIAL: QwixxTutorialStep[] = [
  {
    title: "줄의 진행 방향을 먼저 보세요",
    body: "숫자 자체의 크기가 아니라 점수표에서 왼쪽에서 오른쪽으로 진행한다는 점이 핵심입니다.",
    visual: "빨강·노랑  2  3  4  →  12\n초록·파랑 12 11 10  →   2",
    note: "초록 10을 체크한 뒤에는 초록 11·12를 체크할 수 없습니다.",
  },
  {
    title: "흰 주사위 합은 모두의 선택",
    body: "예시에서 흰 주사위가 3과 4라면 공용 합은 7입니다. 차례와 관계없이 모든 참가자가 7 하나를 체크할 수 있습니다.",
    visual: "⚂  +  ⚃  =  7\n모든 참가자 → 원하는 색 7",
    note: "원하는 줄에 7을 쓸 수 없다면 불이익 없이 건너뛸 수 있습니다.",
  },
  {
    title: "현재 선수는 한 번 더 조합합니다",
    body: "현재 선수는 흰색 하나와 색 주사위를 더합니다. 흰색 4와 빨간색 5를 고르면 빨강 9를 체크합니다.",
    visual: "흰색 ⚃  +  빨강 ⚄  =  9\n현재 선수 → 빨강 9",
    note: "공용 행동과 개인 행동을 같은 색 줄에 연속으로 사용해도 됩니다.",
  },
  {
    title: "멀리 건너뛰기 전에 생각하세요",
    body: "빨강 7을 체크하면 그 왼쪽의 2부터 6까지는 닫힙니다. 당장 가능한 숫자보다 남을 칸의 가치도 살펴보세요.",
    visual: "2  3  4  5  6  [7]  8  9\n×  ×  ×  ×  ×   ✓   →  →",
    note: "초반에는 작은 간격으로 전진하면 다음 주사위 결과를 받아낼 가능성이 높습니다.",
  },
  {
    title: "다섯 칸을 채운 뒤 잠그세요",
    body: "마지막 숫자를 제외하고 5개 이상 체크했다면 끝 숫자와 자물쇠를 함께 체크할 수 있습니다.",
    visual: "✓  ✓  ✓  ✓  ✓  …  12  🔒\n체크 5개 + 12 + 잠금",
    note: "잠금에 성공하면 그 색 주사위가 빠지고, 잠금 표시도 줄 점수의 체크 1개로 계산됩니다.",
  },
  {
    title: "체크 수를 삼각 점수로 바꿉니다",
    body: "각 줄 점수를 더하고 실패마다 5점을 뺍니다. 예를 들어 체크 6개는 21점이고 실패 2회는 −10점입니다.",
    visual: "1  3  6  10  15  21 …\n체크 6개 = 21점  |  실패 2회 = −10",
    note: "한 줄만 무리하게 밀기보다 네 줄에서 꾸준히 체크 수를 늘리는 편이 안정적입니다.",
  },
];

function QwixxLearningTools() {
  const [mode, setMode] = useState<"rules" | "tutorial" | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!mode) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMode(null);
      if (mode === "tutorial" && event.key === "ArrowRight") {
        setStep((current) => Math.min(QWIXX_TUTORIAL.length - 1, current + 1));
      }
      if (mode === "tutorial" && event.key === "ArrowLeft") {
        setStep((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode]);

  const openTutorial = () => {
    setStep(0);
    setMode("tutorial");
  };
  const current = QWIXX_TUTORIAL[step];

  return (
    <>
      <div className="learning-tools qwixx" aria-label="큐윅스 도움말">
        <button onClick={() => setMode("rules")}><span aria-hidden="true">ⓘ</span> 게임 방법</button>
        <button onClick={openTutorial}><span aria-hidden="true">▷</span> 튜토리얼</button>
      </div>
      {mode && (
        <div className="learning-backdrop" role="presentation" onClick={() => setMode(null)}>
          <section
            className="learning-modal qwixx"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qwixx-learning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="learning-close" onClick={() => setMode(null)} aria-label="도움말 닫기">×</button>
            <span className="learning-eyebrow">{mode === "rules" ? "HOW TO PLAY" : "QUICK TUTORIAL"}</span>
            <h2 id="qwixx-learning-title">큐윅스 {mode === "rules" ? "게임 방법" : "따라하기"}</h2>
            {mode === "rules" ? (
              <>
                <section className="qwixx-learning-goal" aria-label="큐윅스 게임 목표">
                  <span>GAME GOAL</span>
                  <strong>네 색 줄에서 가장 높은 최종 점수를 만드세요</strong>
                  <p>숫자를 왼쪽에서 오른쪽으로 체크해 점수를 쌓고, 실패 감점을 줄이세요. 두 줄이 잠기거나 한 선수가 실패 4회에 도달하면 점수를 비교해 가장 높은 사람이 승리합니다.</p>
                </section>
                <p className="learning-intro">목표를 확인했다면 한 차례의 두 가지 선택부터 줄 잠금과 점수 계산까지 순서대로 살펴보세요.</p>
                <ol className="learning-rules">
                  {QWIXX_RULES.map((rule, index) => (
                    <li key={rule.title}>
                      <b>{index + 1}</b>
                      <span><strong>{rule.title}</strong><small>{rule.body}</small></span>
                    </li>
                  ))}
                </ol>
                <button className="learning-primary" onClick={openTutorial}>예시로 따라하기</button>
              </>
            ) : (
              <div className="tutorial-content">
                <div className="tutorial-progress" aria-label={`${QWIXX_TUTORIAL.length}단계 중 ${step + 1}단계`}>
                  {QWIXX_TUTORIAL.map((item, index) => <i key={item.title} className={index <= step ? "active" : ""} />)}
                </div>
                <span className="tutorial-count">{step + 1} / {QWIXX_TUTORIAL.length}</span>
                <div className="tutorial-visual qwixx" aria-hidden="true"><span>{current.visual}</span></div>
                <h3>{current.title}</h3>
                <p>{current.body}</p>
                <aside><b>TIP</b>{current.note}</aside>
                <div className="tutorial-actions">
                  <button className="learning-secondary" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>이전</button>
                  {step < QWIXX_TUTORIAL.length - 1 ? (
                    <button className="learning-primary" onClick={() => setStep((value) => Math.min(QWIXX_TUTORIAL.length - 1, value + 1))}>다음</button>
                  ) : (
                    <button className="learning-primary" onClick={() => setMode(null)}>게임 시작하기</button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function emptyMarks(): Marks {
  return { red: [], yellow: [], green: [], blue: [] };
}

function makePlayers(total: number): Player[] {
  return Array.from({ length: total }, (_, id) => ({
    id,
    name: PLAYER_NAMES[id],
    style: PLAYER_STYLES[id],
    marks: emptyMarks(),
    locks: [],
    penalties: 0,
  }));
}

function emptyState(total = 3): QwixxState {
  return {
    phase: "setup",
    players: makePlayers(total),
    activeIndex: 0,
    turn: 1,
    dice: null,
    locked: [],
    aiCommon: {},
    activeUsedCommon: false,
    message: "함께 굴릴 참가자를 정하세요",
    detail: "공식 규칙은 2~5명이 함께 플레이합니다",
    history: [],
    actionId: 0,
  };
}

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollAllDice(): Dice {
  return {
    white: [rollDie(), rollDie()],
    colors: {
      red: rollDie(),
      yellow: rollDie(),
      green: rollDie(),
      blue: rollDie(),
    },
  };
}

function markValue(player: Player, color: Color, value: number) {
  const marks = qwixxApplyMark(player.marks, color, value) as Marks;
  const closes = qwixxCellIndex(color, value) === 10;
  return {
    ...player,
    marks,
    locks: closes && !player.locks.includes(color) ? [...player.locks, color] : player.locks,
  };
}

function markable(player: Player, color: Color, value: number, locked: Color[]) {
  return qwixxCanMark(player.marks, color, value, locked.includes(color));
}

function optionQuality(player: Player, color: Color, value: number, locked: Color[]) {
  if (!markable(player, color, value, locked)) return Number.NEGATIVE_INFINITY;
  const index = qwixxCellIndex(color, value);
  const rowMarks = player.marks[color];
  const last = rowMarks.length ? Math.max(...rowMarks) : -1;
  const skipped = index - last - 1;
  const closing = index === 10 ? 13 : 0;
  const density = rowMarks.length * 0.65;
  return 7.5 - skipped * 1.7 + closing + density;
}

function chooseAiCommon(player: Player, value: number, locked: Color[], isActive: boolean) {
  const options = QWIXX_COLORS
    .map((color) => ({ color: color as Color, quality: optionQuality(player, color as Color, value, locked) }))
    .filter((option) => Number.isFinite(option.quality))
    .sort((a, b) => b.quality - a.quality);
  if (!options.length) return null;
  const threshold = isActive ? -2 : 1.3;
  const jitter = Math.random() * 2.2 - 1.1;
  return options[0].quality + jitter >= threshold ? options[0].color : null;
}

function personalOptions(player: Player, dice: Dice, locked: Color[]) {
  return QWIXX_COLORS.flatMap((color) =>
    dice.white.map((white, whiteIndex) => {
      const value = white + dice.colors[color as Color];
      return {
        color: color as Color,
        whiteIndex,
        value,
        quality: optionQuality(player, color as Color, value, locked),
      };
    }),
  ).filter((option) => Number.isFinite(option.quality));
}

function gameEnded(state: Pick<QwixxState, "locked" | "players">) {
  return state.locked.length >= 2 || state.players.some((player) => player.penalties >= 4);
}

function winnerText(players: Player[]) {
  const sorted = [...players].sort((a, b) => qwixxPlayerScore(b) - qwixxPlayerScore(a));
  const best = qwixxPlayerScore(sorted[0]);
  const winners = sorted.filter((player) => qwixxPlayerScore(player) === best);
  return winners.length > 1
    ? `${winners.map((player) => player.name).join("·")} 공동 승리`
    : winners[0].id === 0
      ? "큐윅스에서 승리했어요!"
      : `${withKoreanSubject(winners[0].name)} 승리했어요`;
}

function endTurn(state: QwixxState, players: Player[], locked: Color[], actions: string[]) {
  const ended = gameEnded({ players, locked });
  const nextIndex = (state.activeIndex + 1) % players.length;
  return {
    ...state,
    players,
    locked,
    phase: ended ? "game-over" as const : "ready" as const,
    activeIndex: ended ? state.activeIndex : nextIndex,
    turn: state.turn + 1,
    dice: ended ? state.dice : null,
    aiCommon: {},
    activeUsedCommon: false,
    message: ended ? winnerText(players) : `${players[nextIndex].name}의 차례`,
    detail: ended ? "네 색 줄의 점수에서 실패 점수를 뺀 최종 결과입니다" : "주사위를 굴릴 준비를 합니다",
    history: [...actions, ...state.history].slice(0, 8),
    actionId: state.actionId + 1,
  };
}

function closeRowsFromChoices(
  players: Player[],
  choices: Record<number, Color | null>,
  value: number,
  locked: Color[],
) {
  const newlyLocked = new Set<Color>();
  const updated = players.map((player) => {
    const color = choices[player.id];
    if (!color || !markable(player, color, value, locked)) return player;
    if (qwixxCellIndex(color, value) === 10) newlyLocked.add(color);
    return markValue(player, color, value);
  });
  return {
    players: updated,
    locked: [...new Set([...locked, ...newlyLocked])] as Color[],
    newlyLocked: [...newlyLocked],
  };
}

function applyAiPersonal(state: QwixxState, players: Player[], locked: Color[], usedCommon: boolean, commonActions: string[]) {
  if (!state.dice) return state;
  const active = players[state.activeIndex];
  const options = personalOptions(active, state.dice, locked).sort((a, b) => b.quality - a.quality);
  const best = options[0];
  const willUse = Boolean(best) && (best.quality > 0.4 || !usedCommon);
  let nextPlayers = players;
  let nextLocked = locked;
  const actions = [...commonActions];

  if (willUse && best) {
    nextPlayers = players.map((player, index) =>
      index === state.activeIndex ? markValue(player, best.color, best.value) : player,
    );
    if (qwixxCellIndex(best.color, best.value) === 10) {
      nextLocked = [...new Set([...locked, best.color])] as Color[];
      actions.push(`${active.name}: ${COLOR_LABELS[best.color]} 줄 잠금`);
    } else {
      actions.push(`${active.name}: ${COLOR_LABELS[best.color]} ${best.value} 체크`);
    }
  } else if (!usedCommon) {
    nextPlayers = players.map((player, index) =>
      index === state.activeIndex ? { ...player, penalties: player.penalties + 1 } : player,
    );
    actions.push(`${active.name}: 체크하지 못해 실패 1회`);
  } else {
    actions.push(`${active.name}: 개인 조합 건너뜀`);
  }

  return endTurn(state, nextPlayers, nextLocked, actions);
}

function applyCommonChoice(state: QwixxState, humanChoice: Color | null): QwixxState {
  if (!state.dice || state.phase !== "common") return state;
  const commonValue = state.dice.white[0] + state.dice.white[1];
  const choices: Record<number, Color | null> = { ...state.aiCommon, 0: humanChoice };
  const result = closeRowsFromChoices(state.players, choices, commonValue, state.locked);
  const actions = state.players.flatMap((player) => {
    const color = choices[player.id];
    if (!color || !markable(player, color, commonValue, state.locked)) return [];
    return [`${player.name}: ${COLOR_LABELS[color]} ${commonValue} 체크`];
  });
  result.newlyLocked.forEach((color) => actions.push(`${COLOR_LABELS[color]} 줄이 잠겼습니다`));
  const activeChoice = choices[state.activeIndex];
  const activeUsedCommon = Boolean(
    activeChoice && markable(state.players[state.activeIndex], activeChoice, commonValue, state.locked),
  );

  if (gameEnded(result)) {
    return endTurn(state, result.players, result.locked, actions);
  }

  if (state.activeIndex === 0) {
    return {
      ...state,
      players: result.players,
      locked: result.locked,
      phase: "personal",
      activeUsedCommon,
      message: "색 주사위 조합을 선택하세요",
      detail: "흰 주사위 하나와 같은 색 주사위를 더할 수 있습니다",
      history: [...actions, ...state.history].slice(0, 8),
      actionId: state.actionId + 1,
    };
  }

  return {
    ...state,
    players: result.players,
    locked: result.locked,
    phase: "ai-resolving",
    activeUsedCommon,
    message: `${withKoreanSubject(state.players[state.activeIndex].name)} 개인 조합을 고릅니다`,
    detail: "AI의 두 번째 행동을 확인합니다",
    history: [...actions, ...state.history].slice(0, 8),
    actionId: state.actionId + 1,
  };
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function QwixxTopbar({ onExit }: ExitProps) {
  return (
    <header className="game-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup">
        <BrandMark />
        <div><span>paperoid</span><strong>큐윅스</strong></div>
      </div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

function Die({ value, color = "white", removed = false }: { value: number; color?: Color | "white"; removed?: boolean }) {
  return (
    <span className={`qwixx-die ${color} ${removed ? "removed" : ""}`} aria-label={removed ? `${COLOR_LABELS[color as Color]} 주사위 제거됨` : `${color === "white" ? "흰" : COLOR_LABELS[color]} 주사위 ${value}`}>
      {removed ? "×" : DIE_FACES[value]}
    </span>
  );
}

function FullScoreSheet({ player, locked }: { player: Player; locked: Color[] }) {
  return (
    <section className="qwixx-sheet" aria-label={`${player.name} 점수표`}>
      <header>
        <div><span>MY SCORE SHEET</span><strong>{player.name}</strong></div>
        <div className="qwixx-sheet-total"><small>현재 점수</small><strong>{qwixxPlayerScore(player)}</strong></div>
      </header>
      <div className="qwixx-rows">
        {QWIXX_COLORS.map((rawColor) => {
          const color = rawColor as Color;
          const marks = player.marks[color];
          const last = marks.length ? Math.max(...marks) : -1;
          const rowCrosses = marks.length + (player.locks.includes(color) ? 1 : 0);
          return (
            <div className={`qwixx-row ${color} ${locked.includes(color) ? "locked" : ""}`} key={color}>
              <span className="row-name">{COLOR_LABELS[color]}</span>
              <div className="row-cells">
                {QWIXX_ROWS[color].map((value, index) => (
                  <span
                    key={value}
                    className={`${marks.includes(index) ? "marked" : ""} ${index < last && !marks.includes(index) ? "passed" : ""}`}
                  >
                    <b>{value}</b>
                    {marks.includes(index) && <i>×</i>}
                  </span>
                ))}
                <span className={`row-lock ${player.locks.includes(color) ? "marked" : ""}`}>
                  {player.locks.includes(color) ? "✓" : "▣"}
                </span>
              </div>
              <small>{rowCrosses}개 · {qwixxCrossScore(rowCrosses)}점</small>
            </div>
          );
        })}
      </div>
      <footer>
        <span>실패</span>
        <div>{Array.from({ length: 4 }, (_, index) => <i key={index} className={index < player.penalties ? "marked" : ""}>{index < player.penalties ? "×" : "−5"}</i>)}</div>
        <strong>{player.penalties * -5}점</strong>
      </footer>
    </section>
  );
}

function AiSummary({ player, active }: { player: Player; active: boolean }) {
  return (
    <article className={`qwixx-ai-card ${active ? "active" : ""}`} style={{ "--ai-accent": PLAYER_ACCENTS[player.id] } as CSSProperties}>
      <span className="qwixx-ai-avatar">{player.name.slice(0, 1)}</span>
      <div className="qwixx-ai-name"><strong>{player.name}</strong><small>{player.style}</small></div>
      <strong className="qwixx-ai-score">{qwixxPlayerScore(player)}점</strong>
      <div className="qwixx-ai-bars">
        {QWIXX_COLORS.map((rawColor) => {
          const color = rawColor as Color;
          const count = player.marks[color].length + (player.locks.includes(color) ? 1 : 0);
          return <i key={color} className={color}><span style={{ width: `${Math.min(100, count / 12 * 100)}%` }} /></i>;
        })}
      </div>
      <small className="qwixx-ai-penalty">실패 {player.penalties}/4</small>
    </article>
  );
}

export function QwixxGame({ onExit }: ExitProps) {
  const [totalPlayers, setTotalPlayers] = useState(3);
  const [state, setState] = useState<QwixxState>(() => emptyState(3));

  useEffect(() => {
    if (state.phase !== "ready" || state.activeIndex === 0) return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.phase !== "ready" || current.activeIndex === 0) return current;
        const dice = rollAllDice();
        const commonValue = dice.white[0] + dice.white[1];
        const aiCommon = Object.fromEntries(
          current.players
            .filter((player) => player.id > 0)
            .map((player) => [
              player.id,
              chooseAiCommon(player, commonValue, current.locked, player.id === current.activeIndex),
            ]),
        );
        return {
          ...current,
          dice,
          aiCommon,
          phase: "common",
          message: `${withKoreanSubject(current.players[current.activeIndex].name)} ${withKoreanObject(commonValue)} 만들었어요`,
          detail: "모든 참가자가 흰 주사위 합을 사용할 수 있습니다",
          actionId: current.actionId + 1,
        };
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.activeIndex, state.actionId]);

  useEffect(() => {
    if (state.phase !== "ai-resolving") return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.phase !== "ai-resolving") return current;
        return applyAiPersonal(
          current,
          current.players,
          current.locked,
          current.activeUsedCommon,
          [],
        );
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.actionId]);

  const sortedPlayers = useMemo(
    () => [...state.players].sort((a, b) => qwixxPlayerScore(b) - qwixxPlayerScore(a)),
    [state.players],
  );
  const activePlayer = state.players[state.activeIndex];
  const commonValue = state.dice ? state.dice.white[0] + state.dice.white[1] : 0;

  function updateTotal(total: number) {
    setTotalPlayers(total);
    setState(emptyState(total));
  }

  function start() {
    setState({
      ...emptyState(totalPlayers),
      phase: "ready",
      message: "나의 첫 번째 차례",
      detail: "여섯 개의 주사위를 굴려 시작하세요",
    });
  }

  function roll() {
    setState((current) => {
      if (current.phase !== "ready" || current.activeIndex !== 0) return current;
      const dice = rollAllDice();
      const common = dice.white[0] + dice.white[1];
      const aiCommon = Object.fromEntries(
        current.players
          .filter((player) => player.id > 0)
          .map((player) => [player.id, chooseAiCommon(player, common, current.locked, false)]),
      );
      return {
        ...current,
        dice,
        aiCommon,
        phase: "common",
        message: `공용 합은 ${common}입니다`,
        detail: "체크할 색상 줄을 선택하거나 건너뛰세요",
        actionId: current.actionId + 1,
      };
    });
  }

  function playPersonal(color: Color | null, whiteIndex = 0) {
    setState((current) => {
      if (current.phase !== "personal" || !current.dice) return current;
      let players = current.players;
      let locked = current.locked;
      const actions: string[] = [];
      if (color) {
        const value = current.dice.white[whiteIndex] + current.dice.colors[color];
        const human = current.players[0];
        if (!markable(human, color, value, current.locked)) return current;
        players = current.players.map((player, index) => index === 0 ? markValue(player, color, value) : player);
        if (qwixxCellIndex(color, value) === 10) {
          locked = [...new Set([...current.locked, color])] as Color[];
          actions.push(`${COLOR_LABELS[color]} 줄 잠금`);
        } else {
          actions.push(`나: ${COLOR_LABELS[color]} ${value} 체크`);
        }
      } else if (!current.activeUsedCommon) {
        players = current.players.map((player, index) =>
          index === 0 ? { ...player, penalties: player.penalties + 1 } : player,
        );
        actions.push("체크하지 못해 실패 1회");
      } else {
        actions.push("개인 조합 건너뜀");
      }
      return endTurn(current, players, locked, actions);
    });
  }

  return (
    <main className="game-shell qwixx-shell">
      <QwixxTopbar onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel qwixx-info">
          <div>
            <span className="eyebrow">ROLL & WRITE</span>
            <h1>왼쪽에서<br />오른쪽으로!</h1>
            <p>숫자를 건너뛸수록 선택지는 줄어듭니다. 네 색 줄에 영리하게 체크해 가장 높은 점수를 만드세요.</p>
          </div>
          {state.phase === "setup" ? (
            <div className="qwixx-player-count">
              <span>참가 인원</span>
              <strong>{totalPlayers}명</strong>
              <div>
                {[2, 3, 4, 5].map((count) => (
                  <button key={count} className={totalPlayers === count ? "active" : ""} onClick={() => updateTotal(count)}>{count}</button>
                ))}
              </div>
              <small>나 1명 + AI {totalPlayers - 1}명</small>
            </div>
          ) : (
            <div className="qwixx-side-score">
              <div><span>TURN</span><strong>{state.turn}</strong></div>
              <div><span>잠긴 줄</span><strong>{state.locked.length}/2</strong></div>
              <div><span>내 점수</span><strong>{qwixxPlayerScore(state.players[0])}</strong></div>
            </div>
          )}
          <div className="qwixx-side-note">
            <span>게임 종료</span>
            <strong>두 줄 잠금 또는 실패 4회</strong>
          </div>
        </aside>

        <div className="board-panel qwixx-board-panel">
          <QwixxLearningTools />
          {state.phase === "setup" ? (
            <section className="qwixx-welcome">
              <div className="qwixx-logo-dice" aria-hidden="true"><i>⚁</i><i>⚄</i><i>⚂</i></div>
              <span>FAST FAMILY DICE GAME</span>
              <h2>모두가 매번<br />함께 선택합니다</h2>
              <p>다른 사람의 차례에도 흰 주사위 두 개의 합을 사용할 수 있어 기다리는 시간이 없습니다.</p>
              <ol>
                <li><b>1</b><span>공용 흰 주사위 합을 원하는 색 줄에 체크</span></li>
                <li><b>2</b><span>현재 선수는 흰색 하나와 색 주사위도 조합</span></li>
                <li><b>3</b><span>줄마다 체크 수의 누적 점수를 계산</span></li>
              </ol>
              <button onClick={start}>큐윅스 시작 <span aria-hidden="true">→</span></button>
            </section>
          ) : (
            <>
              <div className="qwixx-status" role="status">
                <span className="qwixx-turn-badge">{state.phase === "game-over" ? "★" : state.activeIndex === 0 ? "나" : "AI"}</span>
                <div><strong>{state.message}</strong><span>{state.detail}</span></div>
                <details>
                  <summary>ⓘ 점수·규칙</summary>
                  <div>
                    <p><b>공용 행동</b> 모든 사람이 흰 주사위 둘의 합을 한 색 줄에 체크할 수 있습니다.</p>
                    <p><b>개인 행동</b> 현재 선수만 흰 주사위 하나와 같은 색 주사위를 더해 체크합니다.</p>
                    <p><b>진행 방향</b> 각 줄은 왼쪽에서 오른쪽으로만 진행하며 건너뛴 숫자로 돌아갈 수 없습니다.</p>
                    <p><b>줄 잠금</b> 먼저 5칸 이상 체크한 뒤 마지막 숫자를 체크하면 잠금도 점수에 포함됩니다.</p>
                    <p><b>실패</b> 현재 선수가 두 행동 모두 사용하지 못하면 −5점입니다.</p>
                  </div>
                </details>
              </div>

              <section className="qwixx-opponents" aria-label="AI 참가자 현황">
                {state.players.slice(1).map((player) => <AiSummary key={player.id} player={player} active={player.id === state.activeIndex} />)}
              </section>

              <section className="qwixx-dice-table" aria-label="주사위 결과">
                <div className="qwixx-active-player">
                  <span>{activePlayer.name}</span><strong>{activePlayer.style}</strong>
                </div>
                <div className="qwixx-dice-row">
                  {state.dice ? (
                    <>
                      <Die value={state.dice.white[0]} />
                      <Die value={state.dice.white[1]} />
                      {QWIXX_COLORS.map((rawColor) => {
                        const color = rawColor as Color;
                        return <Die key={color} value={state.dice!.colors[color]} color={color} removed={state.locked.includes(color)} />;
                      })}
                    </>
                  ) : (
                    <>
                      <Die value={1} /><Die value={1} />
                      {QWIXX_COLORS.map((rawColor) => <Die key={rawColor} value={1} color={rawColor as Color} removed={state.locked.includes(rawColor as Color)} />)}
                    </>
                  )}
                </div>
                {state.dice && <div className="qwixx-common-sum"><span>공용 합</span><strong>{commonValue}</strong></div>}
              </section>

              {state.phase === "common" && (
                <section className="qwixx-choice-panel">
                  <header><span>1단계</span><div><strong>공용 합 {commonValue}</strong><small>원하는 한 줄에 체크할 수 있습니다</small></div></header>
                  <div className="qwixx-color-choices">
                    {QWIXX_COLORS.map((rawColor) => {
                      const color = rawColor as Color;
                      const valid = markable(state.players[0], color, commonValue, state.locked);
                      return (
                        <button key={color} className={color} disabled={!valid} onClick={() => setState((current) => applyCommonChoice(current, color))}>
                          <span>{COLOR_LABELS[color]}</span><strong>{commonValue}</strong><small>{valid ? "체크" : state.locked.includes(color) ? "잠김" : "선택 불가"}</small>
                        </button>
                      );
                    })}
                    <button className="skip" onClick={() => setState((current) => applyCommonChoice(current, null))}><span>이번에는</span><strong>건너뛰기</strong><small>비활성 선수는 불이익 없음</small></button>
                  </div>
                </section>
              )}

              {state.phase === "personal" && state.dice && (
                <section className="qwixx-choice-panel personal">
                  <header><span>2단계</span><div><strong>나의 개인 조합</strong><small>흰 주사위 하나 + 색 주사위 하나</small></div></header>
                  <div className="qwixx-combo-grid">
                    {QWIXX_COLORS.flatMap((rawColor) => {
                      const color = rawColor as Color;
                      return state.dice!.white.map((white, whiteIndex) => {
                        const value = white + state.dice!.colors[color];
                        const valid = markable(state.players[0], color, value, state.locked);
                        return (
                          <button key={`${color}-${whiteIndex}`} className={color} disabled={!valid} onClick={() => playPersonal(color, whiteIndex)}>
                            <span>{white} + {state.dice!.colors[color]}</span>
                            <strong>{value}</strong>
                          </button>
                        );
                      });
                    })}
                    <button className="skip" onClick={() => playPersonal(null)}>
                      <span>{state.activeUsedCommon ? "공용 체크 완료" : "체크 없음"}</span><strong>건너뛰기</strong>
                    </button>
                  </div>
                </section>
              )}

              {(state.phase === "ready" || state.phase === "ai-resolving") && (
                <section className="qwixx-waiting">
                  {state.phase === "ready" && state.activeIndex === 0 ? (
                    <button onClick={roll}><span aria-hidden="true">⬡</span> 주사위 굴리기</button>
                  ) : (
                    <div><span>◌</span>{state.phase === "ai-resolving" ? "AI가 개인 조합을 선택하고 있습니다" : "AI가 주사위를 준비하고 있습니다"}</div>
                  )}
                </section>
              )}

              <FullScoreSheet player={state.players[0]} locked={state.locked} />

              {state.phase === "game-over" && (
                <section className="qwixx-result">
                  <span>FINAL SCORE</span>
                  <h2>{winnerText(state.players)}</h2>
                  <div>
                    {sortedPlayers.map((player, index) => (
                      <p key={player.id} className={player.id === 0 ? "human" : ""}>
                        <b>{index + 1}</b><span>{player.name}</span><strong>{qwixxPlayerScore(player)}점</strong>
                      </p>
                    ))}
                  </div>
                  <button onClick={() => setState({ ...emptyState(totalPlayers), phase: "ready", message: "나의 첫 번째 차례", detail: "여섯 개의 주사위를 굴려 시작하세요" })}>
                    같은 인원으로 다시 플레이 <span aria-hidden="true">↻</span>
                  </button>
                </section>
              )}

              <div className="qwixx-history" aria-label="최근 선택">
                <strong>최근 선택</strong>
                <span>{state.history.length ? state.history.slice(0, 3).join(" · ") : "아직 체크한 숫자가 없습니다"}</span>
                <button onClick={() => setState(emptyState(totalPlayers))}>새 게임</button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
