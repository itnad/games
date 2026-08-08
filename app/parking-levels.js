const PARKING_LEVEL_SEEDS = [
  { n: 1, d: "b", m: 4, map: "Th322Ah033Bv523Cv203Dv333Eh002Fh412Gv302Hh402Iv042Jh152Kh012" },
  { n: 2, d: "b", m: 5, map: "Th322Ah402Bv302Ch353Dv113Eh042Fv022Gv242Hh102Iv213Jh332Kv002" },
  { n: 3, d: "b", m: 8, map: "Th322Av222Bv102Cv333Dv202Eh452Fv122Gv512Hv242Iv142Jh432" },
  { n: 4, d: "b", m: 9, map: "Th322Av213Bv102Ch252Dh452Eh022Fh052Gv432Hh143Ih202Jh032Kh312" },
  { n: 5, d: "b", m: 10, map: "Th322Ah113Bh103Cv232Dh023Ev002Fh352Gh412Hh053Ih332Jh343" },
  { n: 6, d: "i", m: 10, map: "Th222Ah022Bv132Ch053Dh212Ev102Fh232Gv002Hv032Ih352Jh303Kh432" },
  { n: 7, d: "i", m: 11, map: "Th322Av112Bh412Ch002Dv542Eh352Fv042Gv332Hh152Iv222Jv432" },
  { n: 8, d: "i", m: 13, map: "Th322Ah013Bh402Cv433Dh023Eh042Fv242Gv302Hv512Ih102Jv332" },
  { n: 9, d: "i", m: 13, map: "Th222Av002Bv112Ch042Dh052Eh212Fh412Gh032Hv522Ih103" },
  { n: 10, d: "i", m: 13, map: "Th222Av202Bh053Ch442Dh012Ev333Fh303Gh132Hh312Ih022Jh142Kh432" },
  { n: 11, d: "i", m: 13, map: "Th322Ah042Bv242Ch122Dv342Eh402Fh442Gh412Hv302Iv102Jv022" },
  { n: 12, d: "i", m: 14, map: "Th222Ah022Bh052Ch002Dh033Eh043Fh212Gv333Hh432Ih452Jv412Kv512" },
  { n: 13, d: "i", m: 15, map: "Th322Av022Bh122Ch232Dh212Ev102Fv002Gh043Hv342Ih442" },
  { n: 14, d: "i", m: 15, map: "Th322Av402Bh432Ch342Dh212Eh232Fh043Gh353Hh002Ih023" },
  { n: 15, d: "i", m: 16, map: "Th222Av112Bh353Cv012Dh032Eh242Fh212Gh102Hh042Ih302" },
  { n: 16, d: "i", m: 16, map: "Th122Ah313Bv342Cv012Dv422Ev032Fv232Gv202Hh302Ih002" },
  { n: 17, d: "i", m: 17, map: "Th122Ah352Bv102Cv202Dh303Ev002Fv022Gh053Hh412Ih432Jh042Kv232" },
  { n: 18, d: "i", m: 17, map: "Th322Ah402Bv242Cv103Dv002Ev333Fh432Gh442Hv132Ih452Jh202Kv222" },
  { n: 19, d: "i", m: 17, map: "Th222Ah203Bv033Ch432Dh002Ev332Fh013Gv142Hv412Ih022" },
  { n: 20, d: "i", m: 19, map: "Th222Av233Bh042Ch212Dv502Eh452Fh022Gv342Hv102Iv412Jh203" },
  { n: 21, d: "i", m: 19, map: "Th022Av523Bv312Cv133Dv002Ev502Fh243Gh332Hh252Iv042Jv222Kh452" },
  { n: 22, d: "i", m: 20, map: "Th322Av122Bv522Ch353Dv302Ev142Fh003Gv402Hv502Iv033Jh012" },
  { n: 23, d: "i", m: 20, map: "Th322Ah122Bv032Ch302Dv003Ev202Fv433Gv102Hh232Iv342Jh142" },
  { n: 24, d: "i", m: 20, map: "Th022Av142Bv222Cv002Dv102Eh412Fh212Gh242Hh032Ih303Jh252" },
  { n: 25, d: "i", m: 21, map: "Th222Av233Bv103Ch052Dh042Eh333Fh202Gh213Hh402Iv002Jv022" },
  { n: 26, d: "a", m: 21, map: "Th022Av142Bh452Ch132Dh442Ev102Fh252Gv522Hv033Iv332" },
  { n: 27, d: "a", m: 22, map: "Th222Ah042Bv002Cv302Dh022Eh112Fh102Gh402Hv342Ih412" },
  { n: 28, d: "a", m: 23, map: "Th022Ah452Bv222Cv132Dv202Ev342Fv432Gv322Hv102Iv502Jh152Kv002" },
  { n: 29, d: "a", m: 23, map: "Th222Av432Bh402Cv512Dv412Ev302Fh012Gv042Hh252Ih452" },
  { n: 30, d: "a", m: 23, map: "Th322Ah022Bv132Cv222Dh243Eh412Fv002Gh402Hh202Ih212Jv542Kh052" },
  { n: 31, d: "a", m: 23, map: "Th322Ah232Bh012Ch432Dv033Eh002Fh442Gh252Hh202Ih023Jv502Kh452" },
  { n: 32, d: "a", m: 24, map: "Th022Av423Bv312Cv133Dv042Ev542Fh412Gv212Hh232Ih242" },
  { n: 33, d: "a", m: 24, map: "Th222Ah212Bh202Cv132Dv342Ev103Fv512Gv002Hh402Iv412Jv242" },
  { n: 34, d: "a", m: 24, map: "Th322Ah043Bv203Ch002Dh303Eh152Fh452Gv342Hh012Ih232Jh032" },
  { n: 35, d: "a", m: 25, map: "Th022Av102Bv242Ch412Dh352Eh033Fv542Gh042Hv522Ih212" },
  { n: 36, d: "a", m: 25, map: "Th222Av412Bh113Ch022Dh153Eh432Fh303Gv002Hv332Iv512Jv442" },
  { n: 37, d: "a", m: 25, map: "Th022Av342Bh013Ch333Dv403Ev502Fh003Gv222Hv033Ih152" },
  { n: 38, d: "a", m: 26, map: "Th022Ah112Bh003Ch452Dv222Eh302Fv142Gh442Hh032Ih252" },
  { n: 39, d: "a", m: 29, map: "Th222Av302Bh032Ch022Dh102Ev142Fh452Gh412Hv042Iv002" },
  { n: 40, d: "a", m: 30, map: "Th222Ah402Bh043Cv412Dh022Ev202Fv302Gh452Hv342Iv513" },
  { n: 41, d: "a", m: 30, map: "Th022Ah442Bv042Cv222Dh012Eh202Fv323Gh032Hh213Ih353Jh402" },
  { n: 42, d: "a", m: 33, map: "Th022Av512Bh002Ch452Dh232Eh432Fv132Gh012Hv342Ih442Jh052Kv402" },
  { n: 43, d: "a", m: 34, map: "Th222Ah343Bh152Ch022Dv522Eh002Fv302Gv033Hh332Ih412" },
  { n: 44, d: "a", m: 37, map: "Th122Ah232Bv023Cv132Dv403Ev242Fh052Gv502Hh003Iv342" },
  { n: 45, d: "a", m: 39, map: "Th122Av432Bv412Ch032Dv202Eh052Fv003Gh402Hv102Ih232Jh042" },
  { n: 46, d: "a", m: 39, map: "Th222Ah202Bh212Cv042Dv422Eh412Fh442Gv342Hv232Ih032Jh402Kh152" },
  { n: 47, d: "a", m: 41, map: "Th122Av332Bv312Ch052Dv102Ev022Fv242Gh202Hh132Iv002Jv402" },
  { n: 48, d: "a", m: 42, map: "Th322Av112Bv333Cv402Dh132Eh212Fh002Gh452Hh202Iv242Jv042" },
  { n: 49, d: "a", m: 46, map: "Th022Ah233Bv242Ch202Dv312Eh412Fv212Gh002Hh042Ih052" },
  { n: 50, d: "a", m: 50, map: "Th322Av502Bh252Ch013Dh002Ev402Fh032Gv222Hh452Ih022Jv142" },
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

export const PARKING_LEVELS = PARKING_LEVEL_SEEDS.map((seed) => ({
  number: seed.n,
  difficulty: DIFFICULTY_NAMES[seed.d],
  minMoves: seed.m,
  cars: decodeParkingMap(seed.map),
}));

