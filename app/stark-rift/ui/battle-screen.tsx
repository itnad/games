"use client";
import { useEffect, useRef, useState } from "react";
import type { BattleMap } from "../data/maps";
import type { RenderSnapshot } from "../worker/render-snapshot";
import type { BattleRenderer } from "../render/renderer";
import { attachCameraGestures } from "../input/camera-gestures";
import "../stark-rift.css";

/** Internal component only. No page.tsx/public route until the design's release gate. */
export function BattleScreen({ map, snapshot, onPause }: { map: BattleMap; snapshot: RenderSnapshot; onPause: () => void }) {
  const battlefield = useRef<HTMLDivElement>(null), minimap = useRef<HTMLDivElement>(null);
  const renderer = useRef<BattleRenderer | null>(null), latestSnapshot = useRef(snapshot), pause = useRef(onPause);
  const [error, setError] = useState<string | null>(null), [zoom, setZoom] = useState(1), [ready, setReady] = useState(false);
  latestSnapshot.current = snapshot; pause.current = onPause;
  useEffect(() => {
    let cancelled = false, instance: BattleRenderer | undefined, detach: (() => void) | undefined;
    setReady(false); setError(null);
    const setup = async () => {
      const probe = document.createElement("canvas"); const gl = probe.getContext("webgl2");
      if (!gl) throw new Error("이 기기에서는 전장을 표시할 수 없습니다. WebGL2를 지원하는 브라우저에서 열어 주세요.");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      const { BattleRenderer } = await import("../render/renderer");
      if (cancelled) return;
      instance = new BattleRenderer(map, battlefield.current!, minimap.current!, () => {
        pause.current(); setReady(false); setError("화면 연결이 끊어져 경기를 일시정지했습니다. 화면을 다시 열어 주세요.");
      });
      await instance.init();
      if (cancelled) { instance.destroy(); return; }
      renderer.current = instance;
      const rect = battlefield.current!.getBoundingClientRect();
      instance.camera.setCenter(map.spawnPoints[0].x * 256, map.spawnPoints[0].y * 256, rect.width, rect.height);
      instance.setSnapshot(latestSnapshot.current);
      detach = attachCameraGestures(instance.canvas, instance.camera, () => { instance!.draw(); setZoom(instance!.camera.zoom); });
      setReady(true);
    };
    setup().catch(reason => { if (!cancelled) { pause.current(); setError(reason instanceof Error ? reason.message : "화면을 열지 못했습니다. 다시 시도해 주세요."); } });
    return () => { cancelled = true; detach?.(); instance?.destroy(); renderer.current = null; };
  }, [map]);
  useEffect(() => { renderer.current?.setSnapshot(snapshot); }, [snapshot]);
  const changeZoom = (value: number) => {
    const current = renderer.current; if (!current) return;
    const rect = battlefield.current!.getBoundingClientRect(); current.camera.setZoom(value, rect.width, rect.height); current.draw(); setZoom(value);
  };
  return <section className="sr-battle" aria-label="스타크 리프트 전장">
    <header className="sr-top">
      <div ref={minimap} className="sr-minimap" role="group" aria-label="미니맵: 터치하거나 드래그해 화면 이동" />
      <div className="sr-overview"><strong>STARK RIFT</strong><span>균열 분지</span>
        <div className="sr-zoom" aria-label="화면 확대">{["근접", "기본", "광역"].map((label, index) => <button key={label} disabled={!ready} aria-pressed={Math.round(zoom) === index} onClick={() => changeZoom(index)}>{label}</button>)}</div>
        <button onClick={onPause}>일시정지</button>
      </div>
    </header>
    <div className="sr-viewport" ref={battlefield} aria-label="전장: 드래그로 이동, 두 손가락으로 확대">
      {error && <p className="sr-status" role="alert">{error}</p>}
      {!ready && !error && <p className="sr-status" role="status">전장을 준비하고 있습니다.</p>}
    </div>
    <footer className="sr-bottom"><div className="sr-groups" aria-label="부대 슬롯">{[1, 2, 3, 4, 5].map(index => <button key={index} disabled aria-label={`부대 ${index}`}>{index}</button>)}</div>
      <div className="sr-command-space" aria-label="선택 정보와 명령 패널" />
    </footer>
  </section>;
}
