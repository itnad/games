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
