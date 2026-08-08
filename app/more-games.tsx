"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { chooseAiHeld, describeAiHeld, shouldAiStop } from "./dice-ai.js";
import { scoreDice } from "./dice-scoring.js";
import { withKoreanObject } from "./korean-particles.js";
import {
  BATTLESHIP_SEA_SIZE as SEA_SIZE,
  BATTLESHIP_SHIP_LENGTHS,
  applyCheckerMove,
  battleshipRemainingShips as remainingShips,
  checkerMoves,
  checkerOwner,
  checkersWinner,
  createBattleshipFleet as createFleet,
} from "./classic-rules-engine.js";

type ExitProps = { onExit: () => void };

function MiniBrand() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

function ExtraTopbar({ title, onExit }: { title: string; onExit: () => void }) {
  return (
    <header className="game-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup">
        <MiniBrand />
        <div><span>paperoid</span><strong>{title}</strong></div>
      </div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

function ExtraModeSwitch() {
  return (
    <div className="mode-switch" aria-label="대전 모드">
      <button className="active"><span className="bot-face">•ᴗ•</span>AI 대전</button>
      <button disabled><span>♙</span>친구 대전<small>준비 중</small></button>
    </div>
  );
}

function InfoPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="game-info-panel">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <ExtraModeSwitch />
      {children}
    </div>
  );
}

function SimpleScore({
  player,
  ai,
  turn,
  label = "SCORE",
}: {
  player: number;
  ai: number;
  turn: 1 | 2;
  label?: string;
}) {
  return (
    <div className="memory-score-card compact-score">
      <div className={turn === 1 ? "active" : ""}>
        <span>나</span><strong>{player}</strong><small>{label}</small>
      </div>
      <i />
      <div className={turn === 2 ? "active" : ""}>
        <span>AI</span><strong>{ai}</strong><small>{label}</small>
      </div>
    </div>
  );
}

type LearningItem = {
  title: string;
  body: string;
};

type TutorialStep = LearningItem & {
  visual: string;
  note: string;
};

function GameLearningTools({
  game,
  theme,
  rules,
  tutorial,
}: {
  game: string;
  theme: "reversi" | "mancala" | "checkers" | "battleship";
  rules: LearningItem[];
  tutorial: TutorialStep[];
}) {
  const [mode, setMode] = useState<"rules" | "tutorial" | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!mode) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMode(null);
      if (mode === "tutorial" && event.key === "ArrowRight") {
        setStep((current) => Math.min(tutorial.length - 1, current + 1));
      }
      if (mode === "tutorial" && event.key === "ArrowLeft") {
        setStep((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode, tutorial.length]);

  const openTutorial = () => {
    setStep(0);
    setMode("tutorial");
  };

  const close = () => setMode(null);
  const current = tutorial[step];

  return (
    <>
      <div className={`learning-tools ${theme}`} aria-label={`${game} 도움말`}>
        <button onClick={() => setMode("rules")}><span aria-hidden="true">ⓘ</span> 게임 방법</button>
        <button onClick={openTutorial}><span aria-hidden="true">▷</span> 튜토리얼</button>
      </div>

      {mode && (
        <div className="learning-backdrop" role="presentation" onClick={close}>
          <section
            className={`learning-modal ${theme}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${theme}-learning-title`}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="learning-close" onClick={close} aria-label="도움말 닫기">×</button>
            <span className="learning-eyebrow">{mode === "rules" ? "HOW TO PLAY" : "QUICK TUTORIAL"}</span>
            <h2 id={`${theme}-learning-title`}>
              {game} {mode === "rules" ? "게임 방법" : "따라하기"}
            </h2>

            {mode === "rules" ? (
              <>
                <p className="learning-intro">핵심 규칙만 익히면 바로 AI와 대전할 수 있어요.</p>
                <ol className="learning-rules">
                  {rules.map((rule, index) => (
                    <li key={rule.title}>
                      <b>{index + 1}</b>
                      <span><strong>{rule.title}</strong><small>{rule.body}</small></span>
                    </li>
                  ))}
                </ol>
                <button className="learning-primary" onClick={openTutorial}>튜토리얼 시작</button>
              </>
            ) : (
              <div className="tutorial-content">
                <div className="tutorial-progress" aria-label={`${tutorial.length}단계 중 ${step + 1}단계`}>
                  {tutorial.map((item, index) => (
                    <i key={item.title} className={index <= step ? "active" : ""} />
                  ))}
                </div>
                <span className="tutorial-count">{step + 1} / {tutorial.length}</span>
                <div className={`tutorial-visual ${theme}`} aria-hidden="true">
                  <span>{current.visual}</span>
                </div>
                <h3>{current.title}</h3>
                <p>{current.body}</p>
                <aside><b>TIP</b>{current.note}</aside>
                <div className="tutorial-actions">
                  <button
                    className="learning-secondary"
                    onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))}
                    disabled={step === 0}
                  >
                    이전
                  </button>
                  {step < tutorial.length - 1 ? (
                    <button
                      className="learning-primary"
                      onClick={() => setStep((currentStep) => Math.min(tutorial.length - 1, currentStep + 1))}
                    >
                      다음
                    </button>
                  ) : (
                    <button className="learning-primary" onClick={close}>판에서 연습하기</button>
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

/* Reversi */
type RevStone = 0 | 1 | 2;
type RevMove = { index: number; flips: number[] };
const REV_DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
] as const;

const REVERSI_RULES: LearningItem[] = [
  { title: "내 돌 색", body: "플레이어는 흑돌이며 언제나 먼저 둡니다. AI는 백돌입니다." },
  { title: "돌 놓기", body: "가로·세로·대각선으로 상대 돌을 내 돌 사이에 끼울 수 있는 빈칸에만 놓습니다." },
  { title: "뒤집기", body: "새 돌과 기존 내 돌 사이에 갇힌 상대 돌은 한 줄씩 모두 내 색으로 뒤집힙니다." },
  { title: "패스", body: "둘 수 있는 칸이 없으면 자동으로 차례를 넘깁니다. 두 사람 모두 둘 곳이 없으면 끝납니다." },
  { title: "승리", body: "게임 종료 시 판 위에 자신의 색 돌이 더 많은 사람이 승리합니다." },
];

const REVERSI_TUTORIAL: TutorialStep[] = [
  { visual: "● ○\n○ ●", title: "가운데 네 돌에서 시작", body: "플레이어는 검은 돌입니다. 중앙의 흑백 돌 네 개를 기준으로 첫 수를 찾아보세요.", note: "흑돌이 먼저 시작합니다." },
  { visual: "● · ○ ●", title: "점이 있는 칸을 선택", body: "판에 작은 점으로 표시되는 칸만 현재 놓을 수 있는 자리입니다.", note: "상대 돌을 하나 이상 끼워야 유효한 수입니다." },
  { visual: "● ○ ○ ●  →  ● ● ● ●", title: "사이에 낀 돌 뒤집기", body: "내 돌로 양끝을 막으면 그 사이의 백돌이 모두 흑돌로 바뀝니다.", note: "한 번에 여러 방향의 돌을 뒤집을 수도 있어요." },
  { visual: "⌜  ●  ⌝", title: "모서리를 노리기", body: "모서리 돌은 다시 뒤집히지 않아 매우 강합니다. 마지막에는 돌 개수로 승패를 정합니다.", note: "가장자리보다 모서리를 먼저 확보해 보세요." },
];

function newReversiBoard(): RevStone[] {
  const board = Array.from({ length: 64 }, () => 0 as RevStone);
  board[27] = 2;
  board[28] = 1;
  board[35] = 1;
  board[36] = 2;
  return board;
}

function reversiMoves(board: RevStone[], player: 1 | 2): RevMove[] {
  const opponent = player === 1 ? 2 : 1;
  const moves: RevMove[] = [];
  for (let index = 0; index < 64; index += 1) {
    if (board[index]) continue;
    const row = Math.floor(index / 8);
    const col = index % 8;
    const allFlips: number[] = [];
    for (const [dr, dc] of REV_DIRS) {
      let r = row + dr;
      let c = col + dc;
      const line: number[] = [];
      while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === opponent) {
        line.push(r * 8 + c);
        r += dr;
        c += dc;
      }
      if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === player) {
        allFlips.push(...line);
      }
    }
    if (allFlips.length) moves.push({ index, flips: allFlips });
  }
  return moves;
}

function applyReversiMove(board: RevStone[], move: RevMove, player: 1 | 2) {
  const next = [...board];
  next[move.index] = player;
  move.flips.forEach((index) => { next[index] = player; });
  return next;
}

export function ReversiGame({ onExit }: ExitProps) {
  const [board, setBoard] = useState<RevStone[]>(newReversiBoard);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("내 차례");
  const moves = useMemo(() => reversiMoves(board, turn), [board, turn]);
  const black = board.filter((stone) => stone === 1).length;
  const white = board.filter((stone) => stone === 2).length;

  const finishOrAdvance = (next: RevStone[], nextPlayer: 1 | 2) => {
    const nextMoves = reversiMoves(next, nextPlayer);
    const currentMoves = reversiMoves(next, nextPlayer === 1 ? 2 : 1);
    if (!nextMoves.length && !currentMoves.length) {
      setFinished(true);
      setMessage(black === white ? "무승부예요" : black > white ? "승리했어요!" : "AI가 승리했어요");
      return;
    }
    if (!nextMoves.length) {
      const returning = nextPlayer === 1 ? 2 : 1;
      setTurn(returning);
      setMessage(nextPlayer === 1 ? "놓을 곳이 없어 턴을 넘겼어요" : "AI가 패스했어요");
    } else {
      setTurn(nextPlayer);
      setMessage(nextPlayer === 1 ? "내 차례" : "AI가 생각 중…");
    }
  };

  const play = (index: number) => {
    if (turn !== 1 || finished) return;
    const move = moves.find((candidate) => candidate.index === index);
    if (!move) return;
    const next = applyReversiMove(board, move, 1);
    setBoard(next);
    finishOrAdvance(next, 2);
  };

  useEffect(() => {
    if (turn !== 2 || finished) return;
    const timer = window.setTimeout(() => {
      const options = reversiMoves(board, 2);
      if (!options.length) {
        finishOrAdvance(board, 1);
        return;
      }
      const corners = new Set([0, 7, 56, 63]);
      const best = [...options].sort((a, b) => {
        const score = (move: RevMove) =>
          move.flips.length + (corners.has(move.index) ? 30 : 0) +
          ([0, 7].includes(Math.floor(move.index / 8)) || [0, 7].includes(move.index % 8) ? 5 : 0);
        return score(b) - score(a);
      })[0];
      const next = applyReversiMove(board, best, 2);
      setBoard(next);
      finishOrAdvance(next, 1);
    }, 620);
    return () => window.clearTimeout(timer);
  }, [board, finished, turn]);

  const reset = () => {
    setBoard(newReversiBoard());
    setTurn(1);
    setFinished(false);
    setMessage("내 차례");
  };

  const resultText = finished
    ? black === white ? "무승부예요" : black > white ? "승리했어요!" : "AI가 승리했어요"
    : message;

  return (
    <main className="game-shell reversi-shell">
      <ExtraTopbar title="리버시" onExit={onExit} />
      <section className="game-content">
        <InfoPanel
          eyebrow="FLIP THE BOARD"
          title={<>판의 흐름을<br />뒤집으세요</>}
          description="내 돌 사이에 상대 돌을 가두면 모두 내 색으로 뒤집힙니다."
        >
          <SimpleScore player={black} ai={white} turn={turn} label="STONES" />
        </InfoPanel>
        <div className="board-panel">
          <GameLearningTools game="리버시" theme="reversi" rules={REVERSI_RULES} tutorial={REVERSI_TUTORIAL} />
          <div className="board-status" role="status">
            <span className={`turn-stone ${turn === 1 ? "black" : "white"}`} />
            <strong>{resultText}</strong>
            <span>{finished ? `최종 ${black} : ${white}` : turn === 1 ? `${moves.length}곳에 둘 수 있어요` : "잠시만 기다려 주세요"}</span>
          </div>
          <div className="reversi-board" role="grid" aria-label="8 곱하기 8 리버시 판">
            {board.map((stone, index) => {
              const legal = turn === 1 && moves.some((move) => move.index === index);
              return (
                <button
                  key={index}
                  onClick={() => play(index)}
                  className={legal ? "legal" : ""}
                  disabled={!legal || finished}
                  aria-label={`${Math.floor(index / 8) + 1}행 ${(index % 8) + 1}열${stone === 1 ? " 흑돌" : stone === 2 ? " 백돌" : legal ? " 착수 가능" : ""}`}
                  role="gridcell"
                >
                  {stone !== 0 && <span className={`rev-stone ${stone === 1 ? "black" : "white"}`} />}
                </button>
              );
            })}
          </div>
          <div className="game-actions">
            <button className="text-action" onClick={reset}>↻ 새 게임</button>
            <span className="game-hint">점으로 표시된 칸에 둘 수 있습니다</span>
            {finished && <button className="primary-action" onClick={reset}>다시 플레이</button>}
          </div>
        </div>
      </section>
    </main>
  );
}

/* Mancala */
type KalahResult = { pits: number[]; extra: boolean; finished: boolean };

const MANCALA_RULES: LearningItem[] = [
  { title: "내 영역", body: "아래쪽 여섯 구덩이와 오른쪽 큰 창고가 내 영역입니다. 각 구덩이는 돌 4개로 시작합니다." },
  { title: "돌 뿌리기", body: "내 구덩이 하나를 골라 모든 돌을 꺼낸 뒤 반시계 방향으로 한 개씩 나눠 놓습니다." },
  { title: "상대 창고 건너뛰기", body: "돌을 나눌 때 내 창고에는 넣지만 AI의 창고는 건너뜁니다." },
  { title: "추가 턴과 잡기", body: "마지막 돌이 내 창고에 들어가면 한 번 더 둡니다. 내 빈 구덩이에 끝나면 맞은편 돌을 함께 잡습니다." },
  { title: "승리", body: "어느 한쪽 여섯 구덩이가 모두 비면 남은 돌을 각자 창고로 옮기고, 더 많은 돌을 모은 쪽이 이깁니다." },
];

const MANCALA_TUTORIAL: TutorialStep[] = [
  { visual: "AI  ○ ○ ○ ○ ○ ○\n내  ● ● ● ● ● ●  ▐", title: "아래쪽이 내 구덩이", body: "아래 여섯 구덩이 중 하나를 선택합니다. 오른쪽의 긴 구덩이는 내 창고입니다.", note: "숫자는 각 구덩이에 들어 있는 돌의 개수예요." },
  { visual: "④  →  ① ① ① ①", title: "한 알씩 반시계 방향으로", body: "선택한 구덩이의 돌을 모두 꺼내 다음 칸부터 하나씩 놓습니다.", note: "AI 창고는 건너뛰고 계속 나눕니다." },
  { visual: "●  ●  ●  →  ▐ +1턴", title: "내 창고에서 끝내기", body: "마지막 돌이 오른쪽 내 창고에 들어가면 AI에게 넘기지 않고 한 번 더 둡니다.", note: "추가 턴을 만들 수 있는 구덩이를 먼저 찾아보세요." },
  { visual: "빈칸 ●  ⇄  ●●●", title: "맞은편 돌 잡기", body: "마지막 돌이 비어 있던 내 구덩이에 놓이면 맞은편 AI 돌과 마지막 돌을 내 창고로 가져옵니다.", note: "한쪽 구덩이가 모두 비면 게임이 끝납니다." },
];

function newMancalaBoard() {
  return [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
}

function sowMancala(current: number[], pit: number, player: 1 | 2): KalahResult {
  const pits = [...current];
  let stones = pits[pit];
  pits[pit] = 0;
  let cursor = pit;
  while (stones > 0) {
    cursor = (cursor + 1) % 14;
    if ((player === 1 && cursor === 13) || (player === 2 && cursor === 6)) continue;
    pits[cursor] += 1;
    stones -= 1;
  }
  const ownSide = player === 1 ? cursor >= 0 && cursor <= 5 : cursor >= 7 && cursor <= 12;
  if (ownSide && pits[cursor] === 1 && pits[12 - cursor] > 0) {
    const store = player === 1 ? 6 : 13;
    pits[store] += pits[12 - cursor] + 1;
    pits[cursor] = 0;
    pits[12 - cursor] = 0;
  }
  const extra = cursor === (player === 1 ? 6 : 13);
  const playerEmpty = pits.slice(0, 6).every((value) => value === 0);
  const aiEmpty = pits.slice(7, 13).every((value) => value === 0);
  const finished = playerEmpty || aiEmpty;
  if (finished) {
    pits[6] += pits.slice(0, 6).reduce((sum, value) => sum + value, 0);
    pits[13] += pits.slice(7, 13).reduce((sum, value) => sum + value, 0);
    for (let i = 0; i < 6; i += 1) pits[i] = 0;
    for (let i = 7; i < 13; i += 1) pits[i] = 0;
  }
  return { pits, extra: extra && !finished, finished };
}

export function MancalaGame({ onExit }: ExitProps) {
  const [pits, setPits] = useState(newMancalaBoard);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState("아래쪽 구덩이를 선택하세요");

  const playerMove = (pit: number) => {
    if (turn !== 1 || finished || pits[pit] === 0) return;
    const result = sowMancala(pits, pit, 1);
    setPits(result.pits);
    setFinished(result.finished);
    if (result.finished) setNotice("모든 돌을 모았습니다");
    else if (result.extra) setNotice("창고에 도착해 한 번 더!");
    else {
      setTurn(2);
      setNotice("AI가 돌을 고르는 중…");
    }
  };

  useEffect(() => {
    if (turn !== 2 || finished) return;
    const timer = window.setTimeout(() => {
      const options = [7, 8, 9, 10, 11, 12].filter((pit) => pits[pit] > 0);
      if (!options.length) return;
      const best = options
        .map((pit) => {
          const result = sowMancala(pits, pit, 2);
          const gain = result.pits[13] - pits[13];
          return { pit, score: gain * 4 + (result.extra ? 9 : 0) + Math.random() };
        })
        .sort((a, b) => b.score - a.score)[0].pit;
      const result = sowMancala(pits, best, 2);
      setPits(result.pits);
      setFinished(result.finished);
      if (result.finished) setNotice("모든 돌을 모았습니다");
      else if (result.extra) setNotice("AI가 추가 턴을 얻었어요");
      else {
        setTurn(1);
        setNotice("아래쪽 구덩이를 선택하세요");
      }
    }, 620);
    return () => window.clearTimeout(timer);
  }, [finished, pits, turn]);

  const reset = () => {
    setPits(newMancalaBoard());
    setTurn(1);
    setFinished(false);
    setNotice("아래쪽 구덩이를 선택하세요");
  };

  const result = pits[6] === pits[13] ? "무승부예요" : pits[6] > pits[13] ? "승리했어요!" : "AI가 승리했어요";

  return (
    <main className="game-shell mancala-shell">
      <ExtraTopbar title="만칼라" onExit={onExit} />
      <section className="game-content">
        <InfoPanel
          eyebrow="SOW & GATHER"
          title={<>한 알씩 나누고<br />크게 거두세요</>}
          description="내 구덩이의 돌을 반시계 방향으로 나누어 오른쪽 창고에 더 많이 모으세요."
        >
          <SimpleScore player={pits[6]} ai={pits[13]} turn={turn} label="STONES" />
        </InfoPanel>
        <div className="board-panel">
          <GameLearningTools game="만칼라" theme="mancala" rules={MANCALA_RULES} tutorial={MANCALA_TUTORIAL} />
          <div className="board-status" role="status">
            <span className="mancala-status-icon">•</span>
            <strong>{finished ? result : turn === 1 ? "내 차례" : "AI 차례"}</strong>
            <span>{finished ? `최종 ${pits[6]} : ${pits[13]}` : notice}</span>
          </div>
          <div className="mancala-board" aria-label="만칼라 보드">
            <div className="mancala-store ai-store"><small>AI 창고</small><strong>{pits[13]}</strong></div>
            <div className="mancala-pits top-pits">
              {[12, 11, 10, 9, 8, 7].map((pit) => (
                <div key={pit} className="mancala-pit" aria-label={`AI 구덩이 돌 ${pits[pit]}개`}>
                  <span>{Array.from({ length: Math.min(pits[pit], 10) }, (_, index) => <i key={index} />)}</span>
                  <b>{pits[pit]}</b>
                </div>
              ))}
            </div>
            <div className="mancala-pits bottom-pits">
              {[0, 1, 2, 3, 4, 5].map((pit) => (
                <button
                  key={pit}
                  className="mancala-pit"
                  onClick={() => playerMove(pit)}
                  disabled={turn !== 1 || pits[pit] === 0 || finished}
                  aria-label={`내 ${pit + 1}번 구덩이, 돌 ${pits[pit]}개`}
                >
                  <span>{Array.from({ length: Math.min(pits[pit], 10) }, (_, index) => <i key={index} />)}</span>
                  <b>{pits[pit]}</b>
                </button>
              ))}
            </div>
            <div className="mancala-store player-store"><small>내 창고</small><strong>{pits[6]}</strong></div>
          </div>
          <div className="game-actions">
            <button className="text-action" onClick={reset}>↻ 새 게임</button>
            <span className="game-hint">마지막 돌이 내 창고에 들어가면 추가 턴</span>
            {finished && <button className="primary-action" onClick={reset}>다시 플레이</button>}
          </div>
        </div>
      </section>
    </main>
  );
}

/* Battleship */
type Fleet = { cells: Set<number>; ships: number[][] };

const BATTLESHIP_RULES: LearningItem[] = [
  { title: "목표와 함대", body: "10×10 해역에서 상대의 함선 5척, 총 17개 선체 칸을 내 함대보다 먼저 모두 맞히면 승리합니다." },
  { title: "함선 구성", body: "함선 길이는 5칸·4칸·3칸·3칸·2칸이며, 가로나 세로로 자동 배치됩니다. 서로 겹치지는 않습니다." },
  { title: "좌표 한 칸 공격", body: "내 차례에는 상대 해역에서 아직 공격하지 않은 칸 하나를 선택합니다. 작은 점은 빗나감, 붉은 ×는 명중입니다." },
  { title: "AI 반격과 격침", body: "내 공격이 끝나면 AI도 내 해역 한 칸을 공격합니다. 한 함선의 모든 칸이 명중되면 그 함선이 공개되며 격침 수가 올라갑니다." },
  { title: "승리 조건", body: "상대 함선 5척을 모두 격침하면 즉시 승리하고, 내 함선 5척이 먼저 격침되면 패배합니다." },
];

const BATTLESHIP_TUTORIAL: TutorialStep[] = [
  { visual: "A1  A2  A3\nB1  ◉   B3\nC1  C2  C3", title: "공격할 좌표를 고르세요", body: "위쪽 상대 해역에서 아직 공격하지 않은 사각 타일 하나를 누릅니다.", note: "한 차례에는 한 좌표만 공격할 수 있습니다." },
  { visual: "빗나감   •\n명중     ×", title: "공격 결과를 확인하세요", body: "작은 점은 바다만 맞힌 것이고, 붉은 ×는 상대 함선의 선체를 맞힌 것입니다.", note: "이미 공격한 칸은 다시 선택할 수 없습니다." },
  { visual: "×  ×  □  □\n      ↑ 다음 후보", title: "명중한 방향을 추리하세요", body: "명중했다면 같은 가로 또는 세로 방향의 이웃 칸을 이어서 공격해 함선의 나머지 부분을 찾으세요.", note: "함선은 대각선으로 놓이지 않습니다." },
  { visual: "5칸  ▰▰▰▰▰\n4칸  ▰▰▰▰\n3칸  ▰▰▰\n3칸  ▰▰▰\n2칸  ▰▰", title: "다섯 척을 모두 격침하세요", body: "한 함선의 모든 칸을 맞히면 잠수함 이미지가 공개됩니다. 상대의 다섯 척을 먼저 모두 찾아내세요.", note: "상단 점수의 SUNK는 지금까지 격침한 함선 수입니다." },
];

function SeaGrid({
  fleet,
  shots,
  conceal,
  onShoot,
  disabled,
  label,
}: {
  fleet: Fleet;
  shots: Set<number>;
  conceal: boolean;
  onShoot?: (index: number) => void;
  disabled?: boolean;
  label: string;
}) {
  const visibleSubmarines = fleet.ships
    .map((ship, shipIndex) => {
      const start = ship[0];
      const end = ship[ship.length - 1];
      const horizontal = Math.floor(start / SEA_SIZE) === Math.floor(end / SEA_SIZE);
      const row = Math.min(...ship.map((cell) => Math.floor(cell / SEA_SIZE)));
      const col = Math.min(...ship.map((cell) => cell % SEA_SIZE));
      const sunk = ship.every((cell) => shots.has(cell));
      const style = {
        left: `${(col / SEA_SIZE) * 100}%`,
        top: `${(row / SEA_SIZE) * 100}%`,
        width: `${((horizontal ? ship.length : 1) / SEA_SIZE) * 100}%`,
        height: `${((horizontal ? 1 : ship.length) / SEA_SIZE) * 100}%`,
      } as CSSProperties;
      return { shipIndex, horizontal, sunk, style };
    })
    .filter((submarine) => !conceal || submarine.sunk);

  return (
    <div
      className="sea-grid"
      style={{ "--sea-size": SEA_SIZE } as CSSProperties}
      role="grid"
      aria-label={label}
    >
      {visibleSubmarines.map((submarine) => (
        <span
          key={`submarine-${submarine.shipIndex}`}
          className={`submarine-token ${submarine.horizontal ? "horizontal" : "vertical"} ${submarine.sunk ? "sunk" : ""}`}
          style={submarine.style}
          aria-hidden="true"
        >
          <img src="/submarine-sprite.png" alt="" />
        </span>
      ))}
      {Array.from({ length: SEA_SIZE * SEA_SIZE }, (_, index) => {
        const ship = fleet.cells.has(index);
        const shot = shots.has(index);
        return (
          <button
            key={index}
            onClick={() => onShoot?.(index)}
            disabled={!onShoot || disabled || shot}
            className={shot ? ship ? "hit" : "miss" : ""}
            aria-label={`${Math.floor(index / SEA_SIZE) + 1}행 ${(index % SEA_SIZE) + 1}열${!conceal && ship ? " 내 함선" : ""}${shot ? ship ? " 명중" : " 빗나감" : ""}`}
            role="gridcell"
          >
            {shot && <span>{ship ? "×" : "•"}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function BattleshipGame({ onExit }: ExitProps) {
  const [enemyFleet, setEnemyFleet] = useState<Fleet>(createFleet);
  const [playerFleet, setPlayerFleet] = useState<Fleet>(createFleet);
  const [playerShots, setPlayerShots] = useState<Set<number>>(new Set());
  const [aiShots, setAiShots] = useState<Set<number>>(new Set());
  const [turn, setTurn] = useState<1 | 2>(1);
  const [winner, setWinner] = useState<0 | 1 | 2>(0);
  const [notice, setNotice] = useState("상대 해역의 좌표를 선택하세요");

  const shoot = (index: number) => {
    if (turn !== 1 || winner || playerShots.has(index)) return;
    const shots = new Set(playerShots).add(index);
    setPlayerShots(shots);
    const hit = enemyFleet.cells.has(index);
    if (remainingShips(enemyFleet, shots) === 0) {
      setWinner(1);
      setNotice("상대 함대를 모두 격침했습니다");
    } else {
      setNotice(hit ? "명중! AI가 반격합니다" : "빗나갔어요. AI가 반격합니다");
      setTurn(2);
    }
  };

  useEffect(() => {
    if (turn !== 2 || winner) return;
    const timer = window.setTimeout(() => {
      const available = Array.from({ length: SEA_SIZE * SEA_SIZE }, (_, index) => index).filter((index) => !aiShots.has(index));
      const target = available[Math.floor(Math.random() * available.length)];
      const shots = new Set(aiShots).add(target);
      setAiShots(shots);
      const hit = playerFleet.cells.has(target);
      if (remainingShips(playerFleet, shots) === 0) {
        setWinner(2);
        setNotice("내 함대가 모두 격침되었습니다");
      } else {
        setNotice(hit ? "AI가 내 함선을 맞혔어요!" : "AI의 공격이 빗나갔어요");
        setTurn(1);
      }
    }, 720);
    return () => window.clearTimeout(timer);
  }, [aiShots, playerFleet, turn, winner]);

  const reset = () => {
    setEnemyFleet(createFleet());
    setPlayerFleet(createFleet());
    setPlayerShots(new Set());
    setAiShots(new Set());
    setTurn(1);
    setWinner(0);
    setNotice("상대 해역의 좌표를 선택하세요");
  };

  return (
    <main className="game-shell battleship-shell">
      <ExtraTopbar title="해전" onExit={onExit} />
      <section className="game-content">
        <InfoPanel
          eyebrow="FIND THE FLEET"
          title={<>보이지 않는<br />함대를 찾아라</>}
          description="10×10 해역의 좌표를 공격해 숨어 있는 다섯 척의 함선을 먼저 격침하세요."
        >
          <SimpleScore
            player={BATTLESHIP_SHIP_LENGTHS.length - remainingShips(enemyFleet, playerShots)}
            ai={BATTLESHIP_SHIP_LENGTHS.length - remainingShips(playerFleet, aiShots)}
            turn={turn}
            label="SUNK"
          />
        </InfoPanel>
        <div className="board-panel sea-panel">
          <GameLearningTools game="해전" theme="battleship" rules={BATTLESHIP_RULES} tutorial={BATTLESHIP_TUTORIAL} />
          <div className="board-status" role="status">
            <span className="sea-status-icon">⌖</span>
            <strong>{winner ? winner === 1 ? "승리했어요!" : "AI가 승리했어요" : turn === 1 ? "내 공격" : "AI의 공격"}</strong>
            <span>{notice}</span>
          </div>
          <div className="fleet-boards">
            <section>
              <header><strong>상대 해역</strong><span>남은 함선 {remainingShips(enemyFleet, playerShots)}</span></header>
              <SeaGrid fleet={enemyFleet} shots={playerShots} conceal onShoot={shoot} disabled={turn !== 1 || Boolean(winner)} label="상대 해역" />
            </section>
            <section>
              <header><strong>내 해역</strong><span>남은 함선 {remainingShips(playerFleet, aiShots)}</span></header>
              <SeaGrid fleet={playerFleet} shots={aiShots} conceal={false} label="내 해역" />
            </section>
          </div>
          <div className="game-actions fleet-actions">
            <button className="text-action" onClick={reset}>↻ 새 함대</button>
            <span className="game-hint">내 함대는 매 게임 자동으로 배치됩니다</span>
            {winner > 0 && <button className="primary-action" onClick={reset}>다시 플레이</button>}
          </div>
        </div>
      </section>
    </main>
  );
}

/* Dice duel */
function randomDie() {
  return Math.floor(Math.random() * 6) + 1;
}

const DIE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
type DiceResult = ReturnType<typeof scoreDice>;
type DicePhase = "player" | "ai" | "round-result" | "game-result";
const DICE_SCORING_RULES = [
  { name: "다섯 주사위", example: "같은 눈 5개", score: "50점" },
  { name: "라지 스트레이트", example: "연속된 눈 5개", score: "40점" },
  { name: "스몰 스트레이트", example: "연속된 눈 4개", score: "30점" },
  { name: "풀하우스", example: "같은 눈 3개 + 2개", score: "25점" },
  { name: "포카드", example: "같은 눈 4개", score: "5개 합계" },
  { name: "트리플", example: "같은 눈 3개", score: "5개 합계" },
  { name: "찬스", example: "페어·투페어·그 외", score: "5개 합계" },
];

export function DiceDuelGame({ onExit }: ExitProps) {
  const [dice, setDice] = useState([1, 2, 3, 4, 5]);
  const [held, setHeld] = useState([false, false, false, false, false]);
  const [rolls, setRolls] = useState(0);
  const [aiDice, setAiDice] = useState<number[] | null>(null);
  const [aiHeld, setAiHeld] = useState([false, false, false, false, false]);
  const [aiRolls, setAiRolls] = useState(0);
  const [round, setRound] = useState(1);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [phase, setPhase] = useState<DicePhase>("player");
  const [playerResult, setPlayerResult] = useState<DiceResult | null>(null);
  const [aiResult, setAiResult] = useState<DiceResult | null>(null);
  const [notice, setNotice] = useState("주사위를 굴려 시작하세요");
  const [showRules, setShowRules] = useState(false);
  const current = scoreDice(dice);
  const aiCurrent = aiDice ? scoreDice(aiDice) : null;
  const isPlayerTurn = phase === "player";

  useEffect(() => {
    if (!showRules) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowRules(false);
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [showRules]);

  const roll = () => {
    if (!isPlayerTurn || rolls >= 3) return;
    setDice((values) => values.map((value, index) => held[index] ? value : randomDie()));
    setRolls((value) => value + 1);
    setNotice("남길 주사위를 선택하거나 점수를 확정하세요");
  };

  const confirm = () => {
    if (!isPlayerTurn || rolls === 0) return;
    const result = scoreDice(dice);
    setPlayerScore((value) => value + result.score);
    setPlayerResult(result);
    setNotice(`내 점수는 ${result.name} · ${result.score}점입니다`);
    setPhase("ai");
  };

  useEffect(() => {
    if (phase !== "ai") return;
    let cancelled = false;
    const wait = (delay: number) => new Promise<void>((resolve) => {
      window.setTimeout(resolve, delay);
    });

    const playAiTurn = async () => {
      const finishTurn = (values: number[]) => {
        const result = scoreDice(values);
        setAiDice(values);
        setAiHeld([true, true, true, true, true]);
        setAiResult(result);
        setAiScore((value) => value + result.score);
        setPhase(round >= 5 ? "game-result" : "round-result");
        setNotice(`AI는 ${result.name} · ${result.score}점입니다`);
      };

      const stopOnCompletedCombination = async (values: number[]) => {
        if (!shouldAiStop(values)) return false;
        const result = scoreDice(values);
        setAiHeld([true, true, true, true, true]);
        setNotice(`AI가 ${result.name} 조합을 확정했습니다`);
        await wait(850);
        if (!cancelled) finishTurn(values);
        return true;
      };

      setAiDice(null);
      setAiHeld([false, false, false, false, false]);
      setAiRolls(0);
      setNotice("AI가 주사위를 준비하고 있습니다");
      await wait(550);
      if (cancelled) return;

      let values = Array.from({ length: 5 }, randomDie);
      setAiDice(values);
      setAiRolls(1);
      setNotice("AI의 첫 번째 굴림");
      await wait(900);
      if (cancelled) return;
      if (await stopOnCompletedCombination(values)) return;

      let kept = chooseAiHeld(values);
      setAiHeld(kept);
      setNotice(`AI가 ${withKoreanObject(describeAiHeld(values, kept))} 선택했습니다`);
      await wait(900);
      if (cancelled) return;

      values = values.map((die, index) => kept[index] ? die : randomDie());
      setAiDice(values);
      setAiRolls(2);
      setNotice("AI의 두 번째 굴림");
      await wait(900);
      if (cancelled) return;
      if (await stopOnCompletedCombination(values)) return;

      kept = chooseAiHeld(values);
      setAiHeld(kept);
      setNotice(`AI가 ${withKoreanObject(describeAiHeld(values, kept))} 남기고 다시 굴립니다`);
      await wait(900);
      if (cancelled) return;

      values = values.map((die, index) => kept[index] ? die : randomDie());
      setAiDice(values);
      setAiHeld([true, true, true, true, true]);
      setAiRolls(3);
      setNotice("AI의 마지막 굴림");
      await wait(900);
      if (cancelled) return;

      finishTurn(values);
    };

    void playAiTurn();
    return () => {
      cancelled = true;
    };
  }, [phase, round]);

  const nextRound = () => {
    if (phase !== "round-result") return;
    setDice([1, 2, 3, 4, 5]);
    setHeld([false, false, false, false, false]);
    setRolls(0);
    setAiDice(null);
    setAiHeld([false, false, false, false, false]);
    setAiRolls(0);
    setPlayerResult(null);
    setAiResult(null);
    setRound((value) => value + 1);
    setPhase("player");
    setNotice("주사위를 굴려 시작하세요");
  };

  const reset = () => {
    setDice([1, 2, 3, 4, 5]);
    setHeld([false, false, false, false, false]);
    setRolls(0);
    setAiDice(null);
    setAiHeld([false, false, false, false, false]);
    setAiRolls(0);
    setRound(1);
    setPlayerScore(0);
    setAiScore(0);
    setPlayerResult(null);
    setAiResult(null);
    setPhase("player");
    setNotice("주사위를 굴려 시작하세요");
  };

  const finalText = playerScore === aiScore ? "무승부예요" : playerScore > aiScore ? "승리했어요!" : "AI가 승리했어요";
  const statusTitle = phase === "game-result"
    ? finalText
    : phase === "round-result"
      ? `${round}라운드 결과`
      : phase === "ai"
        ? `AI ${aiRolls || 1}번째 굴림`
        : rolls
          ? current.name
          : "내 차례";

  return (
    <main className="game-shell dice-shell">
      <ExtraTopbar title="주사위 대결" onExit={onExit} />
      <section className="game-content">
        <InfoPanel
          eyebrow={`ROUND ${round}/5`}
          title={<>행운은 굴리고<br />선택은 남기세요</>}
          description="세 번까지 굴릴 수 있습니다. 공식 야찌 하단 조합 점수로 대결하며 페어와 투페어는 찬스로 계산합니다."
        >
          <SimpleScore player={playerScore} ai={aiScore} turn={phase === "ai" ? 2 : 1} />
        </InfoPanel>
        <div className="board-panel dice-panel">
          <div className="dice-status-row">
            <div className="board-status" role="status">
              <span className="dice-status-icon">{round}/5</span>
              <strong>{statusTitle}</strong>
              <span>{phase === "game-result" ? `최종 점수 나 ${playerScore} : ${aiScore} AI` : notice}</span>
            </div>
            <button
              className="dice-rules-toggle"
              onClick={() => setShowRules((visible) => !visible)}
              aria-expanded={showRules}
              aria-controls="dice-scoring-layer"
            >
              <span aria-hidden="true">ⓘ</span>
              점수 규칙
            </button>
          </div>
          <div className="dice-table">
            <section className={`dice-contestant ai ${phase === "ai" ? "active" : ""} ${phase === "player" ? "waiting" : ""}`}>
              <header className="dice-contestant-head">
                <strong>AI 주사위</strong>
                <span>{aiRolls ? `${aiRolls} / 3번째 굴림` : phase === "ai" ? "준비 중" : "대기"}</span>
              </header>
              <div className="dice-row ai-dice-row" aria-label="AI 주사위">
                {(aiDice ?? [0, 0, 0, 0, 0]).map((die, index) => (
                  <button
                    key={index}
                    className={aiHeld[index] ? "held" : ""}
                    disabled
                    aria-label={die ? `AI의 ${die} 주사위${aiHeld[index] ? ", 선택됨" : ""}` : "아직 굴리지 않은 AI 주사위"}
                  >
                    <span>{die ? DIE_FACES[die] : "?"}</span>
                    <small>{aiHeld[index] ? "KEEP" : aiRolls ? "ROLL" : "WAIT"}</small>
                  </button>
                ))}
              </div>
              <div className="combination-card">
                <span>AI 조합</span><strong>{aiCurrent ? aiCurrent.name : "—"}</strong><b>{aiCurrent ? aiCurrent.score : 0}점</b>
              </div>
            </section>

            <div className="dice-versus" aria-hidden="true"><span>VS</span></div>

            <section className={`dice-contestant ${isPlayerTurn ? "active" : ""}`}>
              <header className="dice-contestant-head">
                <strong>나의 주사위</strong>
                <span>{rolls ? `${rolls} / 3번째 굴림` : "굴리기 전"}</span>
              </header>
              <div className="dice-row" aria-label="내 주사위">
                {dice.map((die, index) => (
                  <button
                    key={index}
                    className={held[index] ? "held" : ""}
                    onClick={() => setHeld((values) => values.map((value, i) => i === index ? !value : value))}
                    disabled={!isPlayerTurn || rolls === 0}
                    aria-label={`${die} 주사위${held[index] ? ", 고정됨" : ""}`}
                  >
                    <span>{DIE_FACES[die]}</span>
                    <small>{held[index] ? "KEEP" : "HOLD"}</small>
                  </button>
                ))}
              </div>
              <div className="combination-card">
                <span>나의 조합</span><strong>{rolls ? current.name : "—"}</strong><b>{rolls ? current.score : 0}점</b>
              </div>
            </section>

            {(phase === "round-result" || phase === "game-result") && playerResult && aiResult && (
              <div className="dice-result-card" aria-live="polite">
                <span>{phase === "game-result" ? "최종 결과" : `${round}라운드 비교`}</span>
                <div>
                  <p><small>나</small><strong>{phase === "game-result" ? playerScore : playerResult.score}점</strong></p>
                  <b>{phase === "game-result" ? finalText : playerResult.score === aiResult.score ? "무승부" : playerResult.score > aiResult.score ? "라운드 승리" : "AI 라운드 승리"}</b>
                  <p><small>AI</small><strong>{phase === "game-result" ? aiScore : aiResult.score}점</strong></p>
                </div>
              </div>
            )}

            <div className="dice-controls">
              {isPlayerTurn ? (
                <>
                  <button className="roll-button" onClick={roll} disabled={rolls >= 3}>
                    <span className="roll-die-icon" aria-hidden="true">
                      <i /><i /><i />
                    </span>
                    {rolls === 0 ? "주사위 굴리기" : `다시 굴리기 · ${3 - rolls}회 남음`}
                  </button>
                  <button className="score-button" onClick={confirm} disabled={rolls === 0}>점수 확정</button>
                </>
              ) : phase === "round-result" ? (
                <button className="score-button dice-next-button" onClick={nextRound}>다음 라운드</button>
              ) : phase === "game-result" ? (
                <button className="score-button dice-next-button" onClick={reset}>다음 게임</button>
              ) : (
                <button className="roll-button dice-next-button" disabled>AI가 선택하고 있습니다…</button>
              )}
            </div>
          </div>
          <div className="game-actions dice-actions">
            <span className="game-hint">페어·투페어는 찬스 합계 · 풀하우스 25점 · 스트레이트 30/40점</span>
          </div>
        </div>
      </section>
      {showRules && (
        <div
          className="dice-rules-layer"
          id="dice-scoring-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dice-rules-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowRules(false);
          }}
        >
          <div className="dice-rules-card">
            <header>
              <div>
                <span>SCORING GUIDE</span>
                <h2 id="dice-rules-title">주사위 조합 점수</h2>
              </div>
              <button onClick={() => setShowRules(false)} aria-label="점수 규칙 닫기" autoFocus>×</button>
            </header>
            <p>공식 야찌 하단 조합 점수를 사용하는 5라운드 자동 채점 방식입니다.</p>
            <div className="dice-rules-list">
              {DICE_SCORING_RULES.map((item) => (
                <div key={item.name}>
                  <span><strong>{item.name}</strong><small>{item.example}</small></span>
                  <b>{item.score}</b>
                </div>
              ))}
            </div>
            <aside>
              <strong>페어와 투페어는?</strong>
              <span>별도 득점 조합이 아니므로 찬스로 계산해 주사위 5개의 눈을 모두 더합니다.</span>
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}

/* Checkers */
type Checker = 0 | 1 | 2 | 3 | 4;
type CheckerMove = { from: number; to: number; capture?: number };

const CHECKERS_RULES: LearningItem[] = [
  { title: "내 말과 이동", body: "플레이어는 산호색 말입니다. 어두운 칸 위에서 앞쪽 대각선으로 한 칸 이동합니다." },
  { title: "말 잡기", body: "대각선 앞의 상대 말 너머가 비어 있으면 뛰어넘어 잡습니다. 잡을 수 있을 때는 반드시 잡아야 합니다." },
  { title: "연속 점프", body: "잡은 뒤 같은 말로 다시 잡을 수 있으면 한 차례에 계속 점프합니다. 단, 일반 말이 끝줄에 도착해 킹이 되면 그 차례는 즉시 끝납니다." },
  { title: "킹", body: "상대편 끝줄에 도착한 말은 별이 표시된 킹이 되며 앞뒤 양방향으로 움직일 수 있습니다." },
  { title: "승리", body: "상대 말을 모두 잡거나 상대가 움직일 수 없게 만들면 승리합니다." },
];

const CHECKERS_TUTORIAL: TutorialStep[] = [
  { visual: "◆  ↖  ↗", title: "산호색 말을 선택", body: "내 말은 판 아래쪽에서 시작하며 앞쪽 대각선의 어두운 칸으로 움직입니다.", note: "밝은 칸에는 말이 이동하지 않습니다." },
  { visual: "◆  →  ·", title: "표시된 목적지로 이동", body: "움직일 말을 누르면 갈 수 있는 칸에 작은 점이 표시됩니다. 원하는 점을 누르세요.", note: "다른 내 말을 누르면 선택을 바꿀 수 있어요." },
  { visual: "◆  ◇  ·  →  ◆", title: "상대 말을 뛰어넘어 잡기", body: "상대 말 바로 너머의 빈칸으로 점프하면 그 말을 잡습니다. 가능한 점프가 있으면 일반 이동은 할 수 없습니다.", note: "이어 잡을 수 있으면 같은 말로 연속 점프합니다." },
  { visual: "◆  →  ★", title: "끝줄에서 킹 되기", body: "상대편 끝줄에 닿으면 킹이 되어 앞뒤로 이동합니다. 상대의 모든 움직임을 막아 승리하세요.", note: "킹은 이동 범위가 아니라 이동 방향이 늘어납니다." },
];

function newCheckersBoard(): Checker[] {
  return Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    if ((row + col) % 2 === 0) return 0;
    if (row < 3) return 2;
    if (row > 4) return 1;
    return 0;
  }) as Checker[];
}

export function CheckersGame({ onExit }: ExitProps) {
  const [board, setBoard] = useState<Checker[]>(newCheckersBoard);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [winner, setWinner] = useState<0 | 1 | 2>(0);
  const [chainFrom, setChainFrom] = useState<number | null>(null);
  const playerMoves = useMemo(() => checkerMoves(board, 1, chainFrom ?? undefined), [board, chainFrom]);
  const playerCount = board.filter((piece) => checkerOwner(piece) === 1).length;
  const aiCount = board.filter((piece) => checkerOwner(piece) === 2).length;

  const selectOrMove = (index: number) => {
    if (turn !== 1 || winner) return;
    const owner = checkerOwner(board[index]);
    if (owner === 1 && chainFrom === null) {
      setSelected(index);
      return;
    }
    if (selected === null) return;
    const move = playerMoves.find((candidate) => candidate.from === selected && candidate.to === index);
    if (!move) {
      if (chainFrom === null) setSelected(null);
      return;
    }
    const result = applyCheckerMove(board, move);
    const next = result.board as Checker[];
    setBoard(next);
    if (move.capture !== undefined && !result.crowned) {
      const further = checkerMoves(next, 1, move.to).filter((candidate) => candidate.capture !== undefined);
      if (further.length) {
        setSelected(move.to);
        setChainFrom(move.to);
        return;
      }
    }
    setSelected(null);
    setChainFrom(null);
    const outcome = checkersWinner(next);
    if (outcome) setWinner(outcome);
    else setTurn(2);
  };

  useEffect(() => {
    if (turn !== 2 || winner) return;
    const timer = window.setTimeout(() => {
      let next = [...board];
      const options = checkerMoves(next, 2);
      if (!options.length) {
        setWinner(1);
        return;
      }
      let move = [...options].sort((a, b) => {
        const value = (candidate: CheckerMove) =>
          (candidate.capture !== undefined ? 20 : 0) +
          (next[candidate.from] === 4 ? 3 : 0) +
          (Math.floor(candidate.to / 8) === 7 ? 8 : 0) + Math.random();
        return value(b) - value(a);
      })[0];
      let result = applyCheckerMove(next, move);
      next = result.board as Checker[];
      while (move.capture !== undefined && !result.crowned) {
        const more = checkerMoves(next, 2, move.to).filter((candidate) => candidate.capture !== undefined);
        if (!more.length) break;
        move = more[Math.floor(Math.random() * more.length)];
        result = applyCheckerMove(next, move);
        next = result.board as Checker[];
      }
      setBoard(next);
      const outcome = checkersWinner(next);
      if (outcome) setWinner(outcome);
      else setTurn(1);
    }, 680);
    return () => window.clearTimeout(timer);
  }, [board, turn, winner]);

  const reset = () => {
    setBoard(newCheckersBoard());
    setTurn(1);
    setSelected(null);
    setWinner(0);
    setChainFrom(null);
  };

  const destinations = new Set(selected === null ? [] : playerMoves.filter((move) => move.from === selected).map((move) => move.to));
  const mustCapture = playerMoves.some((move) => move.capture !== undefined);

  return (
    <main className="game-shell checkers-shell">
      <ExtraTopbar title="체커" onExit={onExit} />
      <section className="game-content">
        <InfoPanel
          eyebrow="JUMP AHEAD"
          title={<>대각선 한 수로<br />길을 여세요</>}
          description="대각선으로 전진하고 상대 말을 뛰어넘어 잡으세요. 끝에 도착하면 킹이 됩니다."
        >
          <SimpleScore player={playerCount} ai={aiCount} turn={turn} label="PIECES" />
        </InfoPanel>
        <div className="board-panel">
          <GameLearningTools game="체커" theme="checkers" rules={CHECKERS_RULES} tutorial={CHECKERS_TUTORIAL} />
          <div className="board-status" role="status">
            <span className="checker-status-icon">◆</span>
            <strong>{winner ? winner === 1 ? "승리했어요!" : "AI가 승리했어요" : turn === 1 ? chainFrom !== null ? "연속 점프!" : "내 차례" : "AI가 생각 중…"}</strong>
            <span>{winner ? `남은 말 ${playerCount} : ${aiCount}` : mustCapture ? "잡을 수 있는 말이 있어요" : "움직일 말을 선택하세요"}</span>
          </div>
          <div className="checkers-board" role="grid" aria-label="8 곱하기 8 체커 판">
            {board.map((piece, index) => {
              const dark = (Math.floor(index / 8) + index % 8) % 2 === 1;
              const selectable = turn === 1 && checkerOwner(piece) === 1 && playerMoves.some((move) => move.from === index);
              return (
                <button
                  key={index}
                  className={`${dark ? "dark" : "light"} ${selected === index ? "selected" : ""} ${destinations.has(index) ? "destination" : ""}`}
                  onClick={() => selectOrMove(index)}
                  disabled={!dark || turn !== 1 || Boolean(winner) || (!selectable && !destinations.has(index))}
                  role="gridcell"
                  aria-label={`${Math.floor(index / 8) + 1}행 ${(index % 8) + 1}열${piece ? checkerOwner(piece) === 1 ? " 내 말" : " AI 말" : destinations.has(index) ? " 이동 가능" : ""}`}
                >
                  {piece !== 0 && (
                    <span className={`checker-piece ${checkerOwner(piece) === 1 ? "player" : "ai"} ${piece >= 3 ? "king" : ""}`}>
                      {piece >= 3 && <b>★</b>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="game-actions">
            <button className="text-action" onClick={reset}>↻ 새 게임</button>
            <span className="game-hint">점프할 수 있을 때는 반드시 상대 말을 잡습니다</span>
            {winner > 0 && <button className="primary-action" onClick={reset}>다시 플레이</button>}
          </div>
        </div>
      </section>
    </main>
  );
}
