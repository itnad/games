"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SimpleBrandMark, SimpleGameTopbar, SimpleModeSwitch } from "./simple-game-chrome";

const MEMORY_CHARACTERS = [
  ["moon-jelly", "달빛 해파리"], ["teapot-snail", "주전자 달팽이"],
  ["lantern-owl", "등불 부엉이"], ["coral-cat", "산호 고양이"],
  ["paper-dragon", "종이 아기용"], ["star-moth", "별날개 나방"],
  ["mushroom-diver", "버섯 잠수부"], ["cloud-whale", "구름 아기고래"],
] as const;
const MEMORY_SYMBOLS = MEMORY_CHARACTERS.map(([id]) => id);

function memoryCharacterLabel(id: string) {
  return MEMORY_CHARACTERS.find(([characterId]) => characterId === id)?.[1] ?? "신비한 친구";
}
function memoryCharacterImage(id: string) { return `/memory-characters/${id}.png`; }

type MemoryCard = { id: number; symbol: string; matched: boolean };
function createMemoryDeck(): MemoryCard[] {
  return [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS]
    .map((symbol, index) => ({ id: index, symbol, matched: false, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ symbol, matched }, index) => ({ id: index, symbol, matched }));
}

export function MemoryGame({ onExit }: { onExit: () => void }) {
  const [cards, setCards] = useState<MemoryCard[]>(createMemoryDeck);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [turn, setTurn] = useState<"player" | "ai">("player");
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [moves, setMoves] = useState(0);
  const [round, setRound] = useState(1);
  const [isBusy, setIsBusy] = useState(false);
  const memory = useRef<Map<string, Set<number>>>(new Map());
  const busy = useRef(false);

  const remember = useCallback((indexes: number[], currentCards: MemoryCard[]) => {
    indexes.forEach((index) => {
      const symbol = currentCards[index].symbol;
      const known = memory.current.get(symbol) ?? new Set<number>();
      known.add(index); memory.current.set(symbol, known);
    });
  }, []);
  const resolvePair = useCallback((first: number, second: number, owner: "player" | "ai") => {
    const isMatch = cards[first].symbol === cards[second].symbol;
    window.setTimeout(() => {
      if (isMatch) {
        setCards((current) => current.map((card, index) => index === first || index === second ? { ...card, matched: true } : card));
        setScore((current) => ({ ...current, [owner]: current[owner] + 1 }));
        memory.current.delete(cards[first].symbol);
      }
      setRevealed([]); busy.current = false; setIsBusy(false); setTurn(owner === "player" ? "ai" : "player");
    }, 760);
  }, [cards]);
  const chooseCard = (index: number) => {
    if (turn !== "player" || busy.current || cards[index].matched || revealed.includes(index)) return;
    const nextRevealed = [...revealed, index]; setRevealed(nextRevealed); remember([index], cards);
    if (nextRevealed.length === 2) {
      busy.current = true; setIsBusy(true); setMoves((value) => value + 1); resolvePair(nextRevealed[0], nextRevealed[1], "player");
    }
  };

  useEffect(() => {
    if (turn !== "ai" || busy.current || cards.every((card) => card.matched)) return;
    busy.current = true;
    const available = cards.map((card, index) => ({ card, index })).filter(({ card }) => !card.matched).map(({ index }) => index);
    const knownPair = [...memory.current.values()].map((indexes) => [...indexes].filter((index) => available.includes(index))).find((indexes) => indexes.length >= 2);
    const first = knownPair?.[0] ?? available[Math.floor(Math.random() * available.length)];
    const secondPool = available.filter((index) => index !== first);
    const firstKnown = memory.current.get(cards[first].symbol);
    const rememberedMatch = firstKnown ? [...firstKnown].find((index) => index !== first && secondPool.includes(index)) : undefined;
    const second = knownPair?.[1] ?? rememberedMatch ?? secondPool[Math.floor(Math.random() * secondPool.length)];
    let secondTimer: number | undefined;
    const firstTimer = window.setTimeout(() => {
      setRevealed([first]); remember([first], cards);
      secondTimer = window.setTimeout(() => {
        setRevealed([first, second]); remember([second], cards); setMoves((value) => value + 1); resolvePair(first, second, "ai");
      }, 620);
    }, 580);
    return () => { window.clearTimeout(firstTimer); if (secondTimer !== undefined) window.clearTimeout(secondTimer); };
  }, [cards, remember, resolvePair, turn]);

  const finished = cards.every((card) => card.matched);
  const result = score.player > score.ai ? "기억력 챔피언!" : score.player < score.ai ? "AI가 한발 앞섰어요" : "멋진 무승부!";
  const reset = () => {
    memory.current.clear(); busy.current = false; setIsBusy(false); setCards(createMemoryDeck()); setRevealed([]);
    setTurn("player"); setScore({ player: 0, ai: 0 }); setMoves(0); setRound((value) => value + 1);
  };

  return (
    <main className="game-shell memory-shell">
      <SimpleGameTopbar title="짝 맞추기" onExit={onExit} />
      <section className="game-content">
        <div className="game-info-panel">
          <div><span className="eyebrow">ROUND {String(round).padStart(2, "0")}</span><h1>같은 그림을<br />찾아보세요</h1><p>카드의 위치를 기억해 같은 그림을 한 쌍씩 찾아보세요.</p></div>
          <SimpleModeSwitch />
          <div className="memory-score-card"><div className={turn === "player" && !finished ? "active" : ""}><span>나</span><strong>{score.player}</strong><small>PAIRS</small></div><i /><div className={turn === "ai" && !finished ? "active" : ""}><span>AI</span><strong>{score.ai}</strong><small>PAIRS</small></div></div>
        </div>
        <div className="board-panel memory-panel">
          <div className="board-status" role="status"><span className="memory-status-icon">{finished ? "✓" : turn === "player" ? "✦" : "…"}</span><strong>{finished ? result : turn === "player" ? "내 차례" : "AI가 기억을 더듬는 중…"}</strong><span>{finished ? `${moves}번 만에 모든 짝을 찾았습니다` : turn === "player" ? "카드 두 장을 뒤집으세요" : "AI의 선택을 지켜보세요"}</span></div>
          <div className="memory-grid" role="grid" aria-label="4 곱하기 4 기억력 카드">
            {cards.map((card, index) => {
              const open = card.matched || revealed.includes(index);
              return <button key={card.id} className={`memory-card ${open ? "open" : ""} ${card.matched ? "matched" : ""}`} onClick={() => chooseCard(index)} disabled={turn !== "player" || isBusy || card.matched} aria-label={open ? `${memoryCharacterLabel(card.symbol)} 카드${card.matched ? ", 짝 맞춤" : ""}` : "뒤집힌 카드"} role="gridcell"><span className="card-inner"><span className="card-back"><SimpleBrandMark /></span><span className="card-front"><img className="memory-character" src={memoryCharacterImage(card.symbol)} alt="" aria-hidden="true" /></span></span></button>;
            })}
          </div>
          <div className="game-actions"><button className="text-action" onClick={reset}>↻ 새 게임</button><span className="game-hint">{moves}번 선택 · {cards.filter((card) => card.matched).length / 2}/8 짝</span>{finished && <button className="primary-action" onClick={reset}>다시 플레이</button>}</div>
        </div>
      </section>
    </main>
  );
}
