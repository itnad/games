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
      <small className="ms-exit-kicker">원정 기록 보관 준비</small>
      <h2 id="ms-exit-title">잠시 어디로 물러날까요?</h2>
      <p id="ms-exit-description">나가도 현재 원정 상태는 이 기기에 저장돼요.<br />해루질럿 메인에서 바로 이어할 수 있습니다.</p>
      <div className="ms-exit-note" aria-hidden="true"><span>일시정지 중</span><span>저장 후 이동</span></div>
      {error && <p className="ms-save-error" role="alert">{error}</p>}
      <div className="ms-exit-actions">
        <button type="button" className="ms-exit-main" onClick={onMain}><span><small>이어하기 위치</small><b>해루질럿 메인</b></span><i aria-hidden="true">갯벌</i></button>
        <button type="button" className="ms-exit-home" onClick={onHome}><span><small>전체 게임 목록</small><b>홈 화면</b></span></button>
        <button type="button" className="ms-exit-cancel" ref={cancelRef} onClick={onCancel}>취소</button>
      </div>
    </section>
  </div>;
}
