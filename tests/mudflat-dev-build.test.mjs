import assert from "node:assert/strict";
import test from "node:test";
import {
  MUDFLAT_DEV_BUILD_MAX_STAGE,
  createMudflatDevBuild,
  mudflatDevBuildCampaign,
  mudflatDevBuildSeed,
  mudflatDevBuildSkills,
  mudflatDevFixedSeed,
  validateMudflatDevBuild,
} from "../app/mudflat-dev-build.js";
import { MUDFLAT_GENERAL_UPGRADES, MUDFLAT_UPGRADES, mudflatEquipmentStats } from "../app/mudflat-survivor-engine.js";

// createCampaign(characterId, mode, stage)가 만드는 값과 같은 모양의 기본 캠페인.
function baseCampaign(mode = "normal", stage = 1) {
  const levels = mode === "normal"
    ? { tongs: 1, harpoon: 0, net: 0, boots: 0, basket: 0, snack: 0, rocker: 0, digging: 1 }
    : { hoe: 2, net: 0, salt: 0, boots: 0, basket: 0, stamina: 0 };
  return {
    version: 1, mode, characterId: mode === "normal" ? "beginner" : "digger", stage, coins: 0, hp: 100, maxHp: 100, baseMaxHp: mode === "normal" ? 100 : 115,
    level: 1, xp: 0, nextXp: mode === "normal" ? 10 : 8, levels, activeSkills: [],
    equipment: { headlamp: 0, cooler: 0, vest: 0, gloves: 0, waders: 0 }, inventory: {}, lastHaul: {}, lastSaleValue: 0, totalScore: 0, lastBossCaught: false, gemsCollected: 0, digsCompleted: 0, hitByCrab: false, hitByShrimp: false, hitByRock: false, hitByTide: false, hitByMosquito: false, hitByPufferfish: false,
    lastObjectiveLabel: "", lastObjectiveComplete: false, lastObjectiveBonus: 0,
  };
}

test("default builds are valid and list the mode's skills with basic tools at Lv.1", () => {
  const normal = createMudflatDevBuild("normal");
  assert.deepEqual(validateMudflatDevBuild(normal), []);
  assert.equal(normal.levels.tongs, 1);
  assert.equal(normal.levels.digging, 1);
  assert.equal(normal.levels["guard-basket"], 0);
  assert.deepEqual(Object.keys(normal.levels), MUDFLAT_GENERAL_UPGRADES.map((skill) => skill.id));
  assert.equal(mudflatDevBuildSkills("normal"), MUDFLAT_GENERAL_UPGRADES);
  const kids = createMudflatDevBuild("kids");
  assert.deepEqual(validateMudflatDevBuild(kids), []);
  assert.equal(kids.levels.hoe, 1);
  assert.equal(mudflatDevBuildSkills("kids"), MUDFLAT_UPGRADES);
  assert.equal(createMudflatDevBuild("weird").mode, "normal");
});

test("validation names every out-of-range field without appending raw particles", () => {
  const build = createMudflatDevBuild("normal");
  build.stage = 0;
  build.levels.tongs = 0;
  build.levels.harpoon = 7;
  build.activeSkills = ["net", "net", "tongs", "snack"];
  build.level = 0; build.xp = -1; build.nextXp = 0; build.coins = 1.5; build.hpPercent = 101;
  build.equipment.cooler = 9; build.gemsCollected = -3; build.digsCompleted = 2.5; build.seedMode = "custom"; build.seed = 0;
  const errors = validateMudflatDevBuild(build);
  assert.ok(errors.includes(`단계는 1부터 ${MUDFLAT_DEV_BUILD_MAX_STAGE}까지입니다.`));
  assert.ok(errors.includes("집게 숙련도는 기본 기술이라 Lv.1 이상이어야 합니다."));
  assert.ok(errors.includes("작살던지기 레벨은 0부터 6까지입니다."));
  assert.ok(errors.includes("활성 기술이 중복되었습니다."));
  assert.ok(errors.includes("활성 목록에 둘 수 없는 기술 ID: tongs"));
  assert.ok(errors.includes("뜰채는 레벨이 0이라 활성화할 수 없습니다."));
  assert.ok(errors.includes("든든한 간식은 레벨이 0이라 활성화할 수 없습니다."));
  assert.ok(errors.includes("캐릭터 레벨은 1 이상의 정수여야 합니다."));
  assert.ok(errors.includes("경험치는 0 이상의 정수여야 합니다."));
  assert.ok(errors.includes("다음 레벨 경험치는 1 이상의 정수여야 합니다."));
  assert.ok(errors.includes("코인은 0 이상의 정수여야 합니다."));
  assert.ok(errors.includes("체력 비율은 1부터 100까지입니다."));
  assert.ok(errors.includes("조과통 업그레이드 레벨은 0부터 6까지입니다."));
  assert.ok(errors.includes("경험치 보석 수는 0 이상의 정수여야 합니다."));
  assert.ok(errors.includes("호미질 수는 0 이상의 정수여야 합니다."));
  assert.ok(errors.includes("직접 입력 시드는 1부터 4294967295 사이의 정수여야 합니다."));
  assert.ok(errors.every((message) => !/[}\]]\s*(이|가|은|는|을|를|과|와|으로|로)\b/.test(message)));
  const seven = createMudflatDevBuild("normal");
  for (const id of ["harpoon", "net", "rocker", "boots", "basket", "snack", "electric"]) seven.levels[id] = 1;
  seven.activeSkills = ["harpoon", "net", "rocker", "boots", "basket", "snack", "electric"];
  assert.ok(validateMudflatDevBuild(seven).includes("활성 기술은 최대 6개입니다."));
  const kids = createMudflatDevBuild("kids");
  kids.levels.hoe = 0; kids.supervisor = true;
  const kidsErrors = validateMudflatDevBuild(kids);
  assert.ok(kidsErrors.includes("갯벌 파동은 기본 기술이라 Lv.1 이상이어야 합니다."));
  assert.ok(kidsErrors.includes("AI 감독모드는 일반 모드에서만 관전할 수 있습니다."));
  assert.deepEqual(validateMudflatDevBuild(null), ["빌드 명세가 없습니다."]);
  assert.deepEqual(validateMudflatDevBuild({ mode: "x" }), ["모드는 일반 또는 어린이여야 합니다."]);
});

test("a build becomes a campaign with normalized active skills, clamped gear, HP percent and auto unlock", () => {
  const build = createMudflatDevBuild("normal");
  Object.assign(build, { stage: 8, coins: 4321, level: 14, xp: 30, nextXp: 200, hpPercent: 50, mosquitoRepellent: true });
  Object.assign(build.levels, { tongs: 5, digging: 4, harpoon: 3, net: 2, rocker: 1, boots: 1, basket: 1, snack: 2, electric: 2, "guard-basket": 6 });
  build.activeSkills = ["harpoon", "net", "rocker", "boots", "basket", "snack", "guard-basket"];
  build.equipment = { headlamp: 9, cooler: 2, vest: 1, gloves: 0, waders: 3 };
  const campaign = mudflatDevBuildCampaign(build, baseCampaign("normal", 8));
  assert.equal(campaign.stage, 8);
  assert.equal(campaign.coins, 4321);
  assert.equal(campaign.level, 14);
  assert.deepEqual(campaign.activeSkills, ["harpoon", "net", "rocker", "boots", "basket", "snack"]);
  assert.equal(campaign.levels["guard-basket"], 6); // 보관 상태로 인벤토리에 남는다.
  assert.equal(campaign.levels.electric, 2);
  assert.equal(campaign.equipment.headlamp, 6);
  assert.equal(campaign.equipment.mosquitoRepellent, 1);
  const expectedMaxHp = mudflatEquipmentStats(campaign.equipment, 100, 2).maxHp;
  assert.equal(campaign.maxHp, expectedMaxHp);
  assert.equal(campaign.hp, Math.round(expectedMaxHp / 2));
  assert.equal(campaign.gemsCollected, 100); // 소쿠리의 달인 해금 조건 자동 충족
  assert.equal(campaign.pendingSkillDiscovery, false);
  build.autoUnlock = false;
  assert.equal(mudflatDevBuildCampaign(build, baseCampaign("normal", 8)).gemsCollected, 0);
  build.gemsCollected = 250;
  assert.equal(mudflatDevBuildCampaign(build, baseCampaign("normal", 8)).gemsCollected, 250);
  // 호미봇 레벨이 있으면 호미질 20회를 채우고, 호미질 레벨은 건드리지 않는다.
  const botBuild = createMudflatDevBuild("normal");
  botBuild.levels["hoe-bot"] = 2;
  const botCampaign = mudflatDevBuildCampaign(botBuild, baseCampaign("normal"));
  assert.equal(botCampaign.digsCompleted, 20);
  assert.equal(botCampaign.levels.digging, 1);
  assert.deepEqual(botCampaign.activeSkills, []);
  botBuild.autoUnlock = false;
  assert.equal(mudflatDevBuildCampaign(botBuild, baseCampaign("normal")).digsCompleted, 0);
  botBuild.digsCompleted = 33;
  assert.equal(mudflatDevBuildCampaign(botBuild, baseCampaign("normal")).digsCompleted, 33);
  // 화염 기술 레벨이 있으면 게·새우 피격 경험을 채우고, 끄면 체크박스 값만 따른다.
  const fireBuild = createMudflatDevBuild("normal");
  fireBuild.levels.fireball = 1;
  assert.deepEqual([mudflatDevBuildCampaign(fireBuild, baseCampaign("normal")).hitByCrab, mudflatDevBuildCampaign(fireBuild, baseCampaign("normal")).hitByShrimp], [true, false]);
  fireBuild.autoUnlock = false; fireBuild.hitByShrimp = true;
  assert.deepEqual([mudflatDevBuildCampaign(fireBuild, baseCampaign("normal")).hitByCrab, mudflatDevBuildCampaign(fireBuild, baseCampaign("normal")).hitByShrimp], [false, true]);
  // 빙결 기술 레벨이 있으면 바위·돌발 물살 피격 경험을 채우고, 끄면 체크박스 값만 따른다.
  const frostBuild = createMudflatDevBuild("normal");
  assert.deepEqual([frostBuild.hitByRock, frostBuild.hitByTide], [false, false]);
  frostBuild.levels["frost-wave"] = 1;
  assert.deepEqual([mudflatDevBuildCampaign(frostBuild, baseCampaign("normal")).hitByRock, mudflatDevBuildCampaign(frostBuild, baseCampaign("normal")).hitByTide], [false, true]);
  frostBuild.levels["frost-trail"] = 2;
  assert.deepEqual([mudflatDevBuildCampaign(frostBuild, baseCampaign("normal")).hitByRock, mudflatDevBuildCampaign(frostBuild, baseCampaign("normal")).hitByTide], [true, true]);
  frostBuild.autoUnlock = false; frostBuild.hitByRock = true;
  assert.deepEqual([mudflatDevBuildCampaign(frostBuild, baseCampaign("normal")).hitByRock, mudflatDevBuildCampaign(frostBuild, baseCampaign("normal")).hitByTide], [true, false]);
  // 대왕 박하지 일찍 등장은 기본 꺼짐이고 캠페인에는 들어가지 않는다(launch 전용).
  assert.equal(createMudflatDevBuild("normal").bossEarly, false);
  assert.equal("bossEarly" in mudflatDevBuildCampaign({ ...createMudflatDevBuild("normal"), bossEarly: true }, baseCampaign("normal")), false);
  // 번개 기술 레벨이 있으면 모기떼·복어 피격 경험을 채우고, 끄면 체크박스 값만 따른다.
  const lightningBuild = createMudflatDevBuild("normal");
  assert.deepEqual([lightningBuild.hitByMosquito, lightningBuild.hitByPufferfish], [false, false]);
  lightningBuild.levels.thunderbolt = 1;
  assert.deepEqual([mudflatDevBuildCampaign(lightningBuild, baseCampaign("normal")).hitByMosquito, mudflatDevBuildCampaign(lightningBuild, baseCampaign("normal")).hitByPufferfish], [false, true]);
  lightningBuild.levels["chain-lightning"] = 2;
  assert.deepEqual([mudflatDevBuildCampaign(lightningBuild, baseCampaign("normal")).hitByMosquito, mudflatDevBuildCampaign(lightningBuild, baseCampaign("normal")).hitByPufferfish], [true, true]);
  lightningBuild.autoUnlock = false; lightningBuild.hitByMosquito = true;
  assert.deepEqual([mudflatDevBuildCampaign(lightningBuild, baseCampaign("normal")).hitByMosquito, mudflatDevBuildCampaign(lightningBuild, baseCampaign("normal")).hitByPufferfish], [true, false]);
  // 보관된 간식은 최대 체력에 들어가지 않는다.
  const benched = createMudflatDevBuild("normal");
  benched.levels.snack = 3;
  benched.activeSkills = [];
  assert.equal(mudflatDevBuildCampaign(benched, baseCampaign("normal")).maxHp, mudflatEquipmentStats({ headlamp: 0, cooler: 0, vest: 0, gloves: 0, waders: 0 }, 100, 0).maxHp);
  const noRepellent = mudflatDevBuildCampaign(createMudflatDevBuild("normal"), baseCampaign("normal"));
  assert.equal("mosquitoRepellent" in noRepellent.equipment, false);
});

test("kids builds keep the kids skill list and stamina-based HP", () => {
  const build = createMudflatDevBuild("kids");
  Object.assign(build.levels, { hoe: 3, stamina: 2, salt: 1 });
  build.stage = 5; build.hpPercent = 100;
  const campaign = mudflatDevBuildCampaign(build, baseCampaign("kids", 5));
  assert.equal(campaign.mode, "kids");
  assert.deepEqual(campaign.activeSkills, []);
  assert.equal(campaign.levels.hoe, 3);
  assert.equal(campaign.maxHp, 115 + 36);
  assert.equal(campaign.hp, 115 + 36);
});

test("seed modes reproduce the preset seed, honour a custom seed, or draw a random one", () => {
  const build = createMudflatDevBuild("normal");
  build.stage = 4;
  assert.equal(mudflatDevFixedSeed(4), 20261102 + 4 * 101);
  assert.equal(mudflatDevBuildSeed(build, () => 7), mudflatDevFixedSeed(4));
  build.seedMode = "random";
  assert.equal(mudflatDevBuildSeed(build, () => 7), 7);
  build.seedMode = "custom"; build.seed = 123456;
  assert.equal(mudflatDevBuildSeed(build, () => 7), 123456);
});
