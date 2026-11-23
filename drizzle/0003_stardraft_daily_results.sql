CREATE TABLE `stardraft_daily_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`challenge_date` text NOT NULL,
	`participant_id` text NOT NULL,
	`display_name` text NOT NULL,
	`seed` integer NOT NULL,
	`elapsed_ticks` integer NOT NULL,
	`lost_value` integer NOT NULL,
	`build` text DEFAULT '' NOT NULL,
	`replay` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stardraft_daily_results_date_participant_unique` ON `stardraft_daily_results` (`challenge_date`,`participant_id`);--> statement-breakpoint
CREATE INDEX `stardraft_daily_results_ranking_index` ON `stardraft_daily_results` (`challenge_date`,`elapsed_ticks`);