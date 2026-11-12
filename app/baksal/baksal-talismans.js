// 부적: 런 안에서 고르는 로그라이크 성장. 네 축(소금총·등롱·몸·박자)과 발동형이 있다.
// 발동형은 왼손 버튼에 1개만 장착되며, 새로 고르면 이전 발동형을 대체한다.

import { nextMudflatRandom, normalizeMudflatSeed } from "../mudflat-rng.js";

export const TALISMANS = Object.freeze({
  "salt-wide": { id: "salt-wide", axis: "소금총", name: "넓은 산탄", summary: "조준 보정 반경이 4도 넓어진다.", apply: (m) => ({ ...m, aimAssistDeg: m.aimAssistDeg + 4 }) },
  "salt-joa": { id: "salt-joa", axis: "소금총", name: "너그러운 소금", summary: "좋아 판정도 피해가 2배다.", apply: (m) => ({ ...m, joaDoubles: true }) },
  "salt-bag": { id: "salt-bag", axis: "소금총", name: "큰 소금통", summary: "탄창이 4발 늘고 바로 가득 찬다.", apply: (m) => ({ ...m, ammoBonus: m.ammoBonus + 4 }) },
  "salt-weak": { id: "salt-weak", axis: "소금총", name: "쇠침 소금", summary: "약점 피해가 절반 더 늘고 약점 반경이 2도 넓어진다.", apply: (m) => ({ ...m, weakPointBonus: m.weakPointBonus + 0.5, weakPointDeg: m.weakPointDeg + 2 }) },
  "lantern-wide": { id: "lantern-wide", axis: "등롱", name: "큰 등롱", summary: "등롱 시야가 12도 넓어진다.", apply: (m) => ({ ...m, lanternConeDeg: m.lanternConeDeg + 12 }) },
  "lantern-reveal": { id: "lantern-reveal", axis: "등롱", name: "맑은 불", summary: "은신 악귀가 등롱 안 어디서나 보인다.", apply: (m) => ({ ...m, revealHidden: true }) },
  "lantern-torch": { id: "lantern-torch", axis: "등롱", name: "횃불", summary: "발동하면 2마디 동안 등롱 밖까지 환해지고 은신이 풀린다. 3회.", active: { uses: 3, effect: "torch", beats: 8 }, apply: (m) => m },
  "body-hp": { id: "body-hp", axis: "몸", name: "질긴 염주", summary: "최대 체력이 1 늘고 바로 1 회복한다.", apply: (m) => ({ ...m, maxHpBonus: m.maxHpBonus + 1, healOnPick: 1 }) },
  "body-window": { id: "body-window", axis: "몸", name: "가벼운 짚신", summary: "회피 판정 창이 60ms 넓어진다.", apply: (m) => ({ ...m, dodgeWindowBonusMs: m.dodgeWindowBonusMs + 60 }) },
  "body-shield": { id: "body-shield", axis: "몸", name: "여분 금줄", summary: "긴급 결계를 1회 더 쓸 수 있다.", apply: (m) => ({ ...m, shieldBonus: m.shieldBonus + 1 }) },
  "beat-combo": { id: "beat-combo", axis: "박자", name: "북채", summary: "콤보 보너스가 커진다.", apply: (m) => ({ ...m, comboStep: m.comboStep + 3 }) },
  "beat-guard": { id: "beat-guard", axis: "박자", name: "실 묶기", summary: "콤보가 끊길 때 2번까지 지켜 준다.", apply: (m) => ({ ...m, comboShields: m.comboShields + 2 }) },
  "beat-purify": { id: "beat-purify", axis: "박자", name: "느슨한 봉인", summary: "정화가 마디 1박과 3박 모두에 된다.", apply: (m) => ({ ...m, purifyBeats: [0, 2] }) },
  cleanse: { id: "cleanse", axis: "몸", name: "부정 씻기", summary: "발동하면 저주가 풀리고 2마디 동안 저주에 걸리지 않는다. 3회.", active: { uses: 3, effect: "cleanse", beats: 8 }, apply: (m) => m },
  "salt-throw": { id: "salt-throw", axis: "소금총", name: "소금 뿌리기", summary: "발동하면 등롱 안에 보이는 투사체를 모두 격파한다. 2회.", active: { uses: 2, effect: "salt-throw", beats: 0 }, apply: (m) => m },
});

export const TALISMAN_IDS = Object.freeze(Object.keys(TALISMANS));
export const BASE_TALISMAN_IDS = Object.freeze(["salt-wide", "salt-joa", "salt-bag", "lantern-wide", "lantern-torch", "body-hp", "body-window", "beat-combo", "cleanse"]);
export const TALISMAN_UNLOCKS = Object.freeze([
  { purified: 8, ids: ["body-shield", "beat-purify"] },
  { purified: 20, ids: ["salt-weak", "lantern-reveal"] },
  { purified: 40, ids: ["beat-guard", "salt-throw"] },
]);

export function defaultModifiers() {
  return {
    aimAssistDeg: 11,
    joaDoubles: false,
    weakPointBonus: 1,
    weakPointDeg: 4,
    lanternConeDeg: 40,
    revealHidden: false,
    maxHpBonus: 0,
    healOnPick: 0,
    dodgeWindowBonusMs: 0,
    shieldBonus: 0,
    comboStep: 5,
    comboShields: 0,
    purifyBeats: [0],
    ammoBonus: 0,
  };
}

export function unlockedTalismanIds(totalPurified) {
  const count = Number(totalPurified) || 0;
  const ids = [...BASE_TALISMAN_IDS];
  for (const unlock of TALISMAN_UNLOCKS) if (count >= unlock.purified) ids.push(...unlock.ids);
  return ids;
}

export function nextTalismanUnlock(totalPurified) {
  const count = Number(totalPurified) || 0;
  return TALISMAN_UNLOCKS.find((unlock) => count < unlock.purified) ?? null;
}

/** 후보 3개. 이미 가진 지속형은 빼고, 발동형은 장착 중인 것만 뺀다. 결정적 RNG. */
export function offerTalismans(rngState, { unlocked = BASE_TALISMAN_IDS, owned = [], activeId = null } = {}) {
  let state = normalizeMudflatSeed(rngState);
  const pool = unlocked.filter((id) => {
    const talisman = TALISMANS[id];
    if (!talisman) return false;
    if (talisman.active) return id !== activeId;
    return !owned.includes(id);
  });
  const offered = [];
  while (offered.length < 3 && pool.length > 0) {
    const next = nextMudflatRandom(state);
    state = next.state;
    const index = Math.floor(next.value * pool.length);
    offered.push(pool.splice(index, 1)[0]);
  }
  return { offered, state };
}
