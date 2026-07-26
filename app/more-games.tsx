"use client";

import { useEffect, useMemo, useState } from "react";

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
        <div><span>PLAYROOM</span><strong>{title}</strong></div>
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

/* Reversi */
type RevStone = 0 | 1 | 2;
type RevMove = { index: number; flips: number[] };
const REV_DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
] as const;

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
const SEA_SIZE = 8;

function createFleet(): Fleet {
  const cells = new Set<number>();
  const ships: number[][] = [];
  for (const length of [3, 2, 2]) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() > 0.5;
      const row = Math.floor(Math.random() * (horizontal ? SEA_SIZE : SEA_SIZE - length + 1));
      const col = Math.floor(Math.random() * (horizontal ? SEA_SIZE - length + 1 : SEA_SIZE));
      const ship = Array.from({ length }, (_, offset) =>
        (row + (horizontal ? 0 : offset)) * SEA_SIZE + col + (horizontal ? offset : 0),
      );
      if (ship.every((cell) => !cells.has(cell))) {
        ship.forEach((cell) => cells.add(cell));
        ships.push(ship);
        placed = true;
      }
    }
  }
  return { cells, ships };
}

function remainingShips(fleet: Fleet, shots: Set<number>) {
  return fleet.ships.filter((ship) => !ship.every((cell) => shots.has(cell))).length;
}

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
  return (
    <div className="sea-grid" role="grid" aria-label={label}>
      {Array.from({ length: 64 }, (_, index) => {
        const ship = fleet.cells.has(index);
        const shot = shots.has(index);
        return (
          <button
            key={index}
            onClick={() => onShoot?.(index)}
            disabled={!onShoot || disabled || shot}
            className={`${!conceal && ship ? "ship" : ""} ${shot ? ship ? "hit" : "miss" : ""}`}
            aria-label={`${Math.floor(index / 8) + 1}행 ${(index % 8) + 1}열${shot ? ship ? " 명중" : " 빗나감" : ""}`}
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
      const available = Array.from({ length: 64 }, (_, index) => index).filter((index) => !aiShots.has(index));
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
          description="상대 해역의 좌표를 공격해 숨어 있는 세 척의 함선을 먼저 격침하세요."
        >
          <SimpleScore
            player={3 - remainingShips(enemyFleet, playerShots)}
            ai={3 - remainingShips(playerFleet, aiShots)}
            turn={turn}
            label="SUNK"
          />
        </InfoPanel>
        <div className="board-panel sea-panel">
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

function scoreDice(dice: number[]) {
  const counts = Object.values(dice.reduce<Record<number, number>>((map, die) => {
    map[die] = (map[die] ?? 0) + 1;
    return map;
  }, {})).sort((a, b) => b - a);
  const unique = [...new Set(dice)].sort((a, b) => a - b).join("");
  const sum = dice.reduce((total, die) => total + die, 0);
  if (counts[0] === 5) return { score: 50, name: "다섯 주사위!" };
  if (unique === "12345" || unique === "23456") return { score: 40, name: "라지 스트레이트" };
  if (counts[0] === 4) return { score: 30 + sum, name: "포카드" };
  if (counts[0] === 3 && counts[1] === 2) return { score: 25, name: "풀하우스" };
  if (unique.includes("1234") || unique.includes("2345") || unique.includes("3456")) return { score: 30, name: "스몰 스트레이트" };
  if (counts[0] === 3) return { score: 20 + sum, name: "트리플" };
  if (counts[0] === 2) return { score: 10 + sum, name: "페어" };
  return { score: sum, name: "찬스" };
}

function aiDiceTurn() {
  let dice = Array.from({ length: 5 }, randomDie);
  for (let roll = 1; roll < 3; roll += 1) {
    const counts = dice.reduce<Record<number, number>>((map, die) => {
      map[die] = (map[die] ?? 0) + 1;
      return map;
    }, {});
    const target = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
    dice = dice.map((die) => die === target ? die : randomDie());
  }
  return dice;
}

const DIE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function DiceDuelGame({ onExit }: ExitProps) {
  const [dice, setDice] = useState([1, 2, 3, 4, 5]);
  const [held, setHeld] = useState([false, false, false, false, false]);
  const [rolls, setRolls] = useState(0);
  const [round, setRound] = useState(1);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState("주사위를 굴려 시작하세요");
  const current = scoreDice(dice);

  const roll = () => {
    if (turn !== 1 || rolls >= 3 || finished) return;
    setDice((values) => values.map((value, index) => held[index] ? value : randomDie()));
    setRolls((value) => value + 1);
    setNotice("남길 주사위를 선택하거나 점수를 확정하세요");
  };

  const confirm = () => {
    if (turn !== 1 || rolls === 0 || finished) return;
    const result = scoreDice(dice);
    setPlayerScore((value) => value + result.score);
    setNotice(`${result.name} · ${result.score}점`);
    setTurn(2);
  };

  useEffect(() => {
    if (turn !== 2 || finished) return;
    const timer = window.setTimeout(() => {
      const aiDice = aiDiceTurn();
      const result = scoreDice(aiDice);
      setAiScore((value) => value + result.score);
      if (round >= 5) {
        setFinished(true);
        setNotice(`AI는 ${result.name}으로 ${result.score}점`);
      } else {
        setRound((value) => value + 1);
        setDice([1, 2, 3, 4, 5]);
        setHeld([false, false, false, false, false]);
        setRolls(0);
        setTurn(1);
        setNotice(`AI는 ${result.score}점 · 다음 라운드!`);
      }
    }, 820);
    return () => window.clearTimeout(timer);
  }, [finished, round, turn]);

  const reset = () => {
    setDice([1, 2, 3, 4, 5]);
    setHeld([false, false, false, false, false]);
    setRolls(0);
    setRound(1);
    setPlayerScore(0);
    setAiScore(0);
    setTurn(1);
    setFinished(false);
    setNotice("주사위를 굴려 시작하세요");
  };

  const finalText = playerScore === aiScore ? "무승부예요" : playerScore > aiScore ? "승리했어요!" : "AI가 승리했어요";

  return (
    <main className="game-shell dice-shell">
      <ExtraTopbar title="주사위 대결" onExit={onExit} />
      <section className="game-content">
        <InfoPanel
          eyebrow={`ROUND ${round} / 5`}
          title={<>행운은 굴리고<br />선택은 남기세요</>}
          description="세 번까지 굴릴 수 있습니다. 좋은 주사위를 고정해 최고의 조합을 만드세요."
        >
          <SimpleScore player={playerScore} ai={aiScore} turn={turn} />
        </InfoPanel>
        <div className="board-panel dice-panel">
          <div className="board-status" role="status">
            <span className="dice-status-icon">{round}</span>
            <strong>{finished ? finalText : turn === 1 ? rolls ? current.name : "내 차례" : "AI가 굴리는 중…"}</strong>
            <span>{finished ? `최종 ${playerScore} : ${aiScore}` : notice}</span>
          </div>
          <div className="dice-table">
            <div className="dice-row" aria-label="내 주사위">
              {dice.map((die, index) => (
                <button
                  key={index}
                  className={held[index] ? "held" : ""}
                  onClick={() => setHeld((values) => values.map((value, i) => i === index ? !value : value))}
                  disabled={turn !== 1 || rolls === 0 || finished}
                  aria-label={`${die} 주사위${held[index] ? ", 고정됨" : ""}`}
                >
                  <span>{DIE_FACES[die]}</span>
                  <small>{held[index] ? "KEEP" : "HOLD"}</small>
                </button>
              ))}
            </div>
            <div className="combination-card">
              <span>현재 조합</span><strong>{rolls ? current.name : "—"}</strong><b>{rolls ? current.score : 0}점</b>
            </div>
            <div className="dice-controls">
              <button className="roll-button" onClick={roll} disabled={turn !== 1 || rolls >= 3 || finished}>
                {rolls === 0 ? "주사위 굴리기" : `다시 굴리기 · ${3 - rolls}회 남음`}
              </button>
              <button className="score-button" onClick={confirm} disabled={turn !== 1 || rolls === 0 || finished}>점수 확정</button>
            </div>
          </div>
          <div className="game-actions dice-actions">
            <button className="text-action" onClick={reset}>↻ 새 게임</button>
            <span className="game-hint">다섯 주사위는 50점, 스트레이트는 40점</span>
            {finished && <button className="primary-action" onClick={reset}>다시 플레이</button>}
          </div>
        </div>
      </section>
    </main>
  );
}

/* Checkers */
type Checker = 0 | 1 | 2 | 3 | 4;
type CheckerMove = { from: number; to: number; capture?: number };

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

function checkerOwner(piece: Checker): 0 | 1 | 2 {
  if (piece === 1 || piece === 3) return 1;
  if (piece === 2 || piece === 4) return 2;
  return 0;
}

function checkerMoves(board: Checker[], player: 1 | 2, onlyFrom?: number): CheckerMove[] {
  const captures: CheckerMove[] = [];
  const normals: CheckerMove[] = [];
  board.forEach((piece, from) => {
    if (checkerOwner(piece) !== player || (onlyFrom !== undefined && from !== onlyFrom)) return;
    const row = Math.floor(from / 8);
    const col = from % 8;
    const rows = piece >= 3 ? [-1, 1] : player === 1 ? [-1] : [1];
    for (const dr of rows) {
      for (const dc of [-1, 1]) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
        const near = r * 8 + c;
        if (board[near] === 0) {
          normals.push({ from, to: near });
        } else if (checkerOwner(board[near]) === (player === 1 ? 2 : 1)) {
          const jumpR = row + dr * 2;
          const jumpC = col + dc * 2;
          if (jumpR >= 0 && jumpR < 8 && jumpC >= 0 && jumpC < 8 && board[jumpR * 8 + jumpC] === 0) {
            captures.push({ from, to: jumpR * 8 + jumpC, capture: near });
          }
        }
      }
    }
  });
  return captures.length ? captures : normals;
}

function applyCheckerMove(board: Checker[], move: CheckerMove) {
  const next = [...board];
  let piece = next[move.from];
  next[move.from] = 0;
  if (move.capture !== undefined) next[move.capture] = 0;
  const row = Math.floor(move.to / 8);
  if (piece === 1 && row === 0) piece = 3;
  if (piece === 2 && row === 7) piece = 4;
  next[move.to] = piece;
  return next;
}

function checkersWinner(board: Checker[]): 0 | 1 | 2 {
  const playerPieces = board.filter((piece) => checkerOwner(piece) === 1).length;
  const aiPieces = board.filter((piece) => checkerOwner(piece) === 2).length;
  if (!playerPieces || !checkerMoves(board, 1).length) return 2;
  if (!aiPieces || !checkerMoves(board, 2).length) return 1;
  return 0;
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
    const next = applyCheckerMove(board, move);
    setBoard(next);
    if (move.capture !== undefined) {
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
      next = applyCheckerMove(next, move);
      while (move.capture !== undefined) {
        const more = checkerMoves(next, 2, move.to).filter((candidate) => candidate.capture !== undefined);
        if (!more.length) break;
        move = more[Math.floor(Math.random() * more.length)];
        next = applyCheckerMove(next, move);
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
