"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CasualHeader } from "./casual-games";
import {
  canPlaceTetrisPiece,
  clearTetrisLines,
  createTetrisBoard,
  lockTetrisPiece,
  shuffleTetrisBag,
  tetrisDropDelay,
  tetrisLineScore,
  tetrisPieceCells,
  tetrisShape,
} from "./tetris-engine";

type Tetromino = "I" | "J" | "L" | "O" | "S" | "T" | "Z";
type Piece = { type: Tetromino; x: number; y: number; rotation: number };
type GameStatus = "ready" | "playing" | "paused" | "over";

const spawnPiece = (type: Tetromino): Piece => ({ type, x: 3, y: 0, rotation: 0 });

export function TetrisGame({ onExit }: { onExit: () => void }) {
  const bagRef = useRef<Tetromino[]>([]);
  const drawType = () => {
    if (!bagRef.current.length) bagRef.current = shuffleTetrisBag() as Tetromino[];
    return bagRef.current.pop()!;
  };
  const firstTypeRef = useRef<Tetromino | null>(null);
  if (!firstTypeRef.current) firstTypeRef.current = drawType();

  const [board, setBoard] = useState<(Tetromino | null)[][]>(() => createTetrisBoard());
  const [piece, setPiece] = useState<Piece>(() => spawnPiece(firstTypeRef.current!));
  const [nextType, setNextType] = useState<Tetromino>(() => drawType());
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [best, setBest] = useState(0);
  const level = Math.floor(lines / 10) + 1;

  useEffect(() => {
    setBest(Number(window.localStorage.getItem("paperoid-tetris-best") ?? 0));
  }, []);

  useEffect(() => {
    if (score <= best) return;
    setBest(score);
    window.localStorage.setItem("paperoid-tetris-best", String(score));
  }, [best, score]);

  const finishLock = useCallback((lockedPiece: Piece) => {
    const locked = lockTetrisPiece(board, lockedPiece);
    const result = clearTetrisLines(locked);
    const nextLines = lines + result.cleared;
    const upcoming = spawnPiece(nextType);
    setBoard(result.board);
    setLines(nextLines);
    setScore((value) => value + tetrisLineScore(result.cleared, level));
    setNextType(drawType());
    if (!canPlaceTetrisPiece(result.board, upcoming)) {
      setStatus("over");
      return;
    }
    setPiece(upcoming);
  }, [board, level, lines, nextType]);

  const softDrop = useCallback((manual = false) => {
    if (status !== "playing") return;
    const next = { ...piece, y: piece.y + 1 };
    if (canPlaceTetrisPiece(board, next)) {
      setPiece(next);
      if (manual) setScore((value) => value + 1);
      return;
    }
    finishLock(piece);
  }, [board, finishLock, piece, status]);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setTimeout(() => softDrop(false), tetrisDropDelay(level));
    return () => window.clearTimeout(timer);
  }, [level, piece, softDrop, status]);

  const moveHorizontal = useCallback((delta: number) => {
    if (status !== "playing") return;
    const next = { ...piece, x: piece.x + delta };
    if (canPlaceTetrisPiece(board, next)) setPiece(next);
  }, [board, piece, status]);

  const rotate = useCallback(() => {
    if (status !== "playing") return;
    const rotation = (piece.rotation + 1) % 4;
    for (const offset of [0, -1, 1, -2, 2]) {
      const next = { ...piece, x: piece.x + offset, rotation };
      if (canPlaceTetrisPiece(board, next)) { setPiece(next); return; }
    }
  }, [board, piece, status]);

  const hardDrop = useCallback(() => {
    if (status !== "playing") return;
    let dropped = piece;
    let distance = 0;
    while (canPlaceTetrisPiece(board, { ...dropped, y: dropped.y + 1 })) {
      dropped = { ...dropped, y: dropped.y + 1 };
      distance += 1;
    }
    setScore((value) => value + distance * 2);
    finishLock(dropped);
  }, [board, finishLock, piece, status]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space", "KeyP"].includes(event.code)) event.preventDefault();
      if (event.code === "ArrowLeft") moveHorizontal(-1);
      if (event.code === "ArrowRight") moveHorizontal(1);
      if (event.code === "ArrowDown") softDrop(true);
      if (event.code === "ArrowUp") rotate();
      if (event.code === "Space") hardDrop();
      if (event.code === "KeyP") setStatus((current) => current === "playing" ? "paused" : current === "paused" ? "playing" : current);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [hardDrop, moveHorizontal, rotate, softDrop]);

  const restart = () => {
    bagRef.current = shuffleTetrisBag() as Tetromino[];
    const first = drawType();
    setBoard(createTetrisBoard());
    setPiece(spawnPiece(first));
    setNextType(drawType());
    setScore(0);
    setLines(0);
    setStatus("playing");
  };

  const activeCells = useMemo(() => new Set(tetrisPieceCells(piece).filter(([, y]) => y >= 0).map(([x, y]) => `${x},${y}`)), [piece]);
  const ghostCells = useMemo(() => {
    let ghost = piece;
    while (canPlaceTetrisPiece(board, { ...ghost, y: ghost.y + 1 })) ghost = { ...ghost, y: ghost.y + 1 };
    return new Set(tetrisPieceCells(ghost).filter(([, y]) => y >= 0).map(([x, y]) => `${x},${y}`));
  }, [board, piece]);
  const nextCells = new Set(tetrisShape(nextType, 0).map(([x, y]) => `${x},${y}`));

  return (
    <main className="tetris-shell">
      <CasualHeader title="테트리스" icon="▦" onExit={onExit} />
      <section className="tetris-heading">
        <div><small>STACK · CLEAR · LEVEL UP</small><h1>빈틈없이 쌓아<br />가로줄을 지우세요</h1></div>
        <div className="tetris-score"><span><small>점수</small><b>{score.toLocaleString()}</b></span><span><small>최고</small><b>{best.toLocaleString()}</b></span></div>
      </section>
      <section className="tetris-game-area">
        <div className="tetris-board" role="grid" aria-label="테트리스 10열 20행 게임판">
          {board.flatMap((row, y) => row.map((cell, x) => {
            const key = `${x},${y}`;
            const active = activeCells.has(key);
            const ghost = !active && ghostCells.has(key);
            return <i key={key} className={`${active ? piece.type : cell ?? ""} ${active ? "active" : ""} ${ghost ? "ghost" : ""}`} />;
          }))}
          {status !== "playing" && <div className="tetris-overlay"><b>{status === "over" ? "게임 오버" : status === "paused" ? "일시정지" : "준비됐나요?"}</b><span>{status === "over" ? `${lines}줄을 지웠습니다` : "터치 버튼이나 방향키로 조작하세요"}</span><button type="button" onClick={status === "paused" ? () => setStatus("playing") : restart}>{status === "paused" ? "계속하기" : status === "over" ? "다시 시작" : "게임 시작"}</button></div>}
        </div>
        <aside className="tetris-side">
          <div className="tetris-next"><small>다음 블록</small><div>{Array.from({ length: 16 }, (_, index) => <i key={index} className={nextCells.has(`${index % 4},${Math.floor(index / 4)}`) ? nextType : ""} />)}</div></div>
          <dl><div><dt>레벨</dt><dd>{level}</dd></div><div><dt>라인</dt><dd>{lines}</dd></div></dl>
          <button type="button" className="tetris-pause" disabled={status === "ready" || status === "over"} onClick={() => setStatus((current) => current === "playing" ? "paused" : "playing")}>{status === "paused" ? "계속" : "일시정지"}</button>
        </aside>
      </section>
      <section className="tetris-controls" aria-label="테트리스 터치 조작">
        <button type="button" onClick={() => moveHorizontal(-1)} aria-label="왼쪽 이동">←</button>
        <button type="button" onClick={rotate} aria-label="회전">↻</button>
        <button type="button" onClick={() => moveHorizontal(1)} aria-label="오른쪽 이동">→</button>
        <button type="button" onClick={() => softDrop(true)} aria-label="한 칸 내리기">↓</button>
        <button type="button" className="hard" onClick={hardDrop} aria-label="바닥까지 내리기">내리기</button>
      </section>
    </main>
  );
}

