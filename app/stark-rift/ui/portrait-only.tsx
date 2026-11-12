"use client";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { isPortraitViewport, subscribePortraitMode } from "../input/portrait-mode";
import "../stark-rift.css";

/** Keep the mounted session; rotation must neither reset nor automatically resume it. */
export function PortraitOnly({children,onBlocked}:{children:ReactNode;onBlocked:()=>void}) {
  const portrait=useSyncExternalStore(subscribePortraitMode,isPortraitViewport,()=>true);
  const blocked=useRef(onBlocked);blocked.current=onBlocked;
  useEffect(()=>{if(!portrait)blocked.current();},[portrait]);
  return <div className="sr-portrait-root">
    <div className="sr-portrait-content" inert={!portrait} aria-hidden={!portrait||undefined}>{children}</div>
    <div className="sr-orientation-notice" role="status" aria-hidden={portrait}>
      <strong>세로 화면으로 돌려 주세요</strong>
      <p>스타크 리프트는 세로 화면에서 플레이할 수 있습니다.</p>
      <p>세로 화면으로 돌아온 뒤 이어서 진행해 주세요.</p><p>PC에서는 브라우저 창의 폭을 높이보다 좁게 줄여 주세요.</p>
    </div>
  </div>;
}
