export type Screen = "setup" | "running" | "upgrade" | "paused" | "camp" | "defeat" | "daily-result";
export type GameMode = "kids" | "normal";
export type Point = { x: number; y: number };
export type CountMap = Record<string, number>;
export type StageObjective = { id: "catch" | "rocks" | "health"; label: string; target: number; bonus: number };
export type StageProfile = {
  stage: number;
  name: string;
  subtitle: string;
  modifiers: string[];
  waterChannels: boolean;
  tideInterval: number;
  safeZone: string;
  rockMultiplier: number;
  fallingRocks: number;
  darkness: number;
  mudSlow: number;
  seafoodSpawnMultiplier: number;
  wind: number;
  mosquitoes: boolean;
  swarms: boolean;
  coldThresholdMultiplier: number;
  finalBoss: boolean;
  endless: boolean;
  objective: StageObjective | null;
};
export type CreatureMovement = "chase" | "still" | "wander" | "flee" | "oval";
export type DeepMudPatch = Point & { radiusX: number; radiusY: number; angle: number; hash: number };
export type CharacterOption = {
  id: string;
  icon: string;
  sprite?: string;
  portrait?: string;
  spriteSheet?: boolean;
  name: string;
  description: string;
  startLabel: string;
  levels: CountMap;
  hp: number;
};
export type Campaign = {
  version: 1;
  mode: GameMode;
  characterId: string;
  stage: number;
  coins: number;
  hp: number;
  maxHp: number;
  baseMaxHp: number;
  level: number;
  xp: number;
  nextXp: number;
  /** 기술 인벤토리: 보관 중인 기술도 레벨을 유지한다. */
  levels: CountMap;
  /** 원정에서 작동하는 선택 기술(최대 6개). 집게·호미질은 항상 작동한다. */
  activeSkills: string[];
  equipment: CountMap;
  inventory: CountMap;
  lastHaul: CountMap;
  lastSaleValue: number;
  totalScore: number;
  lastBossCaught: boolean;
  /** 캠페인 누적으로 주운 경험치 보석 수. 소쿠리의 달인 해금에 쓴다. */
  gemsCollected: number;
  /** 플레이어가 직접 끝낸 호미질 수(캠페인 누적). 호미봇 해금에 쓴다. */
  digsCompleted: number;
  /** 게·새우에게 피해를 받은 경험(캠페인 누적). 파이어볼·화염 방사 해금에 쓴다. */
  hitByCrab: boolean;
  hitByShrimp: boolean;
  hitByRock: boolean;
  hitByTide: boolean;
  lastObjectiveLabel?: string;
  lastObjectiveComplete?: boolean;
  lastObjectiveBonus?: number;
  pendingSkillDiscovery?: boolean;
};
