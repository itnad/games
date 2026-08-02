"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  PICK_PICNIC_GRAINS,
  PICK_PICNIC_YARDS,
  pickPicnicChooseAiCards,
  pickPicnicCreateGame,
  pickPicnicFairShare,
  pickPicnicGrainScore,
  pickPicnicHumanConflicts,
  pickPicnicNextRound,
  pickPicnicPlayerScore,
  pickPicnicResolveRound,
} from "./pick-picnic-engine.js";

type Card = {
  uid: string;
  yardId: string;
  kind: "bird" | "fox";
  value: number;
  name: string;
};
type Player = {
  id: number;
  name: string;
  hand: Card[];
  grains: Record<string, number>;
  captured: Card[];
};
type Yard = (typeof PICK_PICNIC_YARDS)[number] & { grains: string[] };
type Game = {
  players: Player[];
  deck: Card[];
  discard: Card[];
  yards: Yard[];
  bag: string[];
  lastRound: boolean;
};
type Play = { playerId: number; card: Card };
type Phase = "setup" | "select" | "reveal" | "negotiate" | "summary" | "game-over";

function Mark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function Topbar({ onExit }: { onExit: () => void }) {
  return (
    <header className="game-topbar picnic-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup"><Mark /><div><span>PLAYROOM</span><strong>픽 피크닉</strong></div></div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

function GrainDots({ grains, compact = false }: { grains: string[]; compact?: boolean }) {
  return (
    <span className={`picnic-grains ${compact ? "compact" : ""}`} aria-label={`먹이 ${grains.length}개`}>
      {grains.map((grain, index) => {
        const grainInfo = PICK_PICNIC_GRAINS[grain as keyof typeof PICK_PICNIC_GRAINS];
        return (
          <i
            key={`${grain}-${index}`}
            className={grain}
            title={`${grainInfo.name} ${grainInfo.value}점`}
            aria-label={`${grainInfo.name} 먹이 ${grainInfo.value}점`}
          >
            <b>{grainInfo.value}</b>
          </i>
        );
      })}
      {!grains.length && <small>비어 있음</small>}
    </span>
  );
}

function BirdIcon({ yard, className }: { yard: (typeof PICK_PICNIC_YARDS)[number]; className: string }) {
  if (yard.id === "green") {
    return (
      <span className={`${className} picnic-goose-icon`} role="img" aria-label="거위">
        <i aria-hidden="true" />
        <b aria-hidden="true" />
      </span>
    );
  }

  return <span className={className} role="img" aria-label={yard.bird}>{yard.icon}</span>;
}

function AnimalCard({
  card,
  selected = false,
  owner,
  onClick,
  disabled,
}: {
  card: Card;
  selected?: boolean;
  owner?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const yard = PICK_PICNIC_YARDS.find((item) => item.id === card.yardId)!;
  return (
    <button
      className={`picnic-animal-card ${card.kind} ${selected ? "selected" : ""}`}
      style={{ "--yard-color": yard.color } as CSSProperties}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={onClick ? selected : undefined}
    >
      <span className="picnic-card-color" />
      <small>{yard.name}</small>
      {card.kind === "fox" ? (
        <span className="picnic-card-bird" role="img" aria-label="여우">🦊</span>
      ) : (
        <BirdIcon yard={yard} className="picnic-card-bird" />
      )}
      <strong>{card.name}</strong>
      <em>{card.value > 0 ? `+${card.value}` : card.value}</em>
      {owner && <i>{owner}</i>}
    </button>
  );
}

function grainCounts(grains: string[]) {
  return grains.reduce<Record<string, number>>((counts, grain) => {
    counts[grain] = (counts[grain] ?? 0) + 1;
    return counts;
  }, {});
}

export function PickPicnicGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [totalPlayers, setTotalPlayers] = useState(4);
  const [game, setGame] = useState<Game | null>(null);
  const [round, setRound] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [plays, setPlays] = useState<Play[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [conflictIndex, setConflictIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, "share" | "duel">>({});
  const [events, setEvents] = useState<string[]>([]);
  const [duels, setDuels] = useState<{ yardId: string; detail: string; winnerId: number }[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);

  const required = totalPlayers <= 3 ? 2 : 1;
  const human = game?.players[0];
  const currentConflict = conflicts[conflictIndex];
  const revealed = phase !== "select" && phase !== "setup";

  const rankings = useMemo(() => {
    if (!game) return [];
    return [...game.players].sort((a, b) => pickPicnicPlayerScore(b) - pickPicnicPlayerScore(a));
  }, [game]);

  const conflictOffer = useMemo(() => {
    if (!game || !currentConflict) return null;
    const yard = game.yards.find((item) => item.id === currentConflict)!;
    const entries = plays.filter(
      (entry) => entry.card.yardId === currentConflict && entry.card.kind === "bird" && entry.card.value !== -2,
    );
    return { yard, entries, shares: pickPicnicFairShare(yard.grains, entries) };
  }, [currentConflict, game, plays]);

  function startGame() {
    setGame(pickPicnicCreateGame(totalPlayers));
    setRound(1);
    setSelected([]);
    setPlays([]);
    setConflicts([]);
    setDecisions({});
    setEvents([]);
    setDuels([]);
    setPhase("select");
  }

  function toggleCard(card: Card) {
    if (phase !== "select") return;
    if (selected.includes(card.uid)) {
      setSelected(selected.filter((uid) => uid !== card.uid));
      return;
    }
    if (selected.length >= required) return;
    if (required === 2) {
      const chosenCards = human!.hand.filter((item) => selected.includes(item.uid));
      if (chosenCards.some((item) => item.yardId === card.yardId)) return;
    }
    setSelected([...selected, card.uid]);
  }

  function revealCards() {
    if (!game || selected.length !== required) return;
    const humanCards = human!.hand.filter((card) => selected.includes(card.uid));
    const nextPlays: Play[] = humanCards.map((card) => ({ playerId: 0, card }));
    for (const player of game.players.slice(1)) {
      for (const card of pickPicnicChooseAiCards(player, game.yards, required)) {
        nextPlays.push({ playerId: player.id, card });
      }
    }
    const nextConflicts = pickPicnicHumanConflicts(nextPlays);
    setPlays(nextPlays);
    setConflicts(nextConflicts);
    setConflictIndex(0);
    setDecisions({});
    setPhase("reveal");
  }

  function finishResolution(finalDecisions: Record<string, "share" | "duel">) {
    if (!game) return;
    const result = pickPicnicResolveRound(game, plays, finalDecisions);
    setGame({ ...game, players: result.players, yards: result.yards, discard: result.discard });
    setEvents(result.events);
    setDuels(result.duels);
    setPhase(game.lastRound ? "game-over" : "summary");
  }

  function decide(mode: "share" | "duel") {
    if (!currentConflict) return;
    const nextDecisions = { ...decisions, [currentConflict]: mode };
    setDecisions(nextDecisions);
    if (conflictIndex + 1 < conflicts.length) {
      setConflictIndex(conflictIndex + 1);
    } else {
      finishResolution(nextDecisions);
    }
  }

  function nextRound() {
    if (!game) return;
    const next = pickPicnicNextRound(game);
    setGame(next);
    setRound(round + 1);
    setSelected([]);
    setPlays([]);
    setConflicts([]);
    setDecisions({});
    setEvents([]);
    setDuels([]);
    setPhase("select");
  }

  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = window.setTimeout(() => {
      if (conflicts.length) setPhase("negotiate");
      else finishResolution({});
    }, 900);
    return () => window.clearTimeout(timer);
  });

  const bagTotal = game?.bag.length ?? 66;

  return (
    <main className="game-shell picnic-shell">
      <Topbar onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel picnic-info">
          <div>
            <span className="eyebrow">PICK · BLUFF · FEAST</span>
            <h1>새와 여우의<br />발칙한 한 끼</h1>
            <p>먹이가 쌓인 농장을 노리되 여우를 조심하세요. 같은 곳에 몰리면 나눌지 주사위로 다툴지 결정합니다.</p>
          </div>
          {phase === "setup" ? (
            <div className="picnic-side-facts"><span>게임 시간 <b>약 20분</b></span><span>인원 <b>AI 포함 2~6인</b></span></div>
          ) : (
            <div className="picnic-side-score">
              <div><span>현재 점수</span><strong>{human ? pickPicnicPlayerScore(human) : 0}</strong></div>
              <div><span>라운드</span><strong>{round}</strong></div>
              <div><span>남은 먹이</span><strong>{bagTotal}</strong></div>
            </div>
          )}
          <button className="picnic-rules-button" onClick={() => setRulesOpen(true)}>ⓘ 게임 방법</button>
        </aside>

        <div className="board-panel picnic-board-panel">
          {phase === "setup" ? (
            <section className="picnic-setup">
              <div className="picnic-setup-visual" aria-hidden="true">
                <span className="bird one">🐔</span><span className="bird two">🦆</span>
                <span className="fox">🦊</span><i className="grain g1" /><i className="grain g2" /><i className="grain g3" />
              </div>
              <span className="picnic-kicker">A CLEVER FARMYARD FEAST</span>
              <h2>오늘 농장의<br /><em>최고 먹보</em>는 누구?</h2>
              <p>참가 인원을 선택하면 나머지 자리는 서로 다른 성향의 AI가 맡습니다.</p>
              <div className="picnic-player-picker" aria-label="전체 참가 인원">
                {[2, 3, 4, 5, 6].map((count) => (
                  <button key={count} className={totalPlayers === count ? "active" : ""} onClick={() => setTotalPlayers(count)}>
                    <strong>{count}</strong><span>명</span>
                  </button>
                ))}
              </div>
              <button className="picnic-start" onClick={startGame}>농장으로 출발 <span>→</span></button>
              <small>{totalPlayers <= 3 ? "한 라운드에 색이 다른 카드 2장을 냅니다." : "한 라운드에 카드 1장을 냅니다."}</small>
            </section>
          ) : game && (
            <>
              <section className="picnic-score-strip" aria-label="참가자별 점수">
                {game.players.map((player, index) => (
                  <article key={player.id} className={index === 0 ? "human" : ""}>
                    <span>{index === 0 ? "나" : `AI ${index}`}</span>
                    <strong>{player.name}</strong>
                    <b>{pickPicnicPlayerScore(player)}점</b>
                    <small>먹이 {Object.values(player.grains).reduce((sum, count) => sum + count, 0)} · 사냥 {player.captured.length}</small>
                  </article>
                ))}
              </section>

              <header className="picnic-round-head">
                <div><span>ROUND {round}</span><h2>{
                  phase === "select" ? `카드 ${required}장을 골라주세요` :
                  phase === "reveal" ? "하나, 둘, 셋! 모두 공개" :
                  phase === "negotiate" ? "먹이를 나눌까요?" :
                  phase === "game-over" ? "마지막 식사가 끝났어요" : "이번 라운드 결과"
                }</h2></div>
                <div className={`picnic-bag ${game.lastRound ? "last" : ""}`}><i /><span>{game.lastRound ? "마지막 라운드" : `먹이 ${bagTotal}개 남음`}</span></div>
              </header>
              <div className="picnic-inline-legend" aria-label="먹이 블록 점수 안내">
                {Object.entries(PICK_PICNIC_GRAINS).map(([id, grain]) => (
                  <span key={id}><i className={id}><b>{grain.value}</b></i>{grain.name} <strong>{grain.value}점</strong></span>
                ))}
              </div>

              <section className="picnic-yards">
                {game.yards.map((yard) => {
                  const yardPlays = revealed ? plays.filter((entry) => entry.card.yardId === yard.id) : [];
                  return (
                    <article key={yard.id} className={`picnic-yard ${currentConflict === yard.id ? "conflict" : ""}`} style={{ "--yard-color": yard.color } as CSSProperties}>
                      <header><BirdIcon yard={yard} className="picnic-yard-bird" /><div><small>{yard.bird}의 농장</small><strong>{yard.name}</strong></div><b>{pickPicnicGrainScore(grainCounts(yard.grains))}점</b></header>
                      <GrainDots grains={yard.grains} />
                      <div className="picnic-yard-plays">
                        {yardPlays.map((entry) => <AnimalCard key={entry.card.uid} card={entry.card} owner={game.players[entry.playerId].name} />)}
                      </div>
                    </article>
                  );
                })}
              </section>

              {phase === "select" && (
                <section className="picnic-hand">
                  <header><div><span>MY HAND</span><strong>내 카드</strong></div><small>{selected.length}/{required} 선택 · {required === 2 ? "같은 색은 함께 낼 수 없어요" : "다른 참가자에게는 보이지 않아요"}</small></header>
                  <div>{human!.hand.map((card) => {
                    const sameYardBlocked = required === 2 && !selected.includes(card.uid) && human!.hand.some((chosen) => selected.includes(chosen.uid) && chosen.yardId === card.yardId);
                    return <AnimalCard key={card.uid} card={card} selected={selected.includes(card.uid)} disabled={sameYardBlocked || (selected.length >= required && !selected.includes(card.uid))} onClick={() => toggleCard(card)} />;
                  })}</div>
                  <button className="picnic-reveal-button" disabled={selected.length !== required} onClick={revealCards}>선택 확정 · 동시에 공개</button>
                </section>
              )}

              {phase === "negotiate" && conflictOffer && (
                <section className="picnic-negotiation">
                  <span className="picnic-talk-icon">💬</span>
                  <div className="picnic-negotiation-copy">
                    <small>{conflictOffer.yard.name} · 분배 제안 {conflictIndex + 1}/{conflicts.length}</small>
                    <h3>“싸우지 말고 이렇게 나누는 건 어때?”</h3>
                    <div className="picnic-offer-grid">
                      {conflictOffer.entries.map((entry) => (
                        <article key={entry.playerId} className={entry.playerId === 0 ? "mine" : ""}>
                          <strong>{game.players[entry.playerId].name}</strong>
                          <GrainDots grains={conflictOffer.shares[entry.playerId]} compact />
                          <b>{pickPicnicGrainScore(grainCounts(conflictOffer.shares[entry.playerId]))}점</b>
                        </article>
                      ))}
                    </div>
                  </div>
                  <div className="picnic-decision-buttons">
                    <button onClick={() => decide("share")}>제안 수락<span>먹이를 나눠 갖기</span></button>
                    <button className="duel" onClick={() => decide("duel")}>⚄ 주사위 결투<span>승자가 전부 차지</span></button>
                  </div>
                </section>
              )}

              {(phase === "summary" || phase === "game-over") && (
                <section className="picnic-summary">
                  {phase === "game-over" ? (
                    <div className="picnic-final">
                      <span>🏆</span><div><small>THE FEAST IS OVER</small><h2>{rankings[0].name} 승리!</h2><p>먹이와 잡은 가금류 점수를 모두 합산했습니다.</p></div>
                      <ol>{rankings.map((player, index) => <li key={player.id}><b>{index + 1}</b><span>{player.name}</span><strong>{pickPicnicPlayerScore(player)}점</strong></li>)}</ol>
                    </div>
                  ) : (
                    <div className="picnic-event-list">
                      {events.map((event, index) => <p key={`${event}-${index}`}><span>{index + 1}</span>{event}</p>)}
                      {!events.length && <p><span>·</span>이번 라운드에는 아무도 먹이를 얻지 못했습니다.</p>}
                    </div>
                  )}
                  {duels.length > 0 && <div className="picnic-duel-note"><b>⚄ 결투 기록</b>{duels.map((duel) => <span key={duel.yardId}>{duel.detail}</span>)}</div>}
                  <div className="picnic-summary-actions">
                    {phase === "summary" && <button onClick={nextRound}>다음 라운드 <span>→</span></button>}
                    {phase === "game-over" && <><button onClick={startGame}>같은 인원으로 다시 플레이</button><button className="secondary" onClick={() => setPhase("setup")}>인원 다시 선택</button></>}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </section>

      {rulesOpen && (
        <div className="picnic-modal-backdrop" onClick={() => setRulesOpen(false)}>
          <section className="picnic-rules-modal" role="dialog" aria-modal="true" aria-labelledby="picnic-rules-title" onClick={(event) => event.stopPropagation()}>
            <header><div><span>HOW TO PLAY</span><h2 id="picnic-rules-title">픽 피크닉 게임 방법</h2></div><button onClick={() => setRulesOpen(false)}>×</button></header>
            <div className="picnic-rule-steps">
              <article><b>1</b><div><strong>먹이 놓기</strong><p>매 라운드 여섯 농장에 먹이가 하나씩 추가됩니다. 남은 먹이는 다음 라운드에도 그대로 쌓입니다.</p></div></article>
              <article><b>2</b><div><strong>카드 동시 공개</strong><p>가금류는 먹이를 노리고, 여우는 같은 색 농장에 온 가금류를 노립니다. 2~3인은 색이 다른 카드 두 장을 냅니다.</p></div></article>
              <article><b>3</b><div><strong>나누거나 결투하기</strong><p>가금류가 겹치면 먹이를 나누거나 카드 숫자와 주사위 합으로 결투합니다. 여우가 겹치면 반드시 결투합니다.</p></div></article>
              <article><b>4</b><div><strong>최고 점수로 승리</strong><p>초록·파랑·노랑 먹이는 각각 1·2·3점이며, 여우가 잡은 가금류는 카드 숫자만큼 점수가 됩니다.</p></div></article>
            </div>
            <div className="picnic-special-rule">
              <span>🐦</span><div><strong>겁쟁이 가금류 · −2</strong><p>혼자라면 먹이를 전부 먹습니다. 누군가 함께 오면 초록 먹이 하나만 챙겨 달아나지만, 여우가 있다면 잡혀 −2점 먹이가 됩니다.</p></div>
            </div>
            <div className="picnic-grain-guide">
              {Object.entries(PICK_PICNIC_GRAINS).map(([id, grain]) => <span key={id}><i className={id} />{grain.name} 먹이 <b>{grain.value}점</b></span>)}
            </div>
            <button className="picnic-modal-close" onClick={() => setRulesOpen(false)}>확인하고 계속하기</button>
          </section>
        </div>
      )}
    </main>
  );
}
