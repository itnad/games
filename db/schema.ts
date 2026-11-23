import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const gameSuggestions = sqliteTable("game_suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
});

export const mudflatDailyResults = sqliteTable("mudflat_daily_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  challengeDate: text("challenge_date").notNull(),
  participantId: text("participant_id").notNull(),
  displayName: text("display_name").notNull(),
  stage: integer("stage").notNull(),
  seed: integer("seed").notNull(),
  score: integer("score").notNull(),
  caught: integer("caught").notNull(),
  elapsed: integer("elapsed").notNull(),
  remainingHp: integer("remaining_hp").notNull(),
  bossCaught: integer("boss_caught", { mode: "boolean" }).notNull().default(false),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("mudflat_daily_results_date_participant_unique").on(table.challengeDate, table.participantId),
  index("mudflat_daily_results_ranking_index").on(table.challengeDate, table.completed, table.score),
]);

export const baksalDailyResults = sqliteTable("baksal_daily_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  challengeDate: text("challenge_date").notNull(),
  participantId: text("participant_id").notNull(),
  displayName: text("display_name").notNull(),
  seed: integer("seed").notNull(),
  bpm: integer("bpm").notNull(),
  reinforced: integer("reinforced", { mode: "boolean" }).notNull().default(false),
  score: integer("score").notNull(),
  roomsCleared: integer("rooms_cleared").notNull(),
  maxCombo: integer("max_combo").notNull(),
  remainingHp: integer("remaining_hp").notNull(),
  purified: integer("purified").notNull(),
  dodges: integer("dodges").notNull(),
  ttak: integer("ttak").notNull(),
  judged: integer("judged").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  lenient: integer("lenient", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("baksal_daily_results_date_participant_unique").on(table.challengeDate, table.participantId),
  index("baksal_daily_results_ranking_index").on(table.challengeDate, table.score),
]);

export const stardraftDailyResults = sqliteTable("stardraft_daily_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  challengeDate: text("challenge_date").notNull(),
  participantId: text("participant_id").notNull(),
  displayName: text("display_name").notNull(),
  seed: integer("seed").notNull(),
  // 승리까지 걸린 경기 시간(틱, 0.1초)과 잃은 병력 가치. 순위는 시간이 짧은 순, 같으면 잃은 가치가 적은 순이다.
  elapsedTicks: integer("elapsed_ticks").notNull(),
  lostValue: integer("lost_value").notNull(),
  // 그 경기를 다시 돌릴 수 있는 재현 코드(JSON)와 기록한 게임 판.
  build: text("build").notNull().default(""),
  replay: text("replay").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("stardraft_daily_results_date_participant_unique").on(table.challengeDate, table.participantId),
  index("stardraft_daily_results_ranking_index").on(table.challengeDate, table.elapsedTicks),
]);
