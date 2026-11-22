// 스타드래프트의 브라우저 저장 키와, 예전 이름(starswar)으로 저장한 값을 새 키로 옮기는 처리.
// 게임의 내부 이름을 starswar에서 stardraft로 바꾸면서 저장 키도 함께 바꿨다. 옮기지 않으면 이어하기·전적·학습 자료·실험실 설정이 사라진다.
export const STW_STORAGE_KEYS = {
  lab: "paperoid-stardraft-lab",
  labPresets: "paperoid-stardraft-lab-presets",
  learning: "paperoid-stardraft-learning",
  record: "paperoid-stardraft-record",
  save: "paperoid-stardraft-save",
  theme: "paperoid-stardraft-theme-v2",
  tipsSeen: "paperoid-stardraft-tips-seen",
};

const LEGACY_PREFIX = "paperoid-starswar-";
const CURRENT_PREFIX = "paperoid-stardraft-";

/**
 * 예전 키의 값을 새 키로 옮긴다(한 번 옮기면 예전 키는 지운다). 새 키에 이미 값이 있으면 그 값을 두고 예전 키만 지운다.
 * 저장소를 쓸 수 없으면 아무것도 하지 않는다. 옮긴 키 수를 돌려준다.
 */
export function stwMigrateLegacyStorage(storage) {
  let moved = 0;
  try {
    for (const key of Object.values(STW_STORAGE_KEYS)) {
      const legacyKey = LEGACY_PREFIX + key.slice(CURRENT_PREFIX.length);
      const legacy = storage.getItem(legacyKey);
      if (legacy === null) continue;
      if (storage.getItem(key) === null) {
        storage.setItem(key, legacy);
        moved += 1;
      }
      storage.removeItem(legacyKey);
    }
  } catch {
    // 저장소가 막혀 있으면 옮기지 못할 뿐 게임은 계속한다.
  }
  return moved;
}
