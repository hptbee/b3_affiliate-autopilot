-- Affiliate products and offers. Product URL and affiliate URL stay in separate columns.
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_product_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`price` text,
	`original_price` text,
	`rating` text,
	`sales_count` integer,
	`images` text DEFAULT '[]' NOT NULL,
	`product_url` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_user_provider_external_idx` ON `products` (`user_id`,`provider`,`external_product_id`);
--> statement-breakpoint
CREATE INDEX `products_user_provider_idx` ON `products` (`user_id`,`provider`);
--> statement-breakpoint
CREATE TABLE `affiliate_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`provider` text NOT NULL,
	`affiliate_url` text NOT NULL,
	`tracking_code` text,
	`commission_rate` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `affiliate_offers_product_url_idx` ON `affiliate_offers` (`product_id`,`affiliate_url`);
--> statement-breakpoint
CREATE INDEX `affiliate_offers_user_idx` ON `affiliate_offers` (`user_id`);
--> statement-breakpoint
CREATE INDEX `affiliate_offers_product_idx` ON `affiliate_offers` (`product_id`);
