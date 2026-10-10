import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../../public/css/product.css";
import SkeletonCard from "../components/Loaders/SkeletonCard";
import catalogService, { normalizeProduct } from "../services/catalog.service";
import cartService from "../services/cart.service";
import { syncCartBadge } from "../utils/cartSync";

const DUMMY_IMAGE = "/images/products/01.png";
const FALLBACK_WHATSAPP = "919836609063";

// Series presets: voltage is fixed per chemistry — no manual voltage input.
const SERIES_PRESETS = {
  NMC: [
    { s: "1S", v: "3.7V" },
    { s: "2S", v: "7.4V" },
    { s: "3S", v: "12V" },
    { s: "4S", v: "16V" },
    { s: "5S", v: "21V" },
    { s: "6S", v: "24V" },
    { s: "7S", v: "24V" },
    { s: "10S", v: "36V" },
    { s: "13S", v: "48V" },
    { s: "16S", v: "60V" },
  ],
  LFP: [
    { s: "4S", v: "12V" },
    { s: "8S", v: "24V" },
    { s: "11S", v: "36V" },
    { s: "15S", v: "48V" },
    { s: "19S", v: "60V" },
  ],
};

const chemistryGroup = (chemistry) => {
  if (chemistry === "LiFePO4") return "LFP";
  if (chemistry === "Li-ion" || chemistry === "LiPo") return "NMC";
  return "";
};

const seriesVoltageFor = (cells) => {
  const all = [...SERIES_PRESETS.NMC, ...SERIES_PRESETS.LFP];
  return (all.find((p) => p.s === cells) || {}).v || "";
};

const blankCustom = () => ({
  fullName: "",
  email: "",
  phone: "",
  address: "",
  pincode: "",
  state: "",
  company: "",
  gstin: "",
  chemistry: "",
  cellS: "",
  cellP: "",
  cellModel: "",
  capacityMah: "",
  voltage: "",
  contAmp: "",
  peakAmp: "",
  bms: "Yes",
  connector: "",
  dimL: "",
  dimW: "",
  dimH: "",
  quantity: "1",
  note: "",
});

export default function Batteries() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failedImages, setFailedImages] = useState({});
  const [addedCartIds, setAddedCartIds] = useState([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState(blankCustom());
  const [sending, setSending] = useState(false);
  const [waNumber, setWaNumber] = useState(FALLBACK_WHATSAPP);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const [productsRes, contactRes] = await Promise.all([
          catalogService.getProducts({ limit: 100, category: "lithium-battery-packs" }),
          catalogService.getContactInfo().catch(() => null),
        ]);
        if (!active) return;
        setItems((productsRes.data.products || []).map(normalizeProduct));
        const wa = contactRes?.data?.data?.contactInfo?.whatsapp || "";
        const digits = String(wa).replace(/\D/g, "");
        if (digits) setWaNumber(digits);
      } catch (error) {
        if (active) {
          setItems([]);
          toast.error(error?.response?.data?.message || "Unable to load battery packs");
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
      navigate("/login", { state: { from: "/batteries" } });
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

  const set = (patch) => setCustom((prev) => ({ ...prev, ...patch }));

  const sendCustomEnquiry = (e) => {
    e.preventDefault();
    const required = [
      ["chemistry", "Battery chemistry"],
      ["email", "Email id"],
      ["capacityMah", "Max battery pack capacity"],
      ["fullName", "Full name"],
      ["cellS", "Pack configuration (series)"],
      ["contAmp", "Current consumption (continuous)"],
      ["peakAmp", "Current consumption (peak)"],
      ["phone", "Contact number"],
    ];
    for (const [key, label] of required) {
      if (!String(custom[key] || "").trim()) {
        toast.warn(`Please enter ${label}.`);
        return;
      }
    }
    if (!custom.email.includes("@")) {
      toast.warn("Please enter a valid email id.");
      return;
    }
    if (custom.phone.replace(/\D/g, "").length < 10) {
      toast.warn("Please enter a valid 10-digit contact number.");
      return;
    }
    if (custom.gstin.trim() && custom.gstin.trim().length > 20) {
      toast.warn("GST Number looks too long (max 20 characters).");
      return;
    }
    setSending(true);
    try {
      const nominalVoltage = seriesVoltageFor(custom.cellS) || custom.voltage.trim();
      const lines = [
        "*Custom Lithium Battery Pack Enquiry — Printynozzle*",
        "------------------------------",
        "*Contact Details*",
        `Name: ${custom.fullName.trim()}`,
        `Email: ${custom.email.trim()}`,
        `Phone: ${custom.phone.trim()}`,
        `Address: ${custom.address.trim() || "-"}`,
        `Pincode: ${custom.pincode.trim() || "-"}`,
        `State: ${custom.state.trim() || "-"}`,
      ];
      if (custom.company.trim()) lines.push(`Company: ${custom.company.trim()}`);
      if (custom.gstin.trim()) lines.push(`GSTIN: ${custom.gstin.trim().toUpperCase()}`);
      lines.push(
        "------------------------------",
        "*Battery Requirements*",
        `Chemistry: ${custom.chemistry}`,
        `Configuration: ${custom.cellS || "?"}${custom.cellP ? ` x ${custom.cellP}P` : ""}`,
        `Capacity: ${custom.capacityMah.trim()} mAh`,
        `Nominal Voltage: ${nominalVoltage || "-"}`,
        `Continuous Current: ${custom.contAmp.trim()} Amp`,
        `Peak Current: ${custom.peakAmp.trim()} Amp`,
        `BMS Required: ${custom.bms}`,
        `Connector Type: ${custom.connector.trim() || "-"}`,
        `Dimensions (L×W×H mm): ${[custom.dimL, custom.dimW, custom.dimH].map((v) => v.trim() || "-").join(" × ")}`,
        `Preferred Cell: ${custom.cellModel || "-"}`,
        `Quantity: ${custom.quantity.trim() || "1"}`
      );
      if (custom.note.trim()) lines.push(`Note: ${custom.note.trim()}`);
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
      toast.success("Opening WhatsApp with your enquiry — press send there to submit.");
      setCustomOpen(false);
      setCustom(blankCustom());
    } finally {
      setSending(false);
    }
  };

  const packSpecs = (product) => {
    const specs = product.specifications;
    if (specs && typeof specs === "object" && !Array.isArray(specs)) {
      return Object.entries(specs)
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" • ");
    }
    return product.subtitle || "";
  };

  return (
    <div className="products-page">
      <div className="products-container">
        <div className="products-breadcrumb">
          <Link to="/">Home</Link>
          <span>&gt;</span>
          <span className="products-breadcrumb-current">Lithium Battery Packs</span>
        </div>

        <div className="products-header">
          <div>
            <h1 className="products-title">Lithium Battery Packs</h1>
            <p className="products-subtitle">
              Prebuilt packs ready to ship — or get a pack customized to your exact needs.
            </p>
          </div>
          <button type="button" className="batt-customize-btn" onClick={() => setCustomOpen(true)}>
            Customize Lithium Battery Packs
          </button>
        </div>

        <h2 className="products-section-title">Prebuilt Battery Packs</h2>

        {isLoading ? (
          <div className="products-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="admin-empty">
            No prebuilt packs right now — use Customize to request one built for you.
          </div>
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
                    {packSpecs(product) && (
                      <div className="product-card-subtitle">{packSpecs(product)}</div>
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

      {customOpen && (
        <div className="batt-modal-backdrop" onClick={() => setCustomOpen(false)}>
          <div
            className="batt-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Customize lithium battery pack"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="batt-modal-head">
              <span className="batt-modal-num">1</span>
              <div>
                <h3>Custom Battery Details</h3>
                <p>Fill the form and send — it opens WhatsApp with everything pre-typed.</p>
              </div>
              <button type="button" className="batt-modal-close" onClick={() => setCustomOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={sendCustomEnquiry}>
              <div className="batt-grid">
                <label>Battery Chemistry*
                  <select
                    required
                    value={custom.chemistry}
                    onChange={(e) => {
                      const nextChem = e.target.value;
                      const group = chemistryGroup(nextChem);
                      const stillValid =
                        group &&
                        SERIES_PRESETS[group].some((p) => p.s === custom.cellS);
                      set({
                        chemistry: nextChem,
                        ...(stillValid ? {} : { cellS: "" }),
                      });
                    }}
                  >
                    <option value="">Please select</option>
                    <option>Li-ion</option>
                    <option>LiPo</option>
                    <option>LiFePO4</option>
                  </select>
                </label>
                <label>Email Id*
                  <input type="email" required value={custom.email} onChange={(e) => set({ email: e.target.value })} placeholder="Enter your email id" />
                </label>
                <label>Max Pack Capacity (mAh)*
                  <input required inputMode="numeric" value={custom.capacityMah} onChange={(e) => set({ capacityMah: e.target.value })} placeholder="Enter maximum capacity" />
                </label>
                <label>Full Name*
                  <input required value={custom.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder="Enter your full name" />
                </label>
                <label>Pack Configuration (Series)*
                  <select required value={custom.cellS} onChange={(e) => set({ cellS: e.target.value })}>
                    <option value="">Select series</option>
                    {(() => {
                      const group = chemistryGroup(custom.chemistry);
                      const groups = group ? [[group, SERIES_PRESETS[group]]] : [["NMC", SERIES_PRESETS.NMC], ["LFP", SERIES_PRESETS.LFP]];
                      return groups.map(([gName, presets]) => (
                        <optgroup key={gName} label={gName}>
                          {presets.map((p) => (
                            <option key={`${gName}-${p.s}`} value={p.s}>{p.s} {p.v}</option>
                          ))}
                        </optgroup>
                      ));
                    })()}
                  </select>
                </label>
                <label>Parallel Count (P)
                  <input inputMode="numeric" value={custom.cellP} onChange={(e) => set({ cellP: e.target.value })} placeholder="e.g. 2 for 3S2P" />
                </label>
                <label>Preferred Cell Model
                  <select value={custom.cellModel} onChange={(e) => set({ cellModel: e.target.value })}>
                    <option value="">---Select---</option>
                    <option>18650</option>
                    <option>21700</option>
                    <option>26650</option>
                    <option>32700</option>
                    <option>Pouch cell</option>
                    <option>No preference</option>
                  </select>
                </label>
                <label>Company Name
                  <input value={custom.company} onChange={(e) => set({ company: e.target.value })} placeholder="Enter your company name" />
                </label>
                <label>Nominal Pack Voltage (auto)
                  <input value={custom.cellS ? seriesVoltageFor(custom.cellS) : ""} placeholder="Select series above" disabled readOnly />
                </label>
                <label>GST Number
                  <input value={custom.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} placeholder="ENTER GSTIN (E.G., 27XXXXX0000X1Z5)" maxLength={15} />
                </label>
                <label>Current Consumption Continuous (Amp)*
                  <input required value={custom.contAmp} onChange={(e) => set({ contAmp: e.target.value })} placeholder="Enter continuous current" />
                </label>
                <label>Address
                  <input value={custom.address} onChange={(e) => set({ address: e.target.value })} placeholder="Enter your billing address" />
                </label>
                <label>Current Consumption Peak (Amp)*
                  <input required value={custom.peakAmp} onChange={(e) => set({ peakAmp: e.target.value })} placeholder="Enter peak current" />
                </label>
                <label>Contact Number*
                  <input required type="tel" value={custom.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="Enter your mobile number" />
                </label>
                <div className="batt-radio-row">
                  <span>Need BMS*</span>
                  <label><input type="radio" checked={custom.bms === "Yes"} onChange={() => set({ bms: "Yes" })} /> Yes</label>
                  <label><input type="radio" checked={custom.bms === "No"} onChange={() => set({ bms: "No" })} /> No</label>
                </div>
                <label>Connector Type
                  <input value={custom.connector} onChange={(e) => set({ connector: e.target.value })} placeholder="Charge / Discharge connector type" />
                </label>
                <label>Battery Dimension L (mm)
                  <input inputMode="decimal" value={custom.dimL} onChange={(e) => set({ dimL: e.target.value })} placeholder="length" />
                </label>
                <label>Battery Dimension W (mm)
                  <input inputMode="decimal" value={custom.dimW} onChange={(e) => set({ dimW: e.target.value })} placeholder="width" />
                </label>
                <label>Battery Dimension H (mm)
                  <input inputMode="decimal" value={custom.dimH} onChange={(e) => set({ dimH: e.target.value })} placeholder="height" />
                </label>
                <label>Quantity
                  <input inputMode="numeric" value={custom.quantity} onChange={(e) => set({ quantity: e.target.value })} placeholder="1" />
                </label>
                <label>State
                  <input value={custom.state} onChange={(e) => set({ state: e.target.value })} placeholder="Enter state" />
                </label>
                <label>Pincode
                  <input value={custom.pincode} onChange={(e) => set({ pincode: e.target.value })} placeholder="Enter pincode" maxLength={6} />
                </label>
              </div>
              <label className="batt-note-label">Your Note
                <textarea value={custom.note} onChange={(e) => set({ note: e.target.value })} placeholder="Anything else we should know..." rows={3} />
              </label>
              <p className="batt-hint">Reference files can't ride along in a WhatsApp link — mention file names in the note and share them in chat.</p>
              <button type="submit" className="batt-submit" disabled={sending}>
                {sending ? "Opening..." : "Send via WhatsApp"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
