import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../../public/css/product.css";
import SkeletonCard from "../components/Loaders/SkeletonCard";
import catalogService, { normalizeProduct } from "../services/catalog.service";
import cartService from "../services/cart.service";
import { syncCartBadge } from "../utils/cartSync";

const DUMMY_IMAGE = "/images/products/01.png";

export default function Filaments() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failedImages, setFailedImages] = useState({});
  const [addedCartIds, setAddedCartIds] = useState([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await catalogService.getProducts({
          limit: 100,
          category: "3d-printing-filaments",
        });
        if (active) {
          setItems((response.data.products || []).map(normalizeProduct));
        }
      } catch (error) {
        if (active) {
          setItems([]);
          toast.error(error?.response?.data?.message || "Unable to load filaments");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleAddToCart = async (e, product) => {
    e.stopPropagation();
    if (!localStorage.getItem("token")) {
      toast.info("Please login before adding to cart");
      navigate("/login", { state: { from: "/filaments" } });
      return;
    }
    try {
      await cartService.addItem({ product_id: product.id, quantity: 1 });
      setAddedCartIds((prev) => [...prev, product.id]);
      toast.success(`Added "${product.name}" to cart!`);
      syncCartBadge();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to add to cart");
    }
  };

  const subtitle = (product) =>
    [product.filament_material_name, product.filament_color_name]
      .filter(Boolean)
      .join(" • ");

  return (
    <div className="products-page">
      <div className="products-container">
        <div className="products-breadcrumb">
          <Link to="/">Home</Link>
          <span>&gt;</span>
          <span className="products-breadcrumb-current">3D Printing Filaments</span>
        </div>

        <div className="products-header">
          <div>
            <h1 className="products-title">3D Printing Filaments</h1>
            <p className="products-subtitle">
              Ready-to-print spools by material and color — {items.length} item{items.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="products-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="admin-empty">No filaments available yet — check back soon.</div>
        ) : (
          <div className="products-grid">
            {items.map((product) => {
              const isAdded = addedCartIds.includes(product.id);
              return (
                <div
                  key={product.id}
                  className="product-card"
                  onClick={() => navigate(`/products/${product.slug || product.id}`)}
                >
                  {product.tag && (
                    <span className={`product-badge ${product.tag.toLowerCase()}`}>
                      {product.tag}
                    </span>
                  )}
                  <div className="product-image-box">
                    <img
                      src={failedImages[product.id] ? DUMMY_IMAGE : product.image}
                      alt={product.name}
                      className="product-img"
                      loading="lazy"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                      }
                    />
                  </div>
                  <div className="product-card-body">
                    <h4 className="product-card-title" title={product.name}>
                      {product.name}
                    </h4>
                    {subtitle(product) && (
                      <div className="product-card-subtitle">{subtitle(product)}</div>
                    )}
                    <div className="product-price-row">
                      <span className="product-price">
                        ₹{Number(product.price || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="product-bottom-row">
                      <div className="product-bottom-left">
                        <span className="product-stock-text">
                          {Number(product.stock || 0) > 0 ? "In Stock" : "Out of Stock"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`btn-add-cart ${isAdded ? "added" : ""}`}
                        onClick={(e) => handleAddToCart(e, product)}
                        title="Add to Cart"
                      >
                        <i className={`bi ${isAdded ? "bi-check2" : "bi-cart3"}`}></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
