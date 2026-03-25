CREATE TABLE `ingredient_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_id` text NOT NULL,
	`name` text NOT NULL,
	`name_he` text,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recipe_ingredient_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_ingredient_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_ingredient_id`) REFERENCES `recipe_ingredients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `ingredient_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `shopping_list_items` ADD `chosen_variant_id` text REFERENCES ingredient_variants(id);