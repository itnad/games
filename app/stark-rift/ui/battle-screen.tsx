"use client";
import type { CommandFeedback } from "../input/command-feedback";

import type { BattleCamera } from "../render/camera";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BattleMap } from "../data/maps";
import type { RenderSnapshot } from "../worker/render-snapshot";
import type { BattleRenderer } from "../render/renderer";
import {
  attachCameraGestures,
  type GestureActions,
} from "../input/camera-gestures";
import "../stark-rift.css";

/** Shared battle view for the lab and hosted development playtest. */
export function BattleScreen({
  commandFeedback,
  viewportHint,
  overlay,
  placement,
  onMinimapPoint,
  map,
  snapshot,
  onPause,
  input,
  onCameraChange,
  initialCamera,
  onRenderFailure,
  inputFactory,
  controls,
  selectedIds = [],
  previewIds = [],
}: {
  commandFeedback?: CommandFeedback | null;
  viewportHint?: string | null;
  overlay?: ReactNode;
  placement?: {
    tileX: number;
    tileY: number;
    width: number;
    height: number;
    status: "valid" | "blocked" | "warning";
  } | null;
  onMinimapPoint?: (point: { x: number; y: number }) => boolean;
  map: BattleMap;
  snapshot: RenderSnapshot;
  onPause: () => void;
  input?: GestureActions;
  controls?: ReactNode;
  selectedIds?: number[];
  previewIds?: number[];
  inputFactory?: (
    camera: BattleCamera,
    size: () => { width: number; height: number },
  ) => GestureActions;
  onRenderFailure?: () => void;
  initialCamera?: { centerX: number; centerY: number; zoomLevel: 0 | 1 | 2 };
  onCameraChange?: (camera: {
    centerX: number;
    centerY: number;
    zoomLevel: 0 | 1 | 2;
  }) => void;
}) {
  const battlefield = useRef<HTMLDivElement>(null),
    minimap = useRef<HTMLDivElement>(null);
  const renderer = useRef<BattleRenderer | null>(null),
    latestSnapshot = useRef(snapshot),
    pause = useRef(onPause);
  const [error, setError] = useState<string | null>(null),
    [zoom, setZoom] = useState(1),
    [ready, setReady] = useState(false);
  latestSnapshot.current = snapshot;
  pause.current = onPause;
  const minimapAction = useRef(onMinimapPoint);
  minimapAction.current = onMinimapPoint;
  const placementRef = useRef(placement);
  placementRef.current = placement;
  const feedbackRef = useRef(commandFeedback);
  feedbackRef.current = commandFeedback;
  const inputRef = useRef(input),
    cameraCallback = useRef(onCameraChange);
  const selectionRef = useRef({ selectedIds, previewIds });
  selectionRef.current = { selectedIds, previewIds };
  const renderFailure = useRef(onRenderFailure);
  renderFailure.current = onRenderFailure;
  inputRef.current = input;
  cameraCallback.current = onCameraChange;
  const cameraChanged = (instance: BattleRenderer) => {
    instance.draw();
    setZoom(instance.camera.zoom);
    cameraCallback.current?.({
      centerX: Math.round(instance.camera.centerX),
      centerY: Math.round(instance.camera.centerY),
      zoomLevel: Math.round(instance.camera.zoom) as 0 | 1 | 2,
    });
  };
  useEffect(() => {
    let cancelled = false,
      instance: BattleRenderer | undefined,
      detach: (() => void) | undefined;
    setReady(false);
    setError(null);
    const setup = async () => {
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2");
      if (!gl)
        throw new Error(
          "이 기기에서는 전장을 표시할 수 없습니다. WebGL2를 지원하는 브라우저에서 열어 주세요.",
        );
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      const { BattleRenderer } = await import("../render/renderer");
      if (cancelled) return;
      instance = new BattleRenderer(
        map,
        battlefield.current!,
        minimap.current!,
        () => {
          pause.current();
          renderFailure.current?.();
          setReady(false);
          setError(
            "화면 연결이 끊어져 경기를 일시정지했습니다. 화면을 다시 열어 주세요.",
          );
        },
        () => cameraChanged(instance!),
      );
      instance.minimapAction = (point) =>
        minimapAction.current?.(point) ?? false;
      await instance.init();
      if (cancelled) {
        instance.destroy();
        return;
      }
      renderer.current = instance;
      const rect = battlefield.current!.getBoundingClientRect();
      if (initialCamera)
        instance.camera.setZoom(
          initialCamera.zoomLevel,
          rect.width,
          rect.height,
        );
      instance.camera.setCenter(
        initialCamera?.centerX ?? map.spawnPoints[0].x * 256,
        initialCamera?.centerY ?? map.spawnPoints[0].y * 256,
        rect.width,
        rect.height,
      );
      instance.setSnapshot(latestSnapshot.current);
      instance.setPlacement(placementRef.current ?? null);
      instance.setCommandFeedback(feedbackRef.current ?? null);
      instance.setSelection(
        selectionRef.current.selectedIds,
        selectionRef.current.previewIds,
      );
      const bound = inputFactory?.(instance.camera, () => {
        const r = battlefield.current!.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      detach = attachCameraGestures(
        instance.canvas,
        instance.camera,
        () => cameraChanged(instance!),
        {
          hitTest: (point) =>
            (bound ?? inputRef.current)?.hitTest(point) ?? null,
          groundTap: (point) => (bound ?? inputRef.current)?.groundTap?.(point),
          tap: (hit) => (bound ?? inputRef.current)?.tap(hit),
          preview: (hit) => (bound ?? inputRef.current)?.preview(hit),
          group: (hit) => (bound ?? inputRef.current)?.group(hit),
          swipe: (hit, point, attack) =>
            (bound ?? inputRef.current)?.swipe(hit, point, attack),
        },
      );
      cameraChanged(instance);
      setReady(true);
    };
    setup().catch((reason) => {
      detach?.();
      instance?.destroy();
      if (renderer.current === instance) renderer.current = null;
      if (!cancelled) {
        pause.current();
        renderFailure.current?.();
        setReady(false);
        setError(
          reason instanceof Error
            ? reason.message
            : "화면을 열지 못했습니다. 다시 시도해 주세요.",
        );
      }
    });
    return () => {
      cancelled = true;
      detach?.();
      instance?.destroy();
      renderer.current = null;
    };
  }, [map]);
  useEffect(() => {
    renderer.current?.setSnapshot(snapshot);
  }, [snapshot]);
  useEffect(() => {
    renderer.current?.setCommandFeedback(commandFeedback ?? null);
  }, [commandFeedback]);
  useEffect(() => {
    renderer.current?.setPlacement(placement ?? null);
  }, [placement]);
  useEffect(() => {
    renderer.current?.setSelection(selectedIds, previewIds);
  }, [selectedIds, previewIds, snapshot]);
  const changeZoom = (value: number) => {
    const current = renderer.current;
    if (!current) return;
    const rect = battlefield.current!.getBoundingClientRect();
    current.camera.setZoom(value, rect.width, rect.height);
    cameraChanged(current);
  };
  return (
    <section className="sr-battle" aria-label="스타크 리프트 전장">
      <header className="sr-top">
        <div
          ref={minimap}
          className="sr-minimap"
          role="group"
          aria-label="미니맵: 터치하거나 드래그해 화면 이동"
        />
        <div className="sr-overview">
          <strong>STARK RIFT</strong>
          <span>
            균열 분지 ·{" "}
            {snapshot.economy
              ? { terran: "테란", zerg: "저그", protoss: "프로토스" }[
                  snapshot.economy.faction
                ]
              : "이동 검증"}
          </span>
          {snapshot.economy && (
            <div className="sr-resource-hud" aria-label="보유 자원과 인구">
              <div>
                <i>◆</i>{" "}
                <b data-balance="minerals">{snapshot.economy.minerals}</b>
              </div>
              <div>
                <i>◉</i> <b data-balance="gas">{snapshot.economy.gas}</b>
              </div>
              <div
                className={
                  snapshot.economy.supplyUsedHalf >=
                  snapshot.economy.supplyCapHalf
                    ? "sr-locked"
                    : ""
                }
              >
                인구{" "}
                <b data-balance="supply">
                  {snapshot.economy.supplyUsedHalf / 2} /{" "}
                  {snapshot.economy.supplyCapHalf / 2}
                </b>
              </div>
            </div>
          )}
          <div className="sr-zoom" aria-label="화면 확대">
            {["근접", "기본", "광역"].map((label, index) => (
              <button
                key={label}
                disabled={!ready}
                aria-pressed={Math.round(zoom) === index}
                onClick={() => changeZoom(index)}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={onPause}>일시정지</button>
        </div>
      </header>
      <div
        className="sr-viewport"
        data-command-feedback={commandFeedback?.id}
        data-command-kind={commandFeedback?.kind}
        ref={battlefield}
        aria-label="전장: 드래그로 이동, 두 손가락으로 확대"
      >
        {viewportHint && (
          <p className="sr-placement-hint" role="status">
            {viewportHint}
          </p>
        )}
        {error && (
          <p className="sr-status" role="alert">
            {error}
          </p>
        )}
        {!ready && !error && (
          <p className="sr-status" role="status">
            전장을 준비하고 있습니다.
          </p>
        )}
      </div>
      <footer className="sr-bottom">
        {controls ?? (
          <>
            <div className="sr-groups" aria-label="부대 슬롯">
              {[1, 2, 3, 4, 5].map((index) => (
                <button key={index} disabled aria-label={`부대 ${index}`}>
                  {index}
                </button>
              ))}
            </div>
            <div
              className="sr-command-space"
              aria-label="선택 정보와 명령 패널"
            />
          </>
        )}
      </footer>
      {overlay}
    </section>
  );
}
