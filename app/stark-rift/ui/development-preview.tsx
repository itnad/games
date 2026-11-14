"use client";
import { useEffect, useRef, useState } from "react";
import { SCENARIOS, type Scenario } from "../combat/state";
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
      summary: "드론 변태 · 버로우 연구",
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
  scenario: Scenario;
  seed: number;
  faction: Faction;
  restored: PersistenceEnvelope | null;
};
export function DevelopmentPreview() {
  const [scenario, setScenario] = useState<Scenario>("economy");
  const [faction, setFaction] = useState<Faction>("terran");
  const [saved, setSaved] = useState<Partial<Record<string, DevelopmentSave>>>(
    {},
  );
  const [run, setRun] = useState<Run | null>(null);
  const store = useRef<DevelopmentSaveStore | null>(null);
  useEffect(() => {
    try {
      const instance = new DevelopmentSaveStore(window.localStorage);
      store.current = instance;
      setSaved(
        Object.fromEntries(
          FACTIONS.flatMap((f) =>
            (
              [
                "economy",
                "combat-practice",
                "ranged-practice",
                "siege-practice",
                "special-practice",
              ] as const
            ).map((mode) => [mode + ":" + f.id, instance.read(f.id, mode)]),
          ),
        ),
      );
    } catch {
      setSaved(
        Object.fromEntries(
          FACTIONS.flatMap((f) =>
            SCENARIOS.map((mode) => [
              mode + ":" + f.id,
              { status: "unavailable" },
            ]),
          ),
        ),
      );
    }
  }, []);
  const persist = (snapshot: PersistenceEnvelope) => {
    if (!store.current?.write(snapshot))
      throw new Error("Browser save unavailable");
    setSaved((current) => ({
      ...current,
      [(snapshot.simulation.combat?.scenario ?? "economy") +
      ":" +
      snapshot.simulation.players[0].faction]: { status: "ready", snapshot },
    }));
  };
  const savedMatch = saved[scenario + ":" + faction];
  const start = () => {
    if (
      savedMatch?.status === "ready" &&
      !window.confirm("이 종족의 저장 기록을 새 테스트로 교체할까요?")
    )
      return;
    setRun({ seed: 42, faction, scenario, restored: null });
  };
  const resume = () => {
    const current = store.current?.read(faction, scenario);
    if (current?.status === "ready")
      setRun({
        seed: current.snapshot.simulation.seed,
        faction,
        scenario,
        restored: current.snapshot,
      });
    else if (current)
      setSaved((value) => ({ ...value, [scenario + ":" + faction]: current }));
  };
  if (run)
    return (
      <main className="sr-dev-route sr-dev-playing">
        <SimulationSession
          key={`${run.faction}:${run.seed}:${run.restored?.savedAt ?? "new"}`}
          scenario={run.scenario}
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
          <div className="sr-dev-kicker">DEVELOPMENT PLAYTEST · 06B</div>
          <h1>스타크 리프트</h1>
          <p className="sr-dev-intro">나만의 기지를 세워 보세요.</p>
          <p className="sr-dev-scope">
            채취 · 건설 · 병력 생산을 확인하는 개발 테스트입니다.
            <br />
            기본 병력과 벌처·탱크·히드라·드라군의 공격을 사용할 수 있습니다.
            버로우·영구 은폐·탐지·수송을 지원합니다. 상대 AI는 준비 중입니다.
          </p>
          <div className="sr-dev-modes" role="group" aria-label="테스트 모드">
            <button
              aria-pressed={scenario === "economy"}
              onClick={() => setScenario("economy")}
            >
              기지 운영
            </button>
            <button
              aria-pressed={scenario === "combat-practice"}
              onClick={() => setScenario("combat-practice")}
            >
              전투 연습
            </button>
            <button
              aria-pressed={scenario === "ranged-practice"}
              onClick={() => setScenario("ranged-practice")}
            >
              원거리 연습
            </button>
            <button
              aria-pressed={scenario === "siege-practice"}
              onClick={() => setScenario("siege-practice")}
            >
              본부 공략
            </button>
            <button aria-pressed={scenario === "special-practice"} onClick={() => setScenario("special-practice")}>특수 연습</button>
          </div>
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
              {savedMatch?.status === "ready" &&
              savedMatch.snapshot.simulation.phase === "finished"
                ? "결과 보기"
                : "이어서 하기"}
            </button>
          </div>
          {scenario === "special-practice" && <p className="sr-dev-scope">수송선과 병력이 제공됩니다. 탑승 → 부대 슬롯 터치 → 전체 하차 → 지점 선택. 테란은 시즈 탱크·고스트·레이스와 모드/은폐 연구가, 프로토스는 영구 은폐 유닛·옵저버가, 저그는 러커(3번 부대), 수송·버로우·러커 변태 연구와 추가 자원 ◆ 100 ◉ 200이 제공됩니다. 러커 선택 → 버로우로 직선 범위 공격을 확인하세요. 연습 기록은 별도로 저장됩니다.</p>}
          {scenario === "combat-practice" && (
            <p className="sr-dev-scope">
              기본 병력이 준비됩니다. 부대 1번 선택 → 붉은 적 터치로 공격하세요.
              적은 제자리에서 반격합니다. 연습 기록은 기지 운영과 별도로
              저장됩니다.
            </p>
          )}
          {scenario === "ranged-practice" && (
            <p className="sr-dev-scope">
              테란: 벌처·탱크 · 저그: 히드라리스크 · 프로토스: 드라군. 부대 1번
              선택 → 공격 이동 → 적 근처를 터치하세요. 테란 탱크는 2번
              부대입니다. 저그·프로토스는 공중 표적도 공격합니다. 연습 기록은
              별도로 저장됩니다.
            </p>
          )}
          {scenario === "siege-practice" && (
            <p className="sr-dev-scope">
              정찰 출발 버튼으로 경사로 아래를 탐색하세요. 건설이 멈춘 적 본부를
              찾아 파괴하면 승리합니다. 적 본부도 건설 중에는 생존 거점으로
              인정됩니다. 연습 기록은 별도로 저장됩니다.
            </p>
          )}
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
            종족·모드별로 이 브라우저에 저장됩니다. 기기 간 동기화는 지원하지
            않습니다.
          </p>
        </main>
      </PortraitOnly>
    </div>
  );
}
