CREATE TABLE `post_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduled_post_id` text NOT NULL,
	`content_id` text NOT NULL,
	`social_account_id` text NOT NULL,
	`platform` text NOT NULL,
	`external_post_id` text NOT NULL,
	`product_id` text,
	`affiliate_offer_id` text,
	`published_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scheduled_post_id`) REFERENCES `scheduled_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`social_account_id`) REFERENCES `social_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`affiliate_offer_id`) REFERENCES `affiliate_offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_publications_scheduled_post_id_idx` ON `post_publications` (`scheduled_post_id`);
--> statement-breakpoint
CREATE INDEX `post_publications_content_id_idx` ON `post_publications` (`content_id`);
--> statement-breakpoint
CREATE INDEX `post_publications_product_id_idx` ON `post_publications` (`product_id`);
--> statement-breakpoint
CREATE TABLE `post_metric_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`publication_id` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`impressions` integer,
	`reach` integer,
	`clicks` integer,
	`reactions` integer,
	`comments` integer,
	`shares` integer,
	`engagements` integer,
	`raw_metrics` text,
	`fetch_error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`publication_id`) REFERENCES `post_publications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_metric_snapshots_publication_fetched_idx` ON `post_metric_snapshots` (`publication_id`,`fetched_at`);
