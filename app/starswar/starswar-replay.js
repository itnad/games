// 스타즈워 경기 재현. 엔진은 결정적이므로 경기를 만든 설정과 사람이 내린 명령(틱, 명령)만 있으면
// 같은 코드에서 같은 경기를 처음부터 다시 돌릴 수 있다. 결과 화면의 리포트에 이 재현 코드를 넣는다.
import { createStarswarGame, stepStarswar, stwCreateScenario, stwIssue } from "./starswar-engine.js";
import { stwAiThink } from "./starswar-ai.js";

/** 재현 코드 형식 판. */
export const STW_REPLAY_VERSION = 1;

/** 재현을 멈추는 최대 경기 시간(초). 무한히 돌지 않게 막는다. */
const REPLAY_TIME_LIMIT = 3600;

/** 경기 끝 상태의 지문: 재현한 경기가 원래 경기와 같은지(같은 코드인지) 비교한다. */
export function stwFingerprint(state) {
  return {
    time: Math.round(state.time * 10) / 10,
    status: state.status,
    winner: state.winner ?? null,
    rng: state.rngState,
    nextId: state.nextId,
    units: state.units.length,
    buildings: state.buildings.length,
  };
}

/** 경기의 재현 코드(JSON으로 옮길 수 있는 객체). 재현 정보가 없는 옛 저장 경기면 null. */
export function stwReplayCode(state, build = "") {
  if (!state.replay) return null;
  const { setup, scenario, commands } = state.replay;
  return { v: STW_REPLAY_VERSION, build, ...(scenario ? { scenario } : { setup }), commands, end: stwFingerprint(state) };
}

/**
 * 재현 코드로 경기를 다시 돌린다. 매 틱 전에 그 틱까지의 사람 명령을 넣고, AI는 원래처럼 생각한다.
 * until(초)을 주면 그 시각에서 멈춘다(그 시점의 상태를 살펴볼 때). 경기가 끝나면 멈춘다.
 * 경기 중에(일시정지 화면에서) 뽑은 코드는 따로 주지 않으면 뽑은 시각에서 멈춘다(그 뒤는 사람 명령이 없어 원래 경기와 다르다).
 * onTick(state)를 주면 틱마다 부른다.
 */
export function stwReplay(code, { until = code?.end?.status === "playing" ? code.end.time : Infinity, onTick = null } = {}) {
  if (!code || code.v !== STW_REPLAY_VERSION) throw new Error("재현 코드 형식이 맞지 않습니다");
  const state = code.scenario ? stwCreateScenario(code.scenario) : createStarswarGame(code.setup);
  const commands = code.commands ?? [];
  // 시각은 0.1초씩 더해 가며 쌓여 소수 오차가 있으므로 틱 수로 견준다.
  const limitTick = Math.round(Math.min(until, REPLAY_TIME_LIMIT) * 10);
  let next = 0;
  for (;;) {
    const tick = Math.round(state.time * 10);
    while (next < commands.length && commands[next][0] <= tick) {
      const [, side, command] = commands[next];
      stwIssue(state, side, command);
      next += 1;
    }
    if (state.status !== "playing" || tick >= limitTick) break;
    stepStarswar(state, stwAiThink);
    onTick?.(state);
  }
  return state;
}

/** 재현 결과가 코드에 적힌 끝 상태와 같은지. 다르면 다른 판의 코드이거나 비결정적인 곳이 있다는 뜻이다. */
export function stwReplayMatches(code, state) {
  return JSON.stringify(stwFingerprint(state)) === JSON.stringify(code.end);
}
