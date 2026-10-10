const db = require("../../config/db");
const slugify = require("slugify");
const { uploadFile, deleteFile } = require("../../utils/cloudinaryUploader");

/* ===== Helper: serialize JSON fields (objects/arrays/JSON strings) ===== */
const jsonOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(value.split("\n").filter(Boolean));
    }
  }
  return JSON.stringify(value);
};

/* ===== Helper: normalize booleans from FormData ("true"/"false" strings) ===== */
const parseBool = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const str = String(value).toLowerCase();
  if (str === "true" || str === "1") return true;
  if (str === "false" || str === "0") return false;
  return fallback;
};

/* ===================== GET ALL PRODUCTS (ADMIN) ===================== */
const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", category = "", brand = "", status = "" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClauses = ["1=1"];
    let params = [];

    if (search) {
      whereClauses.push("(p.name LIKE ? OR p.sku LIKE ? OR p.short_description LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (category) {
      whereClauses.push("p.category_id = ?");
      params.push(category);
    }

    if (brand) {
      whereClauses.push("p.brand_id = ?");
      params.push(brand);
    }

    if (status !== "") {
      whereClauses.push("p.is_active = ?");
      params.push(status === "active" || status === "1" ? 1 : 0);
    }

    const whereSql = whereClauses.join(" AND ");

    // Total count
    const [countResult] = await db.query(
      `SELECT COUNT(*) AS total FROM products p WHERE ${whereSql}`,
      params
    );
    const total = countResult[0].total;

    // Fetch products
    const [products] = await db.query(
      `SELECT p.*,
              c.name AS category_name,
              b.name AS brand_name,
              COALESCE(
                (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1),
                (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1)
              ) AS primary_image,
              (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) AS variant_count
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE ${whereSql}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Admin getAllProducts error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ===================== GET PRODUCT BY ID (ADMIN) ===================== */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const [products] = await db.query(
      `SELECT p.*, c.name AS category_name, b.name AS brand_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.id = ?`,
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const product = products[0];

    // Parse JSON columns for client convenience
    const jsonFields = ["highlights", "key_features", "specifications", "resources", "faqs", "applications", "trust_badges"];
    jsonFields.forEach((field) => {
      if (typeof product[field] === "string" && product[field]) {
        try {
          product[field] = JSON.parse(product[field]);
        } catch {
          /* leave as-is */
        }
      }
    });

    // Images
    const [images] = await db.query(
      "SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC",
      [id]
    );
    product.images = images;

    // Variants
    const [variants] = await db.query("SELECT * FROM product_variants WHERE product_id = ?", [id]);
    product.variants = variants;

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error("Admin getProductById error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ===================== CREATE PRODUCT ===================== */
const createProduct = async (req, res) => {
  try {
    const {
      name,
      category_id,
      brand_id,
      variation_id,
      filament_material_id,
      filament_color_id,
      sku,
      tagline,
      price,
      compare_price,
      stock,
      short_description,
      description,
      highlights,
      key_features,
      specifications,
      pinout_image,
      pinout_description,
      resources,
      faqs,
      applications,
      is_featured,
      is_active,
    } = req.body;

    if (!name || !price || !category_id) {
      return res.status(400).json({
        success: false,
        message: "Name, price, and category are required",
      });
    }
    let slug = slugify(name, { lower: true, strict: true });
    // Check slug collision
    const [existingSlug] = await db.query("SELECT id FROM products WHERE slug = ?", [slug]);
    if (existingSlug.length > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    const [result] = await db.query(
      `INSERT INTO products 
       (name, slug, sku, tagline, category_id, brand_id, variation_id, filament_material_id, filament_color_id, price, compare_price, stock, short_description, description, highlights, key_features, specifications, pinout_image, pinout_description, resources, faqs, applications, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        slug,
        sku || `SKU-${Date.now()}`,
        tagline || null,
        category_id,
        brand_id || null,
        variation_id || null,
        filament_material_id || null,
        filament_color_id || null,
        price,
        compare_price || null,
        stock || 0,
        short_description || null,
        description || null,
        jsonOrNull(highlights),
        jsonOrNull(key_features),
        jsonOrNull(specifications),
        pinout_image || null,
        pinout_description || null,
        jsonOrNull(resources),
        jsonOrNull(faqs),
        jsonOrNull(applications),
        parseBool(is_featured, false) ? 1 : 0,
        parseBool(is_active, true) ? 1 : 0,
      ]
    );

    const productId = result.insertId;

    // Handle pinout image file upload if attached
    if (!pinout_image && req.files && req.files.pinout_image && req.files.pinout_image[0]) {
      const pinoutRes = await uploadFile(req.files.pinout_image[0], "products", "image");
      await db.query("UPDATE products SET pinout_image = ? WHERE id = ?", [pinoutRes.secure_url, productId]);
    }

    // Handle gallery image uploads if attached
    if (req.files && req.files.images && req.files.images.length > 0) {
      for (let i = 0; i < req.files.images.length; i++) {
        const file = req.files.images[i];
        const uploadRes = await uploadFile(file, "products", "image");
        await db.query(
          "INSERT INTO product_images (product_id, image_url, public_id, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)",
          [productId, uploadRes.secure_url, uploadRes.public_id, i === 0 ? 1 : 0, i]
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: { productId, slug },
    });
  } catch (error) {
    console.error("Admin createProduct error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ===================== UPDATE PRODUCT ===================== */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category_id,
      brand_id,
      variation_id,
      filament_material_id,
      filament_color_id,
      sku,
      tagline,
      price,
      compare_price,
      stock,
      short_description,
      description,
      highlights,
      key_features,
      specifications,
      pinout_image,
      pinout_description,
      resources,
      faqs,
      applications,
      is_featured,
      is_active,
    } = req.body;

    const [existing] = await db.query("SELECT id, name FROM products WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    let slug = undefined;
    if (name && name !== existing[0].name) {
      slug = slugify(name, { lower: true, strict: true });
      const [slugCheck] = await db.query("SELECT id FROM products WHERE slug = ? AND id != ?", [slug, id]);
      if (slugCheck.length > 0) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    await db.query(
      `UPDATE products SET
         name = COALESCE(?, name),
         slug = COALESCE(?, slug),
         sku = COALESCE(?, sku),
         tagline = COALESCE(?, tagline),
         category_id = COALESCE(?, category_id),
         brand_id = COALESCE(?, brand_id),
         variation_id = CASE WHEN ? THEN NULL ELSE COALESCE(?, variation_id) END,
         filament_material_id = CASE WHEN ? THEN NULL ELSE COALESCE(?, filament_material_id) END,
         filament_color_id = CASE WHEN ? THEN NULL ELSE COALESCE(?, filament_color_id) END,
         price = COALESCE(?, price),
         compare_price = COALESCE(?, compare_price),
         stock = COALESCE(?, stock),
         short_description = COALESCE(?, short_description),
         description = COALESCE(?, description),
         highlights = COALESCE(?, highlights),
         key_features = COALESCE(?, key_features),
         specifications = COALESCE(?, specifications),
         pinout_image = COALESCE(?, pinout_image),
         pinout_description = COALESCE(?, pinout_description),
         resources = COALESCE(?, resources),
         faqs = COALESCE(?, faqs),
         applications = COALESCE(?, applications),
         is_featured = COALESCE(?, is_featured),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name || null,
        slug || null,
        sku || null,
        tagline !== undefined ? tagline : null,
        category_id || null,
        brand_id !== undefined ? brand_id : null,
        variation_id === "" ? 1 : 0,
        variation_id !== undefined && variation_id !== "" ? variation_id : null,
        filament_material_id === "" ? 1 : 0,
        filament_material_id !== undefined && filament_material_id !== "" ? filament_material_id : null,
        filament_color_id === "" ? 1 : 0,
        filament_color_id !== undefined && filament_color_id !== "" ? filament_color_id : null,
        price || null,
        compare_price !== undefined ? compare_price : null,
        stock !== undefined ? stock : null,
        short_description !== undefined ? short_description : null,
        description !== undefined ? description : null,
        jsonOrNull(highlights),
        jsonOrNull(key_features),
        jsonOrNull(specifications),
        pinout_image !== undefined ? pinout_image : null,
        pinout_description !== undefined ? pinout_description : null,
        jsonOrNull(resources),
        jsonOrNull(faqs),
        jsonOrNull(applications),
        parseBool(is_featured) !== null ? (parseBool(is_featured) ? 1 : 0) : null,
        parseBool(is_active) !== null ? (parseBool(is_active) ? 1 : 0) : null,
        id,
      ]
    );

    // Handle pinout image file upload if attached
    if (req.files && req.files.pinout_image && req.files.pinout_image[0]) {
      const pinoutRes = await uploadFile(req.files.pinout_image[0], "products", "image");
      await db.query("UPDATE products SET pinout_image = ? WHERE id = ?", [pinoutRes.secure_url, id]);
    }

    // Append gallery image uploads if attached
    if (req.files && req.files.images && req.files.images.length > 0) {
      const [existingImages] = await db.query("SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?", [id]);
      let sortOrder = existingImages[0].count;
      for (const file of req.files.images) {
        const uploadRes = await uploadFile(file, "products", "image");
        await db.query(
          "INSERT INTO product_images (product_id, image_url, public_id, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)",
          [id, uploadRes.secure_url, uploadRes.public_id, 0, sortOrder++]
        );
      }
    }

    return res.status(200).json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    console.error("Admin updateProduct error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ===================== DELETE PRODUCT ===================== */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // We can toggle inactive or delete
    const [result] = await db.query("UPDATE products SET is_active = 0 WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.status(200).json({ success: true, message: "Product deactivated successfully" });
  } catch (error) {
    console.error("Admin deleteProduct error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ===================== ADD PRODUCT IMAGE ===================== */
const addProductImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const uploadRes = await uploadFile(req.file, "products", "image");

    const [existingImages] = await db.query("SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?", [id]);
    const isPrimary = existingImages[0].count === 0 ? 1 : 0;

    const [insertRes] = await db.query(
      "INSERT INTO product_images (product_id, image_url, public_id, is_primary, sort_order) VALUES (?, ?, ?, ?, ?)",
      [id, uploadRes.secure_url, uploadRes.public_id, isPrimary, existingImages[0].count]
    );

    return res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        id: insertRes.insertId,
        image_url: uploadRes.secure_url,
        is_primary: isPrimary,
      },
    });
  } catch (error) {
    console.error("Admin addProductImage error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ===================== DELETE PRODUCT IMAGE ===================== */
const deleteProductImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    const [images] = await db.query("SELECT * FROM product_images WHERE id = ?", [imageId]);
    if (images.length === 0) {
      return res.status(404).json({ success: false, message: "Image not found" });
    }

    const img = images[0];
    if (img.public_id) {
      await deleteFile(img.public_id, "image");
    }

    await db.query("DELETE FROM product_images WHERE id = ?", [imageId]);

    // If deleted image was primary, set another as primary
    if (img.is_primary) {
      await db.query(
        "UPDATE product_images SET is_primary = 1 WHERE product_id = ? ORDER BY id ASC LIMIT 1",
        [img.product_id]
      );
    }

    return res.status(200).json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Admin deleteProductImage error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ===================== SET PRIMARY IMAGE ===================== */
const setPrimaryImage = async (req, res) => {
  try {
    const { productId, imageId } = req.params;

    await db.query("UPDATE product_images SET is_primary = 0 WHERE product_id = ?", [productId]);
    const [result] = await db.query(
      "UPDATE product_images SET is_primary = 1 WHERE id = ? AND product_id = ?",
      [imageId, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Image not found for this product" });
    }

    return res.status(200).json({ success: true, message: "Primary image updated" });
  } catch (error) {
    console.error("Admin setPrimaryImage error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ===================== VARIANT MANAGEMENT ===================== */
const addVariant = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variant_name, variant_value, sku, price_adjustment, stock } = req.body;

    if (!variant_name || !variant_value) {
      return res.status(400).json({ success: false, message: "Variant name and value are required" });
    }

    const [result] = await db.query(
      "INSERT INTO product_variants (product_id, variant_name, variant_value, sku, price_adjustment, stock) VALUES (?, ?, ?, ?, ?, ?)",
      [productId, variant_name, variant_value, sku || null, price_adjustment || 0, stock || 0]
    );

    return res.status(201).json({
      success: true,
      message: "Variant added successfully",
      data: { variantId: result.insertId },
    });
  } catch (error) {
    console.error("Admin addVariant error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateVariant = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { variant_name, variant_value, sku, price_adjustment, stock } = req.body;

    const [result] = await db.query(
      `UPDATE product_variants SET
         variant_name = COALESCE(?, variant_name),
         variant_value = COALESCE(?, variant_value),
         sku = COALESCE(?, sku),
         price_adjustment = COALESCE(?, price_adjustment),
         stock = COALESCE(?, stock)
       WHERE id = ?`,
      [variant_name || null, variant_value || null, sku || null, price_adjustment !== undefined ? price_adjustment : null, stock !== undefined ? stock : null, variantId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    return res.status(200).json({ success: true, message: "Variant updated successfully" });
  } catch (error) {
    console.error("Admin updateVariant error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteVariant = async (req, res) => {
  try {
    const { variantId } = req.params;
    const [result] = await db.query("DELETE FROM product_variants WHERE id = ?", [variantId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    return res.status(200).json({ success: true, message: "Variant deleted successfully" });
  } catch (error) {
    console.error("Admin deleteVariant error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductImage,
  deleteProductImage,
  setPrimaryImage,
  addVariant,
  updateVariant,
  deleteVariant,
};
