import { storeContent } from "./store-content.js";

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' https: http: data:; base-uri 'none'; form-action 'self'",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function imageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function price(value, currency, locale) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function productPrice(product, store) {
  const prices = (product.variants || []).map((variant) => Number(variant.price)).filter(Number.isFinite);
  if (!prices.length) return "";
  const prefix = new Set(prices).size > 1 ? "From " : "";
  return `${prefix}${price(Math.min(...prices), store.currency, store.locale)}`;
}

function picture(product, className = "") {
  const first = product.images?.[0];
  const src = imageUrl(first?.url);
  if (!src) return `<div class="image-placeholder ${className}" aria-hidden="true"><span>✳</span></div>`;
  return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(first.alt || product.title)}" loading="lazy">`;
}

function card(product, store) {
  const href = `/products/${encodeURIComponent(product.handle)}`;
  return `<a class="product-card" href="${href}">
    <div class="product-image">${picture(product)}</div>
    <div class="product-meta"><h3>${escapeHtml(product.title)}</h3><span>${escapeHtml(productPrice(product, store))}</span></div>
    <span class="text-link">View product <span aria-hidden="true">↗</span></span>
  </a>`;
}

function page(site, store, title, body, status = 200) {
  const collections = (store?.collections || []).slice(0, 4).map((collection) =>
    `<a href="/collections/${encodeURIComponent(collection.handle)}">${escapeHtml(collection.title)}</a>`,
  ).join("");
  const name = site?.name || "Storefront";
  const legalName = storeContent.legalName || name;
  const footerCollections = (store?.collections || []).slice(0, 3).map((collection) =>
    `<a href="/collections/${encodeURIComponent(collection.handle)}">${escapeHtml(collection.title)}</a>`,
  ).join("");
  const contact = storeContent.contactEmail
    ? `<a href="mailto:${escapeHtml(storeContent.contactEmail)}">${escapeHtml(storeContent.contactEmail)}</a>`
    : `<a href="/pages/contact">Contact us</a>`;
  return new Response(`<!doctype html>
<html lang="${escapeHtml(store?.locale || "en")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Explore ${escapeHtml(name)} products and collections.">
  <meta name="theme-color" content="#21443b">
  <title>${escapeHtml(title)} · ${escapeHtml(name)}</title>
  <link rel="icon" href="/storefront-mark.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="announcement">${escapeHtml(storeContent.tagline)}</div>
  <header class="site-header shell">
    <a class="wordmark" href="/"><img src="/storefront-mark.svg" alt="" width="38" height="38">${escapeHtml(name)}</a>
    <nav aria-label="Main navigation"><a href="/#products">Shop</a>${collections}<a href="/pages/about">About</a><a href="/pages/contact">Contact</a><a class="cart-link" href="/cart">Cart <span data-cart-count>0</span></a></nav>
  </header>
  <main id="main">${body}</main>
  <footer class="site-footer"><div class="shell footer-grid">
    <div class="footer-brand"><a class="wordmark" href="/"><img src="/storefront-mark.svg" alt="" width="38" height="38">${escapeHtml(name)}</a><p>${escapeHtml(storeContent.aboutIntro)}</p></div>
    <div><h2>Shop</h2><a href="/#products">All products</a>${footerCollections}<a href="/cart">Your cart</a></div>
    <div><h2>Help</h2><a href="/pages/contact">Contact</a><a href="/pages/shipping">Shipping &amp; delivery</a><a href="/pages/faq">FAQs</a><a href="/policies/returns">Returns</a></div>
    <div><h2>About</h2><a href="/pages/about">Our story</a>${contact}<a href="/policies/privacy">Privacy</a><a href="/policies/terms">Terms of sale</a></div>
  </div><div class="shell footer-bottom"><span>© ${new Date().getUTCFullYear()} ${escapeHtml(legalName)}${storeContent.organizationNumber ? ` · ${escapeHtml(storeContent.organizationNumber)}` : ""}</span><span>Powered by <a href="https://reai.no" rel="external">ReAI</a></span></div></footer>
  <script src="/store.js" defer></script>
</body>
</html>`, { status, headers: HTML_HEADERS });
}

function home(site, store) {
  const collectionLinks = (store.collections || []).slice(0, 3).map((collection, index) =>
    `<a class="collection-tile collection-tile-${index + 1}" href="/collections/${encodeURIComponent(collection.handle)}">
      <span>Collection ${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(collection.title)}</strong><span aria-hidden="true">↗</span>
    </a>`,
  ).join("");
  const products = (store.products || []).slice(0, 8);
  return page(site, store, "Home", `
    <section class="hero shell">
      <div class="hero-copy"><span class="eyebrow">${escapeHtml(storeContent.heroEyebrow)}</span>
        <h1>${escapeHtml(storeContent.heroTitle)}</h1>
        <p>${escapeHtml(storeContent.heroDescription)}</p>
        <a class="button" href="#products">Explore products <span aria-hidden="true">↗</span></a>
      </div>
      <div class="hero-art"><img src="/storefront-hero.avif" alt="A considered arrangement of everyday objects" width="1536" height="1024" fetchpriority="high"></div>
    </section>
    <section class="shell value-strip" aria-label="Shopping information"><div><strong>Curated selection</strong><span>Discover the latest arrivals</span></div><div><strong>Clear checkout</strong><span>Review your order before payment</span></div><div><strong>Here to help</strong><a href="/pages/contact">Get in touch <span aria-hidden="true">↗</span></a></div></section>
    ${collectionLinks ? `<section class="shell collection-section"><div class="section-heading"><span class="eyebrow">01 / Browse</span><h2>Explore collections</h2></div><div class="collection-grid">${collectionLinks}</div></section>` : ""}
    <section class="shell product-section" id="products"><div class="section-heading"><span class="eyebrow">02 / Discover</span><h2>Our products</h2></div>
      ${products.length ? `<div class="product-grid">${products.map((product) => card(product, store)).join("")}</div>` : `<p class="empty-state">No products have been published yet. Check back soon.</p>`}
    </section>
    <section class="shell story-panel"><div><span class="eyebrow">Meet the store</span><h2>More than a shopping list.</h2></div><div><p>${escapeHtml(storeContent.aboutIntro)}</p><a class="text-link" href="/pages/about">Get to know us <span aria-hidden="true">↗</span></a></div></section>`);
}

function collectionPage(site, store, collection) {
  const included = new Set((collection.products || []).map((product) => product.id));
  const products = (store.products || []).filter((product) => included.has(product.id));
  return page(site, store, collection.title, `<section class="shell inner-page">
    <a class="breadcrumb" href="/">← All products</a><span class="eyebrow">Collection</span>
    <h1>${escapeHtml(collection.title)}</h1>${collection.description ? `<p class="lead">${escapeHtml(collection.description)}</p>` : ""}
    ${products.length ? `<div class="product-grid">${products.map((product) => card(product, store)).join("")}</div>` : `<p class="empty-state">This collection has no published products yet.</p>`}
  </section>`);
}

function productPage(site, store, product) {
  const options = (product.variants || []).map((variant) => {
    const label = variant.options?.map((option) => `${option.name}: ${option.value}`).join(" · ") || "Standard";
    return `<option value="${escapeHtml(variant.id)}">${escapeHtml(label)} · ${escapeHtml(price(variant.price, store.currency, store.locale))}</option>`;
  }).join("");
  return page(site, store, product.title, `<section class="shell inner-page">
    <a class="breadcrumb" href="/">← All products</a>
    <div class="product-detail"><div class="detail-image">${picture(product)}</div>
      <div class="detail-copy"><span class="eyebrow">${escapeHtml(product.brand || site.name)}</span>
        <h1>${escapeHtml(product.title)}</h1><p class="detail-price">${escapeHtml(productPrice(product, store))}</p>
        ${product.description ? `<p class="lead">${escapeHtml(product.description)}</p>` : ""}
        ${options ? `<form data-add-to-cart><label for="variant">Options</label><select id="variant" name="variantId" required>${options}</select>
          <label for="quantity">Quantity</label><input id="quantity" name="quantity" type="number" min="1" max="20" value="1" required>
          <button class="button" type="submit">Add to cart</button><p data-add-message role="status"></p></form>` : ""}
      </div>
    </div>
  </section>`);
}

function cartPage(site, store) {
  return page(site, store, "Cart", `<section class="shell inner-page"><a class="breadcrumb" href="/">← Continue shopping</a>
    <h1>Your cart</h1><div data-cart-items><p>Loading cart…</p></div><p data-cart-total class="cart-total"></p>
    <button class="button" type="button" data-start-checkout disabled>Continue to checkout</button>
    <p data-checkout-error role="alert" tabindex="-1" hidden></p>
    <p class="cart-note">ReAI confirms prices, availability, shipping and payment on the secure checkout page.</p></section>`);
}

function completePage(site, store) {
  return page(site, store, "Order complete", `<section class="shell inner-page" data-checkout-complete>
    <span class="eyebrow">Thank you</span><h1>Your order is complete.</h1>
    <p class="lead">Your payment was completed in ReAI checkout. Look for your order confirmation.</p>
    <a class="button" href="/">Continue shopping</a></section>`);
}

function informationPage(site, store, slug) {
  const name = escapeHtml(site.name);
  const email = storeContent.contactEmail
    ? `<a href="mailto:${escapeHtml(storeContent.contactEmail)}">${escapeHtml(storeContent.contactEmail)}</a>`
    : "the contact address in your order confirmation";
  const details = [
    storeContent.legalName && `<p><strong>Registered business:</strong> ${escapeHtml(storeContent.legalName)}</p>`,
    storeContent.organizationNumber && `<p><strong>Registration number:</strong> ${escapeHtml(storeContent.organizationNumber)}</p>`,
    storeContent.address && `<p><strong>Business address:</strong> ${escapeHtml(storeContent.address)}</p>`,
  ].filter(Boolean).join("");
  const pages = {
    "/pages/about": {
      title: "About us", eyebrow: "The story", lead: storeContent.aboutIntro,
      body: `<h2>Welcome to ${name}</h2><p>${escapeHtml(storeContent.aboutBody)}</p><p>Our selection changes as new products arrive. Browse the store to see what is available today.</p>${details}<a class="button" href="/#products">Explore the collection <span aria-hidden="true">↗</span></a>`,
    },
    "/pages/contact": {
      title: "Contact us", eyebrow: "We're here to help", lead: "Have a question about a product or an order? We would love to hear from you.",
      body: `<h2>Get in touch</h2><p>For order questions, include your order number so we can help you faster. Email us at ${email}.</p>${details}<p>For information about delivery and returns, visit the pages below.</p><div class="inline-links"><a href="/pages/shipping">Shipping &amp; delivery ↗</a><a href="/policies/returns">Returns ↗</a></div>`,
    },
    "/pages/shipping": {
      title: "Shipping & delivery", eyebrow: "Your order", lead: "Delivery choices and their prices are shown before you place an order.",
      body: `<h2>Delivery at checkout</h2><p>Enter your delivery details during checkout to see the available shipping methods and the total cost for your order. Availability and delivery times depend on the destination and the selected method.</p><h2>Need help?</h2><p>For questions about a delivery, please contact ${email} and include your order number.</p>`,
    },
    "/pages/faq": {
      title: "Frequently asked questions", eyebrow: "Good to know", lead: "Answers to common questions about shopping with us.",
      body: `<h2>How do I place an order?</h2><p>Add a product to your cart, review it, and continue to the secure checkout.</p><h2>When will I see shipping costs?</h2><p>Available delivery methods and their prices are shown during checkout, before you pay.</p><h2>Can I change or return an order?</h2><p>Contact ${email} as soon as possible. See our <a href="/policies/returns">returns page</a> for more information.</p>`,
    },
    "/policies/returns": {
      title: "Returns", eyebrow: "After your purchase", lead: "If something is not right with your order, please get in touch.",
      body: `<h2>Request a return</h2><p>Contact ${email} with your order number, the item concerned, and the reason for your request before sending anything back. We will explain the next steps and applicable costs.</p><p>Your statutory consumer rights remain unaffected.</p>`,
    },
    "/policies/privacy": {
      title: "Privacy", eyebrow: "Your information", lead: "We use the information you provide to process and deliver your order.",
      body: `<h2>Order information</h2><p>Checkout collects the contact, delivery, and payment information needed to complete your purchase. Payment is handled on ReAI's hosted checkout. Contact ${email} for questions about your personal information.</p>`,
    },
    "/policies/terms": {
      title: "Terms of sale", eyebrow: "Before you order", lead: "Review your products, delivery choice, and total before confirming payment.",
      body: `<h2>Prices and payment</h2><p>Product prices appear in the store's selected currency. The final total, including any delivery cost, is shown during checkout before you pay.</p><h2>Questions</h2><p>Contact ${email} if you have questions about an order.</p>`,
    },
  };
  const content = pages[slug];
  if (!content) return null;
  return page(site, store, content.title, `<section class="shell editorial-page"><a class="breadcrumb" href="/">← Back to the store</a><div class="editorial-heading"><span class="eyebrow">${content.eyebrow}</span><h1>${content.title}</h1><p class="lead">${escapeHtml(content.lead)}</p></div><div class="editorial-body">${content.body}</div></section>`);
}

async function siteApi(baseUrl, credential, path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers: { accept: "application/json", authorization: `Bearer ${credential}`, ...options.headers },
  });
  if (!response.ok) {
    const error = new Error(`Site API returned ${response.status}`);
    error.status = response.status;
    error.response = response;
    throw error;
  }
  return response.json();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

function checkoutLines(body) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!body || !Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 100) return null;
  const lines = body.lines.map((line) => ({ variantId: line?.variantId, quantity: line?.quantity }));
  if (lines.some((line) => typeof line.variantId !== "string" || !uuid.test(line.variantId)
      || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20)) return null;
  return lines;
}

async function boundedJson(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let raw = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 16_384) {
      await reader.cancel();
      return null;
    }
    raw += decoder.decode(value, { stream: true });
  }
  try { return JSON.parse(raw + decoder.decode()); } catch { return null; }
}

function routeHandle(pathname, segment) {
  const match = pathname.match(new RegExp(`^/${segment}/([^/]+)/?$`));
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (["/styles.css", "/store.js", "/storefront-mark.svg", "/storefront-hero.avif"].includes(url.pathname)) return env.ASSETS.fetch(request);
    if (request.method === "POST") {
      if (url.pathname !== "/checkout/start") return json({ error: "Method not allowed" }, 405);
      if (request.headers.get("Origin") !== url.origin) return json({ error: "Invalid origin" }, 403);
      if (!request.headers.get("Content-Type")?.startsWith("application/json")) return json({ error: "Expected JSON" }, 415);
    }

    if (!env.REAI_API_BASE_URL || !env.REAI_SITE_CREDENTIAL) {
      return page(null, null, "Coming soon", `<section class="shell inner-page"><span class="eyebrow">Coming soon</span><h1>Something good is on its way.</h1><p class="lead">This storefront is being set up.</p></section>`, 503);
    }

    try {
      const baseUrl = new URL(env.REAI_API_BASE_URL);
      if (!(["http:", "https:"].includes(baseUrl.protocol))) throw new Error("Invalid API URL");
      const site = await siteApi(baseUrl, env.REAI_SITE_CREDENTIAL, "/site/v1/site");
      const market = site.markets?.find((entry) => entry.isDefault) || site.markets?.[0];
      if (!market) throw new Error("No Site market configured");
      const query = new URLSearchParams({ market: market.handle, locale: market.defaultLocale });
      if (url.pathname === "/checkout/start") {
        if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
        const body = await boundedJson(request);
        const lines = checkoutLines(body);
        if (!lines) return json({ error: "Invalid cart" }, 400);
        try {
          const session = await siteApi(baseUrl, env.REAI_SITE_CREDENTIAL, `/site/v1/commerce/checkout-sessions?${query}`, {
            method: "POST",
            headers: { "content-type": "application/json", "Idempotency-Key": request.headers.get("Idempotency-Key") || crypto.randomUUID() },
            body: JSON.stringify({ lines, returnUrl: `${url.origin}/checkout/complete` }),
          });
          return json({ checkoutUrl: session.checkoutUrl });
        } catch (error) {
          if (error.response) {
            const details = await error.response.json().catch(() => ({}));
            return json({ error: details.detail || "Checkout could not be started", code: details.code, stockIssues: details.stockIssues }, error.status);
          }
          return json({ error: "Checkout is temporarily unavailable" }, 502);
        }
      }
      const store = await siteApi(baseUrl, env.REAI_SITE_CREDENTIAL, `/site/v1/commerce/storefront?${query}`);

      if (url.pathname === "/catalog.json") return json({ products: store.products, currency: store.currency, locale: store.locale });
      if (url.pathname === "/") return home(site, store);
      const information = informationPage(site, store, url.pathname.replace(/\/$/, ""));
      if (information) return information;
      if (url.pathname === "/cart") return cartPage(site, store);
      if (url.pathname === "/checkout/complete") return completePage(site, store);
      const collectionHandle = routeHandle(url.pathname, "collections");
      if (collectionHandle !== null) {
        const collection = store.collections?.find((entry) => entry.handle === collectionHandle);
        if (collection) return collectionPage(site, store, collection);
      }
      const productHandle = routeHandle(url.pathname, "products");
      if (productHandle !== null) {
        const product = store.products?.find((entry) => entry.handle === productHandle);
        if (product) return productPage(site, store, product);
      }
      return page(site, store, "Not found", `<section class="shell inner-page"><span class="eyebrow">404</span><h1>We couldn't find that page.</h1><a class="button" href="/">Back to the store</a></section>`, 404);
    } catch {
      if (url.pathname === "/checkout/start") return json({ error: "Checkout is temporarily unavailable" }, 502);
      return page(null, null, "Temporarily unavailable", `<section class="shell inner-page"><span class="eyebrow">Please try again</span><h1>The store is temporarily unavailable.</h1><p class="lead">We couldn't load the catalog right now.</p></section>`, 502);
    }
  },
};
