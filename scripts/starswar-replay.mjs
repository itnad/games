// 스타드래프트 리포트의 재현 코드로 경기를 다시 돌린다(개발용).
//   node scripts/starswar-replay.mjs 리포트.txt            → 끝까지 돌리고 원래 경기와 같은지 확인
//   node scripts/starswar-replay.mjs 리포트.txt --at 7:30  → 그 시각의 양쪽 병력·건물·자원을 보여 준다
//   node scripts/starswar-replay.mjs 리포트.txt --dump 7:30 > state.json → 그 시각의 엔진 상태 전체
// 리포트 글 전체를 넣어도 되고, 재현 코드(JSON)만 넣어도 된다. 파일 대신 "-"를 주면 표준 입력에서 읽는다.
import { readFileSync } from "node:fs";
import { stwClock } from "../app/starswar/starswar-engine.js";
import { stwBugReport } from "../app/starswar/starswar-report.js";
import { stwFingerprint, stwReplay, stwReplayMatches } from "../app/starswar/starswar-replay.js";

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error("사용법: node scripts/starswar-replay.mjs <리포트 파일|-> [--at m:ss | --dump m:ss]");
  process.exit(1);
}
const text = readFileSync(file === "-" ? 0 : file, "utf8");
const match = text.match(/```json\s*(\{"v":[\s\S]*?\})\s*```/) ?? text.match(/(\{"v":\d[\s\S]*\})/);
if (!match) {
  console.error("재현 코드를 찾지 못했습니다");
  process.exit(1);
}
const code = JSON.parse(match[1]);
const seconds = (value) => {
  const [m, s] = String(value).split(":").map(Number);
  return s === undefined ? m : m * 60 + s;
};
const atIndex = rest.findIndex((arg) => arg === "--at" || arg === "--dump");
const until = atIndex >= 0 ? seconds(rest[atIndex + 1]) : Infinity;
const started = Date.now();
const state = stwReplay(code, { until });
if (atIndex >= 0 && rest[atIndex] === "--dump") {
  process.stdout.write(JSON.stringify(state));
} else if (atIndex >= 0) {
  console.log(`${stwClock(state.time)} 시점`);
  console.log(stwBugReport(state, { build: code.build }).split("## 마지막 상태")[1].split("## 재현 코드")[0].trim());
} else {
  const same = stwReplayMatches(code, state);
  console.log(`재현: ${stwClock(state.time)} · ${state.winner ?? state.status} · ${Date.now() - started}ms`);
  console.log(`원래 끝: ${JSON.stringify(code.end)}`);
  console.log(`재현 끝: ${JSON.stringify(stwFingerprint(state))}`);
  console.log(same ? "같은 경기로 재현됐습니다" : `다르게 끝났습니다(코드 판이 다르거나 비결정적인 곳이 있음). 리포트 판: ${code.build || "모름"}`);
}
