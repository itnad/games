// 전선 지휘관 단독 실행 진입점. 사이트 없이 HTML 파일 하나로 게임을 띄운다.
import { createRoot } from "react-dom/client";
import { FrontlineGame } from "../../app/frontline/frontline-game";
import "../../app/game-readability.css";
import "../../app/frontline/frontline.css";
import "./standalone.css";

function StandaloneFrontline() {
  return (
    <div className="game-readability-scope" data-game-id="frontline">
      {/* 단독 실행에는 게임 목록이 없으므로 나가기는 처음 화면으로 돌아간다. */}
      <FrontlineGame onExit={() => window.location.reload()} />
    </div>
  );
}

const root = document.getElementById("frontline-root");
if (root) createRoot(root).render(<StandaloneFrontline />);
