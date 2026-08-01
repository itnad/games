"use client";

import { useEffect, useState } from "react";
import {
  CFE_GROWTH_TRACK,
  CFE_INNER_TRACK,
  CFE_SPACE_LABELS,
  cfeBorrow,
  cfeChooseAiAction,
  cfeCreateGame,
  cfeFinancials,
  cfeRanking,
  cfeRepayBank,
  cfeRepayLiability,
  cfeResolvePending,
  cfeRoll,
} from "./cashflow-escape-engine.js";

type Difficulty = "casual" | "balanced" | "sharp";
type Stage = "cycle" | "growth";
type Asset = { id: string; name: string; category: string; cost: number; value: number; income: number; description: string; acquiredTurn: number; size?: string; multiplier?: number };
type Liability = { id: string; name: string; balance: number; payment: number };
type Profession = { id: string; name: string; salary: number; savings: number; expenses: number };
type Dream = { id: string; name: string; cost: number; icon: string };
type Player = {
  id: number; name: string; isHuman: boolean; profession: Profession; dream: Dream;
  cash: number; baseExpenses: number; liabilities: Liability[]; bankLoan: number;
  assets: Asset[]; children: number; position: number; stage: Stage;
  growthTarget: number | null; skipTurns: number; charityTurns: number; turns: number;
};
type Pending = {
  kind: "deal" | "market" | "charity" | "vision"; playerId: number;
  card?: Asset; amount?: number; assetIds?: string[]; dream?: Dream;
};
type Standing = { id: number; name: string; stage: Stage; cash: number; passive: number; netWorth: number };
type Game = {
  playerCount: number; difficulty: Difficulty; players: Player[]; currentPlayer: number;
  phase: "playing" | "finished"; pending: Pending | null; turn: number;
  lastRoll: { playerId: number; values: number[]; used: number } | null;
  lastEvent: string; log: string[]; winner: number | null; standings: Standing[] | null;
};

const SAVE_KEY = "playroom-cashflow-escape-save-v1";
const RULES = [
  ["게임 목표", "보유한 부동산·주식·사업체 등의 자산에서 매월 들어오는 자산소득을 총지출 이상으로 만들어 생활 순환로를 벗어나세요. 성장 트랙에서는 수입 목표를 달성하거나 선택한 인생 목표를 실현하면 승리합니다."],
  ["재무제표", "급여와 자산소득은 수입, 생활비·부채 상환·가족비·운영자금 이자는 지출입니다. 월 현금흐름은 총수입에서 총지출을 뺀 값입니다."],
  ["투자 기회", "작은 기회는 적은 현금으로 시작할 수 있고 큰 기회는 더 많은 자산소득을 만듭니다. 가격보다 수익률과 남길 비상금을 함께 확인하세요."],
  ["부채와 대출", "기존 부채를 완납하면 매월 지출이 줄어듭니다. 운영자금 대출은 바로 현금을 주지만 대출액의 10%가 월지출에 추가됩니다."],
  ["시장 변화", "시장 칸에서는 특정 자산을 높은 가격에 매각할 수 있습니다. 좋은 자산을 계속 보유할지 현금을 확보할지 선택하세요."],
  ["성장 트랙", "자산소득이 총지출 이상이 되는 즉시 성장 트랙으로 이동합니다. 더 큰 투자와 성장 수익을 활용해 인생 목표 비용을 마련하세요."],
  ["교육용 안내", "게임 속 수치와 상품은 모두 가상이며 실제 투자 수익이나 금융 조언을 의미하지 않습니다."],
];
const TUTORIAL = [
  ["재무제표부터 보세요", "현금보다 먼저 자산소득과 총지출의 차이를 확인하세요. 이 차이가 0 이상이 되는 것이 첫 목표입니다."],
  ["월급날을 활용하세요", "월급날에는 월 현금흐름만큼 현금이 변합니다. 현금흐름이 음수라면 자동으로 운영자금 대출이 발생합니다."],
  ["수익률과 비상금", "투자 수익률이 높아도 현금을 모두 쓰면 생활 사건에 취약합니다. 매입 후 남는 현금도 함께 살펴보세요."],
  ["부채를 줄이세요", "현금 여유가 생기면 월 상환액이 큰 부채부터 갚아 총지출을 낮추는 것도 빠른 탈출 전략입니다."],
  ["시장은 출구입니다", "자산의 시장가가 올랐을 때 매각하면 더 큰 기회를 잡을 현금을 만들 수 있지만 자산소득은 줄어듭니다."],
  ["두 번째 목표", "성장 트랙에 들어간 뒤에는 인생 목표를 살 수 있는 현금 또는 추가 자산소득 목표 중 하나를 먼저 달성하세요."],
];

function money(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("ko-KR")}만원`;
}

function Topbar({ onExit, onSave }: { onExit: () => void; onSave?: () => void }) {
  return <header className="cfe-topbar"><button onClick={onExit} aria-label="게임 목록으로">←</button><div><small>PLAYROOM · FINANCIAL SIMULATION</small><strong>현금흐름 탈출</strong></div><div>{onSave && <button onClick={onSave}>저장</button>}<button onClick={onExit}>나가기</button></div></header>;
}

function Guide({ mode, step, onStep, onClose }: { mode: "rules" | "tutorial"; step: number; onStep: (step: number) => void; onClose: () => void }) {
  const item = TUTORIAL[step];
  return <div className="cfe-modal-bg" onClick={onClose}><section className="cfe-guide" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="cfe-close" onClick={onClose}>×</button><small>FINANCIAL GUIDE</small><h2>{mode === "rules" ? "게임 방법" : "빠른 튜토리얼"}</h2>
    {mode === "rules" ? <div className="cfe-rules">{RULES.map(([title, text], index) => <article key={title}><b>{index + 1}</b><div><h3>{title}</h3><p>{text}</p></div></article>)}</div> : <div className="cfe-tutorial"><span>{["▤", "₩", "%", "↓", "↗", "✦"][step]}</span><div>{TUTORIAL.map((_, index) => <i className={index <= step ? "active" : ""} key={index} />)}</div><small>{step + 1} / {TUTORIAL.length}</small><h3>{item[0]}</h3><p>{item[1]}</p><footer><button disabled={step === 0} onClick={() => onStep(step - 1)}>이전</button>{step < TUTORIAL.length - 1 ? <button className="primary" onClick={() => onStep(step + 1)}>다음</button> : <button className="primary" onClick={onClose}>준비 완료</button>}</footer></div>}
  </section></div>;
}

function FinanceStatement({ player, onRepay }: { player: Player; onRepay?: (id: string) => void }) {
  const finance = cfeFinancials(player);
  const progress = Math.min(100, Math.round(finance.passiveIncome / Math.max(1, finance.totalExpenses) * 100));
  return <section className="cfe-statement"><header><div><small>PERSONAL FINANCIAL STATEMENT</small><h2>{player.profession.name}</h2></div><strong>{money(player.cash)}<small>보유 현금</small></strong></header>
    <div className="cfe-freedom-meter"><div><span>자산소득 {money(finance.passiveIncome)}</span><span>총지출 {money(finance.totalExpenses)}</span></div><i><b style={{ width: `${progress}%` }} /></i><small>{player.stage === "growth" ? `성장 수입 목표 ${money(player.growthTarget || 0)}` : `재무 자유까지 ${money(Math.max(0, finance.totalExpenses - finance.passiveIncome))}`}</small></div>
    <div className="cfe-ledger"><article><h3>수입</h3><span><b>급여</b><em>{money(player.profession.salary)}</em></span><span><b>자산소득</b><em className="positive">{money(finance.passiveIncome)}</em></span><strong><b>총수입</b><em>{money(finance.totalIncome)}</em></strong></article><article><h3>지출</h3><span><b>기본 생활비</b><em>{money(player.baseExpenses)}</em></span><span><b>부채 상환</b><em>{money(finance.debtPayments)}</em></span><span><b>가족·대출</b><em>{money(finance.childExpense + Math.ceil(player.bankLoan * .1))}</em></span><strong><b>총지출</b><em>{money(finance.totalExpenses)}</em></strong></article></div>
    <div className={`cfe-monthly ${finance.monthlyCashflow >= 0 ? "positive" : "negative"}`}><span>월 현금흐름</span><strong>{finance.monthlyCashflow >= 0 ? "+" : ""}{money(finance.monthlyCashflow)}</strong></div>
    <details open><summary>자산 <b>{player.assets.length}</b></summary>{player.assets.length ? player.assets.map((asset, index) => <span key={`${asset.id}-${index}`}><i>{asset.category === "realestate" ? "⌂" : asset.category === "stock" ? "↗" : asset.category === "business" ? "◫" : "◇"}</i><b>{asset.name}<small>가치 {money(asset.value)}</small></b><em>+{money(asset.income)}/월</em></span>) : <p>아직 보유 자산이 없습니다.</p>}</details>
    <details><summary>부채 <b>{player.liabilities.length + (player.bankLoan ? 1 : 0)}</b></summary>{player.liabilities.map((item) => <span key={item.id}><i>−</i><b>{item.name}<small>월 {money(item.payment)}</small></b><em>{money(item.balance)}{onRepay && <button disabled={player.cash < item.balance} onClick={() => onRepay(item.id)}>완납</button>}</em></span>)}{player.bankLoan > 0 && <span><i>−</i><b>운영자금 대출<small>월 {money(Math.ceil(player.bankLoan * .1))}</small></b><em>{money(player.bankLoan)}</em></span>}</details>
  </section>;
}

function PendingCard({ game, onResolve, onBorrow }: { game: Game; onResolve: (choice: string, option?: string) => void; onBorrow: () => void }) {
  const pending = game.pending!;
  const player = game.players[pending.playerId];
  const finance = cfeFinancials(player);
  if (pending.kind === "deal" && pending.card) {
    const card = pending.card;
    const roi = Math.round(card.income / card.cost * 100);
    return <div className="cfe-modal-bg"><section className="cfe-event-card deal"><small>{card.size === "venture" ? "GROWTH VENTURE" : "INVESTMENT OPPORTUNITY"}</small><span className="cfe-event-icon">{card.category === "realestate" ? "⌂" : card.category === "stock" ? "↗" : card.category === "business" ? "◫" : "◇"}</span><h2>{card.name}</h2><p>{card.description}</p><div className="cfe-deal-numbers"><span><small>필요 현금</small><b>{money(card.cost)}</b></span><span><small>월 자산소득</small><b>+{money(card.income)}</b></span><span><small>현금 수익률</small><b>{roi}%</b></span><span><small>예상 가치</small><b>{money(card.value)}</b></span></div><p className="cfe-balance">현재 현금 {money(player.cash)} · 매입 후 {money(player.cash - card.cost)}</p><footer><button onClick={() => onResolve("skip")}>이번 기회 넘기기</button>{player.cash < card.cost && <button className="loan" onClick={onBorrow}>+100만원 대출</button>}<button className="primary" disabled={player.cash < card.cost} onClick={() => onResolve("buy")}>투자하기</button></footer></section></div>;
  }
  if (pending.kind === "market" && pending.card) {
    const assets = player.assets.filter((asset) => pending.assetIds?.includes(asset.id));
    return <div className="cfe-modal-bg"><section className="cfe-event-card market"><small>MARKET UPDATE</small><span className="cfe-event-icon">↗</span><h2>{pending.card.name}</h2><p>{pending.card.description}</p><div className="cfe-market-assets">{assets.map((asset, index) => <button key={`${asset.id}-${index}`} onClick={() => onResolve("sell", asset.id)}><span>{asset.name}</span><small>현재 자산소득 −{money(asset.income)}</small><b>{money(Math.round(asset.value * (pending.card?.multiplier || 1)))}에 매각</b></button>)}</div><footer><button onClick={() => onResolve("skip")}>계속 보유</button></footer></section></div>;
  }
  if (pending.kind === "charity") return <div className="cfe-modal-bg"><section className="cfe-event-card charity"><small>COMMUNITY CHOICE</small><span className="cfe-event-icon">♡</span><h2>작은 나눔, 넓은 기회</h2><p>50만원을 나누면 다음 세 차례 동안 주사위 두 개를 굴려 높은 값을 사용합니다.</p><div className="cfe-deal-numbers"><span><small>나눔 금액</small><b>{money(pending.amount || 0)}</b></span><span><small>현재 현금</small><b>{money(player.cash)}</b></span></div><footer><button onClick={() => onResolve("skip")}>다음에 참여</button><button className="primary" disabled={player.cash < (pending.amount || 0)} onClick={() => onResolve("accept")}>나눔 참여</button></footer></section></div>;
  return <div className="cfe-modal-bg"><section className="cfe-event-card vision"><small>LIFE VISION</small><span className="cfe-event-icon">{pending.dream?.icon}</span><h2>{pending.dream?.name}</h2><p>재무 자유 이후 선택한 인생 목표를 지금 실현할 수 있습니다.</p><div className="cfe-deal-numbers"><span><small>필요 현금</small><b>{money(pending.dream?.cost || 0)}</b></span><span><small>현재 현금</small><b>{money(player.cash)}</b></span><span><small>월 자산소득</small><b>{money(finance.passiveIncome)}</b></span></div><footer><button onClick={() => onResolve("skip")}>다음 기회</button><button className="primary" onClick={() => onResolve("buy")}>목표 실현</button></footer></section></div>;
}

function Result({ game, onRestart, onExit }: { game: Game; onRestart: () => void; onExit: () => void }) {
  const standings = game.standings || cfeRanking(game);
  return <main className="cfe-shell"><Topbar onExit={onExit} /><section className="cfe-result"><span>FINANCIAL FREEDOM</span><h1>{game.winner === 0 ? "나만의 재무 자유를 완성했습니다!" : `${game.players[game.winner || 0].name}가 먼저 목표를 달성했습니다`}</h1><p>{game.lastEvent}</p><div>{standings.map((item, index) => <article className={item.id === 0 ? "human" : ""} key={item.id}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{item.stage === "growth" ? "성장 트랙" : "생활 순환로"} · 순자산 {money(item.netWorth)}</small></span><em>자산소득 {money(item.passive)}</em></article>)}</div><footer><button onClick={onExit}>게임 목록</button><button className="primary" onClick={onRestart}>같은 설정으로 다시 시작</button></footer></section></main>;
}

export function CashflowEscapeGame({ onExit }: { onExit: () => void }) {
  const [playerCount, setPlayerCount] = useState(4);
  const [difficulty, setDifficulty] = useState<Difficulty>("balanced");
  const [game, setGame] = useState<Game | null>(null);
  const [guide, setGuide] = useState<"rules" | "tutorial" | null>(null);
  const [guideStep, setGuideStep] = useState(0);
  const [trackView, setTrackView] = useState<Stage | null>(null);

  const store = (next: Game) => { setGame(next); window.localStorage.setItem(SAVE_KEY, JSON.stringify(next)); };
  const start = () => store(cfeCreateGame(playerCount, difficulty) as Game);
  const load = () => {
    const saved = window.localStorage.getItem(SAVE_KEY);
    if (!saved) return;
    try { setGame(JSON.parse(saved) as Game); } catch { window.localStorage.removeItem(SAVE_KEY); }
  };
  const openGuide = (mode: "rules" | "tutorial") => { setGuide(mode); setGuideStep(0); };

  useEffect(() => {
    if (!game || game.phase !== "playing" || game.currentPlayer === 0) return;
    const timer = window.setTimeout(() => setGame((current) => {
      if (!current) return current;
      const next = cfeChooseAiAction(current, current.currentPlayer) as Game;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      return next;
    }), 650);
    return () => window.clearTimeout(timer);
  }, [game]);

  if (!game) return <main className="cfe-shell"><Topbar onExit={onExit} /><section className="cfe-lobby"><div className="cfe-hero-copy"><small>A FINANCIAL LIFE SIMULATION</small><h1>월급을 모으는 삶에서<br /><em>자산이 일하는 삶으로</em></h1><p>직업마다 다른 재무제표에서 출발해 현금흐름을 읽고, 나만의 투자 원칙으로 생활 순환로를 탈출하세요.</p><div><button onClick={() => openGuide("rules")}>◎ 게임 방법</button><button onClick={() => openGuide("tutorial")}>▷ 튜토리얼</button></div><span>※ 모든 상품과 수치는 교육용으로 만든 가상 정보입니다.</span></div>
    <div className="cfe-hero-art" aria-hidden="true"><i className="orbit outer" /><i className="orbit inner" /><span className="won">₩</span><div className="cfe-hero-cards"><i><small>ASSET</small><b>+125</b><span>MONTHLY</span></i><i><small>EXPENSE</small><b>−80</b><span>MONTHLY</span></i><i><small>CASHFLOW</small><b>+45</b><span>MONTHLY</span></i></div></div>
    <aside className="cfe-setup"><small>NEW JOURNEY</small><h2>게임 설정</h2><fieldset><legend>참가 인원</legend><div className="cfe-count">{[2,3,4,5,6].map((count) => <button className={playerCount === count ? "active" : ""} onClick={() => setPlayerCount(count)} key={count}>{count}</button>)}</div><p>나 1명 + AI {playerCount - 1}명</p></fieldset><fieldset><legend>AI 투자 성향</legend>{[["casual","연습생","안전한 현금 여유를 중시합니다."],["balanced","분석가","수익률과 부채를 균형 있게 봅니다."],["sharp","투자가","현금흐름 개선 기회를 빠르게 잡습니다."]].map(([value,label,text]) => <label className={difficulty === value ? "active" : ""} key={value}><input type="radio" checked={difficulty === value} onChange={() => setDifficulty(value as Difficulty)} /><span><b>{label}</b><small>{text}</small></span></label>)}</fieldset><button className="cfe-start" onClick={start}>재무 여정 시작 <span>→</span></button><button className="cfe-load" onClick={load}>저장된 게임 불러오기</button></aside></section>{guide && <Guide mode={guide} step={guideStep} onStep={setGuideStep} onClose={() => setGuide(null)} />}</main>;

  if (game.phase === "finished") return <Result game={game} onRestart={() => store(cfeCreateGame(playerCount, difficulty) as Game)} onExit={onExit} />;

  const player = game.players[0];
  const finance = cfeFinancials(player);
  const view = trackView || player.stage;
  const track = view === "growth" ? CFE_GROWTH_TRACK : CFE_INNER_TRACK;
  const myTurn = game.currentPlayer === 0;
  const active = game.players[game.currentPlayer];
  const resolve = (choice: string, option?: string) => store(cfeResolvePending(game, 0, choice, option) as Game);
  return <main className="cfe-shell"><Topbar onExit={onExit} onSave={() => window.localStorage.setItem(SAVE_KEY, JSON.stringify(game))} /><section className="cfe-game-head"><div><small>MONTH {game.turn}</small><h1>{myTurn ? game.pending ? "결정을 내려주세요" : "당신의 차례입니다" : `${active.name}가 재무제표를 검토하는 중…`}</h1></div><div className="cfe-head-stats"><span><small>현금</small><b>{money(player.cash)}</b></span><span><small>월 현금흐름</small><b className={finance.monthlyCashflow >= 0 ? "positive" : "negative"}>{finance.monthlyCashflow >= 0 ? "+" : ""}{money(finance.monthlyCashflow)}</b></span><span><small>현재 단계</small><b>{player.stage === "growth" ? "성장 트랙" : "생활 순환로"}</b></span></div></section>
    <section className="cfe-game-grid"><div className="cfe-board-column"><div className="cfe-track-tabs"><button className={view === "cycle" ? "active" : ""} onClick={() => setTrackView("cycle")}>생활 순환로</button><button className={view === "growth" ? "active" : ""} onClick={() => setTrackView("growth")}>성장 트랙</button><button onClick={() => openGuide("rules")}>ⓘ 규칙</button></div><section className={`cfe-track ${view}`}><header><div><small>{view === "growth" ? "GROWTH TRACK" : "LIFE CYCLE"}</small><h2>{view === "growth" ? "목적 있는 성장을 완성하세요" : "자산소득으로 지출을 덮으세요"}</h2></div><span>{view === "growth" ? "✦" : "₩"}</span></header><div className="cfe-track-grid">{track.map((space, index) => <article className={`${space} ${game.lastRoll?.playerId === 0 && player.stage === view && player.position === index ? "landed" : ""}`} key={`${space}-${index}`}><small>{index + 1}</small><b>{CFE_SPACE_LABELS[space]}</b><div>{game.players.filter((item) => item.stage === view && item.position === index).map((item) => <i className={item.id === 0 ? "human" : ""} title={item.name} key={item.id}>{item.id === 0 ? "나" : item.id}</i>)}</div></article>)}</div><footer><span>{game.lastRoll ? `${game.players[game.lastRoll.playerId].name} · ${game.lastRoll.values.join("·")} → ${game.lastRoll.used}칸` : "아직 주사위를 굴리지 않았습니다."}</span><strong>{game.lastEvent}</strong></footer></section>
      <section className="cfe-turn-panel"><div><span className={myTurn ? "ready" : ""}>{myTurn ? "MY TURN" : "AI TURN"}</span><h2>{myTurn ? game.pending ? "투자 조건을 확인하세요" : "이번 달의 선택" : `${active.name} 차례`}</h2><p>{player.charityTurns ? `나눔 혜택 ${player.charityTurns}회 남음 · 주사위 두 개 중 높은 값 사용` : "주사위로 이동해 새로운 재무 사건을 만나세요."}</p></div><div className="cfe-turn-actions"><button disabled={!myTurn || Boolean(game.pending)} onClick={() => store(cfeBorrow(game, 0, 100) as Game)}>+100 대출</button>{player.bankLoan > 0 && <button disabled={!myTurn || Boolean(game.pending) || player.cash < 100} onClick={() => store(cfeRepayBank(game, 0, 100) as Game)}>100 상환</button>}<button className="roll" disabled={!myTurn || Boolean(game.pending)} onClick={() => store(cfeRoll(game, 0) as Game)}><span>⬡</span> 주사위 굴리기</button></div></section></div>
      <div className="cfe-side-column"><FinanceStatement player={player} onRepay={(id) => store(cfeRepayLiability(game, 0, id) as Game)} /><section className="cfe-opponents"><header><small>OTHER PLAYERS</small><h2>다른 참가자</h2></header>{game.players.slice(1).map((item) => { const data = cfeFinancials(item); return <article className={game.currentPlayer === item.id ? "active" : ""} key={item.id}><span>AI</span><div><b>{item.name}</b><small>{item.profession.name} · {item.stage === "growth" ? "성장 트랙" : "생활 순환로"}</small><i><em style={{ width: `${Math.min(100, data.passiveIncome / Math.max(1, data.totalExpenses) * 100)}%` }} /></i></div><strong>{money(data.passiveIncome)}<small>자산소득</small></strong></article>})}</section><details className="cfe-log"><summary>최근 재무 기록</summary>{game.log.slice(-10).reverse().map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</details></div></section>
    {game.pending?.playerId === 0 && <PendingCard game={game} onResolve={resolve} onBorrow={() => store(cfeBorrow(game, 0, 100) as Game)} />}{guide && <Guide mode={guide} step={guideStep} onStep={setGuideStep} onClose={() => setGuide(null)} />}</main>;
}
