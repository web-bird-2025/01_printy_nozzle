import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import catalogService from "../services/catalog.service";
// import footerData from "../data/footer.json";
import "../../public/css/footer.css";

let footerData = {
  brand: {
    logo: "/images/logo.png",
    name: "PrintyNozzle",
    description:
      "Print. Build. Innovate. Quality 3D printing solutions, components, and electronics for makers and creators.",
  },

  columns: [
    {
      title: "Shop",
      links: [
        {
          label: "Home",
          url: "/",
        },
        {
          label: "All Products",
          url: "/products",
        },
        {
          label: "3d Printing",
          url: "/3d-printing",
        },
        {
          label: "Filaments",
          url: "/filaments",
        },
        {
          label: "Battery Packs",
          url: "/batteries",
        },
      ],
    },
    {
      title: "My Profile",
      links: [
        
        {
          label: "Profile",
          url: "/profile",
        },
        {
          label: "My Orders",
          url: "/my-orders",
        },
        {
          label: "Cart",
          url: "/cart",
        },
        // {
        //   label: "Wishlist",
        //   url: "/wishlist",
        // },
      ],
    },
    {
      title: "Customer Service",
      links: [
        {
          label: "Contact Us",
          url: "/contact",
        },
        {
          label: "Shipping Policy",
          url: "/shipping",
        },
        {
          label: "Return Policy",
          url: "/returns",
        },
        {
          label: "FAQs",
          url: "/faqs",
        },
      ],
    },
    {
      title: "Company",
      links: [
        {
          label: "About Us",
          url: "/about",
        },
        // {
        //   label: "Blog",
        //   url: "/blog",
        // },
        {
          label: "Terms & Conditions",
          url: "/terms",
        },
        {
          label: "Privacy Policy",
          url: "/privacy",
        },
      ],
    },
  ],

  newsletter: {
    title: "Stay in the loop",
    description:
      "Get updates on new products, 3D printing services, offers and more.",
    placeholder: "Enter your email",
    button: "Subscribe",
  },

  socials: [
    {
      name: "Facebook",
      icon: "f",
      url: "#",
    },
    {
      name: "Instagram",
      icon: "◎",
      url: "#",
    },
    {
      name: "YouTube",
      icon: "▶",
      url: "#",
    },
    {
      name: "GitHub",
      icon: "⌘",
      url: "#",
    },
  ],

  payments: ["VISA", "Mastercard", "UPI", "RuPay"],

  copyright: "PrintyNozzle. All rights reserved.",
};

function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [socials, setSocials] = useState(null);

  useEffect(() => {
    let active = true;
    catalogService
      .getContactInfo()
      .then((res) => {
        if (active && Array.isArray(res.data?.data?.socials)) {
          setSocials(res.data.data.socials);
        }
      })
      .catch(() => {
        /* offline fallback below */
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    const email = newsletterEmail.trim();
    if (!email || !email.includes("@")) {
      toast.warn("Please enter a valid email address.");
      return;
    }
    setSubscribing(true);
    try {
      const res = await catalogService.subscribeNewsletter(email);
      toast.success(res.data?.message || "Subscribed successfully!");
      setNewsletterEmail("");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Subscription failed. Please try again.");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <footer className="pn-footer">
      {/* Decorative glow */}
      <div className="pn-footer-glow"></div>

      <div className="pn-footer-container">
        {/* ================= BRAND ================= */}
        <div className="pn-footer-brand">
          <Link to="/" className="pn-footer-logo">
            <img src={footerData.brand.logo} alt={footerData.brand.name} />
          </Link>

          <p>{footerData.brand.description}</p>

          <div className="pn-socials">
            {(socials && socials.length > 0
              ? socials.map((social) => (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    title={social.name}
                  >
                    <i className={social.icon || "bi bi-link-45deg"}></i>
                  </a>
                ))
              : footerData.socials.map((social) => (
                  <a key={social.name} href={social.url} aria-label={social.name}>
                    {social.icon}
                  </a>
                )))}
          </div>
        </div>

        {/* ================= FOOTER COLUMNS ================= */}
        {footerData.columns.map((column) => (
          <div className="pn-footer-column" key={column.title}>
            <h4>{column.title}</h4>

            <div className="pn-footer-links">
              {column.links.map((link) => (
                <Link key={link.label} to={link.url}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* ================= NEWSLETTER ================= */}
        <div className="pn-footer-newsletter">
          <h4>{footerData.newsletter.title}</h4>

          <p>{footerData.newsletter.description}</p>

          <form className="pn-newsletter-form" onSubmit={handleSubscribe}>
            <input
              type="email"
              placeholder={footerData.newsletter.placeholder}
              aria-label="Email address"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              disabled={subscribing}
            />

            <button type="submit" disabled={subscribing}>
              {subscribing ? "..." : footerData.newsletter.button}
            </button>
          </form>

          <small>No spam. Unsubscribe anytime.</small>
        </div>
      </div>

      {/* ================= FOOTER BOTTOM ================= */}
      <div className="pn-footer-bottom">
        <p>
          © {new Date().getFullYear()} {footerData.copyright}
        </p>

        <div className="pn-payment-methods">
          {footerData.payments.map((payment) => (
            <span
              key={payment}
              className={
                payment.toLowerCase() === "mastercard" ? "pn-mastercard" : ""
              }
            >
              {payment === "Mastercard" && (
                <span className="pn-card-circles">
                  <i></i>
                  <i></i>
                </span>
              )}

              {payment}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
