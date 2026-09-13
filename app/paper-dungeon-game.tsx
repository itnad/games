"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PAPER_DUNGEON_CLASSES,
  choosePaperDungeonReward,
  createPaperDungeonRun,
  isPaperDungeonSave,
  resolvePaperDungeonAction,
} from "./paper-dungeon-engine.js";

type ExitProps = { onExit: () => void };
type RunState = ReturnType<typeof createPaperDungeonRun>;
type Action = "attack" | "skill" | "defend" | "potion";

const SAVE_KEY = "paperoid-paper-dungeon-save-v1";
const CLEAR_KEY = "paperoid-paper-dungeon-clears";

function Meter({ value, maximum, tone, label }: { value: number; maximum: number; tone: string; label: string }) {
  const width = maximum > 0 ? Math.max(0, Math.min(100, value / maximum * 100)) : 0;
  return <div className={`pd-meter ${tone}`} aria-label={`${label} ${value}/${maximum}`}><i style={{ width: `${width}%` }} /><span>{label}</span><b>{value} / {maximum}</b></div>;
}

function PaperDungeonTopbar({ onExit, floor }: ExitProps & { floor?: number }) {
  return <header className="pd-topbar"><button type="button" onClick={onExit} aria-label="게임 목록으로">←</button><div><small>paperoid · PAPER RPG</small><strong>종이 던전</strong></div><span>{floor ? `${floor} / 10층` : "NEW STORY"}</span></header>;
}

export function PaperDungeonGame({ onExit }: ExitProps) {
  const [run, setRun] = useState<RunState | null>(null);
  const [savedRun, setSavedRun] = useState<RunState | null>(null);
  const [selectedClass, setSelectedClass] = useState(PAPER_DUNGEON_CLASSES[0].id);
  const [heroName, setHeroName] = useState("모험가");
  const [clears, setClears] = useState(0);
  const victoryRecorded = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "null");
      if (isPaperDungeonSave(saved) && saved.phase !== "victory" && saved.phase !== "defeat") setSavedRun(saved);
      setClears(Number(window.localStorage.getItem(CLEAR_KEY) ?? 0));
    } catch { setSavedRun(null); }
  }, []);

  useEffect(() => {
    if (!run) return;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(run));
    if (run.phase === "victory" && !victoryRecorded.current) {
      victoryRecorded.current = true;
      const nextClears = Number(window.localStorage.getItem(CLEAR_KEY) ?? 0) + 1;
      window.localStorage.setItem(CLEAR_KEY, String(nextClears));
      setClears(nextClears);
    }
  }, [run]);

  const heroClass = useMemo(() => PAPER_DUNGEON_CLASSES.find((item) => item.id === run?.classId) ?? PAPER_DUNGEON_CLASSES[0], [run?.classId]);
  const act = useCallback((action: Action) => setRun((current) => current ? resolvePaperDungeonAction(current, action) : current), []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!run || run.phase !== "battle" || event.repeat) return;
      const action = ({ "1": "attack", "2": "skill", "3": "defend", "4": "potion" } as Record<string, Action>)[event.key];
      if (action) { event.preventDefault(); act(action); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [act, run]);

  const start = () => {
    victoryRecorded.current = false;
    const next = createPaperDungeonRun(selectedClass, heroName);
    setRun(next);
    setSavedRun(next);
  };
  const abandon = () => {
    victoryRecorded.current = false;
    window.localStorage.removeItem(SAVE_KEY);
    setRun(null);
    setSavedRun(null);
  };

  if (!run) {
    return <main className="pd-shell pd-setup" data-game-menu><PaperDungeonTopbar onExit={onExit} /><section className="pd-setup-hero"><div className="pd-title-mark"><i>Ⅰ</i><i>Ⅴ</i><i>Ⅹ</i></div><small>10 CHAPTER ROGUELITE</small><h1>종이 던전</h1><p>찢어진 이야기의 열 장을 되찾기 위해<br />직업을 고르고 첫 원정을 시작하세요.</p><div className="pd-setup-record"><span>완주 기록</span><b>{clears}회</b></div></section><section className="pd-setup-panel"><label className="pd-name-field"><span>모험가 이름</span><input value={heroName} maxLength={8} onChange={(event) => setHeroName(Array.from(event.target.value).slice(0, 8).join(""))} placeholder="이름을 입력하세요" /></label><div className="pd-class-grid" role="radiogroup" aria-label="직업 선택">{PAPER_DUNGEON_CLASSES.map((item) => <button type="button" role="radio" aria-checked={selectedClass === item.id} className={selectedClass === item.id ? "selected" : ""} key={item.id} onClick={() => setSelectedClass(item.id)}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.tagline}</small></span><em>HP {item.hp} · MP {item.mp}</em><strong>{item.skill.name}</strong></button>)}</div><button className="pd-primary" type="button" onClick={start}>새 원정 시작 <span>→</span></button>{savedRun && <button className="pd-continue" type="button" onClick={() => setRun(savedRun)}><span><small>자동 저장된 원정</small><b>{savedRun.player.name} · {savedRun.floor}층 · Lv.{savedRun.player.level}</b></span><strong>이어하기</strong></button>}</section></main>;
  }

  const player = run.player;
  const enemy = run.enemy;
  const xpPercent = Math.min(100, player.xp / player.nextXp * 100);

  if (run.phase === "victory" || run.phase === "defeat") {
    const victory = run.phase === "victory";
    return <main className={`pd-shell pd-result ${victory ? "victory" : "defeat"}`}><PaperDungeonTopbar onExit={onExit} floor={run.floor} /><section><div className="pd-result-seal">{victory ? "完" : "敗"}</div><small>{victory ? "THE STORY IS RESTORED" : "THE PAGE HAS TORN"}</small><h1>{victory ? "마지막 장을 되찾았습니다" : "원정이 여기서 끝났습니다"}</h1><p>{victory ? "백지의 용을 물리치고 종이 던전의 이야기를 복원했습니다." : "장비와 전투 순서를 바꾸면 다음 원정에서는 더 멀리 갈 수 있습니다."}</p><div className="pd-result-stats"><span><small>도달 층</small><b>{run.floor} / 10</b></span><span><small>처치</small><b>{run.defeated}</b></span><span><small>레벨</small><b>{player.level}</b></span><span><small>금화</small><b>{player.gold}</b></span></div><div className="pd-result-actions"><button type="button" onClick={onExit}>게임 목록</button><button className="pd-primary" type="button" onClick={abandon}>새 원정 시작</button></div></section></main>;
  }

  return <main className="pd-shell pd-game"><PaperDungeonTopbar onExit={onExit} floor={run.floor} /><section className="pd-progress"><div><span>CHAPTER {String(run.floor).padStart(2, "0")}</span><b>{enemy.boss ? "보스의 장" : "찢어진 이야기"}</b></div><ol aria-label="던전 진행도">{Array.from({ length: 10 }, (_, index) => <li key={index} className={`${index + 1 < run.floor ? "cleared" : ""} ${index + 1 === run.floor ? "current" : ""} ${[4, 9].includes(index) ? "boss" : ""}`}><span>{index + 1}</span></li>)}</ol></section><div className="pd-game-layout"><section className="pd-battle-card"><div className="pd-enemy-head"><span>{enemy.boss ? "BOSS ENCOUNTER" : `FLOOR ${run.floor}`}</span><b>{enemy.name}</b><p>{enemy.flavor}</p></div><div className={`pd-enemy-art ${enemy.boss ? "boss" : ""}`}><span className="pd-orbit one" /><span className="pd-orbit two" /><i>{enemy.icon}</i><em>{enemy.boss ? "BOSS" : "ENEMY"}</em></div><Meter value={enemy.hp} maximum={enemy.maxHp} tone="enemy" label="HP" /><div className="pd-enemy-stats"><span>공격 <b>{enemy.attack}</b></span><span>방어 <b>{enemy.defense}</b></span><span>보상 <b>{enemy.gold}G</b></span></div></section><section className="pd-command-card"><header><div className="pd-hero-badge">{heroClass.icon}</div><span><small>LV.{player.level} · {heroClass.name}</small><b>{player.name}</b></span><em>TURN {run.turn}</em></header><Meter value={player.hp} maximum={player.maxHp} tone="hero" label="HP" /><Meter value={player.mp} maximum={player.maxMp} tone="mana" label="MP" /><div className="pd-command-grid"><button type="button" onClick={() => act("attack")}><kbd>1</kbd><i>⚔</i><span><b>기본 공격</b><small>마력 1 회복</small></span></button><button type="button" onClick={() => act("skill")} disabled={player.mp < heroClass.skill.cost}><kbd>2</kbd><i>✦</i><span><b>{heroClass.skill.name}</b><small>MP {heroClass.skill.cost} · 강한 피해</small></span></button><button type="button" onClick={() => act("defend")}><kbd>3</kbd><i>⬟</i><span><b>방어</b><small>피해 절반 · MP +2</small></span></button><button type="button" onClick={() => act("potion")} disabled={player.potions < 1 || player.hp >= player.maxHp}><kbd>4</kbd><i>♥</i><span><b>회복 물약</b><small>{player.potions}개 · HP +28</small></span></button></div><div className="pd-xp"><span>다음 레벨</span><i><b style={{ width: `${xpPercent}%` }} /></i><em>{player.xp} / {player.nextXp} XP</em></div></section><aside className="pd-side"><section className="pd-inventory"><header><b>장비와 능력</b><span>{player.gold} G</span></header><dl><div><dt>무기</dt><dd>{player.weapon}</dd></div><div><dt>방어구</dt><dd>{player.armor}</dd></div><div><dt>공격</dt><dd>{player.attack}</dd></div><div><dt>방어</dt><dd>{player.defense}</dd></div><div><dt>치명타</dt><dd>{Math.round(player.crit * 100)}%</dd></div><div><dt>완주</dt><dd>{clears}회</dd></div></dl></section><section className="pd-log" aria-live="polite"><header><b>모험 기록</b><span>최근 {run.logs.length}개</span></header><ol>{run.logs.map((log, index) => <li key={`${run.turn}-${index}`} className={index === 0 ? "latest" : ""}><i>{index === 0 ? "◆" : "·"}</i><span>{log}</span></li>)}</ol></section><button className="pd-abandon" type="button" onClick={() => { if (window.confirm("현재 원정을 끝내고 직업 선택으로 돌아갈까요?")) abandon(); }}>원정 포기</button></aside></div>{run.phase === "reward" && <div className="pd-reward-layer" role="dialog" aria-modal="true" aria-labelledby="pd-reward-title"><section><small>CHAPTER {run.floor} CLEAR</small><h2 id="pd-reward-title">한 가지 보상을 선택하세요</h2><p>선택한 보상은 이번 원정이 끝날 때까지 유지됩니다.</p><div>{run.rewards.map((reward) => <button type="button" key={reward.id} onClick={() => setRun((current) => current ? choosePaperDungeonReward(current, reward.id) : current)}><i>{reward.icon}</i><b>{reward.title}</b><span>{reward.description}</span><em>선택하기 →</em></button>)}</div></section></div>}</main>;
}
