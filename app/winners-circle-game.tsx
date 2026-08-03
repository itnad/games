"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { withKoreanObject, withKoreanSubject } from "./korean-particles.js";
import {
  WC_BET_VALUES,
  WC_PACE_AT,
  WC_SYMBOLS,
  WC_TRACK_FINISH,
  createRaceHorses,
  wcAvailableHorseIds,
  wcChooseAiBets,
  wcChooseAiHorse,
  wcMoveHorse,
  wcRollSymbol,
  wcSettleRaceMulti,
} from "./winners-circle-engine.js";

type SymbolId = "horse" | "cap" | "saddle" | "shoe";
type Phase =
  | "setup"
  | "betting"
  | "ai-betting"
  | "player-roll"
  | "player-choose"
  | "ai-roll"
  | "ai-move"
  | "race-result"
  | "game-result";
type Bet = { horseId: number; value: number };
type Horse = {
  id: number;
  name: string;
  color: string;
  position: number;
  finishedRank: number | null;
  stats: Record<SymbolId, number>;
};
type AiPlayer = {
  id: string;
  name: string;
  money: number;
  bets: Bet[];
};
type Settlement = {
  podium: Horse[];
  lastHorse: Horse | null;
  multiplier: number;
  results: Array<{
    id: string;
    delta: number;
    lines: Array<{ horseId: number; label: string; amount: number }>;
  }>;
};

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

function GameTopbar({ onExit }: { onExit: () => void }) {
  return (
    <header className="game-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로 돌아가기">←</button>
      <div className="game-title-lockup">
        <BrandMark />
        <div><span>paperoid</span><strong>위너스 서클</strong></div>
      </div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

function ModeSwitch() {
  return (
    <div className="mode-switch">
      <button className="active"><span aria-hidden="true">♞</span> AI 대전</button>
      <button disabled><span aria-hidden="true">♙</span> 친구 대전 <small>준비 중</small></button>
    </div>
  );
}

function createAiPlayers(count: number): AiPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `ai-${index + 1}`,
    name: `AI ${index + 1}`,
    money: 1000,
    bets: [],
  }));
}

function formatChips(value: number) {
  return `${value.toLocaleString("ko-KR")}칩`;
}

function deltaText(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("ko-KR")}`;
}

export function WinnersCircleGame({ onExit }: { onExit: () => void }) {
  const [totalPlayers, setTotalPlayers] = useState(2);
  const [race, setRace] = useState(1);
  const [horses, setHorses] = useState<Horse[]>(() => createRaceHorses(1));
  const [phase, setPhase] = useState<Phase>("setup");
  const [playerBets, setPlayerBets] = useState<Bet[]>([]);
  const [aiPlayers, setAiPlayers] = useState<AiPlayer[]>(() => createAiPlayers(1));
  const [activeAiIndex, setActiveAiIndex] = useState(0);
  const [usedHorseIds, setUsedHorseIds] = useState<number[]>([]);
  const [paceHorseId, setPaceHorseId] = useState<number | null>(null);
  const [lastRoll, setLastRoll] = useState<SymbolId | null>(null);
  const [playerMoney, setPlayerMoney] = useState(1000);
  const [notice, setNotice] = useState("함께 경주할 전체 인원을 선택하세요");
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [showRules, setShowRules] = useState(false);

  const activeAi = aiPlayers[activeAiIndex];
  const availableIds = useMemo(
    () => wcAvailableHorseIds(horses, usedHorseIds),
    [horses, usedHorseIds],
  );
  const remainingChips = useMemo(() => {
    const remaining = [...WC_BET_VALUES];
    playerBets.forEach((bet) => {
      const index = remaining.indexOf(bet.value);
      if (index >= 0) remaining.splice(index, 1);
    });
    return remaining;
  }, [playerBets]);

  const phaseTitle = {
    setup: "대전 인원 설정",
    betting: "나의 베팅",
    "ai-betting": `${aiPlayers.length}명의 AI 베팅 중`,
    "player-roll": "내 차례",
    "player-choose": "움직일 말 선택",
    "ai-roll": `${activeAi?.name ?? "AI"} 차례`,
    "ai-move": `${withKoreanSubject(activeAi?.name ?? "AI")} 말을 고르는 중`,
    "race-result": `${race}경주 결과`,
    "game-result": "최종 결과",
  }[phase];

  const finishRace = useCallback((nextHorses: Horse[], nextPaceHorseId: number | null) => {
    const competitors = [
      { id: "player", bets: playerBets },
      ...aiPlayers.map((ai) => ({ id: ai.id, bets: ai.bets })),
    ];
    const result = wcSettleRaceMulti(
      nextHorses,
      competitors,
      nextPaceHorseId,
      race,
    ) as Settlement;
    const playerResult = result.results.find((entry) => entry.id === "player");
    setSettlement(result);
    setPlayerMoney((money) => Math.max(0, money + (playerResult?.delta ?? 0)));
    setAiPlayers((players) =>
      players.map((ai) => {
        const aiResult = result.results.find((entry) => entry.id === ai.id);
        return { ...ai, money: Math.max(0, ai.money + (aiResult?.delta ?? 0)) };
      }),
    );
    setPhase(race === 3 ? "game-result" : "race-result");
    setNotice(race === 3 ? "모든 참가자의 세 경주 정산이 끝났습니다" : "참가자별 배당을 확인하세요");
  }, [aiPlayers, playerBets, race]);

  const moveHorse = useCallback((
    horseId: number,
    actorId: "player" | string,
    actorName: string,
    symbol: SymbolId,
  ) => {
    const horse = horses.find((item) => item.id === horseId);
    if (!horse) return;
    const result = wcMoveHorse(horses, horseId, symbol, usedHorseIds, paceHorseId);
    const nextHorses = result.horses as Horse[];
    setHorses(nextHorses);
    setUsedHorseIds(result.usedHorseIds);
    setPaceHorseId(result.paceHorseId);
    setNotice(`${withKoreanSubject(actorName)} ${withKoreanObject(horse.name)} ${result.moved}칸 이동했습니다`);

    if (nextHorses.filter((item) => item.finishedRank).length >= 3) {
      finishRace(nextHorses, result.paceHorseId);
      return;
    }

    if (actorId === "player") {
      setActiveAiIndex(0);
      setPhase(aiPlayers.length ? "ai-roll" : "player-roll");
    } else if (activeAiIndex < aiPlayers.length - 1) {
      setActiveAiIndex((index) => index + 1);
      setPhase("ai-roll");
    } else {
      setActiveAiIndex(0);
      setPhase("player-roll");
    }
  }, [activeAiIndex, aiPlayers.length, finishRace, horses, paceHorseId, usedHorseIds]);

  function initializeGame(nextPhase: Phase) {
    setRace(1);
    setHorses(createRaceHorses(1));
    setPhase(nextPhase);
    setPlayerBets([]);
    setAiPlayers(createAiPlayers(totalPlayers - 1));
    setActiveAiIndex(0);
    setUsedHorseIds([]);
    setPaceHorseId(null);
    setLastRoll(null);
    setPlayerMoney(1000);
    setSettlement(null);
  }

  function startConfiguredGame() {
    initializeGame("betting");
    setNotice(`${totalPlayers}인 경주입니다. 서로 다른 말 세 마리에 베팅하세요`);
  }

  function toggleBet(horseId: number) {
    if (phase !== "betting") return;
    const existing = playerBets.find((bet) => bet.horseId === horseId);
    if (existing) {
      setPlayerBets((bets) => bets.filter((bet) => bet.horseId !== horseId));
      setNotice("베팅을 취소했습니다");
      return;
    }
    const nextValue = remainingChips[0];
    if (!nextValue) return;
    setPlayerBets((bets) => [...bets, { horseId, value: nextValue }]);
    setNotice(`${horses.find((horse) => horse.id === horseId)?.name}에 ${nextValue}칩을 베팅했습니다`);
  }

  function confirmBets() {
    if (playerBets.length !== 3) return;
    setAiPlayers((players) =>
      players.map((ai) => ({ ...ai, bets: wcChooseAiBets(horses) })),
    );
    setPhase("ai-betting");
    setNotice(`${aiPlayers.length}명의 AI가 비공개 베팅을 고르고 있습니다`);
  }

  function playerRoll() {
    if (phase !== "player-roll") return;
    const symbol = wcRollSymbol() as SymbolId;
    const meta = WC_SYMBOLS.find((item) => item.id === symbol);
    setLastRoll(symbol);
    setNotice(`${meta?.label} 문양이 나왔습니다. 움직일 말을 선택하세요`);
    setPhase("player-choose");
  }

  function chooseHorse(horseId: number) {
    if (phase !== "player-choose" || !lastRoll || !availableIds.includes(horseId)) return;
    moveHorse(horseId, "player", "내", lastRoll);
  }

  function startNextRace() {
    const nextRace = race + 1;
    setRace(nextRace);
    setHorses(createRaceHorses(nextRace));
    setPhase("betting");
    setPlayerBets([]);
    setAiPlayers((players) => players.map((ai) => ({ ...ai, bets: [] })));
    setActiveAiIndex(0);
    setUsedHorseIds([]);
    setPaceHorseId(null);
    setLastRoll(null);
    setSettlement(null);
    setNotice(`${nextRace}경주입니다. 서로 다른 말 세 마리에 베팅하세요`);
  }

  function resetGame() {
    initializeGame("betting");
    setNotice(`${totalPlayers}인 새 게임입니다. 서로 다른 말 세 마리에 베팅하세요`);
  }

  function returnToSetup() {
    initializeGame("setup");
    setNotice("함께 경주할 전체 인원을 선택하세요");
  }

  useEffect(() => {
    if (phase !== "ai-betting") return;
    const timer = window.setTimeout(() => {
      setPhase("player-roll");
      setNotice("모든 AI의 베팅이 완료됐습니다. 특수 주사위를 굴리세요");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ai-roll" || !activeAi) return;
    const timer = window.setTimeout(() => {
      const symbol = wcRollSymbol() as SymbolId;
      const meta = WC_SYMBOLS.find((item) => item.id === symbol);
      setLastRoll(symbol);
      setNotice(`${withKoreanSubject(activeAi.name)} ${meta?.label} 문양을 굴렸습니다`);
      setPhase("ai-move");
    }, 520);
    return () => window.clearTimeout(timer);
  }, [activeAi, phase]);

  useEffect(() => {
    if (phase !== "ai-move" || !lastRoll || !activeAi) return;
    const timer = window.setTimeout(() => {
      const otherBets = [
        ...playerBets,
        ...aiPlayers.filter((ai) => ai.id !== activeAi.id).flatMap((ai) => ai.bets),
      ];
      const horseId = wcChooseAiHorse(
        horses,
        usedHorseIds,
        lastRoll,
        activeAi.bets,
        otherBets,
      );
      if (horseId != null) moveHorse(horseId, activeAi.id, activeAi.name, lastRoll);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeAi, aiPlayers, horses, lastRoll, moveHorse, phase, playerBets, usedHorseIds]);

  const revealAiBets = phase === "race-result" || phase === "game-result";
  const standings = [
    { id: "player", name: "나", money: playerMoney },
    ...aiPlayers.map((ai) => ({ id: ai.id, name: ai.name, money: ai.money })),
  ].sort((a, b) => b.money - a.money);
  const winners = standings.filter((entry) => entry.money === standings[0]?.money);
  const finalWinner = winners.length > 1
    ? `${winners.map((entry) => entry.name).join(" · ")} 공동 1위`
    : winners[0]?.id === "player"
      ? "승리했습니다!"
      : `${withKoreanSubject(winners[0]?.name ?? "AI")} 승리했습니다`;

  return (
    <main className="game-shell winners-shell">
      <GameTopbar onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel">
          <div>
            <span className="eyebrow">BET · ROLL · RACE</span>
            <h1>위너스<br />서클</h1>
            <p>2명부터 6명까지 함께 경주합니다. 유망한 말을 골라 베팅하고 특수 주사위로 흐름을 바꿔보세요.</p>
          </div>
          <ModeSwitch />
          <div className={`winners-score-card ${aiPlayers.length > 1 ? "multi" : ""}`}>
            <span className="player"><small>나</small><strong>{formatChips(playerMoney)}</strong></span>
            {aiPlayers.map((ai) => (
              <span key={ai.id}>
                <small>{ai.name}</small>
                <strong>{formatChips(ai.money)}</strong>
              </span>
            ))}
          </div>
        </aside>

        <div className="board-panel winners-board-panel">
          <div className="wc-status">
            <span className="wc-round-pill">{phase === "setup" ? "2–6인" : `${race}/3 RACE`}</span>
            <div><strong>{phaseTitle}</strong><span aria-live="polite">{notice}</span></div>
            <button className="wc-rules-button" onClick={() => setShowRules(true)}>ⓘ 게임 방법</button>
          </div>

          <div className="wc-race-board">
            {phase === "setup" ? (
              <section className="wc-player-setup" aria-labelledby="wc-player-count-title">
                <span className="wc-setup-icon" aria-hidden="true">♞</span>
                <p className="eyebrow">AI RACE SETUP</p>
                <h2 id="wc-player-count-title">몇 명이 경주할까요?</h2>
                <p>나를 포함한 전체 인원을 선택하세요.<br />나머지 자리는 AI가 참가합니다.</p>
                <div className="wc-player-count" role="radiogroup" aria-label="전체 참가 인원">
                  {[2, 3, 4, 5, 6].map((count) => (
                    <button
                      key={count}
                      className={totalPlayers === count ? "selected" : ""}
                      onClick={() => {
                        setTotalPlayers(count);
                        setAiPlayers(createAiPlayers(count - 1));
                      }}
                      role="radio"
                      aria-checked={totalPlayers === count}
                    >
                      <strong>{count}인</strong>
                      <small>AI {count - 1}</small>
                    </button>
                  ))}
                </div>
                <div className="wc-player-preview">
                  <span className="human">나</span>
                  {Array.from({ length: totalPlayers - 1 }, (_, index) => (
                    <span key={index}>AI {index + 1}</span>
                  ))}
                </div>
                <button className="wc-primary" onClick={startConfiguredGame}>
                  {totalPlayers}인 게임 시작
                </button>
              </section>
            ) : (
              <>
                <div className="wc-track-heading">
                  <span>START</span>
                  <b>선두마 {WC_PACE_AT}</b>
                  <span>FINISH</span>
                </div>

                <div className="wc-horses">
                  {horses.map((horse, index) => {
                    const playerBet = playerBets.find((bet) => bet.horseId === horse.id);
                    const aiHorseBets = aiPlayers.flatMap((ai) => {
                      const bet = ai.bets.find((entry) => entry.horseId === horse.id);
                      return bet ? [{ id: ai.id, name: ai.name, value: bet.value }] : [];
                    });
                    const isAvailable = phase === "player-choose" && availableIds.includes(horse.id);
                    const canBet = phase === "betting" && (Boolean(playerBet) || playerBets.length < 3);
                    const progress = Math.max(
                      0,
                      Math.min(100, ((horse.position + 6) / (WC_TRACK_FINISH + 6)) * 100),
                    );
                    const rowStyle = {
                      "--horse-color": horse.color,
                      "--horse-progress": `${progress}%`,
                    } as CSSProperties;

                    return (
                      <button
                        key={horse.id}
                        className={[
                          "wc-horse-row",
                          canBet || isAvailable ? "selectable" : "",
                          phase === "player-choose" && isAvailable ? "move-option" : "",
                          phase === "player-choose" && !isAvailable ? "move-unavailable" : "",
                          playerBet ? "player-bet" : "",
                          horse.finishedRank ? "finished" : "",
                        ].join(" ")}
                        style={rowStyle}
                        disabled={!canBet && !isAvailable}
                        onClick={() => phase === "betting" ? toggleBet(horse.id) : chooseHorse(horse.id)}
                        aria-label={`${index + 1}번 ${horse.name}${playerBet ? `, ${playerBet.value}칩 베팅` : ""}${isAvailable ? ", 이동 선택 가능" : ""}`}
                      >
                        <span className="wc-gate">{index + 1}</span>
                        <span className="wc-horse-name">
                          <strong><i />{horse.name}</strong>
                          <small>
                            {playerBet && <b className="mine">나 {playerBet.value}×</b>}
                            {revealAiBets && aiHorseBets.map((bet) => (
                              <b key={bet.id} className="ai">{bet.name} {bet.value}×</b>
                            ))}
                            {horse.id === paceHorseId && <b className="pace">선두마</b>}
                            {isAvailable && <b className="move-ready">선택 가능</b>}
                          </small>
                        </span>
                        <span className="wc-lane">
                          <i className="wc-pace-line" />
                          <i className="wc-finish-line" />
                          <b className="wc-runner">
                            {horse.finishedRank ? `${horse.finishedRank}위` : "♞"}
                          </b>
                        </span>
                        <span className="wc-stats">
                          {WC_SYMBOLS.map((symbol) => (
                            <b key={symbol.id} className={lastRoll === symbol.id ? "active" : ""}>
                              <i>{symbol.icon}</i>{horse.stats[symbol.id as SymbolId]}
                            </b>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {settlement && (
                  <div className="wc-settlement">
                    <div className="wc-podium">
                      {settlement.podium.map((horse: Horse) => (
                        <span key={horse.id}>
                          <small>{horse.finishedRank}위</small>
                          <strong>{horse.name}</strong>
                        </span>
                      ))}
                    </div>
                    {settlement.multiplier === 2 && <p className="wc-double">최종 경주 · 모든 배당과 감점 2배</p>}
                    <div className="wc-delta multi">
                      {[
                        { id: "player", name: "나" },
                        ...aiPlayers.map((ai) => ({ id: ai.id, name: ai.name })),
                      ].map((participant) => {
                        const result = settlement.results.find((entry) => entry.id === participant.id);
                        return (
                          <span key={participant.id}>
                            <small>{participant.name}</small>
                            <strong>{deltaText(result?.delta ?? 0)}칩</strong>
                          </span>
                        );
                      })}
                    </div>
                    {phase === "game-result" && <h3>{finalWinner}</h3>}
                  </div>
                )}

                <div className="wc-controls">
                  {phase === "betting" && (
                    <>
                      <div className="wc-chip-rack">
                        <span>남은 베팅</span>
                        {remainingChips.map((chip, index) => <b key={`${chip}-${index}`}>{chip}×</b>)}
                        {!remainingChips.length && <em>선택 완료</em>}
                      </div>
                      <button className="wc-primary" disabled={playerBets.length !== 3} onClick={confirmBets}>
                        베팅 확정
                      </button>
                    </>
                  )}
                  {phase === "ai-betting" && <button className="wc-primary waiting" disabled>{aiPlayers.length}명 AI 비공개 베팅 중…</button>}
                  {phase === "player-roll" && (
                    <button className="wc-primary roll" onClick={playerRoll}>
                      <span aria-hidden="true">⬡</span> 특수 주사위 굴리기
                    </button>
                  )}
                  {phase === "player-choose" && (
                    <div className="wc-choose-note">
                      <b>{WC_SYMBOLS.find((symbol) => symbol.id === lastRoll)?.icon}</b>
                      초록색 ‘선택 가능’ 말 중 하나를 선택하세요
                    </div>
                  )}
                  {(phase === "ai-roll" || phase === "ai-move") && (
                    <button className="wc-primary waiting" disabled>
                      {phase === "ai-roll"
                        ? `${activeAi?.name} 주사위 굴리는 중… (${activeAiIndex + 1}/${aiPlayers.length})`
                        : `${activeAi?.name} 움직일 말 선택 중… (${activeAiIndex + 1}/${aiPlayers.length})`}
                    </button>
                  )}
                  {phase === "race-result" && <button className="wc-primary" onClick={startNextRace}>다음 경주</button>}
                  {phase === "game-result" && <button className="wc-primary" onClick={resetGame}>같은 인원으로 새 게임</button>}
                  <button className="wc-reset" onClick={returnToSetup}>인원 변경</button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {showRules && (
        <div className="wc-modal-backdrop" role="presentation" onClick={() => setShowRules(false)}>
          <section className="wc-rules-modal" role="dialog" aria-modal="true" aria-labelledby="wc-rules-title" onClick={(event) => event.stopPropagation()}>
            <button className="wc-modal-close" onClick={() => setShowRules(false)} aria-label="게임 방법 닫기">×</button>
            <span className="eyebrow">HOW TO PLAY</span>
            <h2 id="wc-rules-title">위너스 서클 게임 방법</h2>
            <ol>
              <li><b>인원</b><span>나와 AI를 합쳐 2~6명이 참가합니다. 각 참가자는 별도 자금과 베팅을 가집니다.</span></li>
              <li><b>베팅</b><span>각자 서로 다른 말 3마리에 1·1·2칩을 놓습니다. AI 베팅은 경주가 끝난 뒤 공개됩니다.</span></li>
              <li><b>경주</b><span>참가자가 차례로 특수 주사위를 굴리고, 아직 움직이지 않은 말을 골라 해당 수치만큼 전진시킵니다.</span></li>
              <li><b>착순</b><span>세 번째 말이 결승선을 넘으면 경주가 끝납니다. 1·2·3위는 배당을 받고 최하위 베팅은 감점됩니다.</span></li>
              <li><b>승리</b><span>3경주는 배당과 감점이 2배입니다. 세 경주 후 칩이 가장 많은 참가자가 이깁니다.</span></li>
            </ol>
            <button className="wc-primary" onClick={() => setShowRules(false)}>확인</button>
          </section>
        </div>
      )}
    </main>
  );
}
