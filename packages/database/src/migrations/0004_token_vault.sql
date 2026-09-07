CREATE TABLE `token_vault` (
	`ref` text PRIMARY KEY NOT NULL,
	`ciphertext` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
