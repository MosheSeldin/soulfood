CREATE TABLE `aisle_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_he` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`icon` text
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_he` text,
	`aisle_category_id` text,
	`default_unit` text,
	FOREIGN KEY (`aisle_category_id`) REFERENCES `aisle_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_name_unique` ON `ingredients` (`name`);--> statement-breakpoint
CREATE TABLE `pantry_items` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text NOT NULL,
	`quantity` real,
	`unit` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`ingredient_id` text,
	`quantity` real,
	`unit` text,
	`original_text` text,
	`original_text_he` text,
	`preparation` text,
	`is_optional` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`title_he` text,
	`description` text,
	`source_url` text,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`image_url` text,
	`servings` integer,
	`prep_time_minutes` integer,
	`cook_time_minutes` integer,
	`total_time_minutes` integer,
	`instructions` text,
	`tags` text,
	`category` text,
	`cuisine` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shopping_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`shopping_list_id` text NOT NULL,
	`ingredient_id` text,
	`custom_name` text,
	`quantity` real,
	`unit` text,
	`is_checked` integer DEFAULT false NOT NULL,
	`aisle_category_id` text,
	`source_recipes` text,
	`added_manually` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`shopping_list_id`) REFERENCES `shopping_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aisle_category_id`) REFERENCES `aisle_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shopping_list_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`shopping_list_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`servings` integer,
	FOREIGN KEY (`shopping_list_id`) REFERENCES `shopping_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shopping_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
