"use client";

export function SimpleBrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function SimpleModeSwitch() {
  return (
    <div className="mode-switch" aria-label="대전 모드">
      <button className="active">
        <span className="bot-face" aria-hidden="true">•ᴗ•</span>
        AI 대전
      </button>
      <button disabled title="친구 대전은 추후 제공됩니다">
        <span aria-hidden="true">♙</span>
        친구 대전
        <small>준비 중</small>
      </button>
    </div>
  );
}

export function SimpleGameTopbar({ title, onExit }: { title: string; onExit: () => void }) {
  return (
    <header className="game-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup">
        <SimpleBrandMark />
        <div>
          <span>paperoid</span>
          <strong title={title}>{title}</strong>
        </div>
      </div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}
