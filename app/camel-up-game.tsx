"use client";

import { useEffect, useMemo, useState } from "react";
import { withKoreanSubject } from "./korean-particles.js";
import {
  CU_CAMELS,
  CU_CRAZY_CAMELS,
  camelName,
  cuChooseAiAction,
  cuCreateGame,
  cuLegalSpectatorSpaces,
  cuPartner,
  cuPlaceFinishBet,
  cuPlaceSpectator,
  cuRanking,
  cuRollPyramid,
  cuTakeLegBet,
  cuTrackView,
} from "./camel-up-engine.js";

type Difficulty = "casual" | "balanced" | "sharp";
type ChoiceMode = "leg" | "winner" | "loser" | "spectator" | "partner" | null;
type CuBet = { camel: string; value: number };
type CuSpectator = { position: number; side: "cheer" | "boo" };
type CuPlayer = {
  id: number; name: string; coins: number; legBets: CuBet[]; pyramidTickets: number;
  finishUsed: string[]; spectator: CuSpectator | null; partner: number | null;
};
type CuStanding = { id: number; name: string; coins: number };
type CuGame = {
  playerCount: number; difficulty: Difficulty; players: CuPlayer[]; track: Record<string, string[]>;
  dice: string[]; revealed: { die: string; camel: string; value: number }[];
  legTickets: Record<string, number[]>; winnerBets: object[]; loserBets: object[];
  currentPlayer: number; leg: number; phase: "race" | "finished";
  winner: CuStanding | null; standings?: CuStanding[];
  winners?: CuStanding[];
  lastRoll: { die: string; camel: string; value: number } | null; log: string[];
};
type CuTrackSpace = { position: number; camels: string[] };

const RULES = [
  ["게임 목표", "경주 낙타의 순위를 예측해 구간 베팅과 최종 우승·최하위 베팅으로 가장 많은 이집트 파운드(EP)를 모으세요."],
  ["낙타 더미", "같은 칸의 낙타는 아래에서 위로 쌓입니다. 낙타가 움직일 때 자기 위에 있는 모든 낙타를 함께 운반합니다."],
  ["한 차례의 행동", "구간 베팅, 관중 타일 배치, 피라미드 굴리기, 최종 우승 또는 최하위 베팅 중 한 가지를 실행합니다."],
  ["구간 종료", "피라미드의 주사위 여섯 개 중 다섯 개가 공개되면 구간을 정산합니다. 선두 베팅은 표의 금액, 2위는 1 EP, 나머지는 -1 EP입니다."],
  ["관중 타일", "응원 면은 도착한 낙타 더미를 진행 방향으로 한 칸 더 보내고, 야유 면은 한 칸 뒤로 보냅니다. 타일 주인은 1 EP를 받습니다."],
  ["역주행 낙타", "하얀색과 검은색 낙타는 반대 방향으로 달립니다. 등에 올라탄 경주 낙타까지 뒤로 운반할 수 있지만 순위에는 포함되지 않습니다."],
  ["경주 종료", "낙타 더미 하나가 결승선을 통과하면 즉시 마지막 구간과 최종 베팅을 정산합니다. 가장 많은 EP를 가진 참가자가 승리합니다."],
];

const TUTORIAL = [
  ["순위를 읽으세요", "더 멀리 간 낙타가 앞서며 같은 칸에서는 더미 위쪽 낙타가 선두입니다. 현재 순위는 경기장 위에 항상 표시됩니다."],
  ["일찍 베팅하세요", "구간 베팅표는 5·3·2·2 EP 순서로 가져갑니다. 확신이 든다면 다른 참가자보다 먼저 높은 표를 잡으세요."],
  ["피라미드를 굴리세요", "무작위 주사위 하나가 1~3을 표시합니다. 피라미드를 굴린 참가자는 구간 정산 때 1 EP를 받습니다."],
  ["더미의 반전을 노리세요", "아래쪽 낙타가 움직이면 위의 낙타를 전부 데려갑니다. 선두 낙타가 아직 주사위를 굴리지 않았다면 순위가 크게 바뀔 수 있습니다."],
  ["응원과 야유", "빈 칸에 관중 타일을 놓아 낙타를 한 칸 더 보내거나 뒤로 미세요. 다른 관중 타일과 인접한 칸에는 놓을 수 없습니다."],
  ["비밀 최종 베팅", "경주가 끝나기 전 원하는 때에 우승 또는 최하위 카드를 제출합니다. 먼저 맞힌 사람일수록 8·5·3·2·1 EP의 큰 보상을 받습니다."],
];

const ALL_CAMELS = [...CU_CAMELS, ...CU_CRAZY_CAMELS];

function Guide({ mode, step, onStep, onClose }: { mode: "rules" | "tutorial"; step: number; onStep: (value: number) => void; onClose: () => void }) {
  const tutorial = TUTORIAL[step];
  return (
    <div className="cu-modal-backdrop" onClick={onClose}>
      <section className="cu-modal" role="dialog" aria-modal="true" aria-label={mode === "rules" ? "게임 방법" : "튜토리얼"} onClick={(event) => event.stopPropagation()}>
        <button className="cu-close" onClick={onClose} aria-label="닫기">×</button>
        <small>RACE GUIDE</small>
        <h2>{mode === "rules" ? "게임 방법" : "빠른 튜토리얼"}</h2>
        {mode === "rules" ? (
          <div className="cu-rules">
            {RULES.map(([title, text], index) => <article key={title}><b>{index + 1}</b><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
        ) : (
          <div className="cu-tutorial">
            <div className="cu-tutorial-art"><span>{["🏁", "票", "△", "♞", "☀", "?"][step]}</span></div>
            <div className="cu-progress">{TUTORIAL.map((_, index) => <i className={index <= step ? "active" : ""} key={index} />)}</div>
            <small>{step + 1} / {TUTORIAL.length}</small>
            <h3>{tutorial[0]}</h3><p>{tutorial[1]}</p>
            <div><button disabled={step === 0} onClick={() => onStep(step - 1)}>이전</button>{step < TUTORIAL.length - 1 ? <button className="primary" onClick={() => onStep(step + 1)}>다음</button> : <button className="primary" onClick={onClose}>경주 시작</button>}</div>
          </div>
        )}
      </section>
    </div>
  );
}

function CamelPiece({ id, compact = false }: { id: string; compact?: boolean }) {
  const camel = ALL_CAMELS.find((item) => item.id === id)!;
  return <span className={`cu-camel ${camel.crazy ? "crazy" : ""} ${compact ? "compact" : ""}`} style={{ "--camel": camel.color } as React.CSSProperties}><i>♞</i><small>{camel.glyph}</small></span>;
}

function ChoicePanel({
  mode,
  game,
  spectatorSide,
  setSpectatorSide,
  onChoose,
  onClose,
}: {
  mode: Exclude<ChoiceMode, null>;
  game: CuGame;
  spectatorSide: "cheer" | "boo";
  setSpectatorSide: (side: "cheer" | "boo") => void;
  onChoose: (value: string | number) => void;
  onClose: () => void;
}) {
  const title = { leg: "구간 선두 낙타", winner: "최종 우승 낙타", loser: "최종 최하위 낙타", spectator: "관중 타일 위치", partner: "제휴할 참가자" }[mode];
  const legalSpaces = mode === "spectator" ? cuLegalSpectatorSpaces(game) : [];
  return (
    <div className="cu-choice-backdrop" onClick={onClose}>
      <section className="cu-choice" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header><div><small>CHOOSE ACTION</small><h2>{title}</h2></div><button onClick={onClose}>×</button></header>
        {mode === "spectator" ? (
          <>
            <div className="cu-side-toggle">
              <button className={spectatorSide === "cheer" ? "active" : ""} onClick={() => setSpectatorSide("cheer")}>☀ 응원 +1</button>
              <button className={spectatorSide === "boo" ? "active" : ""} onClick={() => setSpectatorSide("boo")}>☾ 야유 -1</button>
            </div>
            <div className="cu-space-choice">{legalSpaces.map((space: number) => <button key={space} onClick={() => onChoose(space)}>{space}</button>)}</div>
          </>
        ) : mode === "partner" ? (
          <div className="cu-player-choice">{game.players.filter((player: CuPlayer) => player.id !== 0 && player.partner == null).map((player: CuPlayer) => <button key={player.id} onClick={() => onChoose(player.id)}><span>AI</span><b>{player.name}</b><small>{player.coins} EP</small></button>)}</div>
        ) : (
          <div className="cu-camel-choice">
            {CU_CAMELS.map((camel) => {
              const used = (mode === "winner" || mode === "loser") && game.players[0].finishUsed.includes(camel.id);
              const ticket = mode === "leg" ? game.legTickets[camel.id]?.[0] : null;
              return <button key={camel.id} disabled={used || (mode === "leg" && ticket == null)} onClick={() => onChoose(camel.id)}><CamelPiece id={camel.id} /><b>{camel.name}</b><small>{used ? "이미 사용" : mode === "leg" ? `${ticket} EP 베팅표` : "비밀 카드 제출"}</small></button>;
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Result({ game, onRestart, onExit }: { game: CuGame; onRestart: () => void; onExit: () => void }) {
  const ranking = cuRanking(game.track);
  const winners = game.winners ?? (game.winner ? [game.winner] : []);
  const shared = winners.length > 1;
  return (
    <main className="cu-shell">
      <Topbar onExit={onExit} />
      <section className="cu-result">
        <span>🏆</span><small>RACE COMPLETE</small>
        <h1>{shared
          ? `${winners.some((winner) => winner.id === 0) ? "당신을 포함한 " : ""}${winners.length}명 공동 우승`
          : game.winner?.id === 0 ? "사막 최고의 예측가가 되었습니다!" : `${withKoreanSubject(game.winner?.name)} 우승했습니다`}</h1>
        <p>{camelName(ranking[0])} 우승 · {camelName(ranking[ranking.length - 1])} 최하위</p>
        <div className="cu-podium">
          {(game.standings ?? []).map((player: CuStanding, index: number) => <article className={player.id === 0 ? "human" : ""} key={player.id}><b>{winners.some((winner) => winner.id === player.id) ? 1 : index + 1}</b><div><strong>{player.name}</strong><small>{player.id === 0 ? "PLAYER" : "AI PLAYER"}</small></div><span>{player.coins} <em>EP</em></span></article>)}
        </div>
        <div className="cu-result-actions"><button onClick={onExit}>게임 목록</button><button className="primary" onClick={onRestart}>같은 설정으로 다시 경주</button></div>
      </section>
    </main>
  );
}

function Topbar({ onExit }: { onExit: () => void }) {
  return <header className="cu-topbar"><button onClick={onExit} aria-label="게임 목록으로">←</button><div><small>paperoid</small><strong>카멜 업</strong></div><button onClick={onExit}>나가기</button></header>;
}

export function CamelUpGame({ onExit }: { onExit: () => void }) {
  const [playerCount, setPlayerCount] = useState(4);
  const [difficulty, setDifficulty] = useState<Difficulty>("balanced");
  const [game, setGame] = useState<CuGame | null>(null);
  const [guide, setGuide] = useState<"rules" | "tutorial" | null>(null);
  const [guideStep, setGuideStep] = useState(0);
  const [choice, setChoice] = useState<ChoiceMode>(null);
  const [spectatorSide, setSpectatorSide] = useState<"cheer" | "boo">("cheer");

  const start = () => setGame(cuCreateGame(playerCount, difficulty) as CuGame);
  const restart = () => setGame(cuCreateGame(playerCount, difficulty) as CuGame);
  const openGuide = (mode: "rules" | "tutorial") => { setGuideStep(0); setGuide(mode); };

  useEffect(() => {
    if (!game || game.phase !== "race" || game.currentPlayer === 0 || choice) return;
    const timer = window.setTimeout(() => setGame((current: CuGame | null) => current ? cuChooseAiAction(current, current.currentPlayer) as CuGame : current), 620);
    return () => window.clearTimeout(timer);
  }, [game, choice]);

  const choose = (value: string | number) => {
    if (!game || !choice) return;
    let next = game;
    if (choice === "leg") next = cuTakeLegBet(game, 0, String(value));
    if (choice === "winner" || choice === "loser") next = cuPlaceFinishBet(game, 0, String(value), choice);
    if (choice === "spectator") next = cuPlaceSpectator(game, 0, Number(value), spectatorSide);
    if (choice === "partner") next = cuPartner(game, 0, Number(value));
    setChoice(null);
    setGame(next as CuGame);
  };

  const ranking = useMemo(() => game ? cuRanking(game.track) : [], [game]);

  if (game?.phase === "finished") return <Result game={game} onRestart={restart} onExit={onExit} />;

  if (!game) {
    return (
      <main className="cu-shell">
        <Topbar onExit={onExit} />
        <section className="cu-lobby">
          <div className="cu-lobby-copy">
            <span>THE WILDEST DESERT RACE</span>
            <h1>누가 먼저<br /><em>결승선을 넘을까?</em></h1>
            <p>낙타는 달리고, 쌓이고, 때로는 뒤로 갑니다. 확률을 읽고 남들보다 먼저 승부를 거세요.</p>
            <div><button onClick={() => openGuide("rules")}>◎ 게임 방법</button><button onClick={() => openGuide("tutorial")}>▷ 튜토리얼</button></div>
          </div>
          <div className="cu-lobby-art" aria-hidden="true">
            <span className="cu-sun">☀</span><i className="cu-dune one" /><i className="cu-dune two" />
            <div className="cu-lobby-stack">{["purple", "yellow", "red"].map((id) => <CamelPiece key={id} id={id} />)}</div>
            <div className="cu-pyramid">△<small>1 · 2 · 3</small></div>
            <span className="cu-flag">🏁</span>
          </div>
          <aside className="cu-start-card">
            <small>RACE SETUP</small><h2>대전 설정</h2>
            <fieldset><legend>참가 인원</legend><div className="cu-count">{[3,4,5,6,7,8].map((count) => <button key={count} className={playerCount === count ? "active" : ""} onClick={() => setPlayerCount(count)}>{count}</button>)}</div><p>나 1명 + AI {playerCount - 1}명 {playerCount >= 6 && "· 제휴 규칙 사용"}</p></fieldset>
            <fieldset><legend>AI 예측력</legend>{[
              ["casual", "관광객", "재미있게 과감한 베팅을 합니다."],
              ["balanced", "상인", "현재 순위와 남은 주사위를 함께 봅니다."],
              ["sharp", "승부사", "높은 베팅표와 결승 시점을 빠르게 노립니다."],
            ].map(([value, label, text]) => <label className={difficulty === value ? "active" : ""} key={value}><input type="radio" checked={difficulty === value} onChange={() => setDifficulty(value as Difficulty)} /><span><b>{label}</b><small>{text}</small></span></label>)}</fieldset>
            <button className="cu-start" onClick={start}>피라미드 흔들기 <span>→</span></button>
          </aside>
        </section>
        {guide && <Guide mode={guide} step={guideStep} onStep={setGuideStep} onClose={() => setGuide(null)} />}
      </main>
    );
  }

  const track = cuTrackView(game.track);
  const myTurn = game.currentPlayer === 0;
  const player = game.players[0];
  return (
    <main className="cu-shell">
      <Topbar onExit={onExit} />
      <section className="cu-game">
        <div className="cu-race-status">
          <div><small>LEG</small><strong>{game.leg}</strong></div>
          <div className="cu-rank-strip">{ranking.map((id: string, index: number) => <span key={id}><b>{index + 1}</b><CamelPiece id={id} compact /><small>{camelName(id)}</small></span>)}</div>
          <div><small>DICE</small><strong>{game.revealed.length}/5</strong></div>
        </div>

        <section className="cu-arena">
          <div className="cu-arena-head"><div><small>SAHARA CIRCUIT</small><h2>{myTurn ? "당신의 차례입니다" : `${withKoreanSubject(game.players[game.currentPlayer].name)} 결정하는 중…`}</h2></div><span>{game.lastRoll ? `${camelName(game.lastRoll.camel)} ${game.lastRoll.value}칸` : "경주 시작"}</span></div>
          <div className="cu-track">
            {track.map((space: CuTrackSpace) => {
              const tileOwner = game.players.find((candidate: CuPlayer) => candidate.spectator?.position === space.position);
              return <div className={`cu-track-space ${space.position === 16 ? "finish" : ""}`} key={space.position}><b>{space.position}</b>{space.position === 16 && <span className="cu-mini-flag">🏁</span>}<div className="cu-space-stack">{space.camels.map((id: string) => <CamelPiece key={id} id={id} compact />)}</div>{tileOwner && <span className={`cu-spectator ${tileOwner.spectator.side}`}>{tileOwner.spectator.side === "cheer" ? "+1" : "-1"}</span>}</div>;
            })}
          </div>
          <div className="cu-reverse-lane"><span>↶ 역주행</span>{CU_CRAZY_CAMELS.map((camel) => { const found = Object.entries(game.track).find(([, ids]) => ids.includes(camel.id)); return <div key={camel.id}><CamelPiece id={camel.id} compact /><small>{found?.[0]}번</small></div>; })}</div>
          <div className="cu-dice-history">{[...CU_CAMELS.map((camel) => camel.id), "gray"].map((die) => { const rolled = game.revealed.find((item) => item.die === die); return <span className={rolled ? "rolled" : ""} key={die}>{die === "gray" ? "◐" : <CamelPiece id={die} compact />}<b>{rolled?.value ?? "?"}</b></span>; })}</div>
        </section>

        <section className="cu-table">
          <div className="cu-player-panel">
            <header><div><small>YOUR WALLET</small><h2>나의 베팅</h2></div><strong>{player.coins} <small>EP</small></strong></header>
            <div className="cu-my-bets"><div><span>구간표</span>{player.legBets.length ? player.legBets.map((bet: CuBet, index: number) => <b key={`${bet.camel}-${index}`}>{camelName(bet.camel)} {bet.value}</b>) : <small>아직 없음</small>}</div><div><span>피라미드표</span><b>△ × {player.pyramidTickets}</b></div><div><span>비밀 베팅</span><b>? × {player.finishUsed.length}</b></div>{player.partner != null && <div><span>제휴</span><b>{game.players[player.partner].name}</b></div>}</div>
          </div>
          <div className="cu-actions">
            <button disabled={!myTurn} onClick={() => setChoice("leg")}><span>票</span><div><b>구간 베팅</b><small>현재 구간 선두 예측</small></div></button>
            <button disabled={!myTurn} onClick={() => setChoice("spectator")}><span>☀</span><div><b>관중 타일</b><small>응원 또는 야유 배치</small></div></button>
            <button className="roll" disabled={!myTurn} onClick={() => setGame(cuRollPyramid(game, 0))}><span>△</span><div><b>피라미드 굴리기</b><small>주사위 공개 · 구간 +1 EP</small></div></button>
            <button disabled={!myTurn} onClick={() => setChoice("winner")}><span>🏆</span><div><b>최종 우승</b><small>비밀 카드 제출</small></div></button>
            <button disabled={!myTurn} onClick={() => setChoice("loser")}><span>↘</span><div><b>최종 최하위</b><small>비밀 카드 제출</small></div></button>
            {game.playerCount >= 6 && <button disabled={!myTurn || player.partner != null} onClick={() => setChoice("partner")}><span>↔</span><div><b>베팅 제휴</b><small>서로의 보상 하나 복사</small></div></button>}
          </div>
        </section>

        <section className="cu-opponents">
          {game.players.slice(1).map((opponent: CuPlayer) => <article className={game.currentPlayer === opponent.id ? "active" : ""} key={opponent.id}><span>AI</span><div><b>{opponent.name}</b><small>구간표 {opponent.legBets.length} · 피라미드 {opponent.pyramidTickets}</small></div><strong>{opponent.coins} EP</strong></article>)}
        </section>
        <details className="cu-log"><summary>최근 경주 기록</summary>{game.log.slice(-8).reverse().map((line: string, index: number) => <span key={`${line}-${index}`}>{line}</span>)}</details>
      </section>
      {choice && <ChoicePanel mode={choice} game={game} spectatorSide={spectatorSide} setSpectatorSide={setSpectatorSide} onChoose={choose} onClose={() => setChoice(null)} />}
      {guide && <Guide mode={guide} step={guideStep} onStep={setGuideStep} onClose={() => setGuide(null)} />}
    </main>
  );
}
