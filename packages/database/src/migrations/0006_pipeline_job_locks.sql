CREATE TABLE `pipeline_job_locks` (
	`job_name` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL DEFAULT 'idle',
	`owner_id` text,
	`started_at` integer,
	`lease_expires_at` integer,
	`last_completed_at` integer,
	`last_result` text,
	`last_error` text,
	`updated_at` integer NOT NULL
);
