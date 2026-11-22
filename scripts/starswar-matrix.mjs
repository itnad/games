#!/usr/bin/env node
// 스타드래프트 AI 전략 대진표: 종족 쌍마다 모든 전략 쌍을 AI 대 AI로 돌려 승패를 모은다.
// 정찰 대응 모드의 맞대응 표(starswar-ai.js의 SCOUT_COUNTERS)를 이 결과로 만든다.
//
//   node scripts/starswar-matrix.mjs --seeds 4 --out matrix.json           전략 고정 대진표
//   node scripts/starswar-matrix.mjs --seeds 4 --react player --out r.json  아래쪽(player)만 정찰 대응
//   node scripts/starswar-matrix.mjs --counters matrix.json [--write]       대진표에서 맞대응 표를 뽑아 출력(--write: starswar-counters.js를 다시 쓴다)
import fs from "node:fs";
import os from "node:os";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { createStarswarGame, advanceStarswar } from "../app/starswar/starswar-engine.js";
import { stwAiThink } from "../app/starswar/starswar-ai.js";
import { STW_AI_PERSONAS } from "../app/starswar/starswar-data.js";

const RACES = ["protoss", "terran", "zerg"];
const personasOf = (race) => Object.values(STW_AI_PERSONAS).filter((persona) => persona.race === race).map((persona) => persona.id);

function play(job) {
  const game = createStarswarGame({ difficulty: "hard", seed: job.seed, aiSides: ["player", "enemy"], races: { player: job.races[0], enemy: job.races[1] }, personas: { player: job.personas[0], enemy: job.personas[1] }, ...(job.react ? { scoutReact: job.react } : {}) });
  while (game.status === "playing" && game.time < 2400) advanceStarswar(game, 1, stwAiThink);
  const side = (id) => ({ final: game.sides[id].persona, reads: game.sides[id].ai?.reads ?? [], reacts: game.sides[id].ai?.reacts ?? [] });
  return { ...job, winner: game.status === "playing" ? null : game.winner, time: Math.round(game.time), player: side("player"), enemy: side("enemy") };
}

if (!isMainThread) {
  for (const job of workerData.jobs) parentPort.postMessage(play(job));
} else {
  const args = process.argv.slice(2);
  const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
  if (args.includes("--counters")) {
    const games = JSON.parse(fs.readFileSync(option("counters"), "utf8"));
    const table = counters(games);
    if (args.includes("--write")) {
      // 맞대응 표 모듈을 다시 쓴다: [내 종족][상대 전략][내 전략] = 승률(%).
      const lines = ["// 스타드래프트 정찰 대응 모드의 맞대응 표: [내 종족][상대 전략][내 전략] = 전략 고정 AI 대 AI 대진표의 승률(%).", `// scripts/starswar-matrix.mjs 로 만든다(${games.length}판, 칸마다 ${Object.values(Object.values(table)[0])[0][0][2]}판). 손으로 고치지 않는다.`, "export const STW_SCOUT_COUNTERS = {"];
      for (const [race, rows] of Object.entries(table)) {
        lines.push(`  ${race}: {`);
        for (const [foe, list] of Object.entries(rows)) lines.push(`    ${foe}: { ${list.map(([persona, rate]) => `${persona}: ${rate}`).join(", ")} },`);
        lines.push("  },");
      }
      lines.push("};", "");
      fs.writeFileSync(new URL("../app/starswar/starswar-counters.js", import.meta.url), lines.join("\n"));
      console.error("app/starswar/starswar-counters.js 를 다시 썼습니다.");
    } else console.log(JSON.stringify(table, null, 1));
  } else {
    const seeds = Number(option("seeds", 2));
    const react = option("react", null);
    const only = option("races", null)?.split(",") ?? null;
    const jobs = [];
    for (const a of RACES) for (const b of RACES) {
      if (only && !(only[0] === a && only[1] === b)) continue;
      for (const pa of personasOf(a)) for (const pb of personasOf(b)) for (let seed = 1; seed <= seeds; seed += 1) jobs.push({ races: [a, b], personas: [pa, pb], seed: seed * 7919 + jobs.length, ...(react ? { react: react.split(",") } : {}) });
    }
    // --pick N: 시드 번호 N인 판만 돌린다(같은 --seeds 값으로 돌린 다른 결과와 판 대 판으로 견줄 때).
    const pick = Number(option("pick", 0));
    const todo = pick ? jobs.filter((_, at) => (at % seeds) + 1 === pick) : jobs;
    const threads = Math.max(1, Math.min(os.cpus().length, Number(option("threads", os.cpus().length))));
    const results = [];
    let running = threads;
    const started = Date.now();
    for (let index = 0; index < threads; index += 1) {
      const worker = new Worker(new URL(import.meta.url), { workerData: { jobs: todo.filter((_, at) => at % threads === index) } });
      worker.on("message", (result) => {
        results.push(result);
        if (results.length % 200 === 0) console.error(`${results.length}/${todo.length} · ${Math.round((Date.now() - started) / 1000)}초`);
      });
      worker.on("error", (error) => { console.error(error); process.exitCode = 1; });
      worker.on("exit", () => {
        running -= 1;
        if (running) return;
        fs.writeFileSync(option("out", "starswar-matrix.json"), JSON.stringify(results));
        console.error(`끝: ${results.length}판 · ${Math.round((Date.now() - started) / 1000)}초`);
      });
    }
  }
}

/**
 * 맞대응 표: [내 종족][상대 전략] → 승률이 높은 순서의 내 전략들과 승률. 양쪽 자리(아래·위)의 판을 모두 센다.
 */
export function counters(games) {
  const table = {};
  for (const game of games) {
    if (!game.winner) continue;
    for (const [me, foe] of [[0, 1], [1, 0]]) {
      const mine = game.personas[me];
      const theirs = game.personas[foe];
      const won = game.winner === (me === 0 ? "player" : "enemy");
      const cell = ((table[game.races[me]] ??= {})[theirs] ??= {});
      const entry = (cell[mine] ??= [0, 0]);
      entry[0] += 1;
      entry[1] += won ? 1 : 0;
    }
  }
  const out = {};
  for (const [race, byFoe] of Object.entries(table)) {
    out[race] = {};
    for (const [foe, cell] of Object.entries(byFoe)) {
      out[race][foe] = Object.entries(cell).map(([persona, [n, wins]]) => [persona, Math.round((wins / n) * 100), n]).sort((x, y) => y[1] - x[1]);
    }
  }
  return out;
}
