"use client";

import { useEffect, useState } from "react";
import { withKoreanSubject } from "./korean-particles.js";
import {
  CFE_GROWTH_TRACK,
  CFE_INNER_TRACK,
  CFE_SPACE_LABELS,
  cfeBorrow,
  cfeChooseAiAction,
  cfeCreateGame,
  cfeFinancials,
  cfeMigrateSavedGame,
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
  growthTarget: number | null; growthIncome: number; growthCharity: boolean; eliminated: boolean;
  skipTurns: number; charityTurns: number; turns: number;
};
type Pending = {
  kind: "opportunity" | "deal" | "market" | "charity" | "charity-fast" | "vision"; playerId: number;
  triggerPlayerId?: number; card?: Asset; amount?: number; assetIds?: string[]; dream?: Dream;
};
type Standing = { id: number; name: string; stage: Stage; cash: number; assetIncome: number; netWorth: number; eliminated?: boolean };
type Game = {
  playerCount: number; difficulty: Difficulty; players: Player[]; currentPlayer: number;
  phase: "playing" | "finished"; pending: Pending | null; turn: number;
  lastRoll: { playerId: number; values: number[]; used: number } | null;
  lastEvent: string; log: string[]; winner: number | null; standings: Standing[] | null;
};
type TurnReport = { playerId: number; playerName: string; lines: string[] };

const SAVE_KEY = "playroom-cashflow-escape-save-v1";
const RULES = [
  ["게임 목표와 승리", "생활 순환로에서 자산소득을 총지출보다 크게 만드세요. 다음 자기 차례 시작에 성장 트랙으로 이동하며, 선택한 인생 목표를 사거나 시작 성장 수입보다 5,000만원 높은 목표 수입을 달성하면 승리합니다."],
  ["준비와 월급날", "시작 현금은 저축액과 첫 월 현금흐름의 합계입니다. 생활 순환로에서는 주사위 1개를 굴리며, 월급날 칸을 지나거나 도착할 때마다 월 현금흐름을 받거나 지불합니다."],
  ["투자 기회", "투자 기회에 도착하면 작은 기회와 큰 기회 중 먼저 규모를 고른 뒤 카드 한 장을 봅니다. 현금이 충분하면 매입하고 자산소득을 추가하며, 매입하지 않은 기회는 넘깁니다."],
  ["시장·생활·가족", "시장 카드는 조건에 맞는 자산을 가진 모든 참가자에게 적용됩니다. 생활 사건 지출은 의무이며, 가족 변화는 최대 자녀 3명까지 월지출을 늘립니다."],
  ["나눔", "선택적으로 총수입의 10%를 내면 다음 3차례 동안 주사위 1개 또는 2개를 선택합니다. 2개를 고르면 높은 한 개가 아니라 두 주사위의 합계만큼 이동합니다."],
  ["구조조정·대출·부채", "구조조정에서는 총지출을 즉시 내고 2차례를 쉬며 나눔 혜택이 끝납니다. 생활 순환로에서는 100만원 단위 대출이 가능하고 월 10%가 지출에 더해집니다. 기존 부채는 전액, 은행 대출은 분할 상환할 수 있습니다."],
  ["파산", "월급날에 음수 월 현금흐름을 감당하지 못하면 자산을 매입가의 절반에 처분하고 부채를 갚아 양수 현금흐름을 회복합니다. 회복하면 2차례 쉬고, 끝내 회복하지 못하면 탈락합니다."],
  ["성장 트랙", "진입 시 생활 순환로 현금을 반납하고 자산소득의 100배를 시작 성장 수입과 현금으로 받습니다. 기본 주사위는 2개이며 대출은 할 수 없습니다. 성장 투자는 성장 수입을 높입니다."],
  ["성장 트랙 사건", "성장 나눔은 10,000만원을 내고 남은 게임 동안 주사위 1·2·3개 중 고르게 합니다. 세무 조사와 소송은 현금 절반, 이혼은 현금 전부를 잃습니다."],
  ["교육용 현지화", "공식 게임 흐름을 따르되 직업·투자 카드와 금액은 웹게임용 가상 구성으로 현지화했습니다. 실제 투자 수익이나 금융 조언을 의미하지 않습니다."],
];
const TUTORIAL = [
  ["재무제표부터 보세요", "현금보다 먼저 자산소득과 총지출의 차이를 확인하세요. 자산소득이 총지출보다 커지는 것이 첫 목표입니다."],
  ["월급날을 지나도 받습니다", "월급날 칸에 도착할 때뿐 아니라 지나갈 때도 월 현금흐름이 적용됩니다. 음수 현금흐름을 낼 수 없으면 파산 정리를 시작합니다."],
  ["수익률과 비상금", "투자 수익률이 높아도 현금을 모두 쓰면 생활 사건에 취약합니다. 매입 후 남는 현금도 함께 살펴보세요."],
  ["부채를 줄이세요", "현금 여유가 생기면 월 상환액이 큰 부채부터 갚아 총지출을 낮추는 것도 빠른 탈출 전략입니다."],
  ["시장은 출구입니다", "자산의 시장가가 올랐을 때 매각하면 더 큰 기회를 잡을 현금을 만들 수 있지만 자산소득은 줄어듭니다."],
  ["두 번째 목표", "성장 트랙에서는 시작 성장 수입보다 5,000만원 더 높이거나 자신의 인생 목표를 사면 승리합니다. 기본 이동은 주사위 2개의 합계입니다."],
];

function money(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("ko-KR")}만원`;
}

function buildTurnReport(previous: Game, next: Game, playerId: number): TurnReport {
  const playerName = next.players[playerId]?.name || "참가자";
  let start = previous.log.length;
  if (previous.pending?.playerId === playerId) {
    for (let index = previous.log.length - 1; index >= 0; index -= 1) {
      const line = previous.log[index];
      if (line.startsWith(`${playerName}:`) && line.includes("칸 이동 →")) {
        start = index;
        break;
      }
    }
  }
  const lines = next.log.slice(start).filter((line) => line.startsWith(`${playerName}:`)).slice(-5);
  return { playerId, playerName, lines: lines.length ? lines : [`${playerName}: ${next.lastEvent}`] };
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
  const progress = player.stage === "growth"
    ? Math.min(100, Math.round(player.growthIncome / Math.max(1, player.growthTarget || 1) * 100))
    : Math.min(100, Math.round(finance.assetIncome / Math.max(1, finance.totalExpenses) * 100));
  return <section className="cfe-statement"><header><div><small>PERSONAL FINANCIAL STATEMENT</small><h2>{player.profession.name}</h2></div><strong>{money(player.cash)}<small>보유 현금</small></strong></header>
    <div className="cfe-freedom-meter"><div>{player.stage === "growth" ? <><span>성장 수입 {money(player.growthIncome)}</span><span>목표 {money(player.growthTarget || 0)}</span></> : <><span>자산소득 {money(finance.assetIncome)}</span><span>총지출 {money(finance.totalExpenses)}</span></>}</div><i><b style={{ width: `${progress}%` }} /></i><small>{player.stage === "growth" ? `목표까지 ${money(Math.max(0, (player.growthTarget || 0) - player.growthIncome))}` : `재무 자유까지 ${money(Math.max(0, finance.totalExpenses - finance.assetIncome + 1))}`}</small></div>
    <div className="cfe-ledger"><article><h3>수입</h3><span><b>급여</b><em>{money(player.profession.salary)}</em></span><span><b>자산소득</b><em className="positive">{money(finance.assetIncome)}</em></span><strong><b>총수입</b><em>{money(finance.totalIncome)}</em></strong></article><article><h3>지출</h3><span><b>기본 생활비</b><em>{money(player.baseExpenses)}</em></span><span><b>부채 상환</b><em>{money(finance.debtPayments)}</em></span><span><b>가족·대출</b><em>{money(finance.childExpense + Math.ceil(player.bankLoan * .1))}</em></span><strong><b>총지출</b><em>{money(finance.totalExpenses)}</em></strong></article></div>
    <div className={`cfe-monthly ${finance.monthlyCashflow >= 0 ? "positive" : "negative"}`}><span>월 현금흐름</span><strong>{finance.monthlyCashflow >= 0 ? "+" : ""}{money(finance.monthlyCashflow)}</strong></div>
    <details open><summary>자산 <b>{player.assets.length}</b></summary>{player.assets.length ? player.assets.map((asset, index) => <span key={`${asset.id}-${index}`}><i>{asset.category === "realestate" ? "⌂" : asset.category === "stock" ? "↗" : asset.category === "business" ? "◫" : "◇"}</i><b>{asset.name}<small>가치 {money(asset.value)}</small></b><em>+{money(asset.income)}/월</em></span>) : <p>아직 보유 자산이 없습니다.</p>}</details>
    <details><summary>부채 <b>{player.liabilities.length + (player.bankLoan ? 1 : 0)}</b></summary>{player.liabilities.map((item) => <span key={item.id}><i>−</i><b>{item.name}<small>월 {money(item.payment)}</small></b><em>{money(item.balance)}{onRepay && <button disabled={player.cash < item.balance} onClick={() => onRepay(item.id)}>완납</button>}</em></span>)}{player.bankLoan > 0 && <span><i>−</i><b>운영자금 대출<small>월 {money(Math.ceil(player.bankLoan * .1))}</small></b><em>{money(player.bankLoan)}</em></span>}</details>
  </section>;
}

function PendingCard({ game, onResolve, onBorrow }: { game: Game; onResolve: (choice: string, option?: string) => void; onBorrow: () => void }) {
  const pending = game.pending!;
  const player = game.players[pending.playerId];
  const finance = cfeFinancials(player);
  if (pending.kind === "opportunity") {
    return <div className="cfe-modal-bg"><section className="cfe-event-card opportunity"><small>OPPORTUNITY</small><span className="cfe-event-icon">◇</span><h2>어떤 투자 기회를 볼까요?</h2><p>카드를 보기 전에 작은 기회와 큰 기회 중 하나를 선택합니다. 큰 기회는 더 많은 현금이 필요할 수 있습니다.</p><div className="cfe-opportunity-choices"><button onClick={() => onResolve("small")}><b>작은 기회</b><span>적은 현금으로 시작하기 좋은 투자</span></button><button onClick={() => onResolve("big")}><b>큰 기회</b><span>규모와 자산소득이 더 큰 투자</span></button></div></section></div>;
  }
  if (pending.kind === "deal" && pending.card) {
    const card = pending.card;
    const roi = Math.round(card.income / card.cost * 100);
    const isGrowth = player.stage === "growth";
    return <div className="cfe-modal-bg"><section className="cfe-event-card deal"><small>{isGrowth ? "GROWTH VENTURE" : "INVESTMENT OPPORTUNITY"}</small><span className="cfe-event-icon">{card.category === "realestate" ? "⌂" : card.category === "stock" ? "↗" : card.category === "business" ? "◫" : "◇"}</span><h2>{card.name}</h2><p>{card.description}</p><div className="cfe-deal-numbers"><span><small>필요 현금</small><b>{money(card.cost)}</b></span><span><small>{isGrowth ? "성장 수입 증가" : "월 자산소득"}</small><b>+{money(isGrowth ? card.income * 10 : card.income)}</b></span><span><small>현금 수익률</small><b>{roi}%</b></span><span><small>예상 가치</small><b>{money(card.value)}</b></span></div><p className="cfe-balance">현재 현금 {money(player.cash)} · 매입 후 {money(player.cash - card.cost)}</p><footer><button onClick={() => onResolve("skip")}>이번 기회 넘기기</button>{!isGrowth && player.cash < card.cost && <button className="loan" onClick={onBorrow}>+100만원 대출</button>}<button className="primary" disabled={player.cash < card.cost} onClick={() => onResolve("buy")}>투자하기</button></footer></section></div>;
  }
  if (pending.kind === "market" && pending.card) {
    const assets = player.assets.filter((asset) => pending.assetIds?.includes(asset.id));
    return <div className="cfe-modal-bg"><section className="cfe-event-card market"><small>MARKET UPDATE</small><span className="cfe-event-icon">↗</span><h2>{pending.card.name}</h2><p>{pending.card.description}</p><div className="cfe-market-assets">{assets.map((asset, index) => <button key={`${asset.id}-${index}`} onClick={() => onResolve("sell", asset.id)}><span>{asset.name}</span><small>현재 자산소득 −{money(asset.income)}</small><b>{money(Math.round(asset.value * (pending.card?.multiplier || 1)))}에 매각</b></button>)}</div><footer><button onClick={() => onResolve("skip")}>계속 보유</button></footer></section></div>;
  }
  if (pending.kind === "charity") return <div className="cfe-modal-bg"><section className="cfe-event-card charity"><small>CHARITY</small><span className="cfe-event-icon">♡</span><h2>나눔에 참여할까요?</h2><p>총수입의 10%를 내면 다음 세 차례에 주사위 1개 또는 2개를 선택할 수 있습니다. 2개를 고르면 두 눈의 합계만큼 이동합니다.</p><blockquote><b>Original rule</b> “optional use of 1 or 2 dice on your next 3 turns.”<small>번역: 다음 3차례 동안 주사위 1개 또는 2개를 선택해 사용할 수 있습니다.</small></blockquote><div className="cfe-deal-numbers"><span><small>총수입의 10%</small><b>{money(pending.amount || 0)}</b></span><span><small>현재 현금</small><b>{money(player.cash)}</b></span></div><footer><button onClick={() => onResolve("skip")}>참여하지 않기</button><button className="primary" disabled={player.cash < (pending.amount || 0)} onClick={() => onResolve("accept")}>나눔 참여</button></footer></section></div>;
  if (pending.kind === "charity-fast") return <div className="cfe-modal-bg"><section className="cfe-event-card charity"><small>FAST TRACK CHARITY</small><span className="cfe-event-icon">♡</span><h2>성장 나눔에 참여할까요?</h2><p>참여하면 남은 게임 동안 매 차례 주사위 1개·2개·3개 중 원하는 개수를 고르고, 굴린 눈의 합계만큼 이동합니다.</p><div className="cfe-deal-numbers"><span><small>나눔 금액</small><b>{money(pending.amount || 0)}</b></span><span><small>현재 현금</small><b>{money(player.cash)}</b></span></div><footer><button onClick={() => onResolve("skip")}>참여하지 않기</button><button className="primary" disabled={player.cash < (pending.amount || 0)} onClick={() => onResolve("accept")}>영구 혜택 받기</button></footer></section></div>;
  const isChosenDream = pending.dream?.id === player.dream.id;
  return <div className="cfe-modal-bg"><section className="cfe-event-card vision"><small>LIFE VISION</small><span className="cfe-event-icon">{pending.dream?.icon}</span><h2>{pending.dream?.name}</h2><p>{isChosenDream ? "처음 선택한 나의 인생 목표입니다. 지금 실현하면 즉시 승리합니다." : "다른 인생 목표도 실현할 수 있지만, 승리하려면 처음 선택한 목표 또는 성장 수입 목표를 달성해야 합니다."}</p><div className="cfe-deal-numbers"><span><small>필요 현금</small><b>{money(pending.dream?.cost || 0)}</b></span><span><small>현재 현금</small><b>{money(player.cash)}</b></span><span><small>성장 수입</small><b>{money(player.growthIncome)}</b></span><span><small>승리 여부</small><b>{isChosenDream ? "즉시 승리" : "게임 계속"}</b></span></div><footer><button onClick={() => onResolve("skip")}>다음 기회</button><button className="primary" onClick={() => onResolve("buy")}>목표 실현</button></footer></section></div>;
}

function TurnResultCard({ report, onContinue }: { report: TurnReport; onContinue: () => void }) {
  return <div className="cfe-modal-bg"><section className="cfe-event-card cfe-turn-result" role="dialog" aria-modal="true" aria-label={`${report.playerName}의 턴 결과`}><small>TURN RESULT</small><span className="cfe-event-icon">{report.playerId === 0 ? "나" : "AI"}</span><h2>{report.playerName}의 턴 결과</h2><p>이동부터 사건, 선택과 재무 변화를 순서대로 확인하세요.</p><ol>{report.lines.map((line, index) => <li key={`${line}-${index}`}><b>{index + 1}</b><span>{line.replace(`${report.playerName}: `, "")}</span></li>)}</ol><footer><button className="primary" onClick={onContinue}>확인하고 계속</button></footer></section></div>;
}

function Result({ game, onRestart, onExit }: { game: Game; onRestart: () => void; onExit: () => void }) {
  const standings = game.standings || cfeRanking(game);
  return <main className="cfe-shell"><Topbar onExit={onExit} /><section className="cfe-result"><span>FINANCIAL FREEDOM</span><h1>{game.winner === 0 ? "나만의 재무 자유를 완성했습니다!" : `${withKoreanSubject(game.players[game.winner || 0].name)} 먼저 목표를 달성했습니다`}</h1><p>{game.lastEvent}</p><div>{standings.map((item, index) => <article className={item.id === 0 ? "human" : ""} key={item.id}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{item.eliminated ? "파산으로 탈락" : item.stage === "growth" ? "성장 트랙" : "생활 순환로"} · 순자산 {money(item.netWorth)}</small></span><em>자산소득 {money(item.assetIncome)}</em></article>)}</div><footer><button onClick={onExit}>게임 목록</button><button className="primary" onClick={onRestart}>같은 설정으로 다시 시작</button></footer></section></main>;
}

export function CashflowEscapeGame({ onExit }: { onExit: () => void }) {
  const [playerCount, setPlayerCount] = useState(4);
  const [difficulty, setDifficulty] = useState<Difficulty>("balanced");
  const [game, setGame] = useState<Game | null>(null);
  const [guide, setGuide] = useState<"rules" | "tutorial" | null>(null);
  const [guideStep, setGuideStep] = useState(0);
  const [trackView, setTrackView] = useState<Stage | null>(null);
  const [turnReport, setTurnReport] = useState<TurnReport | null>(null);

  const store = (next: Game) => { setGame(next); window.localStorage.setItem(SAVE_KEY, JSON.stringify(next)); };
  const start = () => { setTurnReport(null); store(cfeCreateGame(playerCount, difficulty) as Game); };
  const load = () => {
    const saved = window.localStorage.getItem(SAVE_KEY);
    if (!saved) return;
    try { setTurnReport(null); setGame(cfeMigrateSavedGame(JSON.parse(saved)) as Game); } catch { window.localStorage.removeItem(SAVE_KEY); }
  };
  const openGuide = (mode: "rules" | "tutorial") => { setGuide(mode); setGuideStep(0); };

  useEffect(() => {
    if (!game || turnReport || game.phase !== "playing" || game.currentPlayer === 0 || (game.pending && game.pending.playerId !== game.currentPlayer)) return;
    const timer = window.setTimeout(() => {
      const actingPlayer = game.currentPlayer;
      const next = cfeChooseAiAction(game, actingPlayer) as Game;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      setGame(next);
      if (!next.pending && next.log.length > game.log.length) setTurnReport(buildTurnReport(game, next, actingPlayer));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [game, turnReport]);

  if (!game) return <main className="cfe-shell"><Topbar onExit={onExit} /><section className="cfe-lobby"><div className="cfe-hero-copy"><small>A FINANCIAL LIFE SIMULATION</small><h1>월급을 모으는 삶에서<br /><em>자산이 일하는 삶으로</em></h1><p>직업마다 다른 재무제표에서 출발해 현금흐름을 읽고, 나만의 투자 원칙으로 생활 순환로를 탈출하세요.</p><div><button onClick={() => openGuide("rules")}>◎ 게임 방법</button><button onClick={() => openGuide("tutorial")}>▷ 튜토리얼</button></div><span>※ 모든 상품과 수치는 교육용으로 만든 가상 정보입니다.</span></div>
    <div className="cfe-hero-art" aria-hidden="true"><i className="orbit outer" /><i className="orbit inner" /><span className="won">₩</span><div className="cfe-hero-cards"><i><small>ASSET</small><b>+125</b><span>MONTHLY</span></i><i><small>EXPENSE</small><b>−80</b><span>MONTHLY</span></i><i><small>CASHFLOW</small><b>+45</b><span>MONTHLY</span></i></div></div>
    <aside className="cfe-setup"><small>NEW JOURNEY</small><h2>게임 설정</h2><fieldset><legend>참가 인원</legend><div className="cfe-count">{[2,3,4,5,6].map((count) => <button className={playerCount === count ? "active" : ""} onClick={() => setPlayerCount(count)} key={count}>{count}</button>)}</div><p>나 1명 + AI {playerCount - 1}명</p></fieldset><fieldset><legend>AI 투자 성향</legend>{[["casual","연습생","안전한 현금 여유를 중시합니다."],["balanced","분석가","수익률과 부채를 균형 있게 봅니다."],["sharp","투자가","현금흐름 개선 기회를 빠르게 잡습니다."]].map(([value,label,text]) => <label className={difficulty === value ? "active" : ""} key={value}><input type="radio" checked={difficulty === value} onChange={() => setDifficulty(value as Difficulty)} /><span><b>{label}</b><small>{text}</small></span></label>)}</fieldset><button className="cfe-start" onClick={start}>재무 여정 시작 <span>→</span></button><button className="cfe-load" onClick={load}>저장된 게임 불러오기</button></aside></section>{guide && <Guide mode={guide} step={guideStep} onStep={setGuideStep} onClose={() => setGuide(null)} />}</main>;

  if (game.phase === "finished") return <Result game={game} onRestart={() => { setTurnReport(null); store(cfeCreateGame(playerCount, difficulty) as Game); }} onExit={onExit} />;

  const player = game.players[0];
  const finance = cfeFinancials(player);
  const view = trackView || player.stage;
  const track = view === "growth" ? CFE_GROWTH_TRACK : CFE_INNER_TRACK;
  const myTurn = game.currentPlayer === 0;
  const active = game.players[game.currentPlayer];
  const resolve = (choice: string, option?: string) => {
    const next = cfeResolvePending(game, 0, choice, option) as Game;
    store(next);
    if (!next.pending) setTurnReport(buildTurnReport(game, next, game.pending?.triggerPlayerId ?? 0));
  };
  const roll = (diceCount?: number) => {
    const next = cfeRoll(game, 0, Math.random, diceCount ?? null) as Game;
    store(next);
    if (!next.pending) setTurnReport(buildTurnReport(game, next, 0));
  };
  const diceOptions = player.stage === "growth"
    ? (player.growthCharity ? [1, 2, 3] : [2])
    : (player.charityTurns > 0 ? [1, 2] : [1]);
  return <main className="cfe-shell"><Topbar onExit={onExit} onSave={() => window.localStorage.setItem(SAVE_KEY, JSON.stringify(game))} /><section className="cfe-game-head"><div><small>MONTH {game.turn}</small><h1>{myTurn ? game.pending ? "결정을 내려주세요" : "당신의 차례입니다" : `${withKoreanSubject(active.name)} 재무제표를 검토하는 중…`}</h1></div><div className="cfe-head-stats"><span><small>현금</small><b>{money(player.cash)}</b></span><span><small>월 현금흐름</small><b className={finance.monthlyCashflow >= 0 ? "positive" : "negative"}>{finance.monthlyCashflow >= 0 ? "+" : ""}{money(finance.monthlyCashflow)}</b></span><span><small>현재 단계</small><b>{player.stage === "growth" ? "성장 트랙" : "생활 순환로"}</b></span></div></section>
    <section className="cfe-game-grid"><div className="cfe-board-column"><div className="cfe-track-tabs"><button className={view === "cycle" ? "active" : ""} onClick={() => setTrackView("cycle")}>생활 순환로</button><button className={view === "growth" ? "active" : ""} onClick={() => setTrackView("growth")}>성장 트랙</button><button onClick={() => openGuide("rules")}>ⓘ 규칙</button></div><section className={`cfe-track ${view}`}><header><div><small>{view === "growth" ? "GROWTH TRACK" : "LIFE CYCLE"}</small><h2>{view === "growth" ? "목적 있는 성장을 완성하세요" : "자산소득으로 지출을 덮으세요"}</h2></div><span>{view === "growth" ? "✦" : "₩"}</span></header><div className="cfe-track-grid">{track.map((space, index) => <article className={`${space} ${game.lastRoll?.playerId === 0 && player.stage === view && player.position === index ? "landed" : ""}`} key={`${space}-${index}`}><small>{index + 1}</small><b>{CFE_SPACE_LABELS[space]}</b><div>{game.players.filter((item) => item.stage === view && item.position === index).map((item) => <i className={item.id === 0 ? "human" : ""} title={item.name} key={item.id}>{item.id === 0 ? "나" : item.id}</i>)}</div></article>)}</div><footer><span>{game.lastRoll ? `${game.players[game.lastRoll.playerId].name} · ${game.lastRoll.values.join("·")} → ${game.lastRoll.used}칸` : "아직 주사위를 굴리지 않았습니다."}</span><strong>{game.lastEvent}</strong></footer></section>
      <section className="cfe-turn-panel"><div><span className={myTurn ? "ready" : ""}>{myTurn ? "MY TURN" : "AI TURN"}</span><h2>{myTurn ? game.pending ? "결정을 확인하세요" : "이번 달의 선택" : `${active.name} 차례`}</h2><p>{player.stage === "growth" ? player.growthCharity ? "성장 나눔 혜택 · 주사위 1·2·3개 중 선택해 합계만큼 이동" : "성장 트랙은 주사위 2개의 합계만큼 이동합니다." : player.charityTurns ? `나눔 혜택 ${player.charityTurns}회 남음 · 주사위 1개 또는 2개 선택` : "주사위로 이동해 새로운 재무 사건을 만나세요."}</p></div><div className="cfe-turn-actions"><button disabled={!myTurn || Boolean(game.pending) || player.stage === "growth"} onClick={() => store(cfeBorrow(game, 0, 100) as Game)}>+100 대출</button>{player.bankLoan > 0 && <button disabled={!myTurn || Boolean(game.pending) || player.cash < 100 || player.stage === "growth"} onClick={() => store(cfeRepayBank(game, 0, 100) as Game)}>100 상환</button>}<div className="cfe-dice-choices">{diceOptions.map((count) => <button className="roll" disabled={!myTurn || Boolean(game.pending)} onClick={() => roll(count)} key={count}><span>⬡</span> 주사위 {count}개</button>)}</div></div></section></div>
      <div className="cfe-side-column"><FinanceStatement player={player} onRepay={player.stage === "cycle" ? (id) => store(cfeRepayLiability(game, 0, id) as Game) : undefined} /><section className="cfe-opponents"><header><small>OTHER PLAYERS</small><h2>다른 참가자</h2></header>{game.players.slice(1).map((item) => { const data = cfeFinancials(item); return <article className={`${game.currentPlayer === item.id ? "active" : ""} ${item.eliminated ? "eliminated" : ""}`} key={item.id}><span>AI</span><div><b>{item.name}</b><small>{item.profession.name} · {item.eliminated ? "파산 탈락" : item.stage === "growth" ? "성장 트랙" : "생활 순환로"}</small><i><em style={{ width: `${Math.min(100, data.assetIncome / Math.max(1, data.totalExpenses) * 100)}%` }} /></i></div><strong>{item.stage === "growth" ? money(item.growthIncome) : money(data.assetIncome)}<small>{item.stage === "growth" ? "성장 수입" : "자산소득"}</small></strong></article>})}</section><section className="cfe-log"><header><div><small>TURN HISTORY</small><h2>진행 기록</h2></div><span>최근 {Math.min(12, game.log.length)}개</span></header><div>{game.log.slice(-12).reverse().map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div></section></div></section>
    {game.pending?.playerId === 0 && <PendingCard game={game} onResolve={resolve} onBorrow={() => store(cfeBorrow(game, 0, 100) as Game)} />}{turnReport && !game.pending && <TurnResultCard report={turnReport} onContinue={() => setTurnReport(null)} />}{guide && <Guide mode={guide} step={guideStep} onStep={setGuideStep} onClose={() => setGuide(null)} />}</main>;
}
