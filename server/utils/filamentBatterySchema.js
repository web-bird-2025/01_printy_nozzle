const db = require("../config/db");

/**
 * Self-healing schema for storefront special catalogs.
 *
 * - Ensures the "3D Printing Filaments" and "Lithium Battery Packs"
 *   categories exist (fixed slugs the storefront filters on).
 * - products.filament_material_id / filament_color_id link a filament
 *   product to its printing material + color (nullable, SET NULL on delete).
 * - Battery-pack specs live in products.specifications JSON (no columns).
 *
 * Idempotent — safe to require on every boot.
 */

const SPECIAL_CATEGORIES = [
  {
    name: "3D Printing Filaments",
    slug: "3d-printing-filaments",
    description: "Ready-to-print filament spools by material and color.",
    sort_order: 20,
  },
  {
    name: "Lithium Battery Packs",
    slug: "lithium-battery-packs",
    description: "Prebuilt and custom lithium battery packs.",
    sort_order: 21,
  },
];

let warned = false;

const ensureSpecialCatalogSchema = async () => {
  try {
    const conn = await db.getConnection();
    try {
      for (const cat of SPECIAL_CATEGORIES) {
        try {
          await conn.query(
            `INSERT INTO categories (name, slug, description, sort_order, is_active)
             VALUES (?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE description = VALUES(description)`,
            [cat.name, cat.slug, cat.description, cat.sort_order]
          );
        } catch (e) {
          if (!warned) console.warn(`⚠️ Could not seed category ${cat.slug}:`, e.message);
        }
      }

      for (const [col, after] of [
        ["filament_material_id", "brand_id"],
        ["filament_color_id", "filament_material_id"],
      ]) {
        try {
          const [exists] = await conn.query(
            `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = ? LIMIT 1`,
            [col]
          );
          if (!exists.length) {
            await conn.query(`ALTER TABLE \`products\` ADD COLUMN \`${col}\` INT NULL AFTER \`${after}\``);
            console.log(`✅ products.${col} column added`);
          }
        } catch (e) {
          if (!warned) console.warn(`⚠️ Could not add products.${col}:`, e.message);
        }
      }

      // Foreign keys (best-effort).
      for (const [fk, col, ref] of [
        ["fk_products_filament_material", "filament_material_id", "printing_materials"],
        ["fk_products_filament_color", "filament_color_id", "printing_colors"],
      ]) {
        try {
          const [found] = await conn.query(
            `SELECT 1 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND CONSTRAINT_NAME = ? LIMIT 1`,
            [fk]
          );
          if (!found.length) {
            await conn.query(
              `ALTER TABLE \`products\` ADD CONSTRAINT \`${fk}\` FOREIGN KEY (\`${col}\`) REFERENCES \`${ref}\` (\`id\`) ON DELETE SET NULL`
            );
            console.log(`✅ products.${col} foreign key added`);
          }
        } catch (e) {
          if (!warned) console.warn(`⚠️ products.${col} FK skipped:`, e.message);
        }
      }

      console.log("🧩 Special catalogs ready (filaments + battery packs)");
    } finally {
      conn.release();
    }
  } catch (e) {
    if (!warned) {
      warned = true;
      console.warn(`⚠️ special catalog schema check skipped: ${e.message}`);
    }
  }
};

// Fire-and-forget on require so fresh deploys self-heal without manual SQL.
ensureSpecialCatalogSchema().catch(() => {});

module.exports = {
  ensureSpecialCatalogSchema,
  FILAMENT_CATEGORY_SLUG: "3d-printing-filaments",
  BATTERY_CATEGORY_SLUG: "lithium-battery-packs",
};
