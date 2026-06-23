-- Maayan's personal food list flags on the canonical ingredient bank.
-- `is_maayan`  : the food is on Maayan's list (rendered as a purple dot in the UI)
-- `maayan_top` : the extra-recommended subset (the bold items on her sheet)
--
-- NOTE: `drizzle-kit generate` also wanted to rebuild several tables here because
-- the meta snapshot baseline had drifted (shopping_lists.version, users.password_salt,
-- the *_variant tables, …) — all of which already exist in the live databases. Those
-- are unrelated to this change, so this migration is trimmed to only the two new
-- columns. The regenerated snapshot (0002_snapshot.json) captures the full current
-- schema and is a clean baseline for future diffs.
ALTER TABLE `ingredients` ADD `is_maayan` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ingredients` ADD `maayan_top` integer DEFAULT false NOT NULL;
