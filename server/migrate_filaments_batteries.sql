-- Printynozzle filaments + lithium battery packs migration
-- Run in phpMyAdmin for existing DBs (new installs get this via query.sql + self-heal).

INSERT INTO categories (name, slug, description, sort_order, is_active) VALUES
('3D Printing Filaments', '3d-printing-filaments', 'Ready-to-print filament spools by material and color.', 20, 1),
('Lithium Battery Packs', 'lithium-battery-packs', 'Prebuilt and custom lithium battery packs.', 21, 1)
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- NOTE: plain ALTER (this MySQL version does not support ADD COLUMN IF NOT EXISTS).
-- Safe to run once; re-running will report "duplicate column" which can be ignored.
ALTER TABLE `products` ADD COLUMN `filament_material_id` INT NULL AFTER `brand_id`;
ALTER TABLE `products` ADD COLUMN `filament_color_id` INT NULL AFTER `filament_material_id`;
