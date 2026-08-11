const PARKING_LEVEL_SEEDS = [
  { n: 1, d: "b", m: 5, map: "Th022Av102Bh432Ch252Dv142Eh033Fh452Gv332Hh442" },
  { n: 2, d: "b", m: 6, map: "Th022Ah103Bh113Cv433Dh232Ev502Fv522Gv142Hv032" },
  { n: 3, d: "b", m: 9, map: "Th022Ah232Bv422Ch252Dh102Eh112Fh442Gv512Hh312" },
  { n: 4, d: "b", m: 5, map: "Th022Ah312Bv032Cv142Dh432Eh132Fh013Gv442Hh252Ih102" },
  { n: 5, d: "b", m: 5, map: "Th022Ah132Bh412Ch342Dh102Eh052Fh432Gh352Hh013Ih142" },
  { n: 6, d: "i", m: 13, map: "Th022Ah152Bh412Ch142Dh212Eh402Fh232Gv422Hh342Iv542Jv522" },
  { n: 7, d: "i", m: 10, map: "Th022Ah113Bh342Cv142Dv042Ev412Fh003Gh332Hv522Ih352Jh302" },
  { n: 8, d: "i", m: 10, map: "Th022Av522Bh012Cv223Dv502Eh042Fv402Gv323Hh152Iv423" },
  { n: 9, d: "i", m: 10, map: "Th022Av312Bv342Ch102Dv413Ev033Fv133Gh302Hv222Ih112Jv002" },
  { n: 10, d: "i", m: 11, map: "Th022Av042Bv303Cv133Dv102Ev512Fh402Gv223Hh432Iv442" },
  { n: 11, d: "i", m: 18, map: "Th022Ah342Bv303Ch352Dv522Eh142Fv222Gv422Hv102Ih412Jh052" },
  { n: 12, d: "i", m: 14, map: "Th022Av542Bh012Cv232Dv303Ev132Fv033Gh402Hh352Iv522Jv212" },
  { n: 13, d: "i", m: 10, map: "Th022Ah442Bv522Ch452Dh212Eh252Fh132Gv002Hh202Iv322Jh412" },
  { n: 14, d: "i", m: 10, map: "Th022Av322Bh202Ch313Dh012Ev222Fh352Gh402Hv422Ih142Jv522" },
  { n: 15, d: "i", m: 10, map: "Th022Ah012Bv542Ch242Dv203Eh303Fv142Gh432Hh132Iv042" },
  { n: 16, d: "i", m: 11, map: "Th022Ah343Bv102Ch132Dh452Ev212Fv522Gv422Hv312Iv032" },
  { n: 17, d: "i", m: 10, map: "Th022Ah003Bh053Ch012Dv523Ev342Fh402Gv322Hh312Ih132Jv422" },
  { n: 18, d: "i", m: 11, map: "Th022Ah432Bh112Cv002Dv032Eh202Fv342Gv503Hv242Ih133Jv402" },
  { n: 19, d: "i", m: 10, map: "Th022Av042Bv002Ch152Dv512Ev223Fv542Gv332Hv202Iv442Jv412" },
  { n: 20, d: "i", m: 11, map: "Th022Ah343Bv213Ch002Dh352Eh432Fh032Gh012Hh142Ih202Jv312" },
  { n: 21, d: "i", m: 12, map: "Th022Ah113Bv222Cv522Dh402Eh102Fh042Gh332Hv242Ih442" },
  { n: 22, d: "i", m: 11, map: "Th022Av413Bh253Ch002Dv222Eh342Fv532Gv502Hh302Ih042Jh032" },
  { n: 23, d: "i", m: 11, map: "Th022Av032Bh002Cv512Dv412Ev312Fh232Gh202Hv132Iv242" },
  { n: 24, d: "i", m: 11, map: "Th022Ah013Bv312Cv042Dh342Ev512Fh232Gh252Hv403Ih102" },
  { n: 25, d: "i", m: 10, map: "Th022Av322Bh243Ch013Dv422Eh132Fv532Gv402Hh152Iv512Jh452" },
  { n: 26, d: "a", m: 15, map: "Th022Av342Bh113Ch333Dv403Ev512Fh003Gv222Hv033Ih152" },
  { n: 27, d: "a", m: 15, map: "Th022Ah442Bv042Cv222Dh012Eh102Fv323Gh032Hh213Ih353Jh302" },
  { n: 28, d: "a", m: 28, map: "Th122Av432Bv412Ch032Dv202Eh152Fv003Gh402Hv102Ih232Jh042" },
  { n: 29, d: "a", m: 16, map: "Th122Ah442Bv042Cv232Dh012Eh002Fv323Gh032Hh213Ih353Jh302" },
  { n: 30, d: "a", m: 24, map: "Th222Av442Bv412Ch032Dv202Eh252Fv003Gh402Hv102Ih332Jh142" },
  { n: 31, d: "a", m: 16, map: "Th022Ah442Bv042Cv232Dh112Eh102Fv323Gh032Hh313Ih353Jh302" },
  { n: 32, d: "a", m: 15, map: "Th122Ah442Bv042Cv242Dh012Eh002Fv323Gh032Hh313Ih353Jh302" },
  { n: 33, d: "a", m: 24, map: "Th222Av432Bv412Ch032Dv202Eh252Fv003Gh302Hv102Ih232Jh242" },
  { n: 34, d: "a", m: 17, map: "Th122Ah442Bv042Cv232Dh012Eh202Fv323Gh032Hh213Ih353Jh402" },
  { n: 35, d: "a", m: 26, map: "Th122Av442Bv412Ch032Dv202Eh152Fv003Gh302Hv102Ih232Jh042" },
  { n: 36, d: "a", m: 15, map: "Th022Ah442Bv042Cv222Dh012Eh102Fv323Gh032Hh213Ih353Jh402" },
  { n: 37, d: "a", m: 15, map: "Th022Ah202Bh112Cv042Dv422Eh412Fh442Gv342Hv222Ih032Jh402Kh152" },
  { n: 38, d: "a", m: 19, map: "Th222Av442Bv412Ch232Dv202Eh052Fv013Gh302Hv112Ih432Jh142" },
  { n: 39, d: "a", m: 24, map: "Th222Av442Bv412Ch032Dv202Eh052Fv003Gh302Hv112Ih232Jh142" },
  { n: 40, d: "a", m: 22, map: "Th222Av442Bv412Ch032Dv202Eh252Fv003Gh302Hv112Ih232Jh242" },
  { n: 41, d: "a", m: 15, map: "Th022Ah442Bv042Cv242Dh112Eh102Fv323Gh032Hh313Ih353Jh302" },
  { n: 42, d: "a", m: 24, map: "Th222Av432Bv412Ch032Dv202Eh252Fv003Gh402Hv112Ih232Jh242" },
  { n: 43, d: "a", m: 15, map: "Th122Ah442Bv042Cv232Dh112Eh002Fv323Gh032Hh313Ih353Jh302" },
  { n: 44, d: "a", m: 25, map: "Th222Av432Bv412Ch032Dv202Eh352Fv003Gh302Hv112Ih232Jh142" },
  { n: 45, d: "a", m: 24, map: "Th222Av442Bv412Ch032Dv202Eh152Fv003Gh402Hv102Ih232Jh242" },
  { n: 46, d: "a", m: 25, map: "Th222Av442Bv422Ch032Dv202Eh152Fv003Gh402Hv102Ih232Jh242" },
  { n: 47, d: "a", m: 17, map: "Th122Ah442Bv042Cv232Dh012Eh102Fv323Gh032Hh213Ih353Jh302" },
  { n: 48, d: "a", m: 26, map: "Th122Av432Bv412Ch032Dv202Eh152Fv003Gh302Hv102Ih232Jh142" },
  { n: 49, d: "a", m: 15, map: "Th022Ah442Bv042Cv222Dh112Eh102Fv323Gh032Hh313Ih353Jh302" },
  { n: 50, d: "a", m: 26, map: "Th122Av442Bv412Ch032Dv202Eh052Fv003Gh302Hv102Ih232Jh142" },
];

const DIFFICULTY_NAMES = { b: "초급", i: "중급", a: "고급" };
const CAR_COLORS = ["blue", "gold", "green", "violet"];

function decodeParkingMap(map) {
  return Array.from({ length: map.length / 5 }, (_, index) => {
    const token = map.slice(index * 5, index * 5 + 5);
    return {
      id: token[0],
      axis: token[1],
      x: Number(token[2]),
      y: Number(token[3]),
      len: Number(token[4]),
      target: token[0] === "T",
      color: token[0] === "T" ? "red" : CAR_COLORS[(index - 1) % CAR_COLORS.length],
    };
  });
}

export function parkingMinimumMoves(cars, maxStates = 750000) {
  const start = cars.flatMap((car) => [car.x, car.y]);
  const stateKey = (positions) => positions.join("");
  const queue = [{ positions: start, moves: 0 }];
  const visited = new Set([stateKey(start)]);

  for (let cursor = 0; cursor < queue.length && queue.length <= maxStates; cursor += 1) {
    const { positions, moves } = queue[cursor];
    const targetX = positions[0];
    if (targetX + cars[0].len === 6) return moves + 1;

    const occupied = new Int8Array(36).fill(-1);
    for (let carIndex = 0; carIndex < cars.length; carIndex += 1) {
      const car = cars[carIndex];
      const x = positions[carIndex * 2];
      const y = positions[carIndex * 2 + 1];
      for (let step = 0; step < car.len; step += 1) {
        const cellX = x + (car.axis === "h" ? step : 0);
        const cellY = y + (car.axis === "v" ? step : 0);
        occupied[cellY * 6 + cellX] = carIndex;
      }
    }

    for (let carIndex = 0; carIndex < cars.length; carIndex += 1) {
      const car = cars[carIndex];
      const x = positions[carIndex * 2];
      const y = positions[carIndex * 2 + 1];
      for (const delta of [-1, 1]) {
        const nextX = car.axis === "h" ? x + delta : x;
        const nextY = car.axis === "v" ? y + delta : y;
        if (nextX < 0 || nextY < 0 || nextX + (car.axis === "h" ? car.len : 1) > 6 || nextY + (car.axis === "v" ? car.len : 1) > 6) continue;
        const leadingX = car.axis === "h" ? (delta > 0 ? x + car.len : x - 1) : x;
        const leadingY = car.axis === "v" ? (delta > 0 ? y + car.len : y - 1) : y;
        if (occupied[leadingY * 6 + leadingX] !== -1) continue;
        const next = [...positions];
        next[carIndex * 2] = nextX;
        next[carIndex * 2 + 1] = nextY;
        const key = stateKey(next);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ positions: next, moves: moves + 1 });
        }
      }
    }
  }
  return Infinity;
}

export const PARKING_LEVELS = PARKING_LEVEL_SEEDS.map((seed) => ({
  number: seed.n,
  difficulty: DIFFICULTY_NAMES[seed.d],
  minMoves: seed.m,
  cars: decodeParkingMap(seed.map),
}));
