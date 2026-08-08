"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CasualHeader } from "./casual-games";
import {
  CHESS_FILES,
  CHESS_PIECE_LABELS,
  CHESS_PIECE_SYMBOLS,
  applyChessMove,
  chessGameStatus,
  chessLegalMoves,
  chessMoveDescription,
  chooseChessAiMove,
  createChessState,
  isChessInCheck,
} from "./chess-engine";

type Square = { x: number; y: number };
type ChessMove = { from: Square; to: Square; capture?: boolean; promotion?: boolean; castle?: string; enPassant?: boolean };
type ChessPiece = { color: "w" | "b"; type: "k" | "q" | "r" | "b" | "n" | "p"; moved?: boolean };

const cloneInitialState = () => createChessState();

export function ChessGame({ onExit }: { onExit: () => void }) {
  const [state, setState] = useState(() => cloneInitialState());
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<ChessMove | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<ChessMove | null>(null);
  const [thinking, setThinking] = useState(false);
  const [capturedByWhite, setCapturedByWhite] = useState<ChessPiece[]>([]);
  const [capturedByBlack, setCapturedByBlack] = useState<ChessPiece[]>([]);
  const [log, setLog] = useState<string[]>(["백의 첫 수를 기다립니다."]);
  const gameId = useRef(0);
  const legalMoves = useMemo(() => chessLegalMoves(state) as ChessMove[], [state]);
  const status = useMemo(() => chessGameStatus(state), [state]);
  useEffect(() => () => { gameId.current += 1; }, []);
  const selectedMoves = selected ? legalMoves.filter((move) => move.from.x === selected.x && move.from.y === selected.y) : [];
  const checkedKing = useMemo(() => {
    if (!isChessInCheck(state)) return null;
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
      const piece = state.board[y][x];
      if (piece?.color === state.turn && piece.type === "k") return { x, y };
    }
    return null;
  }, [state]);

  const capturedPieceForMove = (currentState: ReturnType<typeof createChessState>, move: ChessMove) => {
    if (move.enPassant) {
      const moving = currentState.board[move.from.y][move.from.x];
      const direction = moving.color === "w" ? -1 : 1;
      return currentState.board[move.to.y - direction][move.to.x] as ChessPiece | null;
    }
    return currentState.board[move.to.y][move.to.x] as ChessPiece | null;
  };

  const finishHumanMove = (move: ChessMove, promotion: ChessPiece["type"] = "q") => {
    const session = gameId.current;
    const captured = capturedPieceForMove(state, move);
    const description = chessMoveDescription(state, move, promotion);
    const afterHuman = applyChessMove(state, move, promotion);
    setState(afterHuman);
    setSelected(null);
    setPendingPromotion(null);
    setLastMove(move);
    setLog((current) => [`나 · ${description}`, ...current].slice(0, 8));
    if (captured) setCapturedByWhite((current) => [...current, captured]);
    if (chessGameStatus(afterHuman).phase !== "playing") return;

    setThinking(true);
    window.setTimeout(() => {
      if (gameId.current !== session) return;
      const aiMove = chooseChessAiMove(afterHuman) as ChessMove | null;
      if (!aiMove) { setThinking(false); return; }
      const aiCaptured = capturedPieceForMove(afterHuman, aiMove);
      const aiDescription = chessMoveDescription(afterHuman, aiMove);
      const afterAi = applyChessMove(afterHuman, aiMove);
      setState(afterAi);
      setLastMove(aiMove);
      setThinking(false);
      setLog((current) => [`AI · ${aiDescription}`, ...current].slice(0, 8));
      if (aiCaptured) setCapturedByBlack((current) => [...current, aiCaptured]);
    }, 520);
  };

  const chooseSquare = (x: number, y: number) => {
    if (thinking || state.turn !== "w" || status.phase !== "playing" || pendingPromotion) return;
    const piece = state.board[y][x] as ChessPiece | null;
    if (selected) {
      const move = selectedMoves.find((candidate) => candidate.to.x === x && candidate.to.y === y);
      if (move) {
        if (move.promotion) setPendingPromotion(move);
        else finishHumanMove(move);
        return;
      }
    }
    if (piece?.color === "w") setSelected(selected?.x === x && selected?.y === y ? null : { x, y });
    else setSelected(null);
  };

  const restart = () => {
    gameId.current += 1;
    setState(cloneInitialState());
    setSelected(null);
    setLastMove(null);
    setPendingPromotion(null);
    setThinking(false);
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    setLog(["새 대국 · 백의 첫 수를 기다립니다."]);
  };

  const turnTitle = status.phase === "checkmate"
    ? status.winner === "w" ? "체크메이트 · 승리했습니다" : "체크메이트 · AI가 승리했습니다"
    : status.phase === "stalemate" ? "스테일메이트 · 무승부"
      : thinking ? "AI가 수를 계산하고 있습니다"
        : status.check ? "체크 · 킹을 지켜야 합니다" : "백 · 내 차례";

  return (
    <main className="chess-shell">
      <CasualHeader title="체스" icon="♔" onExit={onExit} />
      <section className="chess-match-head">
        <div className="chess-player black"><span>♚</span><div><small>상대</small><b>AI · 흑</b></div><em>{capturedByBlack.map((piece) => CHESS_PIECE_SYMBOLS[`w${piece.type}`]).join("") || "잡은 기물 없음"}</em></div>
        <div className="chess-turn"><small>CLASSIC MATCH</small><strong>{turnTitle}</strong><span>{Math.ceil(state.fullmove)}수째</span></div>
        <div className="chess-player white"><span>♔</span><div><small>플레이어</small><b>나 · 백</b></div><em>{capturedByWhite.map((piece) => CHESS_PIECE_SYMBOLS[`b${piece.type}`]).join("") || "잡은 기물 없음"}</em></div>
      </section>
      <section className="chess-play-area">
        <div className="chess-board" role="grid" aria-label="체스판">
          {state.board.flatMap((row: (ChessPiece | null)[], y: number) => row.map((piece, x) => {
            const isSelected = selected?.x === x && selected?.y === y;
            const targetMove = selectedMoves.find((move) => move.to.x === x && move.to.y === y);
            const isLast = Boolean(lastMove && ((lastMove.from.x === x && lastMove.from.y === y) || (lastMove.to.x === x && lastMove.to.y === y)));
            const isCheck = checkedKing?.x === x && checkedKing?.y === y;
            return (
              <button key={`${x}-${y}`} type="button" role="gridcell" className={`${(x + y) % 2 ? "dark" : "light"} ${isSelected ? "selected" : ""} ${targetMove ? targetMove.capture ? "capture-target" : "move-target" : ""} ${isLast ? "last" : ""} ${isCheck ? "check" : ""}`} onClick={() => chooseSquare(x, y)} aria-label={`${CHESS_FILES[x]}${8 - y}${piece ? ` ${piece.color === "w" ? "백" : "흑"} ${CHESS_PIECE_LABELS[piece.type]}` : " 빈 칸"}`}>
                {x === 0 && <small className="rank">{8 - y}</small>}
                {y === 7 && <small className="file">{CHESS_FILES[x]}</small>}
                {piece && <span className={piece.color}>{CHESS_PIECE_SYMBOLS[`${piece.color}${piece.type}`]}</span>}
              </button>
            );
          }))}
          {thinking && <div className="chess-thinking" aria-live="polite"><i /><span>AI THINKING</span></div>}
        </div>
        <aside className="chess-side-panel">
          <div className="chess-guide-note"><b>기물을 선택하세요</b><span>이동 가능한 칸은 점으로, 잡을 수 있는 기물은 테두리로 표시됩니다.</span></div>
          <div className="chess-log"><h2>대국 기록</h2>{log.map((entry, index) => <span key={`${entry}-${index}`}>{entry}</span>)}</div>
          <button type="button" onClick={restart}>↻ 새 대국</button>
        </aside>
      </section>
      {pendingPromotion && <div className="chess-promotion-backdrop"><section className="chess-promotion" role="dialog" aria-modal="true" aria-label="폰 승격 기물 선택"><small>PROMOTION</small><h2>승격할 기물을 고르세요</h2><div>{(["q", "r", "b", "n"] as ChessPiece["type"][]).map((type) => <button key={type} type="button" onClick={() => finishHumanMove(pendingPromotion, type)}><span>{CHESS_PIECE_SYMBOLS[`w${type}`]}</span><b>{CHESS_PIECE_LABELS[type]}</b></button>)}</div></section></div>}
    </main>
  );
}
