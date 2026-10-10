-- Printynozzle company / GST details migration (optional B2B fields on orders)
-- Run in phpMyAdmin for existing DBs (new installs get this via query.sql + self-heal).

ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `company_name` VARCHAR(200) NULL AFTER `shipping_country`;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `company_address` VARCHAR(500) NULL AFTER `company_name`;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `company_gstin` VARCHAR(20) NULL AFTER `company_address`;

ALTER TABLE `printing_orders` ADD COLUMN IF NOT EXISTS `company_name` VARCHAR(200) NULL AFTER `shipping_pincode`;
ALTER TABLE `printing_orders` ADD COLUMN IF NOT EXISTS `company_address` VARCHAR(500) NULL AFTER `company_name`;
ALTER TABLE `printing_orders` ADD COLUMN IF NOT EXISTS `company_gstin` VARCHAR(20) NULL AFTER `company_address`;

ALTER TABLE `manual_invoices` ADD COLUMN IF NOT EXISTS `company_name` VARCHAR(200) NULL AFTER `customer_phone`;
ALTER TABLE `manual_invoices` ADD COLUMN IF NOT EXISTS `company_address` VARCHAR(500) NULL AFTER `company_name`;
ALTER TABLE `manual_invoices` ADD COLUMN IF NOT EXISTS `company_gstin` VARCHAR(20) NULL AFTER `company_address`;
ALTER TABLE `manual_invoices` ADD COLUMN IF NOT EXISTS `round_total` DECIMAL(10,2) NULL AFTER `discount`;
ALTER TABLE `manual_invoices` ADD COLUMN IF NOT EXISTS `file_name` VARCHAR(300) NULL AFTER `invoice_number`;
ALTER TABLE `manual_invoice_items` ADD COLUMN IF NOT EXISTS `battery_specs` TEXT NULL AFTER `surface_finish`;
ALTER TABLE `manual_invoice_items` MODIFY COLUMN `item_type` ENUM('product', 'print', 'custom', 'battery') DEFAULT 'product';

-- Company GSTIN printed on invoices (fills only empty slots)
INSERT INTO site_settings (setting_key, setting_value, setting_type, description) VALUES
('company_gstin', '19EINPB6126F1Z8', 'string', 'Company GSTIN printed on invoices (blank = hidden)')
ON DUPLICATE KEY UPDATE description = VALUES(description), setting_value = IF(setting_value IS NULL OR setting_value = '', VALUES(setting_value), setting_value);
