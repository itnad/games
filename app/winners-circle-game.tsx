"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
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
  wcSettleRace,
} from "./winners-circle-engine.js";

type SymbolId = "horse" | "cap" | "saddle" | "shoe";
type Phase =
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
type Settlement = ReturnType<typeof wcSettleRace>;

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
        <div><span>PLAYROOM</span><strong>위너스 서클</strong></div>
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

function formatChips(value: number) {
  return `${value.toLocaleString("ko-KR")}칩`;
}

function deltaText(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("ko-KR")}`;
}

export function WinnersCircleGame({ onExit }: { onExit: () => void }) {
  const [race, setRace] = useState(1);
  const [horses, setHorses] = useState<Horse[]>(() => createRaceHorses(1));
  const [phase, setPhase] = useState<Phase>("betting");
  const [playerBets, setPlayerBets] = useState<Bet[]>([]);
  const [aiBets, setAiBets] = useState<Bet[]>([]);
  const [usedHorseIds, setUsedHorseIds] = useState<number[]>([]);
  const [paceHorseId, setPaceHorseId] = useState<number | null>(null);
  const [lastRoll, setLastRoll] = useState<SymbolId | null>(null);
  const [playerMoney, setPlayerMoney] = useState(1000);
  const [aiMoney, setAiMoney] = useState(1000);
  const [notice, setNotice] = useState("서로 다른 말 세 마리에 1·1·2칩을 베팅하세요");
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [showRules, setShowRules] = useState(false);

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
    betting: "나의 베팅",
    "ai-betting": "AI 베팅 중",
    "player-roll": "내 차례",
    "player-choose": "움직일 말 선택",
    "ai-roll": "AI 차례",
    "ai-move": "AI가 말을 고르는 중",
    "race-result": `${race}경주 결과`,
    "game-result": "최종 결과",
  }[phase];

  const finishRace = useCallback((nextHorses: Horse[], nextPaceHorseId: number | null) => {
    const result = wcSettleRace(nextHorses, playerBets, aiBets, nextPaceHorseId, race);
    setSettlement(result);
    setPlayerMoney((money) => Math.max(0, money + result.playerDelta));
    setAiMoney((money) => Math.max(0, money + result.aiDelta));
    setPhase(race === 3 ? "game-result" : "race-result");
    setNotice(race === 3 ? "세 경주의 정산이 모두 끝났습니다" : "착순과 베팅 배당을 확인하세요");
  }, [aiBets, playerBets, race]);

  const moveHorse = useCallback((horseId: number, actor: "player" | "ai", symbol: SymbolId) => {
    const horse = horses.find((item) => item.id === horseId);
    if (!horse) return;
    const result = wcMoveHorse(horses, horseId, symbol, usedHorseIds, paceHorseId);
    const nextHorses = result.horses as Horse[];
    setHorses(nextHorses);
    setUsedHorseIds(result.usedHorseIds);
    setPaceHorseId(result.paceHorseId);
    setNotice(`${actor === "player" ? "내가" : "AI가"} ${horse.name}을 ${result.moved}칸 이동했습니다`);

    if (nextHorses.filter((item) => item.finishedRank).length >= 3) {
      finishRace(nextHorses, result.paceHorseId);
    } else {
      setPhase(actor === "player" ? "ai-roll" : "player-roll");
    }
  }, [finishRace, horses, paceHorseId, usedHorseIds]);

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
    setAiBets(wcChooseAiBets(horses));
    setPhase("ai-betting");
    setNotice("AI가 비공개 베팅을 고르고 있습니다");
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
    moveHorse(horseId, "player", lastRoll);
  }

  function startNextRace() {
    const nextRace = race + 1;
    setRace(nextRace);
    setHorses(createRaceHorses(nextRace));
    setPhase("betting");
    setPlayerBets([]);
    setAiBets([]);
    setUsedHorseIds([]);
    setPaceHorseId(null);
    setLastRoll(null);
    setSettlement(null);
    setNotice("새 경주입니다. 서로 다른 말 세 마리에 베팅하세요");
  }

  function resetGame() {
    setRace(1);
    setHorses(createRaceHorses(1));
    setPhase("betting");
    setPlayerBets([]);
    setAiBets([]);
    setUsedHorseIds([]);
    setPaceHorseId(null);
    setLastRoll(null);
    setPlayerMoney(1000);
    setAiMoney(1000);
    setSettlement(null);
    setNotice("서로 다른 말 세 마리에 1·1·2칩을 베팅하세요");
  }

  useEffect(() => {
    if (phase !== "ai-betting") return;
    const timer = window.setTimeout(() => {
      setPhase("player-roll");
      setNotice("AI의 베팅이 완료됐습니다. 특수 주사위를 굴리세요");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ai-roll") return;
    const timer = window.setTimeout(() => {
      const symbol = wcRollSymbol() as SymbolId;
      const meta = WC_SYMBOLS.find((item) => item.id === symbol);
      setLastRoll(symbol);
      setNotice(`AI가 ${meta?.label} 문양을 굴렸습니다`);
      setPhase("ai-move");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ai-move" || !lastRoll) return;
    const timer = window.setTimeout(() => {
      const horseId = wcChooseAiHorse(
        horses,
        usedHorseIds,
        lastRoll,
        aiBets,
        playerBets,
      );
      if (horseId != null) moveHorse(horseId, "ai", lastRoll);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [aiBets, horses, lastRoll, moveHorse, phase, playerBets, usedHorseIds]);

  const revealAiBets = phase === "race-result" || phase === "game-result";
  const finalWinner =
    playerMoney === aiMoney ? "무승부입니다" : playerMoney > aiMoney ? "승리했습니다!" : "AI가 승리했습니다";

  return (
    <main className="game-shell winners-shell">
      <GameTopbar onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel">
          <div>
            <span className="eyebrow">BET · ROLL · RACE</span>
            <h1>위너스<br />서클</h1>
            <p>세 번의 경주에서 유망한 말을 골라 베팅하고, 특수 주사위로 경주의 흐름을 바꿔보세요.</p>
          </div>
          <ModeSwitch />
          <div className="winners-score-card">
            <span><small>나</small><strong>{formatChips(playerMoney)}</strong></span>
            <i>VS</i>
            <span><small>AI</small><strong>{formatChips(aiMoney)}</strong></span>
          </div>
        </aside>

        <div className="board-panel winners-board-panel">
          <div className="wc-status">
            <span className="wc-round-pill">{race}/3 RACE</span>
            <div><strong>{phaseTitle}</strong><span aria-live="polite">{notice}</span></div>
            <button className="wc-rules-button" onClick={() => setShowRules(true)}>ⓘ 게임 방법</button>
          </div>

          <div className="wc-race-board">
            <div className="wc-track-heading">
              <span>START</span>
              <b>선두마 {WC_PACE_AT}</b>
              <span>FINISH</span>
            </div>

            <div className="wc-horses">
              {horses.map((horse, index) => {
                const playerBet = playerBets.find((bet) => bet.horseId === horse.id);
                const aiBet = aiBets.find((bet) => bet.horseId === horse.id);
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
                        {revealAiBets && aiBet && <b className="ai">AI {aiBet.value}×</b>}
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
                <div className="wc-delta">
                  <span><small>나의 정산</small><strong>{deltaText(settlement.playerDelta)}칩</strong></span>
                  <i>VS</i>
                  <span><small>AI 정산</small><strong>{deltaText(settlement.aiDelta)}칩</strong></span>
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
              {phase === "ai-betting" && <button className="wc-primary waiting" disabled>AI 비공개 베팅 중…</button>}
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
                  {phase === "ai-roll" ? "AI가 주사위를 굴리는 중…" : "AI가 움직일 말을 선택 중…"}
                </button>
              )}
              {phase === "race-result" && <button className="wc-primary" onClick={startNextRace}>다음 경주</button>}
              {phase === "game-result" && <button className="wc-primary" onClick={resetGame}>새 게임</button>}
              <button className="wc-reset" onClick={resetGame}>↻ 처음부터</button>
            </div>
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
              <li><b>베팅</b><span>서로 다른 말 3마리에 1·1·2칩을 놓습니다. AI의 베팅은 경주가 끝난 뒤 공개됩니다.</span></li>
              <li><b>경주</b><span>특수 주사위를 굴린 뒤 아직 움직이지 않은 말을 골라, 해당 문양의 수치만큼 전진시킵니다.</span></li>
              <li><b>착순</b><span>세 번째 말이 결승선을 넘으면 경주가 끝납니다. 1·2·3위는 배당을 받고 최하위 베팅은 감점됩니다.</span></li>
              <li><b>보너스</b><span>중간 지점에 가장 먼저 도달한 선두마가 3위 안에 들면 추가 배당을 받습니다.</span></li>
              <li><b>승리</b><span>3경주는 배당과 감점이 2배입니다. 세 경주 후 칩이 더 많은 쪽이 이깁니다.</span></li>
            </ol>
            <button className="wc-primary" onClick={() => setShowRules(false)}>확인</button>
          </section>
        </div>
      )}
    </main>
  );
}
