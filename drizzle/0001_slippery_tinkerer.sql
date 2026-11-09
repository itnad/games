CREATE TABLE `mudflat_daily_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`challenge_date` text NOT NULL,
	`participant_id` text NOT NULL,
	`display_name` text NOT NULL,
	`stage` integer NOT NULL,
	`seed` integer NOT NULL,
	`score` integer NOT NULL,
	`caught` integer NOT NULL,
	`elapsed` integer NOT NULL,
	`remaining_hp` integer NOT NULL,
	`boss_caught` integer DEFAULT false NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mudflat_daily_results_date_participant_unique` ON `mudflat_daily_results` (`challenge_date`,`participant_id`);--> statement-breakpoint
CREATE INDEX `mudflat_daily_results_ranking_index` ON `mudflat_daily_results` (`challenge_date`,`completed`,`score`);