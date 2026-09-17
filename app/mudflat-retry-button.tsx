"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createRetryHold } from "./mudflat-retry.js";

type HoldButtonProps = Pick<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "disabled" | "aria-pressed"> & {
  onShort: () => void; onLong: () => void; children: ReactNode;
};

export function MudflatHoldButton({ onShort, onLong, children, className = "", disabled = false, ...buttonProps }: HoldButtonProps) {
  const callbacks = useRef({ onShort, onLong, disabled });
  callbacks.current = { onShort, onLong, disabled };
  const holdRef = useRef<ReturnType<typeof createRetryHold> | null>(null);
  if (!holdRef.current) holdRef.current = createRetryHold(
    () => { if (!callbacks.current.disabled) callbacks.current.onShort(); },
    () => { if (!callbacks.current.disabled) callbacks.current.onLong(); },
  );
  const hold = holdRef.current;
  const input = useRef<{ pointerId: number | null; key: string | null }>({ pointerId: null, key: null });
  const cancel = () => { input.current = { pointerId: null, key: null }; hold.cancel(); };

  useEffect(() => {
    const stop = () => { input.current = { pointerId: null, key: null }; hold.cancel(); };
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stop();
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [hold, disabled]);

  return <button {...buttonProps} type="button" disabled={disabled} className={`ms-hold-button ${className}`}
    onPointerDown={(event) => {
      if (!event.isPrimary || event.button !== 0 || input.current.pointerId !== null || input.current.key !== null) return;
      input.current.pointerId = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      hold.start();
    }}
    onPointerMove={(event) => {
      if (input.current.pointerId !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cancel();
    }}
    onPointerUp={(event) => {
      if (input.current.pointerId !== event.pointerId) return;
      input.current.pointerId = null;
      hold.release();
    }}
    onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
    onContextMenu={(event) => event.preventDefault()}
    onKeyDown={(event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (event.repeat || input.current.pointerId !== null || input.current.key !== null) return;
      input.current.key = event.key;
      hold.start();
    }}
    onKeyUp={(event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (input.current.key !== event.key) return;
      input.current.key = null;
      hold.release();
    }}
    onClick={() => hold.click()}
  >{children}</button>;
}

export function MudflatRetryButton({ onRetry, onSecretRetry, children }: { onRetry: () => void; onSecretRetry: () => void; children: ReactNode }) {
  return <MudflatHoldButton className="ms-primary ms-retry-button" onShort={onRetry} onLong={onSecretRetry}>{children}</MudflatHoldButton>;
}
