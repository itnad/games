"use client";

import { useEffect, useRef } from "react";
import "./mudflat-exit.css";

type Props = { onMain: () => void; onHome: () => void; onCancel: () => void; error: string };

export function MudflatExitDialog({ onMain, onHome, onCancel, error }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelAction = useRef(onCancel);
  cancelAction.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); cancelAction.current(); }
      if (event.key !== "Tab") return;
      const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      const first = buttons[0]; const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return <div className="ms-exit-dialog">
    <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="ms-exit-title" aria-describedby="ms-exit-description">
      <span className="ms-exit-symbol" aria-hidden="true">Ⅱ</span>
      <small>EXPEDITION SAVED ON EXIT</small>
      <h2 id="ms-exit-title">어디로 돌아갈까요?</h2>
      <p id="ms-exit-description">지금은 게임이 멈춰 있습니다.<br />나가면 현재 상태를 이 기기에 저장하며,<br />해루질럿 메인에서 이어할 수 있습니다.</p>
      {error && <p className="ms-save-error" role="alert">{error}</p>}
      <div className="ms-exit-actions">
        <button type="button" className="ms-exit-main" onClick={onMain}>해루질럿 메인 <span aria-hidden="true">→</span></button>
        <button type="button" className="ms-exit-home" onClick={onHome}>홈 화면</button>
        <button type="button" className="ms-exit-cancel" ref={cancelRef} onClick={onCancel}>취소</button>
      </div>
    </section>
  </div>;
}
