"use client";

import { useEffect, useState } from "react";
import { SimpleGameTopbar, SimpleModeSwitch } from "./simple-game-chrome";

const BOARD_SIZE = 15;
type Stone = 0 | 1 | 2;
type GomokuResult = 0 | 1 | 2 | 3;
type GomokuRule = "exact" | "freestyle";

const newBoard = (): Stone[] => Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => 0 as Stone);

function checkWinner(board: Stone[], index: number, player: Stone, rule: GomokuRule) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r * BOARD_SIZE + c] === player) {
        count += 1;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (rule === "exact" ? count === 5 : count >= 5) return true;
  }
  return false;
}

function lineStrength(board: Stone[], index: number, player: Stone) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  let score = 0;
  for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let linked = 1;
    let open = 0;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r * BOARD_SIZE + c] === player) {
        linked += 1;
        r += dr * sign;
        c += dc * sign;
      }
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r * BOARD_SIZE + c] === 0) open += 1;
    }
    score += linked ** 3 * (open + 1);
  }
  return score;
}

function pickAiMove(board: Stone[], rule: GomokuRule) {
  if (!board.some(Boolean)) return Math.floor(BOARD_SIZE / 2) * BOARD_SIZE + 7;
  const candidates: number[] = [];
  board.forEach((value, index) => {
    if (value !== 0) return;
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    let nearby = false;
    for (let dr = -2; dr <= 2 && !nearby; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r * BOARD_SIZE + c] !== 0) {
          nearby = true;
          break;
        }
      }
    }
    if (nearby) candidates.push(index);
  });
  for (const candidate of candidates) {
    const test = [...board];
    test[candidate] = 2;
    if (checkWinner(test, candidate, 2, rule)) return candidate;
  }
  for (const candidate of candidates) {
    const test = [...board];
    test[candidate] = 1;
    if (checkWinner(test, candidate, 1, rule)) return candidate;
  }
  return candidates.map((index) => {
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    return { index, score: lineStrength(board, index, 2) * 1.1 + lineStrength(board, index, 1) + 14 - (Math.abs(7 - row) + Math.abs(7 - col)) + Math.random() * 2 };
  }).sort((a, b) => b.score - a.score)[0]?.index ?? 112;
}

export function GomokuGame({ onExit }: { onExit: () => void }) {
  const [board, setBoard] = useState<Stone[]>(newBoard);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [winner, setWinner] = useState<GomokuResult>(0);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [rule, setRule] = useState<GomokuRule | null>("freestyle");
  const [nextRule, setNextRule] = useState<GomokuRule | null>("freestyle");
  const [started, setStarted] = useState(false);

  const reset = () => {
    const selectedRule = nextRule ?? rule;
    setBoard(newBoard()); setTurn(1); setWinner(0); setLastMove(null);
    setRule(selectedRule); setNextRule(selectedRule); setRound((value) => value + 1);
  };
  const start = () => {
    if (!rule) return;
    setBoard(newBoard()); setTurn(1); setWinner(0); setLastMove(null); setRound(1); setNextRule(rule); setStarted(true);
  };
  const playAt = (index: number) => {
    if (!started || !rule || board[index] !== 0 || turn !== 1 || winner) return;
    const next = [...board]; next[index] = 1; setBoard(next); setLastMove(index);
    if (checkWinner(next, index, 1, rule)) setWinner(1);
    else if (next.every(Boolean)) setWinner(3);
    else setTurn(2);
  };

  useEffect(() => {
    if (!started || !rule || turn !== 2 || winner) return;
    const timer = window.setTimeout(() => {
      const move = pickAiMove(board, rule);
      const next = [...board]; next[move] = 2; setBoard(next); setLastMove(move);
      if (checkWinner(next, move, 2, rule)) setWinner(2);
      else if (next.every(Boolean)) setWinner(3);
      else setTurn(1);
    }, 520);
    return () => window.clearTimeout(timer);
  }, [board, rule, started, turn, winner]);

  const status = winner === 1 ? "승리했어요!" : winner === 2 ? "AI가 승리했어요" : winner === 3 ? "무승부예요" : turn === 1 ? "내 차례" : "AI가 생각 중…";
  return (
    <main className="game-shell">
      <SimpleGameTopbar title="오목" onExit={onExit} />
      <section className="game-content">
        <div className="game-info-panel">
          <div><span className="eyebrow">{started ? `ROUND ${String(round).padStart(2, "0")}` : "SELECT RULE"}</span><h1>다섯 돌을<br />먼저 이으세요</h1><p>{!started ? "대국을 시작하기 전에 장목을 인정할지 선택하세요." : rule === "exact" ? "가로, 세로, 대각선으로 정확히 다섯 개를 연결해야 승리합니다." : "가로, 세로, 대각선으로 다섯 개 이상 연결하면 승리합니다."}</p></div>
          <SimpleModeSwitch />
          <div className="versus-card"><div className={`player-side ${started && turn === 1 && !winner ? "thinking" : ""}`}><span className="avatar user-avatar">나</span><strong>플레이어</strong><small>흑돌</small></div><span className="versus">VS</span><div className={`player-side ${started && turn === 2 && !winner ? "thinking" : ""}`}><span className="avatar ai-avatar">AI</span><strong>모모</strong><small>백돌</small></div></div>
        </div>
        <div className="board-panel">
          {!started ? <div className="gomoku-setup" data-game-menu aria-labelledby="gomoku-rule-title"><span className="gomoku-setup-kicker">GAME RULES</span><h2 id="gomoku-rule-title">승리 규칙을 선택하세요</h2><p>선택한 규칙은 대국 화면에도 계속 표시됩니다.</p><div className="gomoku-rule-options" role="radiogroup" aria-label="오목 승리 규칙"><button className={rule === "exact" ? "selected" : ""} onClick={() => setRule("exact")} role="radio" aria-checked={rule === "exact"}><span className="gomoku-rule-icon">5</span><strong>정확히 5목</strong><small>6목 이상의 장목은 승리가 아닙니다</small></button><button className={rule === "freestyle" ? "selected" : ""} onClick={() => setRule("freestyle")} role="radio" aria-checked={rule === "freestyle"}><span className="gomoku-rule-icon">5+</span><strong>5목 이상</strong><small>6목 이상의 장목도 승리로 인정합니다</small></button></div><button className="gomoku-start-button" onClick={start} disabled={!rule}>{rule ? "선택한 규칙으로 시작" : "규칙을 선택해 주세요"}</button></div> : <><div className="gomoku-status-row"><div className="board-status" role="status"><span className={`turn-stone ${turn === 1 ? "black" : "white"}`} /><strong>{status}</strong><span>{winner ? "한 판 더 도전해 볼까요?" : turn === 1 ? "교차점을 선택하세요" : "잠시만 기다려 주세요"}</span></div><span className="gomoku-rule-pill">{rule === "exact" ? "정확히 5목" : "5목 이상"}</span></div><div className="gomoku-frame"><div className="gomoku-board" role="grid" aria-label={`15 곱하기 15 오목판, ${rule === "exact" ? "정확히 5목" : "5목 이상"} 규칙`}>{board.map((stone, index) => <button key={index} className={`gomoku-cell ${stone ? "placed" : ""}`} onClick={() => playAt(index)} disabled={stone !== 0 || turn !== 1 || Boolean(winner)} role="gridcell" aria-label={`${Math.floor(index / BOARD_SIZE) + 1}행 ${(index % BOARD_SIZE) + 1}열${stone === 1 ? " 흑돌" : stone === 2 ? " 백돌" : ""}`}>{stone !== 0 && <span className={`stone ${stone === 1 ? "black" : "white"} ${lastMove === index ? "last" : ""}`} />}</button>)}</div></div><div className="game-actions gomoku-actions"><button className="gomoku-rule-switch" type="button" role="switch" aria-checked={(nextRule ?? rule) === "freestyle"} aria-label={`다음 판 규칙: ${(nextRule ?? rule) === "exact" ? "정확히 5목" : "5목 이상"}. 누르면 규칙이 바뀝니다.`} onClick={() => setNextRule((current) => (current ?? rule) === "exact" ? "freestyle" : "exact")}><span className="gomoku-switch-track" aria-hidden="true"><i /></span><span className="gomoku-switch-label"><small>다음 판 규칙</small><strong>{(nextRule ?? rule) === "exact" ? "정확히 5목" : "5목 이상"}</strong></span></button>{winner ? <button className="primary-action" onClick={reset}>다시 플레이</button> : <button className="text-action" onClick={reset}>↻ 새 게임</button>}</div></>}
        </div>
      </section>
    </main>
  );
}
