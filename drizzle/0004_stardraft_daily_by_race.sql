DROP INDEX `stardraft_daily_results_date_participant_unique`;--> statement-breakpoint
DROP INDEX `stardraft_daily_results_ranking_index`;--> statement-breakpoint
ALTER TABLE `stardraft_daily_results` ADD `player_race` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `stardraft_daily_results_date_race_participant_unique` ON `stardraft_daily_results` (`challenge_date`,`player_race`,`participant_id`);--> statement-breakpoint
CREATE INDEX `stardraft_daily_results_race_ranking_index` ON `stardraft_daily_results` (`challenge_date`,`player_race`,`elapsed_ticks`);