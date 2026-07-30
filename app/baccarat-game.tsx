"use client";

import { useEffect, useState } from "react";
import {
  BACCARAT_BETS,
  baccaratCreateGame,
  baccaratFinishGame,
  baccaratNextRound,
  baccaratPlayRound,
} from "./baccarat-engine.js";

type BetType = "player" | "banker" | "tie";
type Card = { id: string; symbol: string; color: "red" | "black"; rank: string; value: number };
type RoundResult = {
  playerCards: Card[]; bankerCards: Card[]; playerTotal: number; bankerTotal: number;
  initialPlayerTotal: number; initialBankerTotal: number; natural: boolean;
  playerDrew: boolean; bankerDrew: boolean; winner: BetType; betType: BetType;
  amount: number; profit: number; round: number;
};
type BaccaratGameState = {
  phase: "betting" | "result" | "finished"; round: number; roundLimit: number;
  startingChips: number; chips: number; shoe: Card[];
  history: { round: number; winner: BetType; playerTotal: number; bankerTotal: number }[];
  stats: Record<BetType, number>; lastRound: RoundResult | null; message: string;
};

const RULES = [
  ["게임 목표", "플레이어와 뱅커 중 9에 더 가까운 쪽, 또는 같은 점수인 타이를 예측합니다. 10라운드 뒤 시작 칩보다 많은 가상 칩을 보유하면 챌린지에 성공합니다."],
  ["카드 점수", "A는 1점, 2~9는 표시 숫자, 10·J·Q·K는 0점입니다. 카드 합이 10 이상이면 일의 자리만 사용하므로 7과 8은 5점입니다."],
  ["처음 네 장", "플레이어와 뱅커가 두 장씩 받습니다. 어느 한쪽이라도 처음 두 장 합계가 8 또는 9이면 내추럴로 즉시 비교합니다."],
  ["플레이어 제3카드", "내추럴이 아니면 플레이어는 0~5점에서 한 장을 더 받고 6~7점에서 멈춥니다."],
  ["뱅커 제3카드", "플레이어가 멈추면 뱅커는 0~5점에서 받습니다. 플레이어가 받았다면 뱅커 점수와 그 제3카드에 정해진 공식 표를 자동 적용합니다."],
  ["가상 칩 정산", "플레이어 적중은 1:1, 뱅커 적중은 5% 커미션을 제외한 0.95:1, 타이 적중은 8:1입니다. 타이 때 플레이어·뱅커 선택은 원금을 돌려받습니다."],
  ["안내", "이 게임은 규칙 학습용 가상 칩 게임이며 실제 화폐, 결제, 환전 또는 보상을 제공하지 않습니다."],
];

const TUTORIAL = [
  ["결과를 고르세요", "‘플레이어’는 내 패라는 뜻이 아니라 테이블에 놓이는 두 패 중 하나의 이름입니다. 플레이어·뱅커·타이 중 하나를 예측하세요."],
  ["가상 칩을 정하세요", "10·50·100·200칩 중 하나를 선택합니다. 보유한 칩보다 많이 놓을 수 없습니다."],
  ["딜러가 자동 진행합니다", "카드 받기 규칙은 선택 사항이 아닙니다. 자동 딜러가 내추럴과 제3카드 표를 그대로 적용합니다."],
  ["점수는 끝자리만 봅니다", "합계 17은 7점, 합계 20은 0점입니다. 9점에 더 가까운 패가 승리합니다."],
  ["기록을 확인하세요", "상단 로드맵에서 P는 플레이어, B는 뱅커, T는 타이 결과입니다. 이전 결과는 다음 결과를 보장하지 않습니다."],
  ["10라운드 챌린지", "마지막 라운드까지 가상 칩을 관리하세요. 시작 칩보다 많으면 성공, 같으면 무승부, 적으면 재도전입니다."],
];

function Topbar({ onExit }: { onExit: () => void }) {
  return <header className="bc-topbar"><button onClick={onExit} aria-label="게임 목록으로">←</button><div><small>PLAYROOM · TABLE CLASSIC</small><strong>바카라</strong></div><button onClick={onExit}>나가기</button></header>;
}

function PlayingCard({ card, hidden = false, delay = 0 }: { card?: Card; hidden?: boolean; delay?: number }) {
  if (!card || hidden) return <div className="bc-card back" style={{ "--delay": `${delay}ms` } as React.CSSProperties}><span>PLAY</span><i>◆</i><small>ROOM</small></div>;
  return <div className={`bc-card face ${card.color}`} style={{ "--delay": `${delay}ms` } as React.CSSProperties}><span>{card.rank}</span><i>{card.symbol}</i><small>{card.rank}</small></div>;
}

function Guide({ mode, step, onStep, onClose }: { mode: "rules" | "tutorial"; step: number; onStep: (value: number) => void; onClose: () => void }) {
  const item = TUTORIAL[step];
  return <div className="bc-modal-bg" onClick={onClose}><section className="bc-guide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
    <button className="bc-close" onClick={onClose} aria-label="닫기">×</button>
    <small>BACCARAT GUIDE</small><h2>{mode === "rules" ? "게임 방법" : "빠른 튜토리얼"}</h2>
    {mode === "rules" ? <div className="bc-rule-list">{RULES.map(([title, text], index) => <article key={title}><b>{index + 1}</b><div><h3>{title}</h3><p>{text}</p></div></article>)}</div> :
      <div className="bc-tutorial"><div className="bc-tutorial-mark">{step + 1}</div><p>{step + 1} / {TUTORIAL.length}</p><h3>{item[0]}</h3><div className="bc-tutorial-visual">{["P", "50", "♠", "9", "P·B·T", "10"][step]}</div><p>{item[1]}</p><footer><button disabled={step === 0} onClick={() => onStep(step - 1)}>이전</button>{step < TUTORIAL.length - 1 ? <button className="primary" onClick={() => onStep(step + 1)}>다음</button> : <button className="primary" onClick={onClose}>시작하기</button>}</footer></div>}
  </section></div>;
}

function Hand({ label, side, cards, total, revealCount, offset, note }: { label: string; side: BetType; cards: Card[]; total?: number; revealCount: number; offset: number; note?: string }) {
  return <section className={`bc-hand ${side}`}><header><div><small>{side === "player" ? "PUNTO" : "BANCO"}</small><h2>{label}</h2></div><strong>{total == null ? "—" : total}</strong></header>
    <div className="bc-cards">{cards.length ? cards.map((card, index) => <PlayingCard key={card.id} card={card} hidden={revealCount <= offset + index} delay={index * 100} />) : <><PlayingCard /><PlayingCard /></>}</div>
    <p>{note || "두 장의 합과 자동 제3카드 규칙을 확인하세요"}</p>
  </section>;
}

function Roadmap({ history }: { history: BaccaratGameState["history"] }) {
  return <section className="bc-road"><header><div><small>BEAD ROAD</small><h3>결과 로드맵</h3></div><div className="bc-road-legend"><span className="p">P</span><span className="b">B</span><span className="t">T</span></div></header>
    <div className="bc-road-grid">{Array.from({ length: 30 }, (_, index) => { const item = history[index]; return <i key={index} className={item?.winner || ""} title={item ? `${item.round}라운드 ${BACCARAT_BETS[item.winner].label}` : ""}>{item ? item.winner[0].toUpperCase() : ""}</i>; })}</div>
  </section>;
}

export function BaccaratGame({ onExit }: { onExit: () => void }) {
  const [game, setGame] = useState<BaccaratGameState | null>(null);
  const [roundLimit, setRoundLimit] = useState(10);
  const [betType, setBetType] = useState<BetType>("player");
  const [betAmount, setBetAmount] = useState(50);
  const [revealCount, setRevealCount] = useState(9);
  const [guide, setGuide] = useState<"rules" | "tutorial" | null>(null);
  const [tutorialStep, setTutorialStep] = useState(0);

  const last = game?.lastRound;
  const totalCards = last ? last.playerCards.length + last.bankerCards.length : 0;
  useEffect(() => {
    if (!game || game.phase !== "result" || revealCount >= totalCards) return;
    const timer = window.setTimeout(() => setRevealCount((value) => value + 1), 360);
    return () => window.clearTimeout(timer);
  }, [game, revealCount, totalCards]);

  const start = () => {
    setGame(baccaratCreateGame({ roundLimit }) as BaccaratGameState);
    setBetType("player"); setBetAmount(50); setRevealCount(9);
  };
  const play = () => {
    if (!game) return;
    setGame(baccaratPlayRound(game, betType, betAmount) as BaccaratGameState);
    setRevealCount(0);
  };
  const next = () => {
    if (!game) return;
    setGame(baccaratNextRound(game) as BaccaratGameState);
    setRevealCount(9);
  };

  if (!game) return <main className="bc-shell lobby"><Topbar onExit={onExit} /><section className="bc-hero"><div className="bc-hero-copy"><small>CLASSIC PUNTO BANCO</small><h1>바카라</h1><p>선택은 단순하게, 판정은 정확하게.<br />9에 가까운 패를 예측하는 10라운드 가상 칩 챌린지입니다.</p><div className="bc-safe">가상 칩 전용 · 실제 화폐 및 환전 없음</div></div><div className="bc-hero-table" aria-hidden="true"><span className="bc-hero-card one">A<i>♦</i></span><span className="bc-hero-card two">8<i>♠</i></span><span className="bc-nine">9</span></div></section>
    <section className="bc-lobby-panel"><div><small>SESSION LENGTH</small><h2>게임 설정</h2><p>짧고 명확한 한 세션으로 바카라의 자동 규칙을 익혀보세요.</p></div><label>라운드 수<div className="bc-segment">{[10, 20].map((value) => <button key={value} className={roundLimit === value ? "active" : ""} onClick={() => setRoundLimit(value)}>{value}라운드</button>)}</div></label><div className="bc-lobby-actions"><button onClick={() => setGuide("rules")}>게임 방법</button><button onClick={() => { setTutorialStep(0); setGuide("tutorial"); }}>튜토리얼</button><button className="primary" onClick={start}>게임 시작 →</button></div></section>
    <section className="bc-goal"><span>01</span><div><small>GAME OBJECTIVE</small><h2>가상 칩을 지키며 9를 예측하세요</h2><p>세션이 끝났을 때 시작 칩 1,000개보다 많이 보유하면 챌린지 성공입니다. 이전 결과는 다음 결과의 확률을 바꾸지 않습니다.</p></div></section>
    {guide && <Guide mode={guide} step={tutorialStep} onStep={setTutorialStep} onClose={() => setGuide(null)} />}</main>;

  if (game.phase === "finished") {
    const difference = Math.round((game.chips - game.startingChips) * 100) / 100;
    return <main className="bc-shell"><Topbar onExit={onExit} /><section className={`bc-finish ${difference > 0 ? "win" : difference === 0 ? "draw" : "lose"}`}><small>SESSION COMPLETE</small><span>{difference > 0 ? "◆" : difference === 0 ? "◇" : "○"}</span><h1>{difference > 0 ? "챌린지 성공" : difference === 0 ? "가상 칩 방어" : "세션 종료"}</h1><p>{game.message}</p><strong>{game.chips.toLocaleString()} <small>CHIPS</small></strong><div className="bc-final-stats"><i><b>{game.stats.player}</b>플레이어</i><i><b>{game.stats.banker}</b>뱅커</i><i><b>{game.stats.tie}</b>타이</i></div><Roadmap history={game.history} /><footer><button onClick={onExit}>게임 목록</button><button className="primary" onClick={start}>다시 플레이</button></footer></section></main>;
  }

  const fullyRevealed = game.phase === "result" && revealCount >= totalCards;
  const playerNote = last?.natural ? "내추럴 — 제3카드 없이 판정" : last?.playerDrew ? "0~5점 규칙으로 제3카드 받음" : last ? "6~7점 규칙으로 스탠드" : undefined;
  const bankerNote = last?.natural ? "내추럴 — 제3카드 없이 판정" : last?.bankerDrew ? "뱅커 제3카드 표에 따라 받음" : last ? "뱅커 제3카드 표에 따라 스탠드" : undefined;
  return <main className="bc-shell"><Topbar onExit={onExit} /><section className="bc-status"><div><small>ROUND</small><strong>{game.round}<i>/</i>{game.roundLimit}</strong></div><div className="bc-bankroll"><small>MY VIRTUAL CHIPS</small><strong>{game.chips.toLocaleString()}</strong></div><div className="bc-status-actions"><button onClick={() => setGuide("rules")}>ⓘ 규칙</button><button onClick={() => setGame(baccaratFinishGame(game) as BaccaratGameState)}>종료</button></div></section>
    <Roadmap history={game.history} />
    <section className={`bc-table ${game.phase}`}><div className="bc-felt-label">PLAYROOM BACCARAT · AI DEALER</div>
      <Hand label="뱅커" side="banker" cards={last?.bankerCards || []} total={fullyRevealed ? last?.bankerTotal : undefined} revealCount={revealCount} offset={last?.playerCards.length || 0} note={bankerNote} />
      <div className="bc-versus"><span>9</span><i>VS</i><span>9</span></div>
      <Hand label="플레이어" side="player" cards={last?.playerCards || []} total={fullyRevealed ? last?.playerTotal : undefined} revealCount={revealCount} offset={0} note={playerNote} />
      {fullyRevealed && last && <div className={`bc-result-ribbon ${last.winner}`}><small>{BACCARAT_BETS[last.winner].label} 승리</small><strong>{game.message}</strong></div>}
    </section>
    {game.phase === "betting" ? <section className="bc-betting"><header><div><small>PLACE VIRTUAL CHIPS</small><h2>결과를 예측하세요</h2></div><b>{betAmount}칩</b></header><div className="bc-bet-zones">{(["player", "tie", "banker"] as BetType[]).map((type) => <button key={type} className={`${type} ${betType === type ? "active" : ""}`} onClick={() => setBetType(type)}><small>{type === "player" ? "PUNTO" : type === "banker" ? "BANCO" : "DRAW"}</small><strong>{BACCARAT_BETS[type].label}</strong><span>{BACCARAT_BETS[type].payout}</span></button>)}</div><div className="bc-chip-row">{[10, 50, 100, 200].map((amount) => <button key={amount} disabled={amount > game.chips} className={betAmount === amount ? "active" : ""} onClick={() => setBetAmount(amount)}>{amount}</button>)}<button className="deal" disabled={betAmount > game.chips} onClick={play}>카드 공개</button></div><p>뱅커 적중 수익에는 공식 5% 커미션이 반영됩니다.</p></section> :
      <section className="bc-result-actions" aria-live="polite"><p>{fullyRevealed ? game.message : "AI 딜러가 정해진 제3카드 규칙을 적용하고 있습니다…"}</p><button className="primary" disabled={!fullyRevealed} onClick={next}>{game.round >= game.roundLimit || game.chips < 10 ? "결과 보기" : "다음 라운드"}</button></section>}
    {guide && <Guide mode={guide} step={tutorialStep} onStep={setTutorialStep} onClose={() => setGuide(null)} />}</main>;
}
