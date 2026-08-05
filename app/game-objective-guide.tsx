"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { GAME_OBJECTIVES } from "./game-objectives.js";

export function GameObjectiveGuide({ gameId, inline = false }: { gameId: string; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const guide = GAME_OBJECTIVES[gameId as keyof typeof GAME_OBJECTIVES];

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!guide) return null;
  const style = { "--objective-accent": guide.accent } as CSSProperties;

  return (
    <>
      <button className={`game-objective-trigger${inline ? " inline" : ""}`} style={style} onClick={() => setOpen(true)}>
        <span aria-hidden="true">◎</span>
        <span><small>GOAL &amp; WIN</small><strong>게임 설명</strong></span>
      </button>
      {open && (
        <div className="game-objective-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <section
            className="game-objective-modal"
            style={style}
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-objective-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="game-objective-close" onClick={() => setOpen(false)} aria-label="게임 설명 닫기">×</button>
            <header>
              <i aria-hidden="true">{guide.icon}</i>
              <div><span>paperoid GAME GUIDE</span><h2 id="game-objective-title">{guide.title}</h2></div>
            </header>
            <p className="game-objective-summary">{guide.summary}</p>
            <div className="game-objective-cards">
              <article className="goal">
                <span><b>01</b> GAME GOAL</span>
                <h3>게임 목표</h3>
                <p>{guide.objective}</p>
              </article>
              <article className="victory">
                <span><b>02</b> VICTORY</span>
                <h3>승리 조건</h3>
                <p>{guide.victory}</p>
              </article>
            </div>
            <aside>
              <span>게임 종료 시점</span>
              <strong>{guide.finish}</strong>
            </aside>
            <button className="game-objective-confirm" onClick={() => setOpen(false)}>확인하고 게임하기</button>
          </section>
        </div>
      )}
    </>
  );
}
