"use client";
import { useEffect, useRef, useState } from "react";
import type { Faction } from "../data/economy-catalog";
import type { PersistenceEnvelope } from "../core/state";
import { SimulationSession } from "./simulation-session";
import { PortraitOnly } from "./portrait-only";
import {
  DevelopmentSaveStore,
  type DevelopmentSave,
} from "./development-saves";
import "./development-preview.css";

const FACTIONS: { id: Faction; name: string; summary: string; mark: string }[] =
  [
    {
      id: "terran",
      name: "테란",
      summary: "SCV 건설 · 보급 건물 · 배럭",
      mark: "T",
    },
    {
      id: "zerg",
      name: "저그",
      summary: "드론 변태 · 크립 · 라바 생산",
      mark: "Z",
    },
    {
      id: "protoss",
      name: "프로토스",
      summary: "프로브 워프 · 파일런 동력",
      mark: "P",
    },
  ];
type Run = {
  seed: number;
  faction: Faction;
  restored: PersistenceEnvelope | null;
};
export function DevelopmentPreview() {
  const [faction, setFaction] = useState<Faction>("terran");
  const [saved, setSaved] = useState<Partial<Record<Faction, DevelopmentSave>>>(
    {},
  );
  const [run, setRun] = useState<Run | null>(null);
  const store = useRef<DevelopmentSaveStore | null>(null);
  useEffect(() => {
    try {
      const instance = new DevelopmentSaveStore(window.localStorage);
      store.current = instance;
      setSaved(
        Object.fromEntries(FACTIONS.map((f) => [f.id, instance.read(f.id)])),
      );
    } catch {
      setSaved(
        Object.fromEntries(
          FACTIONS.map((f) => [f.id, { status: "unavailable" }]),
        ),
      );
    }
  }, []);
  const persist = (snapshot: PersistenceEnvelope) => {
    if (!store.current?.write(snapshot))
      throw new Error("Browser save unavailable");
    setSaved((current) => ({
      ...current,
      [snapshot.simulation.players[0].faction]: { status: "ready", snapshot },
    }));
  };
  const savedMatch = saved[faction];
  const start = () => {
    if (
      savedMatch?.status === "ready" &&
      !window.confirm("이 종족의 저장 기록을 새 테스트로 교체할까요?")
    )
      return;
    setRun({ seed: 42, faction, restored: null });
  };
  const resume = () => {
    const current = store.current?.read(faction);
    if (current?.status === "ready")
      setRun({
        seed: current.snapshot.simulation.seed,
        faction,
        restored: current.snapshot,
      });
    else if (current) setSaved((value) => ({ ...value, [faction]: current }));
  };
  if (run)
    return (
      <main className="sr-dev-route sr-dev-playing">
        <SimulationSession
          key={`${run.faction}:${run.seed}:${run.restored?.savedAt ?? "new"}`}
          seed={run.seed}
          faction={run.faction}
          initialSnapshot={run.restored}
          onSave={persist}
          onExit={() => setRun(null)}
        />
      </main>
    );
  return (
    <div className="sr-dev-route">
      <PortraitOnly onBlocked={() => {}}>
        <main className="sr-dev-landing">
          <a className="sr-dev-back" href="/">
            ← paperoid로 돌아가기
          </a>
          <div className="sr-dev-kicker">DEVELOPMENT PLAYTEST · 04</div>
          <h1>스타크 리프트</h1>
          <p className="sr-dev-intro">나만의 기지를 세워 보세요.</p>
          <p className="sr-dev-scope">
            채취 · 건설 · 병력 생산을 확인하는 개발 테스트입니다.
            <br />
            전투와 승패 판정은 준비 중입니다.
          </p>
          <div className="sr-dev-factions" role="group" aria-label="종족 선택">
            {FACTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                data-faction={f.id}
                aria-pressed={faction === f.id}
                onClick={() => setFaction(f.id)}
              >
                <b aria-hidden="true">{f.mark}</b>
                <strong>{f.name}</strong>
                <small>{f.summary}</small>
              </button>
            ))}
          </div>
          <div className="sr-dev-start">
            <button className="sr-dev-primary" onClick={start}>
              새 테스트 시작
            </button>
            <button disabled={savedMatch?.status !== "ready"} onClick={resume}>
              이어서 하기
            </button>
          </div>
          {savedMatch?.status === "ready" && (
            <p className="sr-dev-save-note">
              저장 기록:{" "}
              {new Date(savedMatch.snapshot.savedAt).toLocaleString("ko-KR")}
            </p>
          )}
          {savedMatch?.status === "invalid" && (
            <p className="sr-dev-save-note" role="status">
              저장 기록이 현재 개발 버전과 호환되지 않습니다. 새 테스트를 시작해
              주세요.
            </p>
          )}
          {savedMatch?.status === "unavailable" && (
            <p className="sr-dev-save-note" role="status">
              이 브라우저에서는 저장할 수 없습니다. 창을 닫으면 진행 기록이
              사라집니다.
            </p>
          )}
          <section className="sr-dev-guide" aria-label="시작 안내">
            <h2>이렇게 시작하세요</h2>
            <ol>
              <li>일꾼 4기가 자동으로 미네랄을 채취합니다.</li>
              <li>본부에서 일꾼을 더 생산하세요.</li>
              <li>일꾼을 터치하고 건물을 골라 전장에 배치하세요.</li>
              <li>생산 건물에서 병력을 만들고 이동시켜 보세요.</li>
            </ol>
          </section>
          <p className="sr-dev-footnote">
            세로 화면 전용 · 최대 10초 간격 자동 저장
            <br />
            종족별로 이 브라우저에 저장됩니다. 기기 간 동기화는 지원하지
            않습니다.
          </p>
        </main>
      </PortraitOnly>
    </div>
  );
}
