import { countsAsDefinition } from "../data/economy-catalog";
import { useEffect, useRef } from "react";
import type { RenderSnapshot } from "../worker/render-snapshot";
import {
  ECONOMY_DEFINITIONS,
  economyDefinition,
} from "../data/economy-catalog";
export function ConstructionMenu({
  snapshot,
  actorId,
  onChoose,
  onClose,
}: {
  snapshot: RenderSnapshot;
  actorId: number;
  onChoose: (id: string, repeat: boolean) => void;
  onClose: () => void;
}) {
  const economy = snapshot.economy!,
    actor = snapshot.entities.find((e) => e.id === actorId),
    def = actor ? economyDefinition(actor.definitionId) : undefined;
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
  }, []);
  const has = (id: string) =>
    economy.structures.some(
      (b) =>
        b.completed &&
        countsAsDefinition(snapshot.entities.find((e) => e.id === b.entityId)?.definitionId ?? "", id),
    );
  return (
    <section
      className="sr-construction-menu"
      role="dialog"
      aria-label="건설 메뉴"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header>
        <div>
          <strong>건설할 건물 선택</strong>
          <small>
            {def?.name} · 보유 ◆ {economy.minerals} ◉ {economy.gas}
          </small>
        </div>
        <button ref={close} onClick={onClose}>
          닫기
        </button>
      </header>
      <p>건물을 고른 뒤 전장을 터치하고 건설 확정을 눌러 주세요.</p>
      <div className="sr-construction-options">
        {ECONOMY_DEFINITIONS.filter(
          (d) => d.kind === "building" && d.producer === def?.id,
        ).map((d) => {
          const missing = d.requires.filter((id) => !has(id)),
            lackM = Math.max(0, d.minerals - economy.minerals),
            lackG = Math.max(0, d.gas - economy.gas);
          const reason = missing.length
            ? "선행 건물: " +
              missing.map((id) => economyDefinition(id)?.name).join(", ")
            : lackM || lackG
              ? `부족: ◆ ${lackM} ◉ ${lackG}`
              : d.power
                ? "파일런 동력 안에 배치"
                : d.creep
                  ? "크립 위에 배치"
                  : d.gasBuilding
                    ? "가스 분출구에 배치"
                    : "위치 선택 가능";
          return (
            <div key={d.id} className="sr-construction-option">
              <button data-build={d.id} onClick={() => onChoose(d.id, false)}>
                <strong>{d.name}</strong>
                <small>
                  ◆ {d.minerals}
                  {d.gas ? ` · ◉ ${d.gas}` : ""}
                </small>
                <small
                  className={
                    missing.length || lackM || lackG ? "sr-locked" : ""
                  }
                >
                  {reason}
                </small>
              </button>
              <button
                className="sr-continuous-build"
                aria-label={d.name + " 연속 배치"}
                onClick={() => onChoose(d.id, true)}
              >
                연속 배치
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
