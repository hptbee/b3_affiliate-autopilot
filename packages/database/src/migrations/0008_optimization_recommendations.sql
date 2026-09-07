CREATE TABLE `optimization_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL DEFAULT 'pending',
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`rationale` text NOT NULL,
	`priority` text NOT NULL,
	`product_id` text,
	`content_id` text,
	`affiliate_offer_id` text,
	`evidence` text NOT NULL,
	`ai_reasoning` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`reviewed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`affiliate_offer_id`) REFERENCES `affiliate_offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `optimization_recommendations_user_status_idx` ON `optimization_recommendations` (`user_id`,`status`);
