import type { GameCommand } from "../core/commands";
import type { BattleMap } from "../data/maps";
import type { RenderSnapshot } from "../worker/render-snapshot";
export const COMMAND_FEEDBACK_MS = 900;
export type CommandFeedback = {
  id: number;
  x: number;
  y: number;
  kind: "move" | "attack" | "patrol" | "rally" | "gather" | "build";
};
type Body<T = GameCommand> = T extends GameCommand
  ? Omit<T, "sequence" | "issuedTick" | "executeTick" | "playerId" | "source">
  : never;
/** Local input feedback only. It never advances, mutates or reveals simulation state. */
export function commandFeedback(
  command: Body,
  snapshot: RenderSnapshot,
  map: BattleMap,
  id: number,
): CommandFeedback | null {
  let point: { x: number; y: number } | undefined,
    kind: CommandFeedback["kind"] = "move";
  if ("target" in command) {
    if (command.target.kind === "point") point = command.target;
    else if (command.target.kind === "entity") {
      const id = command.target.entityId;
      point = snapshot.entities.find((e) => e.id === id);
    }
  }
  switch (command.kind) {
    case "move":
      break;
    case "attackMove":
    case "focusAttack":
      kind = "attack";
      break;
    case "patrol":
      kind = "patrol";
      break;
    case "setRallyPoint":
      kind = "rally";
      break;
    case "placeBuilding":
      kind = "build";
      break;
    case "gather": {
      const n = map.resourceNodes.find(
        (n) => n.id === command.payload.resourceId,
      );
      if (n) point = { x: n.x * 256 + 128, y: n.y * 256 + 128 };
      kind = "gather";
      break;
    }
    default:
      return null;
  }
  return point ? { id, x: point.x, y: point.y, kind } : null;
}
