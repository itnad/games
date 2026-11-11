// 스타드래프트 단독 실행 진입점. 사이트 없이 HTML 파일 하나로 게임을 띄운다.
import { createRoot } from "react-dom/client";
import { StarswarGame } from "../../app/starswar/starswar-game";
import "../../app/game-readability.css";
import "../../app/starswar/starswar.css";
import "./standalone.css";

function StandaloneGame() {
  return (
    <div className="game-readability-scope" data-game-id="starswar">
      {/* 단독 실행에는 게임 목록이 없으므로 나가기는 처음 화면으로 돌아간다. */}
      <StarswarGame onExit={() => window.location.reload()} />
    </div>
  );
}

const root = document.getElementById("game-root");
if (root) createRoot(root).render(<StandaloneGame />);
