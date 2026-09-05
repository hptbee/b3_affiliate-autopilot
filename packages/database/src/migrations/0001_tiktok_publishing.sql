-- TikTok-first publishing fields. Video binaries stay in R2; D1 holds metadata only.
ALTER TABLE `media` ADD COLUMN `duration` integer;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD COLUMN `queued_at` integer;--> statement-breakpoint
ALTER TABLE `scheduled_posts` ADD COLUMN `publishing_started_at` integer;
