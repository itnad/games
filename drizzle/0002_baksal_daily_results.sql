CREATE TABLE `baksal_daily_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`challenge_date` text NOT NULL,
	`participant_id` text NOT NULL,
	`display_name` text NOT NULL,
	`seed` integer NOT NULL,
	`bpm` integer NOT NULL,
	`reinforced` integer DEFAULT false NOT NULL,
	`score` integer NOT NULL,
	`rooms_cleared` integer NOT NULL,
	`max_combo` integer NOT NULL,
	`remaining_hp` integer NOT NULL,
	`purified` integer NOT NULL,
	`dodges` integer NOT NULL,
	`ttak` integer NOT NULL,
	`judged` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`lenient` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `baksal_daily_results_date_participant_unique` ON `baksal_daily_results` (`challenge_date`,`participant_id`);--> statement-breakpoint
CREATE INDEX `baksal_daily_results_ranking_index` ON `baksal_daily_results` (`challenge_date`,`score`);