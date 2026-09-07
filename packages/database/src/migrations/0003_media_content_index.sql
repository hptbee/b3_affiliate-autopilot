-- Index media lookups by content for list/get endpoints.
CREATE INDEX `media_content_id_idx` ON `media` (`content_id`);
