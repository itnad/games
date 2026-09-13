"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PARKING_LEVELS } from "./parking-levels";

type ExitProps = { onExit: () => void };

export function CasualHeader({ title, icon, onExit }: ExitProps & { title: string; icon: string }) {
  return <header className="cg-topbar"><button onClick={onExit} aria-label="게임 목록으로">←</button><div><span className="cg-brand">paperoid</span><strong><i>{icon}</i>{title}</strong></div><button onClick={onExit}>나가기</button></header>;
}

function useBestScore(key: string, score: number, lower = false) {
  const [best, setBest] = useState(0);
  useEffect(() => { setBest(Number(window.localStorage.getItem(key) ?? 0)); }, [key]);
  useEffect(() => {
    if (score <= 0 || (best && (lower ? score >= best : score <= best))) return;
    setBest(score); window.localStorage.setItem(key, String(score));
  }, [best, key, lower, score]);
  return best;
}

function CasualStats({ score, best, label = "점수", bestLabel = "최고 기록" }: { score: number; best: number; label?: string; bestLabel?: string }) {
  return <div className="cg-stats"><span><small>{label}</small><b>{score}</b></span><span><small>{bestLabel}</small><b>{best || "—"}</b></span></div>;
}

type StackBlock = { x: number; width: number; perfect?: boolean };

export function PocketStackGame({ onExit }: ExitProps) {
  const [blocks, setBlocks] = useState<StackBlock[]>([{ x: 10, width: 80 }]);
  const [x, setX] = useState(0);
  const [running, setRunning] = useState(true);
  const [streak, setStreak] = useState(0);
  const direction = useRef(1);
  const score = blocks.length - 1;
  const best = useBestScore("paperoid-pocket-stack-best", score);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setX((value) => {
      const width = blocks.at(-1)?.width ?? 80;
      let next = value + direction.current * Math.min(2.5, 1.05 + score * .06);
      if (next <= 0 || next + width >= 100) { direction.current *= -1; next = Math.max(0, Math.min(100 - width, next)); }
      return next;
    }), 24);
    return () => window.clearInterval(timer);
  }, [blocks, running, score]);

  const place = useCallback(() => {
    if (!running) return;
    const previous = blocks.at(-1)!;
    const left = Math.max(previous.x, x);
    const right = Math.min(previous.x + previous.width, x + previous.width);
    const overlap = right - left;
    if (overlap <= 0) { setRunning(false); return; }
    const perfect = Math.abs(previous.x - x) < 1.5;
    const nextBlock = perfect ? { ...previous, perfect: true } : { x: left, width: overlap };
    setBlocks((current) => [...current, nextBlock]);
    setStreak((value) => perfect ? value + 1 : 0);
    setX(direction.current > 0 ? 0 : 100 - nextBlock.width);
  }, [blocks, running, x]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.code === "Space") { event.preventDefault(); place(); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [place]);

  const restart = () => { setBlocks([{ x: 10, width: 80 }]); setX(0); setRunning(true); setStreak(0); direction.current = 1; };
  return <main className="cg-shell stack-theme"><CasualHeader title="포켓 스택" icon="▰" onExit={onExit} /><section className="cg-head"><div><small>ONE TAP · PERFECT STACK</small><h1>흔들리는 블록을<br />정확히 쌓으세요</h1><p>화면이나 스페이스바를 눌러 블록을 놓습니다. 어긋난 부분은 잘려나갑니다.</p></div><CasualStats score={score} best={best} /></section><section className="stack-stage" onPointerDown={place} aria-label="블록 놓기 영역"><div className="stack-sky">{blocks.slice(-10).map((block, index) => <i key={index} className={block.perfect ? "perfect" : ""} style={{ left: `${block.x}%`, width: `${block.width}%`, bottom: `${index * 31 + 18}px` }} />)}{running && <i className="moving" style={{ left: `${x}%`, width: `${blocks.at(-1)!.width}%`, bottom: `${Math.min(10, blocks.length) * 31 + 18}px` }} />}</div><div className="stack-message">{running ? streak >= 2 ? `PERFECT × ${streak}` : "탭해서 놓기" : "블록이 빗나갔어요"}</div></section><button className="cg-main-button" onClick={running ? place : restart}>{running ? "블록 놓기" : "다시 쌓기"}</button></main>;
}

const CHAIN_COLORS = ["coral", "aqua", "gold", "violet", "lime"];
const makeChainBoard = (offset = 0) => Array.from({ length: 49 }, (_, index) => {
  const column = index % 7;
  const row = Math.floor(index / 7);
  return CHAIN_COLORS[(Math.floor(column / 3) + row * 2 + offset) % CHAIN_COLORS.length];
});

export function ColorChainGame({ onExit }: ExitProps) {
  const [board, setBoard] = useState(() => makeChainBoard());
  const [path, setPath] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(15);
  const [over, setOver] = useState(false);
  const best = useBestScore("paperoid-color-chain-best", score);
  const canAdd = (index: number) => {
    if (!path.length) return true;
    if (path.includes(index) || board[index] !== board[path[0]]) return false;
    const last = path.at(-1)!; return Math.abs(last % 7 - index % 7) + Math.abs(Math.floor(last / 7) - Math.floor(index / 7)) === 1;
  };
  const select = (index: number) => {
    if (over) return;
    if (path.at(-1) === index) { setPath((current) => current.slice(0, -1)); return; }
    if (canAdd(index)) setPath((current) => [...current, index]); else setPath([index]);
  };
  const remove = () => {
    if (path.length < 3) return;
    const removed = new Set(path); const remaining = board.filter((_, index) => !removed.has(index));
    const refill = Array.from({ length: path.length }, (_, index) => CHAIN_COLORS[(score + moves + index * 2) % CHAIN_COLORS.length]);
    setBoard([...refill, ...remaining]); setScore((value) => value + path.length * path.length); setPath([]);
    setMoves((value) => { if (value === 1) setOver(true); return value - 1; });
  };
  const restart = () => { setBoard(makeChainBoard(2)); setPath([]); setScore(0); setMoves(15); setOver(false); };
  return <main className="cg-shell chain-theme"><CasualHeader title="컬러 체인" icon="●" onExit={onExit} /><section className="cg-head"><div><small>CONNECT · POP · COMBO</small><h1>같은 색을 이어<br />한 번에 터뜨리세요</h1><p>상하좌우로 붙은 같은 색 점을 3개 이상 선택하세요. 길수록 제곱 점수를 얻습니다.</p></div><CasualStats score={score} best={best} /></section><section className="chain-wrap"><div className="chain-status"><b>{moves}</b>번 남음 <span>{path.length >= 3 ? `+${path.length * path.length}점` : "3개 이상 연결"}</span></div><div className="chain-board">{board.map((color, index) => <button key={index} className={`${color} ${path.includes(index) ? "selected" : ""}`} onClick={() => select(index)} aria-label={`${color} 점 ${path.includes(index) ? "선택됨" : ""}`}><i>{path.includes(index) ? path.indexOf(index) + 1 : ""}</i></button>)}</div></section><div className="cg-actions">{over ? <button className="cg-main-button" onClick={restart}>새 게임</button> : <><button onClick={() => setPath([])}>선택 취소</button><button className="cg-main-button" disabled={path.length < 3} onClick={remove}>연결 터뜨리기</button></>}</div></main>;
}

const NUMBER_VALUES = [1, 2, 4];
export function NumberDropGame({ onExit }: ExitProps) {
  const [columns, setColumns] = useState<number[][]>(() => Array.from({ length: 5 }, () => []));
  const [next, setNext] = useState(1);
  const [score, setScore] = useState(0);
  const [drops, setDrops] = useState(0);
  const [over, setOver] = useState(false);
  const best = useBestScore("paperoid-number-drop-best", score);
  const drop = (columnIndex: number) => {
    if (over) return;
    const nextColumns = columns.map((column) => [...column]); const column = nextColumns[columnIndex];
    if (column.length >= 7) { setOver(true); return; }
    column.push(next); let gained = next;
    while (column.length > 1 && column.at(-1) === column.at(-2)) { const merged = column.pop()! * 2; column.pop(); column.push(merged); gained += merged; }
    setColumns(nextColumns); setScore((value) => value + gained); setDrops((value) => value + 1);
    setNext(NUMBER_VALUES[(drops + score + columnIndex + 1) % NUMBER_VALUES.length]);
    if (nextColumns.every((item) => item.length >= 7)) setOver(true);
  };
  const restart = () => { setColumns(Array.from({ length: 5 }, () => [])); setNext(1); setScore(0); setDrops(0); setOver(false); };
  return <main className="cg-shell number-theme"><CasualHeader title="넘버 드롭" icon="2" onExit={onExit} /><section className="cg-head"><div><small>DROP · MERGE · GROW</small><h1>같은 숫자를 합쳐<br />더 큰 타일을 만드세요</h1><p>열을 눌러 숫자를 떨어뜨립니다. 위아래로 같은 숫자가 만나면 연쇄 합쳐집니다.</p></div><CasualStats score={score} best={best} /></section><section className="number-game"><div className="number-next"><small>NEXT</small><b data-value={next}>{next}</b><span>{drops}개 배치</span></div><div className="number-board">{columns.map((column, columnIndex) => <button key={columnIndex} onClick={() => drop(columnIndex)} aria-label={`${columnIndex + 1}번째 열에 ${next} 놓기`}><span className="drop-arrow">↓</span>{Array.from({ length: 7 }, (_, row) => { const value = column[6 - row]; return <i key={row} className={value ? "filled" : ""} data-value={value || 0}>{value || ""}</i>; })}</button>)}</div></section><button className="cg-main-button" onClick={over ? restart : () => drop(columns.map((column) => column.length).indexOf(Math.min(...columns.map((column) => column.length))))}>{over ? "새 게임" : "가장 낮은 열에 놓기"}</button></main>;
}

type Enemy = { id: number; x: number; y: number; speed: number };
const DOT_SURVIVOR_DRAG_RADIUS = 72;
const DOT_SURVIVOR_PLAYER_SPEED = 1.35;

export function DotSurvivorGame({ onExit }: ExitProps) {
  const [player, setPlayer] = useState({ x: 50, y: 70 });
  const playerRef = useRef(player); playerRef.current = player;
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const idRef = useRef(0);
  const elapsedRef = useRef(0);
  const dragRef = useRef({ pointerId: -1, originX: 0, originY: 0 });
  const pointerInputRef = useRef({ x: 0, y: 0 });
  const pressedKeysRef = useRef(new Set<string>());
  const seconds = Math.floor(elapsed / 1000);
  const best = useBestScore("paperoid-dot-survivor-best", seconds);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      elapsedRef.current += 60;
      setElapsed(elapsedRef.current);
      const keys = pressedKeysRef.current;
      const keyboardX = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
      const keyboardY = (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0);
      let inputX = pointerInputRef.current.x + keyboardX;
      let inputY = pointerInputRef.current.y + keyboardY;
      const inputLength = Math.hypot(inputX, inputY);
      if (inputLength > 1) { inputX /= inputLength; inputY /= inputLength; }
      const currentPlayer = playerRef.current;
      const nextPlayer = {
        x: Math.max(3, Math.min(97, currentPlayer.x + inputX * DOT_SURVIVOR_PLAYER_SPEED)),
        y: Math.max(3, Math.min(97, currentPlayer.y + inputY * DOT_SURVIVOR_PLAYER_SPEED)),
      };
      if (nextPlayer.x !== currentPlayer.x || nextPlayer.y !== currentPlayer.y) {
        playerRef.current = nextPlayer;
        setPlayer(nextPlayer);
      }
      setEnemies((current) => {
        const p = nextPlayer;
        const moved = current.map((enemy) => { const dx = p.x - enemy.x, dy = p.y - enemy.y, length = Math.hypot(dx, dy) || 1; return { ...enemy, x: enemy.x + dx / length * enemy.speed, y: enemy.y + dy / length * enemy.speed }; });
        if (moved.some((enemy) => Math.hypot(enemy.x - p.x, enemy.y - p.y) < 5)) { pointerInputRef.current = { x: 0, y: 0 }; setRunning(false); setOver(true); }
        if (moved.length < Math.min(22, 3 + Math.floor(elapsedRef.current / 2200)) && Math.random() < .25) { const side = idRef.current % 4; const position = (idRef.current * 37) % 100; moved.push({ id: idRef.current++, x: side === 0 ? 0 : side === 1 ? 100 : position, y: side === 2 ? 0 : side === 3 ? 100 : position, speed: .45 + Math.min(.65, elapsedRef.current / 35000) }); }
        return moved.filter((enemy) => enemy.x > -10 && enemy.x < 110 && enemy.y > -10 && enemy.y < 110);
      });
      if (elapsedRef.current >= 60000) { pointerInputRef.current = { x: 0, y: 0 }; setRunning(false); setOver(true); }
    }, 60);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => { if (!running || !event.key.startsWith("Arrow")) return; event.preventDefault(); pressedKeysRef.current.add(event.key); };
    const keyUp = (event: KeyboardEvent) => { pressedKeysRef.current.delete(event.key); };
    const clearKeys = () => pressedKeysRef.current.clear();
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", clearKeys);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", clearKeys); clearKeys(); };
  }, [running]);
  const pointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!running) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY };
    pointerInputRef.current = { x: 0, y: 0 };
  };
  const pointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!running || dragRef.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragRef.current.originX;
    const dy = event.clientY - dragRef.current.originY;
    const distance = Math.hypot(dx, dy);
    if (distance < 6) { pointerInputRef.current = { x: 0, y: 0 }; return; }
    const strength = Math.min(1, (distance - 6) / (DOT_SURVIVOR_DRAG_RADIUS - 6));
    pointerInputRef.current = { x: dx / distance * strength, y: dy / distance * strength };
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.pointerId = -1;
    pointerInputRef.current = { x: 0, y: 0 };
  };
  const start = () => { const initial = { x: 50, y: 70 }; setPlayer(initial); playerRef.current = initial; setEnemies([]); setElapsed(0); elapsedRef.current = 0; dragRef.current.pointerId = -1; pointerInputRef.current = { x: 0, y: 0 }; pressedKeysRef.current.clear(); setOver(false); setRunning(true); idRef.current = 0; };
  return <main className="cg-shell survivor-theme" data-game-menu={(!running && !over) || undefined}><CasualHeader title="도트 서바이버" icon="◎" onExit={onExit} /><section className="cg-head"><div><small>ONE FINGER · 60 SECONDS</small><h1>몰려오는 점을 피해<br />끝까지 살아남으세요</h1><p>화면 아무 곳을 누른 뒤 이동할 방향으로 끌어보세요. 손을 떼면 멈추며, 한 번의 터치로 순간이동하지 않습니다.</p></div><CasualStats score={seconds} best={best} label="생존 시간" bestLabel="최장 시간" /></section><section className="survivor-arena" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}><div className="survivor-grid" /><i className="survivor-player" style={{ left: `${player.x}%`, top: `${player.y}%` }} />{enemies.map((enemy) => <i key={enemy.id} className="survivor-enemy" style={{ left: `${enemy.x}%`, top: `${enemy.y}%` }} />)}{!running && <div className="survivor-overlay"><b>{over ? `${seconds}초 생존` : "READY?"}</b><span>목표 60초</span></div>}</section><button className="cg-main-button" onClick={start}>{running ? `${Math.max(0, 60 - seconds)}초 남음` : over ? "다시 도전" : "생존 시작"}</button></main>;
}

type KnotNode = { x: number; y: number };
const KNOT_START: KnotNode[] = [{ x: 18, y: 18 }, { x: 82, y: 18 }, { x: 20, y: 80 }, { x: 80, y: 80 }, { x: 50, y: 33 }, { x: 50, y: 68 }];
const KNOT_EDGES = [[0, 3], [1, 2], [0, 5], [1, 5], [2, 4], [3, 4], [4, 5]];
const orientation = (a: KnotNode, b: KnotNode, c: KnotNode) => (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
const crossingCount = (nodes: KnotNode[]) => KNOT_EDGES.reduce((count, edge, index) => count + KNOT_EDGES.slice(index + 1).filter((other) => !edge.some((id) => other.includes(id)) && orientation(nodes[edge[0]], nodes[edge[1]], nodes[other[0]]) * orientation(nodes[edge[0]], nodes[edge[1]], nodes[other[1]]) < 0 && orientation(nodes[other[0]], nodes[other[1]], nodes[edge[0]]) * orientation(nodes[other[0]], nodes[other[1]], nodes[edge[1]]) < 0).length, 0);

export function UntangleGame({ onExit }: ExitProps) {
  const [nodes, setNodes] = useState(KNOT_START);
  const [dragging, setDragging] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const crossings = useMemo(() => crossingCount(nodes), [nodes]);
  const won = crossings === 0 && moves > 0;
  const best = useBestScore("paperoid-untangle-best", won ? moves : 0, true);
  const move = (event: ReactPointerEvent<HTMLElement>) => { if (dragging === null) return; const rect = event.currentTarget.getBoundingClientRect(); const point = { x: Math.max(5, Math.min(95, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(5, Math.min(95, (event.clientY - rect.top) / rect.height * 100)) }; setNodes((current) => current.map((node, index) => index === dragging ? point : node)); };
  const end = () => { if (dragging !== null) setMoves((value) => value + 1); setDragging(null); };
  const reset = () => { setNodes(KNOT_START); setMoves(0); setDragging(null); };
  return <main className="cg-shell untangle-theme"><CasualHeader title="줄 풀기" icon="⌘" onExit={onExit} /><section className="cg-head"><div><small>DRAG · THINK · UNTANGLE</small><h1>점을 옮겨 모든 선의<br />교차를 없애세요</h1><p>점을 손가락으로 끌어 선을 정리하세요. 모든 선이 서로 교차하지 않으면 성공입니다.</p></div><CasualStats score={moves} best={best} label="이동" bestLabel="최소 이동" /></section><section className="knot-stage" onPointerMove={move} onPointerUp={end} onPointerCancel={end}><svg viewBox="0 0 100 100" aria-hidden="true">{KNOT_EDGES.map(([a, b], index) => <line key={index} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} />)}</svg>{nodes.map((node, index) => <button key={index} style={{ left: `${node.x}%`, top: `${node.y}%` }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(index); }} aria-label={`${index + 1}번 점 이동`}>{index + 1}</button>)}{won && <div className="knot-win">깔끔하게 풀었습니다!</div>}</section><div className="knot-info"><b>{crossings}</b>개의 교차가 남았습니다</div><button className="cg-main-button" onClick={reset}>{won ? "다른 배치로 다시" : "처음 배치로"}</button></main>;
}

type Car = { id: string; x: number; y: number; len: number; axis: "h" | "v"; target?: boolean; color: string };
type ParkingDifficulty = "초급" | "중급" | "고급";

const cloneParkingCars = (index: number): Car[] => PARKING_LEVELS[index].cars.map((car) => ({
  ...car,
  axis: car.axis as "h" | "v",
}));

export function ParkingEscapeGame({ onExit }: ExitProps) {
  const [levelIndex, setLevelIndex] = useState(0);
  const [levelGroup, setLevelGroup] = useState<ParkingDifficulty>("초급");
  const [cars, setCars] = useState<Car[]>(() => cloneParkingCars(0));
  const [selected, setSelected] = useState("T");
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [unlocked, setUnlocked] = useState(1);
  const [records, setRecords] = useState<Record<number, number>>({});
  const level = PARKING_LEVELS[levelIndex];
  const best = records[level.number] ?? 0;
  const visibleLevels = PARKING_LEVELS.filter((item) => item.difficulty === levelGroup);

  useEffect(() => {
    const savedUnlocked = Number(window.localStorage.getItem("paperoid-parking-unlocked-v2") ?? 1);
    const savedRecords = JSON.parse(window.localStorage.getItem("paperoid-parking-records-v2") ?? "{}");
    setUnlocked(Math.max(1, Math.min(PARKING_LEVELS.length, savedUnlocked)));
    setRecords(savedRecords);
  }, []);

  const startLevel = (index: number) => {
    if (index + 1 > unlocked) return;
    setLevelIndex(index);
    setLevelGroup(PARKING_LEVELS[index].difficulty as ParkingDifficulty);
    setCars(cloneParkingCars(index));
    setSelected("T");
    setMoves(0);
    setWon(false);
  };

  const move = (delta: number) => {
    if (won) return; const car = cars.find((item) => item.id === selected)!;
    if (car.target && delta > 0 && car.x + car.len === 6) {
      const finalMoves = moves + 1;
      const nextRecords = { ...records, [level.number]: best ? Math.min(best, finalMoves) : finalMoves };
      const nextUnlocked = Math.min(PARKING_LEVELS.length, Math.max(unlocked, level.number + 1));
      setMoves(finalMoves);
      setWon(true);
      setRecords(nextRecords);
      setUnlocked(nextUnlocked);
      window.localStorage.setItem("paperoid-parking-records-v2", JSON.stringify(nextRecords));
      window.localStorage.setItem("paperoid-parking-unlocked-v2", String(nextUnlocked));
      return;
    }
    const next = { ...car, x: car.axis === "h" ? car.x + delta : car.x, y: car.axis === "v" ? car.y + delta : car.y };
    if (next.x < 0 || next.y < 0 || next.x + (next.axis === "h" ? next.len : 1) > 6 || next.y + (next.axis === "v" ? next.len : 1) > 6) return;
    const occupied = cars.some((other) => other.id !== car.id && Array.from({ length: other.len }, (_, index) => [other.x + (other.axis === "h" ? index : 0), other.y + (other.axis === "v" ? index : 0)]).some(([x, y]) => Array.from({ length: next.len }, (_, index) => [next.x + (next.axis === "h" ? index : 0), next.y + (next.axis === "v" ? index : 0)]).some(([nx, ny]) => nx === x && ny === y)));
    if (occupied) return;
    setCars((current) => current.map((item) => item.id === car.id ? next : item)); setMoves((value) => value + 1);
  };
  const reset = () => startLevel(levelIndex);
  const nextLevel = () => startLevel(level.number < PARKING_LEVELS.length ? levelIndex + 1 : 0);
  const current = cars.find((car) => car.id === selected)!;
  return (
    <main className="cg-shell parking-theme">
      <CasualHeader title="주차 탈출" icon="▣" onExit={onExit} />
      <section className="cg-head">
        <div><small>SLIDE · CLEAR · ESCAPE</small><h1>차량을 움직여<br />빨간 차의 길을 여세요</h1><p>차량은 향한 방향으로만 움직입니다. 빨간 차를 오른쪽 출구로 빼내세요.</p></div>
        <CasualStats score={moves} best={best} label="이동" bestLabel="이 레벨 기록" />
      </section>
      <section className="parking-levels" aria-label="주차 탈출 레벨 선택">
        <div className="parking-level-summary">
          <span>LEVEL <b>{String(level.number).padStart(2, "0")}</b></span>
          <strong className={`difficulty-${level.difficulty}`}>{level.difficulty}</strong>
          <span>최소 <b>{level.minMoves}</b>수</span>
        </div>
        <div className="parking-difficulty-tabs" role="tablist" aria-label="난이도 선택">
          {(["초급", "중급", "고급"] as ParkingDifficulty[]).map((difficulty) => (
            <button key={difficulty} type="button" role="tab" aria-selected={levelGroup === difficulty} className={levelGroup === difficulty ? "active" : ""} onClick={() => setLevelGroup(difficulty)}>{difficulty}</button>
          ))}
        </div>
        <div className="parking-level-list">
          {visibleLevels.map((item) => {
            const index = item.number - 1;
            const locked = item.number > unlocked;
            return <button key={item.number} type="button" disabled={locked} className={level.number === item.number ? "active" : ""} onClick={() => startLevel(index)} aria-label={`${item.difficulty} ${item.number}레벨${locked ? " 잠김" : ""}`}><b>{item.number}</b><span>{locked ? "잠김" : records[item.number] ? `${records[item.number]}수` : `${item.minMoves}수`}</span></button>;
          })}
        </div>
      </section>
      <section className="parking-wrap">
        <div className="parking-board">
          <i className="parking-exit">EXIT</i>
          {Array.from({ length: 36 }, (_, index) => <span key={index} />)}
          {cars.map((car) => <button key={car.id} className={`${car.color} ${car.target ? "target" : ""} ${selected === car.id ? "selected" : ""}`} style={{ left: `${car.x / 6 * 100}%`, top: `${car.y / 6 * 100}%`, width: `${(car.axis === "h" ? car.len : 1) / 6 * 100}%`, height: `${(car.axis === "v" ? car.len : 1) / 6 * 100}%` }} onClick={() => setSelected(car.id)} aria-label={`${car.id} 차량 선택`}><i /><b>{car.target ? "나가기" : car.id}</b></button>)}
          {won && <div className="parking-win"><b>탈출 성공!</b><span>{moves}수 · 기준 {level.minMoves}수</span></div>}
        </div>
        <div className="parking-control"><span><b>{current.id}</b> 차량 선택됨</span><div><button onClick={() => move(-1)} aria-label="선택 차량 뒤로 이동">{current.axis === "h" ? "←" : "↑"}</button><button onClick={() => move(1)} aria-label="선택 차량 앞으로 이동">{current.axis === "h" ? "→" : "↓"}</button></div></div>
      </section>
      <button className="cg-main-button" onClick={won ? nextLevel : reset}>{won ? level.number < PARKING_LEVELS.length ? "다음 레벨" : "처음부터" : "이 레벨 다시 시작"}</button>
    </main>
  );
}
