"use client";

import { useMemo, useState } from "react";
import { withKoreanDirection } from "./korean-particles.js";
import {
  SW_AI_STRATEGIES,
  SW_COLORS,
  SW_RESOURCE_LABELS,
  SW_RESOURCES,
  swCanBuildCard,
  swCanBuildWonder,
  swCardSummary,
  swChooseAiSelection,
  swCostLabel,
  swCreateGame,
  swResolveSelections,
  swScorePlayer,
  swWinningEntries,
} from "./seven-wonders-engine.js";

type AiStrategy = "builder" | "balanced" | "strategist";
type SelectionAction = "build" | "wonder" | "discard";
type SwEffect = {
  resources?: Record<string, number>;
  points?: number;
  military?: number;
  science?: string;
  guild?: string;
  discount?: string;
  coins?: number;
  scienceWild?: number;
};
type SwCard = {
  id: string;
  age: number;
  name: string;
  color: string;
  cost: Record<string, number>;
  effect: SwEffect;
};
type SwWonderStage = {
  label: string;
  points?: number;
  military?: number;
  scienceWild?: number;
};
type SwWonder = {
  symbol: string;
  city: string;
  name: string;
  stages: SwWonderStage[];
};
type SwPlayer = {
  id: number;
  name: string;
  strategy?: AiStrategy | null;
  wonder: SwWonder;
  coins: number;
  military: number;
  production: Record<string, number>;
  tradeProduction: Record<string, number>;
  cards: SwCard[];
  stages: SwWonderStage[];
};
type SwScore = Record<string, number> & { total: number };
type SwResult = { playerId: number; name: string; city: string; score: SwScore; coins: number };
type SwHistory = { choices: { player: string; card: string; action: SelectionAction }[] };
type SwGame = {
  players: SwPlayer[];
  hands: SwCard[][];
  age: number;
  pick: number;
  phase: "draft" | "finished";
  history: SwHistory[];
  result: SwResult[] | null;
};

const RULES = [
  ["게임 목표", "3시대 동안 카드를 드래프트해 문명을 발전시키고, 군사·과학·건축·상업·불가사의에서 가장 많은 승점을 모으세요."],
  ["동시 드래프트", "각 시대에 카드 7장을 받고 한 장을 고른 뒤 남은 패를 옆 사람에게 넘깁니다. 여섯 장을 사용하면 마지막 한 장은 버립니다."],
  ["카드 사용", "고른 카드는 비용을 내고 건설하거나, 뒤집어 다음 불가사의 단계에 사용하거나, 버리고 3코인을 받을 수 있습니다."],
  ["자원 거래", "내 생산 자원이 부족하면 바로 왼쪽·오른쪽 문명의 시작 자원과 갈색·회색 카드 자원만 살 수 있습니다. 노란 카드와 불가사의가 만든 자원은 살 수 없으며, 거래 대금은 해당 이웃에게 지급됩니다."],
  ["군사 충돌", "각 시대 끝에 양옆 문명과 방패 수를 비교합니다. 승리 토큰은 시대에 따라 1·3·5점이고 패배는 -1점입니다."],
  ["과학 점수", "톱니·서판·컴퍼스는 같은 기호 개수의 제곱만큼 점수입니다. 세 종류 한 세트마다 7점을 추가합니다."],
  ["최종 승리", "3시대가 끝나면 모든 점수를 합산합니다. 최고점이 같으면 남은 코인이 많은 문명이 이기고, 코인도 같으면 공동 승리합니다."],
  ["구현 판본", "Repos 2판의 턴·교역·군사·과학·동점 규칙을 적용했습니다. 카드 이름·효과와 불가사의 면은 모바일 AI 대전에 맞춘 웹 재구성판입니다."],
];

const TUTORIAL = [
  ["문명을 선택하세요", "참가 인원을 정하면 각 참가자가 서로 다른 불가사의를 맡고, AI에는 건축가·집정관·전략가 성향이 고르게 배정됩니다. 내 시작 자원은 문명 보드에 표시됩니다."],
  ["손에서 한 장 고르기", "하단의 카드를 누르면 비용과 효과가 펼쳐집니다. 초반에는 여러 건물에 쓰이는 원자재와 제조품을 확보하는 것이 좋습니다."],
  ["세 가지 행동", "건설은 카드 효과를 얻고, 불가사의는 카드를 뒤집어 단계 보너스를 얻습니다. 어느 쪽도 어렵다면 폐기해 3코인을 받으세요."],
  ["이웃과 거래하기", "건설 버튼에 필요한 거래 비용이 자동 계산됩니다. 이웃의 시작 자원과 갈색·회색 카드 자원만 구매할 수 있고, 지급한 코인은 해당 AI의 국고로 이동합니다."],
  ["패의 이동 방향", "1시대와 3시대에는 왼쪽, 2시대에는 오른쪽으로 패가 이동합니다. 방금 넘긴 강력한 카드를 이웃이 가져갈 수도 있습니다."],
  ["점수 계획 세우기", "화면 위 문명 요약에서 이웃의 방패·과학·색상별 건물 수를 확인하고, 내 전략을 집중하거나 필요한 카드를 견제하세요."],
];

const SCIENCE_ICON: Record<string, string> = { gear: "⚙", tablet: "▣", compass: "⌖" };
const RESOURCE_ICON: Record<string, string> = {
  wood: "♣", stone: "◆", clay: "●", ore: "⬟", glass: "◈", papyrus: "▤", textile: "▥",
};

function GuideModal({
  mode,
  tutorialStep,
  onClose,
  onStep,
}: {
  mode: "rules" | "tutorial";
  tutorialStep: number;
  onClose: () => void;
  onStep: (step: number) => void;
}) {
  const item = TUTORIAL[tutorialStep];
  return (
    <div className="sw-modal-backdrop" onClick={onClose}>
      <section className="sw-modal" role="dialog" aria-modal="true" aria-label={mode === "rules" ? "게임 방법" : "튜토리얼"} onClick={(event) => event.stopPropagation()}>
        <button className="sw-modal-close" onClick={onClose} aria-label="닫기">×</button>
        <small>paperoid GUIDE</small>
        <h2>{mode === "rules" ? "게임 방법" : "빠른 튜토리얼"}</h2>
        {mode === "rules" ? (
          <div className="sw-rule-list">
            {RULES.map(([title, text], index) => (
              <article key={title}><b>{String(index + 1).padStart(2, "0")}</b><div><h3>{title}</h3><p>{text}</p></div></article>
            ))}
          </div>
        ) : (
          <div className="sw-tutorial-card">
            <div className="sw-tutorial-visual">
              <span>{tutorialStep + 1}</span>
              <i>{["△", "▥", "⚒", "↔", "➜", "★"][tutorialStep]}</i>
            </div>
            <div className="sw-tutorial-progress">{TUTORIAL.map((_, index) => <i key={index} className={index <= tutorialStep ? "active" : ""} />)}</div>
            <small>{tutorialStep + 1} / {TUTORIAL.length}</small>
            <h3>{item[0]}</h3>
            <p>{item[1]}</p>
            <div className="sw-modal-actions">
              <button disabled={tutorialStep === 0} onClick={() => onStep(tutorialStep - 1)}>이전</button>
              {tutorialStep < TUTORIAL.length - 1
                ? <button className="primary" onClick={() => onStep(tutorialStep + 1)}>다음</button>
                : <button className="primary" onClick={onClose}>게임 시작하기</button>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function WonderMark({ wonder, compact = false }: { wonder: SwWonder; compact?: boolean }) {
  return (
    <div className={`sw-wonder-mark ${compact ? "compact" : ""}`}>
      <span>{wonder.symbol}</span>
      <div><strong>{wonder.city}</strong><small>{wonder.name}</small></div>
    </div>
  );
}

function ResourceStrip({ production }: { production: Record<string, number> }) {
  return (
    <div className="sw-resource-strip" aria-label="생산 자원">
      {SW_RESOURCES.filter((resource) => production[resource] > 0).map((resource) => (
        <span key={resource} title={SW_RESOURCE_LABELS[resource]}>
          {RESOURCE_ICON[resource]}<b>{production[resource]}</b>
        </span>
      ))}
    </div>
  );
}

function CivilizationCard({ player, players, active = false }: { player: SwPlayer; players: SwPlayer[]; active?: boolean }) {
  const score = swScorePlayer(player, players);
  const colors = player.cards.reduce((result: Record<string, number>, card: SwCard) => {
    result[card.color] = (result[card.color] || 0) + 1;
    return result;
  }, {});
  return (
    <article className={`sw-civilization ${active ? "active" : ""}`}>
      <header>
        <WonderMark wonder={player.wonder} compact />
        <span className="sw-coin">● {player.coins}</span>
      </header>
      {player.strategy && (
        <span className={`sw-ai-personality ${player.strategy}`} title={SW_AI_STRATEGIES[player.strategy].description}>
          AI 성향 · {SW_AI_STRATEGIES[player.strategy].label}
        </span>
      )}
      <div className="sw-civ-stats">
        <span title="방패"><b>⚔</b>{player.military}</span>
        <span title="현재 예상 점수"><b>★</b>{score.total}</span>
        <span title="불가사의 단계"><b>△</b>{player.stages.length}/3</span>
      </div>
      <ResourceStrip production={player.production} />
      <div className="sw-color-track">
        {Object.entries(SW_COLORS).map(([color]) => <i key={color} className={color} data-count={colors[color] || 0} />)}
      </div>
    </article>
  );
}

function DraftCard({ card, selected, onClick }: { card: SwCard; selected: boolean; onClick: () => void }) {
  return (
    <button className={`sw-draft-card ${card.color} ${selected ? "selected" : ""}`} onClick={onClick}>
      <span className="sw-card-age">{["", "Ⅰ", "Ⅱ", "Ⅲ"][card.age]}</span>
      <span className="sw-card-glyph">
        {card.effect.science ? SCIENCE_ICON[card.effect.science] : card.effect.military ? "⚔" : card.effect.points ? "★" : card.effect.guild ? "♛" : card.effect.resources ? "⚒" : "●"}
      </span>
      <strong>{card.name}</strong>
      <small>{swCardSummary(card)}</small>
      <em>{swCostLabel(card.cost)}</em>
    </button>
  );
}

function ResultBoard({ game, onRestart, onExit }: { game: SwGame; onRestart: () => void; onExit: () => void }) {
  const categories = [
    ["military", "군사"], ["treasury", "국고"], ["wonder", "불가사의"], ["civic", "시민"],
    ["commerce", "상업"], ["guilds", "길드"], ["science", "과학"],
  ];
  const ranking = game.result ?? [];
  const winner = ranking[0];
  const sharedWinners = swWinningEntries(game.players) as SwResult[];
  const isSharedVictory = sharedWinners.length > 1;
  const humanSharedWinner = sharedWinners.some((entry) => entry.playerId === 0);
  return (
    <main className="sw-shell sw-result-shell">
      <header className="sw-topbar">
        <button onClick={onExit} aria-label="게임 목록으로">←</button>
        <div><small>paperoid</small><strong>7대 문명</strong></div>
        <button onClick={onExit}>나가기</button>
      </header>
      <section className="sw-result">
        <span className="sw-result-crown">✦</span>
        <small>AGE III · FINAL SCORE</small>
        <h1>{isSharedVictory
          ? `${humanSharedWinner ? "당신을 포함한 " : ""}${sharedWinners.length}개 문명 공동 승리`
          : winner?.playerId === 0 ? "당신의 문명이 승리했습니다!" : `${winner?.name} · ${winner?.city} 승리`}</h1>
        <p>세 시대의 기록을 모두 합산했습니다.</p>
        <div className="sw-score-table">
          <div className="sw-score-head"><span>순위</span><span>문명</span>{categories.map(([, label]) => <span key={label}>{label}</span>)}<strong>합계</strong></div>
          {ranking.map((entry: SwResult, index: number) => (
            <div className={entry.playerId === 0 ? "human" : ""} key={entry.playerId}>
              <span>{sharedWinners.some((winnerEntry) => winnerEntry.playerId === entry.playerId) ? "1" : index + 1}</span>
              <span><b>{entry.name}</b><small>{entry.city}</small></span>
              {categories.map(([key]) => <span key={key}>{entry.score[key]}</span>)}
              <strong>{entry.score.total}</strong>
            </div>
          ))}
        </div>
        <div className="sw-result-actions">
          <button onClick={onExit}>게임 목록</button>
          <button className="primary" onClick={onRestart}>같은 설정으로 다시 플레이</button>
        </div>
      </section>
    </main>
  );
}

export function SevenWondersGame({ onExit }: { onExit: () => void }) {
  const [playerCount, setPlayerCount] = useState(3);
  const [game, setGame] = useState<SwGame | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState<"rules" | "tutorial" | null>(null);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [notice, setNotice] = useState("");

  const startGame = () => {
    setGame(swCreateGame(playerCount) as SwGame);
    setSelectedCard(null);
    setNotice("첫 번째 시대가 시작되었습니다. 손에서 카드 한 장을 고르세요.");
  };

  const restart = () => {
    setGame(swCreateGame(playerCount) as SwGame);
    setSelectedCard(null);
    setNotice("새로운 문명들이 첫 번째 시대를 시작합니다.");
  };

  const selected = game && selectedCard != null ? game.hands[0]?.[selectedCard] : null;
  const cardPayment = selected ? swCanBuildCard(game.players, 0, selected) : null;
  const wonderPayment = game ? swCanBuildWonder(game.players, 0) : null;
  const player = game?.players[0];

  const publicLog = useMemo(() => {
    if (!game?.history.length) return [];
    return game.history.slice(-2).flatMap((turn: SwHistory) => turn.choices.map((choice) => (
      `${choice.player}: ${choice.action === "build" ? choice.card : choice.action === "wonder" ? "불가사의 건설" : "카드 폐기"}`
    )));
  }, [game]);

  const playSelection = (action: SelectionAction) => {
    if (!game || selectedCard == null || busy) return;
    if (action === "build" && !cardPayment) return;
    if (action === "wonder" && !wonderPayment) return;
    setBusy(true);
    setNotice("AI 문명들이 카드를 선택하고 있습니다…");
    window.setTimeout(() => {
      const aiSelections = game.players.slice(1).map((_, index: number) => swChooseAiSelection(game, index + 1));
      const previousAge = game.age;
      const previousPick = game.pick;
      const next = swResolveSelections(game, [{ cardIndex: selectedCard, action }, ...aiSelections]) as SwGame;
      setGame(next);
      setSelectedCard(null);
      setBusy(false);
      if (next.phase === "finished") setNotice("세 번째 시대가 끝났습니다.");
      else if (next.age !== previousAge) setNotice(`${previousAge}시대 군사 충돌 해결 · ${next.age}시대가 시작됩니다.`);
      else setNotice(`${previousAge}시대 ${previousPick}/6 선택 완료 · 패가 ${withKoreanDirection(previousAge === 2 ? "오른쪽" : "왼쪽")} 이동했습니다.`);
    }, 560);
  };

  const openGuide = (mode: "rules" | "tutorial") => {
    setTutorialStep(0);
    setGuide(mode);
  };

  if (game?.phase === "finished") return <ResultBoard game={game} onRestart={restart} onExit={onExit} />;

  if (!game) {
    return (
      <main className="sw-shell">
        <header className="sw-topbar">
          <button onClick={onExit} aria-label="게임 목록으로">←</button>
          <div><small>paperoid</small><strong>7대 문명</strong></div>
          <button onClick={onExit}>나가기</button>
        </header>
        <section className="sw-lobby">
          <div className="sw-lobby-copy">
            <span>BUILD AN ANCIENT LEGACY</span>
            <h1>일곱 문명의<br /><em>찬란한 시대</em></h1>
            <p>카드를 선택하고 이웃과 교역하며 나만의 고대 문명을 완성하세요. 모든 문명은 동시에 성장합니다.</p>
            <div className="sw-lobby-guide-buttons">
              <button onClick={() => openGuide("rules")}>◎ 게임 방법</button>
              <button onClick={() => openGuide("tutorial")}>▷ 튜토리얼</button>
            </div>
          </div>
          <div className="sw-lobby-art" aria-hidden="true">
            <div className="sw-sun">✦</div>
            <div className="sw-temple"><i /><i /><i /><i /><i /><b /></div>
            <span className="sw-art-card one">Ⅰ<small>⚒</small></span>
            <span className="sw-art-card two">Ⅱ<small>⚔</small></span>
            <span className="sw-art-card three">Ⅲ<small>★</small></span>
          </div>
          <aside className="sw-start-card">
            <small>NEW CIVILIZATION</small>
            <h2>대전 설정</h2>
            <fieldset>
              <legend>참가 문명</legend>
              <div className="sw-count-picker">
                {[3, 4, 5, 6, 7].map((count) => <button key={count} className={playerCount === count ? "active" : ""} onClick={() => setPlayerCount(count)}>{count}</button>)}
              </div>
              <p>나 1명 + AI {playerCount - 1}명</p>
            </fieldset>
            <section className="sw-auto-strategy" aria-label="AI 성향 자동 배정">
              <div><small>AI PERSONALITY</small><b>성향을 균형 있게 자동 배정합니다</b></div>
              <p>건축가·집정관·전략가가 참가 인원에 맞춰 고르게 배정되며, 새 대국마다 담당 문명이 달라집니다.</p>
              <div className="sw-strategy-tags">
                {(Object.keys(SW_AI_STRATEGIES) as AiStrategy[]).map((strategy) => (
                  <span key={strategy}>{SW_AI_STRATEGIES[strategy].label}</span>
                ))}
              </div>
            </section>
            <button className="sw-start-button" onClick={startGame}>문명 건설 시작 <span>→</span></button>
          </aside>
        </section>
        {guide && <GuideModal mode={guide} tutorialStep={tutorialStep} onStep={setTutorialStep} onClose={() => setGuide(null)} />}
      </main>
    );
  }

  const stage = player.wonder.stages[player.stages.length];
  const direction = game.age === 2 ? "오른쪽" : "왼쪽";

  return (
    <main className="sw-shell">
      <header className="sw-topbar sw-game-topbar">
        <button onClick={onExit} aria-label="게임 목록으로">←</button>
        <div><small>paperoid</small><strong>7대 문명</strong></div>
        <div className="sw-age-display"><span>AGE</span><b>{["", "Ⅰ", "Ⅱ", "Ⅲ"][game.age]}</b><small>{game.pick}/6</small></div>
        <div className="sw-header-actions">
          <button onClick={() => openGuide("rules")}>게임 방법</button>
          <button onClick={onExit}>나가기</button>
        </div>
      </header>

      <section className="sw-game">
        <div className="sw-rivals-head">
          <div><small>NEIGHBORING CIVILIZATIONS</small><h2>이웃 문명</h2></div>
          <p>패가 <b>{direction}</b>으로 이동합니다 <span>{direction === "왼쪽" ? "←" : "→"}</span></p>
        </div>
        <div className="sw-rivals">
          {game.players.slice(1).map((rival: SwPlayer, index: number) => <CivilizationCard key={rival.id} player={rival} players={game.players} active={index === 0 || index === game.players.length - 2} />)}
        </div>

        <section className="sw-city-board">
          <div className="sw-city-skyline">
            <WonderMark wonder={player.wonder} />
            <div className="sw-own-stats">
              <span><small>COINS</small><b>● {player.coins}</b></span>
              <span><small>SHIELDS</small><b>⚔ {player.military}</b></span>
              <span><small>SCORE</small><b>★ {swScorePlayer(player, game.players).total}</b></span>
            </div>
          </div>
          <ResourceStrip production={player.production} />
          <div className="sw-wonder-track">
            {player.wonder.stages.map((wonderStage: SwWonderStage, index: number) => (
              <div key={wonderStage.label} className={index < player.stages.length ? "built" : index === player.stages.length ? "next" : ""}>
                <span>{index < player.stages.length ? "✓" : index + 1}</span>
                <b>{wonderStage.label}</b>
                <small>{wonderStage.points ? `★ ${wonderStage.points}` : wonderStage.military ? `⚔ ${wonderStage.military}` : wonderStage.scienceWild ? "과학 기호" : "특수 효과"}</small>
              </div>
            ))}
          </div>
          <div className="sw-built-cards">
            {Object.entries(SW_COLORS).map(([color, label]) => {
              const cards = player.cards.filter((built: SwCard) => built.color === color);
              return <div key={color} className={color}><span>{label}</span><b>{cards.length}</b><small>{cards.slice(-2).map((built: SwCard) => built.name).join(" · ") || "아직 없음"}</small></div>;
            })}
          </div>
        </section>

        <div className="sw-turn-status">
          <span>{game.pick}</span>
          <div><strong>{busy ? "AI가 선택하는 중…" : "건설할 카드를 고르세요"}</strong><small>{notice}</small></div>
          <button onClick={() => openGuide("tutorial")}>도움말</button>
        </div>

        <section className="sw-hand-section">
          <div className="sw-hand-head"><div><small>YOUR HAND</small><h2>나의 카드 <b>{game.hands[0].length}</b></h2></div><span>{game.age}시대 · {game.pick}/6 선택</span></div>
          <div className="sw-hand">
            {game.hands[0].map((heldCard: SwCard, index: number) => <DraftCard key={heldCard.id} card={heldCard} selected={selectedCard === index} onClick={() => !busy && setSelectedCard(selectedCard === index ? null : index)} />)}
          </div>
          <aside className={`sw-action-panel ${selected ? "open" : ""}`}>
            {selected ? (
              <>
                <div className={`sw-selected-summary ${selected.color}`}>
                  <span>{["", "Ⅰ", "Ⅱ", "Ⅲ"][selected.age]}</span>
                  <div><small>{SW_COLORS[selected.color]}</small><strong>{selected.name}</strong><p>{swCardSummary(selected)} · 비용 {swCostLabel(selected.cost)}</p></div>
                </div>
                <div className="sw-action-buttons">
                  <button className="build" disabled={!cardPayment || busy} onClick={() => playSelection("build")}>
                    <span>⚒</span><div><b>건설</b><small>{cardPayment ? cardPayment.chain ? "연계 건설 · 무료" : cardPayment.total ? `거래 포함 ${cardPayment.total}코인` : "무료 건설" : "자원 또는 코인 부족"}</small></div>
                  </button>
                  <button disabled={!wonderPayment || busy} onClick={() => playSelection("wonder")}>
                    <span>△</span><div><b>불가사의</b><small>{stage ? `${stage.label} · ${wonderPayment ? wonderPayment.total : "-"}코인` : "모든 단계 완성"}</small></div>
                  </button>
                  <button disabled={busy} onClick={() => playSelection("discard")}>
                    <span>●</span><div><b>폐기</b><small>3코인 획득</small></div>
                  </button>
                </div>
              </>
            ) : <p className="sw-select-prompt"><span>↑</span> 카드를 선택하면 건설 방법과 비용을 확인할 수 있습니다.</p>}
          </aside>
        </section>

        <details className="sw-public-log">
          <summary>최근 건설 기록</summary>
          {publicLog.length ? publicLog.map((line: string, index: number) => <span key={`${line}-${index}`}>{line}</span>) : <span>첫 선택을 기다리고 있습니다.</span>}
        </details>
      </section>
      {guide && <GuideModal mode={guide} tutorialStep={tutorialStep} onStep={setTutorialStep} onClose={() => setGuide(null)} />}
    </main>
  );
}
