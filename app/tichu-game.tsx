"use client";

import { useEffect, useMemo, useState } from "react";
import { withKoreanSubject } from "./korean-particles.js";
import {
  TICHU_SUITS,
  tichuBomb,
  tichuChooseAiAction,
  tichuClassify,
  tichuCompleteGrand,
  tichuCreateGame,
  tichuDeclare,
  tichuGiveDragonTrick,
  tichuLegalSelections,
  tichuNextRound,
  tichuPass,
  tichuPlay,
  tichuRankLabel,
  tichuResolvePassing,
} from "./tichu-engine.js";

type Difficulty = "casual" | "balanced" | "sharp";
type Card = {
  id: string; suit: string; rank: number; label: string; name: string;
  symbol: string; special: string | null; points: number;
};
type Combo = { type: string; count: number; strength: number; label: string };
type Player = {
  id: number; team: number; name: string; isHuman: boolean; hand: Card[];
  reserve?: Card[]; tricks: Card[]; playedAny: boolean;
};
type Declaration = { type: "tichu" | "grand" | null; success: boolean | null };
type Game = {
  difficulty: Difficulty; targetScore: number; scores: number[]; round: number;
  players: Player[]; phase: "grand" | "passing" | "playing" | "dragon-choice" | "round-end" | "finished";
  currentPlayer: number; table: { playerId: number; cards: Card[]; combo: Combo }[];
  currentCombo: Combo | null; lastPlayer: number | null; passes: number[];
  finishOrder: number[]; wish: number | null; declarations: Declaration[];
  log: string[]; roundResult: { roundScores: number[]; doubleVictory: boolean; first: number; last: number } | null;
  pendingDragon: { winnerId: number; settleAfter: boolean } | null;
  winner: number | null;
};

const RULES = [
  ["게임 목표", "파트너와 마주 앉은 4인 팀전입니다. 손의 카드를 먼저 비우고 점수 카드를 모아 상대보다 먼저 목표 점수에 도달하세요."],
  ["카드 교환", "14장을 받은 뒤 왼쪽 상대, 파트너, 오른쪽 상대에게 한 장씩 건넵니다. 받은 카드는 세 장을 모두 보낸 뒤 확인합니다."],
  ["카드 조합", "싱글, 페어, 트리플, 풀하우스, 5장 이상의 스트레이트, 연속 페어를 낼 수 있습니다. 앞 조합과 같은 종류·장수의 더 높은 조합만 냅니다."],
  ["폭탄", "같은 숫자 네 장 또는 같은 무늬의 5장 이상 연속 카드는 폭탄입니다. 어떤 일반 조합도 이기며 더 강한 폭탄만 덮을 수 있습니다."],
  ["특수 카드", "개는 선을 파트너에게 넘기고, 마작은 첫 선과 숫자 소원을 만들며, 봉황은 폭탄을 제외한 조합의 와일드입니다. 용으로 트릭을 이기면 두 상대 중 받을 사람을 직접 고릅니다."],
  ["티츄 선언", "첫 카드를 내기 전 티츄를 선언해 첫 완주에 성공하면 +100점, 실패하면 -100점입니다. 첫 8장만 본 그랜드 티츄는 ±200점입니다."],
  ["점수와 승리", "5는 5점, 10과 K는 10점, 용은 +25점, 봉황은 -25점입니다. 한 팀 두 명이 연속 1·2등이면 카드 점수 대신 200점을 얻습니다."],
];

const TUTORIAL = [
  ["팀을 기억하세요", "나와 맞은편 AI 백호가 한 팀입니다. 바로 옆의 두 AI가 상대 팀입니다."],
  ["세 장을 나누세요", "카드를 세 장 고르면 선택 순서대로 왼쪽 상대, 파트너, 오른쪽 상대에게 전달됩니다."],
  ["같은 조합으로 오르세요", "싱글 위에는 더 높은 싱글, 페어 위에는 더 높은 페어를 냅니다. 낼 수 없거나 아끼고 싶다면 패스하세요."],
  ["마작의 소원", "마작을 낼 때 숫자를 하나 고를 수 있습니다. 해당 숫자를 합법적으로 낼 수 있는 참가자는 반드시 포함해야 합니다."],
  ["파트너를 도우세요", "파트너가 이기고 있는 트릭이라면 낮은 카드를 억지로 덮지 않아도 됩니다. 점수 카드와 선을 팀 단위로 관리하세요."],
  ["티츄는 타이밍", "강한 손이라면 첫 카드를 내기 전에 선언하세요. 선언자는 파트너가 아니라 본인이 가장 먼저 카드를 비워야 합니다."],
];

function Topbar({ onExit }: { onExit: () => void }) {
  return <header className="ti-topbar"><button onClick={onExit} aria-label="게임 목록으로">←</button><div><small>PLAYROOM · PARTNERSHIP CARD GAME</small><strong>티츄</strong></div><button onClick={onExit}>나가기</button></header>;
}

function CardFace({ card, selected = false, compact = false, onClick }: { card: Card; selected?: boolean; compact?: boolean; onClick?: () => void }) {
  const suit = TICHU_SUITS.find((item) => item.id === card.suit);
  return (
    <button
      type="button"
      className={`ti-card ${card.special ? `special ${card.special}` : ""} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      style={{ "--suit": suit?.color || "#b64242" } as React.CSSProperties}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={card.name}
    >
      <span>{card.special ? card.symbol : card.label}</span>
      <i>{card.special ? card.name : suit?.symbol}</i>
      <small>{card.points ? `${card.points > 0 ? "+" : ""}${card.points}` : card.special ? "SPECIAL" : suit?.name}</small>
    </button>
  );
}

function Guide({ mode, step, onStep, onClose }: { mode: "rules" | "tutorial"; step: number; onStep: (value: number) => void; onClose: () => void }) {
  const item = TUTORIAL[step];
  return (
    <div className="ti-modal-bg" onClick={onClose}>
      <section className="ti-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="ti-close" onClick={onClose}>×</button>
        <small>TEAM PLAY GUIDE</small><h2>{mode === "rules" ? "게임 방법" : "빠른 튜토리얼"}</h2>
        {mode === "rules" ? <div className="ti-rule-list">{RULES.map(([title, text], index) => <article key={title}><b>{index + 1}</b><div><h3>{title}</h3><p>{text}</p></div></article>)}</div> : (
          <div className="ti-tutorial">
            <div className="ti-tutorial-symbol">{["↔", "♣", "↑", "一", "◎", "宣"][step]}</div>
            <div className="ti-dots">{TUTORIAL.map((_, index) => <i className={index <= step ? "active" : ""} key={index} />)}</div>
            <small>{step + 1} / {TUTORIAL.length}</small><h3>{item[0]}</h3><p>{item[1]}</p>
            <footer><button disabled={step === 0} onClick={() => onStep(step - 1)}>이전</button>{step < TUTORIAL.length - 1 ? <button className="primary" onClick={() => onStep(step + 1)}>다음</button> : <button className="primary" onClick={onClose}>준비 완료</button>}</footer>
          </div>
        )}
      </section>
    </div>
  );
}

function Scoreboard({ game }: { game: Game }) {
  return <section className="ti-scoreboard"><div className="our"><small>우리 팀 · 나 + AI 백호</small><strong>{game.scores[0]}</strong></div><span><b>{game.round}</b><small>ROUND</small></span><div><small>상대 팀 · 청룡 + 주작</small><strong>{game.scores[1]}</strong></div></section>;
}

function PlayerSeat({ game, id }: { game: Game; id: number }) {
  const player = game.players[id];
  const finish = game.finishOrder.indexOf(id);
  const declaration = game.declarations[id];
  return <article className={`ti-seat seat-${id} ${game.currentPlayer === id && game.phase === "playing" ? "active" : ""} ${player.team === 0 ? "ally" : "rival"}`}>
    <span>{player.isHuman ? "나" : "AI"}</span><div><b>{player.name}</b><small>{player.team === 0 ? "우리 팀" : "상대 팀"} · {player.hand.length}장</small></div>
    {declaration.type && <em>{declaration.type === "grand" ? "GRAND" : "TICHU"}</em>}
    {finish >= 0 && <strong>{finish + 1}위</strong>}
  </article>;
}

function RoundResult({ game, onNext, onExit }: { game: Game; onNext: () => void; onExit: () => void }) {
  const final = game.phase === "finished";
  const result = game.roundResult!;
  return <main className="ti-shell"><Topbar onExit={onExit} /><Scoreboard game={game} /><section className="ti-result">
    <span>{final ? "🏆" : result.doubleVictory ? "✦ 200 ✦" : "ROUND COMPLETE"}</span>
    <h1>{final ? game.winner === 0 ? "우리 팀이 승리했습니다!" : game.winner === 1 ? "상대 팀이 승리했습니다" : "무승부입니다" : result.doubleVictory ? `${game.players[result.first].team === 0 ? "우리 팀" : "상대 팀"} 더블 승리` : `${game.round}라운드 정산`}</h1>
    <p>{withKoreanSubject(game.players[result.first].name)} 가장 먼저 카드를 비웠습니다.</p>
    <div className="ti-round-score"><article><small>우리 팀</small><strong>+{result.roundScores[0]}</strong><span>누적 {game.scores[0]}점</span></article><b>:</b><article><small>상대 팀</small><strong>+{result.roundScores[1]}</strong><span>누적 {game.scores[1]}점</span></article></div>
    <div className="ti-result-actions"><button onClick={onExit}>게임 목록</button><button className="primary" onClick={final ? onExit : onNext}>{final ? "완료" : "다음 라운드"}</button></div>
  </section></main>;
}

export function TichuGame({ onExit }: { onExit: () => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty>("balanced");
  const [targetScore, setTargetScore] = useState(1000);
  const [game, setGame] = useState<Game | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [wish, setWish] = useState<number | null>(null);
  const [guide, setGuide] = useState<"rules" | "tutorial" | null>(null);
  const [guideStep, setGuideStep] = useState(0);

  const openGuide = (mode: "rules" | "tutorial") => { setGuideStep(0); setGuide(mode); };
  const start = () => setGame(tichuCreateGame(difficulty, targetScore) as Game);

  useEffect(() => {
    if (!game || game.phase !== "playing" || game.currentPlayer === 0) return;
    const timer = window.setTimeout(() => setGame((current) => current ? tichuChooseAiAction(current, current.currentPlayer) as Game : current), 900);
    return () => window.clearTimeout(timer);
  }, [game]);

  const selectedCards = useMemo(() => game?.players[0].hand.filter((card) => selected.includes(card.id)) || [], [game, selected]);
  const selectedCombo = useMemo(() => tichuClassify(selectedCards, game?.currentCombo || null) as Combo | null, [selectedCards, game?.currentCombo]);
  const legal = useMemo(() => game?.phase === "playing" ? tichuLegalSelections(game, 0) : [], [game]);
  const canPlay = Boolean(selected.length && legal.some((candidate: { cards: Card[] }) => candidate.cards.length === selected.length && candidate.cards.every((card) => selected.includes(card.id))));
  const canBomb = canPlay && selectedCombo?.type === "bomb" && Boolean(game?.currentCombo);
  const myTurn = game?.currentPlayer === 0;

  const toggleCard = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const play = () => {
    if (!game || (!myTurn && !canBomb) || (myTurn && !canPlay)) return;
    setGame((myTurn ? tichuPlay(game, 0, selected, wish) : tichuBomb(game, 0, selected)) as Game);
    setSelected([]);
    setWish(null);
  };

  if (!game) return <main className="ti-shell"><Topbar onExit={onExit} /><section className="ti-lobby">
    <div className="ti-hero-copy"><small>THE LEGENDARY PARTNERSHIP GAME</small><h1>한 장의 패보다<br /><em>강한 것은 팀입니다</em></h1><p>파트너와 호흡을 맞춰 손을 비우고, 폭탄과 특수 카드로 흐름을 뒤집으세요.</p><div><button onClick={() => openGuide("rules")}>◎ 게임 방법</button><button onClick={() => openGuide("tutorial")}>▷ 튜토리얼</button></div></div>
    <div className="ti-hero-art" aria-hidden="true"><i className="ring one" /><i className="ring two" /><span className="dragon-mark">龍</span><div className="ti-fan">{[
      { label: "A", symbol: "◆", color: "#299476" }, { label: "K", symbol: "⚔", color: "#3975b7" }, { label: "Q", symbol: "♜", color: "#c84f4f" }, { label: "J", symbol: "★", color: "#8d62b7" },
    ].map((card, index) => <i style={{ "--i": index, "--suit": card.color } as React.CSSProperties} key={card.symbol}><b>{card.label}</b><span>{card.symbol}</span></i>)}</div></div>
    <aside className="ti-setup"><small>MATCH SETUP</small><h2>팀전 설정</h2><div className="ti-team-map"><span>AI 청룡</span><b>상대 팀</b><span>AI 주작</span><i>VS</i><span className="human">나</span><b>우리 팀</b><span>AI 백호</span></div>
      <fieldset><legend>목표 점수</legend><div className="ti-toggle"><button className={targetScore === 500 ? "active" : ""} onClick={() => setTargetScore(500)}>빠른 경기 500</button><button className={targetScore === 1000 ? "active" : ""} onClick={() => setTargetScore(1000)}>정규 경기 1,000</button></div></fieldset>
      <fieldset><legend>AI 난이도</legend>{[["casual","입문","조합을 쉽게 풀어냅니다."],["balanced","숙련","파트너와 점수를 함께 봅니다."],["sharp","고수","폭탄과 선언을 신중히 운용합니다."]].map(([value,label,text]) => <label className={difficulty === value ? "active" : ""} key={value}><input type="radio" checked={difficulty === value} onChange={() => setDifficulty(value as Difficulty)} /><span><b>{label}</b><small>{text}</small></span></label>)}</fieldset>
      <button className="ti-start" onClick={start}>카드 나누기 <span>→</span></button>
    </aside>
  </section>{guide && <Guide mode={guide} step={guideStep} onStep={setGuideStep} onClose={() => setGuide(null)} />}</main>;

  if (game.phase === "round-end" || game.phase === "finished") return <RoundResult game={game} onNext={() => setGame(tichuNextRound(game) as Game)} onExit={onExit} />;

  if (game.phase === "dragon-choice") return <main className="ti-shell"><Topbar onExit={onExit} /><Scoreboard game={game} /><section className="ti-decision">
    <small>DRAGON TRICK</small><h1>용의 트릭을 건넬 상대를 고르세요</h1><p>용으로 이긴 트릭은 용의 25점을 포함해 반드시 상대 팀 한 명에게 줍니다.</p>
    <div className="ti-grand-actions">{game.players.filter((player) => player.team !== game.players[0].team).map((player) => <button className="danger" key={player.id} onClick={() => setGame(tichuGiveDragonTrick(game, player.id) as Game)}>{player.name}에게 주기</button>)}</div>
  </section></main>;

  if (game.phase === "grand") return <main className="ti-shell"><Topbar onExit={onExit} /><Scoreboard game={game} /><section className="ti-decision">
    <small>GRAND TICHU WINDOW</small><h1>첫 8장을 확인하세요</h1><p>나머지 6장을 받기 전, 이번 라운드에 가장 먼저 완주할 자신이 있다면 그랜드 티츄를 선언할 수 있습니다.</p>
    <div className="ti-hand preview">{game.players[0].hand.map((card) => <CardFace card={card} key={card.id} />)}</div>
    <div className="ti-grand-actions"><button onClick={() => setGame(tichuCompleteGrand(game, false) as Game)}>선언하지 않고 6장 받기</button><button className="danger" onClick={() => setGame(tichuCompleteGrand(game, true) as Game)}>그랜드 티츄 선언 <b>±200</b></button></div>
  </section></main>;

  if (game.phase === "passing") {
    const recipientLabels = ["왼쪽 상대", "파트너", "오른쪽 상대"];
    return <main className="ti-shell"><Topbar onExit={onExit} /><Scoreboard game={game} /><section className="ti-passing">
      <div><small>CARD EXCHANGE</small><h1>건넬 카드 3장을 고르세요</h1><p>선택한 순서대로 왼쪽 상대 · 파트너 · 오른쪽 상대에게 한 장씩 전달합니다.</p></div>
      <div className="ti-pass-targets">{recipientLabels.map((label, index) => <span className={selected[index] ? "filled" : ""} key={label}><b>{index + 1}</b>{label}<small>{selected[index] ? game.players[0].hand.find((card) => card.id === selected[index])?.name : "카드 선택"}</small></span>)}</div>
      <div className="ti-hand">{game.players[0].hand.map((card) => <CardFace card={card} selected={selected.includes(card.id)} onClick={() => selected.length < 3 || selected.includes(card.id) ? toggleCard(card.id) : undefined} key={card.id} />)}</div>
      <div className="ti-grand-actions"><button disabled={Boolean(game.declarations[0].type)} onClick={() => setGame(tichuDeclare(game, 0) as Game)}>교환 전에 티츄 선언 <b>±100</b></button><button className="ti-confirm" disabled={selected.length !== 3} onClick={() => { setGame(tichuResolvePassing(game, selected) as Game); setSelected([]); }}>세 장 보내고 받은 카드 확인 <span>→</span></button></div>
    </section></main>;
  }

  const myDeclaration = game.declarations[0];
  const containsMahjong = selectedCards.some((card) => card.special === "mahjong");
  return <main className="ti-shell"><Topbar onExit={onExit} /><Scoreboard game={game} /><section className="ti-table">
    <PlayerSeat game={game} id={1} /><PlayerSeat game={game} id={2} /><PlayerSeat game={game} id={3} />
    <section className="ti-trick">
      <header><div><small>CURRENT TRICK</small><h2>{game.currentCombo ? game.currentCombo.label : "새 트릭을 시작하세요"}</h2></div>{game.wish && <span className="ti-wish">소원 {tichuRankLabel(game.wish)}</span>}</header>
      <div className="ti-plays">{game.table.length ? game.table.slice(-4).map((playItem, index) => <article key={`${playItem.playerId}-${index}`}><small>{game.players[playItem.playerId].name}</small><div>{playItem.cards.map((card) => <CardFace compact card={card} key={card.id} />)}</div></article>) : <div className="empty"><span>一</span><p>{myTurn ? "원하는 조합으로 선을 시작하세요" : `${game.players[game.currentPlayer].name}의 선택을 기다리는 중`}</p></div>}</div>
      <footer><span>{game.finishOrder.length ? `완주: ${game.finishOrder.map((id) => game.players[id].name).join(" → ")}` : "아직 완주한 참가자가 없습니다"}</span><button onClick={() => openGuide("rules")}>ⓘ 조합·점수 규칙</button></footer>
    </section>
    <section className={`ti-player-area ${myTurn ? "active" : ""}`}><PlayerSeat game={game} id={0} />
      <div className="ti-turn-copy"><div><small>{myTurn ? "YOUR TURN" : "WAITING"}</small><h2>{myTurn ? selectedCombo ? `${selectedCombo.label} 선택` : "낼 카드를 선택하세요" : `${game.players[game.currentPlayer].name} 차례입니다`}</h2></div>{myDeclaration.type && <span>{myDeclaration.type === "grand" ? "GRAND TICHU" : "TICHU"} 선언 중</span>}</div>
      <div className="ti-hand">{game.players[0].hand.map((card) => <CardFace card={card} selected={selected.includes(card.id)} onClick={() => toggleCard(card.id)} key={card.id} />)}</div>
      {containsMahjong && <div className="ti-wish-picker"><span>마작 소원</span>{Array.from({ length: 13 }, (_, index) => index + 2).map((rank) => <button className={wish === rank ? "active" : ""} onClick={() => setWish(wish === rank ? null : rank)} key={rank}>{tichuRankLabel(rank)}</button>)}</div>}
      <div className="ti-actions"><button disabled={game.players[0].playedAny || Boolean(myDeclaration.type)} onClick={() => setGame(tichuDeclare(game, 0) as Game)}>티츄 선언 <b>±100</b></button><button disabled={!myTurn || !game.currentCombo} onClick={() => { setGame(tichuPass(game, 0) as Game); setSelected([]); setWish(null); }}>패스</button><button className="primary" disabled={myTurn ? !canPlay : !canBomb} onClick={play}>{!myTurn && canBomb ? "폭탄 난입" : selectedCombo?.type === "bomb" ? "폭탄 내기" : "카드 내기"} <span>→</span></button></div>
    </section>
  </section><details className="ti-log"><summary>최근 진행 기록</summary>{game.log.slice(-10).reverse().map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</details>{guide && <Guide mode={guide} step={guideStep} onStep={setGuideStep} onClose={() => setGuide(null)} />}</main>;
}
