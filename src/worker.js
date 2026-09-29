import { storeContent } from "./store-content.js";
import { language, ui } from "./ui-copy.js";

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
  const prefix = new Set(prices).size > 1 ? ui(store.locale).from : "";
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
    <span class="text-link">${ui(store.locale).viewProduct} <span aria-hidden="true">↗</span></span>
  </a>`;
}

function page(site, store, title, body, status = 200) {
  const t = ui(store?.locale);
  const content = storeContent[language(store?.locale)];
  const name = site?.name || "Storefront";
  const legalName = storeContent.legalName || name;
  const footerCollections = (store?.collections || []).slice(0, 3).map((collection) =>
    `<a href="/collections/${encodeURIComponent(collection.handle)}">${escapeHtml(collection.title)}</a>`,
  ).join("");
  const contact = storeContent.contactEmail
    ? `<a href="mailto:${escapeHtml(storeContent.contactEmail)}">${escapeHtml(storeContent.contactEmail)}</a>`
    : `<a href="/pages/contact">${t.contact}</a>`;
  return new Response(`<!doctype html>
<html lang="${escapeHtml(store?.locale || "nb")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${t.meta} ${escapeHtml(name)}.">
  <meta name="theme-color" content="#21443b">
  <title>${escapeHtml(title)} · ${escapeHtml(name)}</title>
  <link rel="icon" href="/storefront-mark.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main">${t.skip}</a>
  <div class="announcement">${escapeHtml(content.tagline)}</div>
  <header class="site-header shell">
    <a class="wordmark" href="/"><img src="/storefront-mark.svg" alt="" width="38" height="38">${escapeHtml(name)}</a>
    <nav aria-label="${t.shop}"><a href="/collections/all">${t.shop}</a><a href="/collections">${t.collections}</a><a href="/pages/about">${t.about}</a><a href="/pages/contact">${t.contact}</a><a class="cart-link" href="/cart">${t.cart} <span data-cart-count>0</span></a></nav>
  </header>
  <main id="main">${body}</main>
  <footer class="site-footer"><div class="shell footer-grid">
    <div class="footer-brand"><a class="wordmark" href="/"><img src="/storefront-mark.svg" alt="" width="38" height="38">${escapeHtml(name)}</a><p>${escapeHtml(content.aboutIntro)}</p></div>
    <div><h2>${t.shop}</h2><a href="/collections/all">${t.allProducts}</a><a href="/collections">${t.collections}</a>${footerCollections}<a href="/cart">${t.yourCart}</a></div>
    <div><h2>${t.help}</h2><a href="/pages/contact">${t.contact}</a><a href="/pages/shipping">${t.shipping}</a><a href="/pages/faq">${t.faq}</a><a href="/policies/returns">${t.returns}</a></div>
    <div><h2>${t.about}</h2><a href="/pages/about">${t.ourStory}</a>${contact}<a href="/policies/privacy">${t.privacy}</a><a href="/policies/terms">${t.terms}</a></div>
  </div><div class="shell footer-bottom"><span>© ${new Date().getUTCFullYear()} ${escapeHtml(legalName)}${storeContent.organizationNumber ? ` · ${escapeHtml(storeContent.organizationNumber)}` : ""}</span><span>${t.poweredBy} <a href="https://reai.no" rel="external">ReAI</a></span></div></footer>
  <script src="/store.js" defer></script>
</body>
</html>`, { status, headers: HTML_HEADERS });
}

function home(site, store) {
  const t = ui(store.locale);
  const content = storeContent[language(store.locale)];
  const collectionLinks = (store.collections || []).slice(0, 3).map((collection, index) => collectionTile(collection, index, store)).join("");
  const products = (store.products || []).slice(0, 8);
  return page(site, store, t.shop, `
    <section class="hero shell">
      <div class="hero-copy"><span class="eyebrow">${escapeHtml(content.heroEyebrow)}</span>
        <h1>${escapeHtml(content.heroTitle)}</h1>
        <p>${escapeHtml(content.heroDescription)}</p>
        <a class="button" href="/collections/all">${t.discoverProducts} <span aria-hidden="true">↗</span></a>
      </div>
      <div class="hero-art"><img src="/storefront-hero.avif" alt="" width="1536" height="1024" fetchpriority="high"></div>
    </section>
    <section class="shell value-strip" aria-label="${t.shop}"><div><strong>${t.curatedSelection}</strong><span>${t.latestArrivals}</span></div><div><strong>${t.clearCheckout}</strong><span>${t.reviewOrder}</span></div><div><strong>${t.hereHelp}</strong><a href="/pages/contact">${t.getInTouch} <span aria-hidden="true">↗</span></a></div></section>
    ${collectionLinks ? `<section class="shell collection-section"><div class="section-heading"><span class="eyebrow">${t.collectionEyebrow}</span><h2>${t.exploreCollections}</h2><a class="text-link" href="/collections">${t.collections} ↗</a></div><div class="collection-grid">${collectionLinks}</div></section>` : ""}
    <section class="shell product-section" id="products"><div class="section-heading"><span class="eyebrow">${t.productsEyebrow}</span><h2>${t.ourProducts}</h2><a class="text-link" href="/collections/all">${t.allProducts} ↗</a></div>
      ${products.length ? `<div class="product-grid">${products.map((product) => card(product, store)).join("")}</div>` : `<p class="empty-state">${t.emptyProducts}</p>`}
    </section>
    <section class="shell story-panel"><div><span class="eyebrow">${t.meetStore}</span><h2>${t.storyHeading}</h2></div><div><p>${escapeHtml(content.aboutIntro)}</p><a class="text-link" href="/pages/about">${t.knowUs} <span aria-hidden="true">↗</span></a></div></section>`);
}

function collectionTile(collection, index, store) {
  const t = ui(store.locale);
  const image = imageUrl(collection.imageUrl);
  return `<a class="collection-tile collection-tile-${index % 3 + 1}${image ? " has-image" : ""}" href="/collections/${encodeURIComponent(collection.handle)}">
    ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : ""}<span>${t.collection} ${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(collection.title)}</strong><span aria-hidden="true">↗</span>
  </a>`;
}

function collectionsPage(site, store) {
  const t = ui(store.locale);
  const collections = store.collections || [];
  return page(site, store, t.collections, `<section class="shell inner-page">
    <a class="breadcrumb" href="/">${t.backStore}</a><span class="eyebrow">${t.collectionEyebrow}</span><h1>${t.collections}</h1>
    ${collections.length ? `<div class="collection-grid">${collections.map((collection, index) => collectionTile(collection, index, store)).join("")}</div>` : `<p class="empty-state">${t.noCollections}</p>`}
    <a class="text-link browse-all-link" href="/collections/all">${t.allProducts} ↗</a>
  </section>`);
}

function allProductsPage(site, store) {
  const t = ui(store.locale);
  const products = store.products || [];
  return page(site, store, t.allProducts, `<section class="shell inner-page">
    <a class="breadcrumb" href="/collections">← ${t.collections}</a><span class="eyebrow">${t.productsEyebrow}</span><h1>${t.allProducts}</h1>
    ${products.length ? `<div class="product-grid">${products.map((product) => card(product, store)).join("")}</div>` : `<p class="empty-state">${t.emptyProducts}</p>`}
  </section>`);
}

function collectionPage(site, store, collection) {
  const t = ui(store.locale);
  const included = new Set((collection.products || []).map((product) => product.id));
  const products = (store.products || []).filter((product) => included.has(product.id));
  return page(site, store, collection.title, `<section class="shell inner-page">
    <a class="breadcrumb" href="/collections">← ${t.collections}</a><span class="eyebrow">${t.collection}</span>
    <h1>${escapeHtml(collection.title)}</h1>${collection.description ? `<p class="lead">${escapeHtml(collection.description)}</p>` : ""}
    ${products.length ? `<div class="product-grid">${products.map((product) => card(product, store)).join("")}</div>` : `<p class="empty-state">${t.noCollectionProducts}</p>`}
  </section>`);
}

function productPage(site, store, product) {
  const t = ui(store.locale);
  const options = (product.variants || []).map((variant) => {
    const label = variant.options?.map((option) => `${option.name}: ${option.value}`).join(" · ") || t.standard;
    return `<option value="${escapeHtml(variant.id)}">${escapeHtml(label)} · ${escapeHtml(price(variant.price, store.currency, store.locale))}</option>`;
  }).join("");
  return page(site, store, product.title, `<section class="shell inner-page">
    <a class="breadcrumb" href="/collections/all">${t.backAllProducts}</a>
    <div class="product-detail"><div class="detail-image">${picture(product)}</div>
      <div class="detail-copy"><span class="eyebrow">${escapeHtml(product.brand || site.name)}</span>
        <h1>${escapeHtml(product.title)}</h1><p class="detail-price">${escapeHtml(productPrice(product, store))}</p>
        ${product.description ? `<p class="lead">${escapeHtml(product.description)}</p>` : ""}
        ${options ? `<form data-add-to-cart><label for="variant">${t.options}</label><select id="variant" name="variantId" required>${options}</select>
          <label for="quantity">${t.quantity}</label><input id="quantity" name="quantity" type="number" min="1" max="20" value="1" required>
          <button class="button" type="submit">${t.addToCart}</button><p data-add-message role="status"></p></form>` : ""}
      </div>
    </div>
  </section>`);
}

function cartPage(site, store) {
  const t = ui(store.locale);
  return page(site, store, t.cart, `<section class="shell inner-page"><a class="breadcrumb" href="/collections/all">${t.continueShopping}</a>
    <h1>${t.yourCart}</h1><div data-cart-items><p>${t.loadingCart}</p></div><p data-cart-total class="cart-total"></p>
    <button class="button" type="button" data-start-checkout disabled>${t.checkout}</button>
    <p data-checkout-error role="alert" tabindex="-1" hidden></p>
    <p class="cart-note">${t.cartNote}</p></section>`);
}

function completePage(site, store) {
  const t = ui(store.locale);
  return page(site, store, t.orderComplete, `<section class="shell inner-page" data-checkout-complete>
    <span class="eyebrow">${t.thankYou}</span><h1>${t.orderCompleteHeading}</h1>
    <p class="lead">${t.orderCompleteText}</p>
    <a class="button" href="/collections/all">${t.continueToStore}</a></section>`);
}

function informationPage(site, store, slug) {
  const t = ui(store.locale);
  const key = {
    "/pages/about": "about", "/pages/contact": "contact", "/pages/shipping": "shipping",
    "/pages/faq": "faq", "/policies/returns": "returns", "/policies/privacy": "privacy",
    "/policies/terms": "terms",
  }[slug];
  const content = storeContent[language(store.locale)].pages[key];
  if (!content) return null;
  const contact = storeContent.contactEmail
    ? `<a href="mailto:${escapeHtml(storeContent.contactEmail)}">${escapeHtml(storeContent.contactEmail)}</a>`
    : t.fallbackContact;
  const renderText = (value) => escapeHtml(value).replaceAll("{name}", escapeHtml(site.name)).replaceAll("{contact}", contact);
  const details = [
    storeContent.legalName && `<p><strong>${t.business}:</strong> ${escapeHtml(storeContent.legalName)}</p>`,
    storeContent.organizationNumber && `<p><strong>${t.organizationNumber}:</strong> ${escapeHtml(storeContent.organizationNumber)}</p>`,
    storeContent.address && `<p><strong>${t.address}:</strong> ${escapeHtml(storeContent.address)}</p>`,
  ].filter(Boolean).join("");
  const sections = content.sections.map(([heading, body]) => `<h2>${renderText(heading)}</h2><p>${renderText(body)}</p>`).join("");
  const links = key === "contact" ? `<div class="inline-links"><a href="/pages/shipping">${t.shipping} ↗</a><a href="/policies/returns">${t.returns} ↗</a></div>` : "";
  return page(site, store, content.title, `<section class="shell editorial-page"><a class="breadcrumb" href="/">${t.backStore}</a><div class="editorial-heading"><span class="eyebrow">${escapeHtml(content.eyebrow)}</span><h1>${escapeHtml(content.title)}</h1><p class="lead">${escapeHtml(content.lead)}</p></div><div class="editorial-body">${sections}${details}${links}</div></section>`);
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
      const t = ui("en");
      return page(null, { locale: "en" }, t.comingSoon, `<section class="shell inner-page"><span class="eyebrow">${t.comingSoon}</span><h1>${t.setupHeading}</h1><p class="lead">${t.setupText}</p></section>`, 503);
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
      if (/^\/collections\/?$/.test(url.pathname)) return collectionsPage(site, store);
      if (/^\/collections\/all\/?$/.test(url.pathname)) return allProductsPage(site, store);
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
      const t = ui(store.locale);
      return page(site, store, t.notFound, `<section class="shell inner-page"><span class="eyebrow">404</span><h1>${t.notFoundHeading}</h1><a class="button" href="/">${t.backToStore}</a></section>`, 404);
    } catch {
      if (url.pathname === "/checkout/start") return json({ error: "Checkout is temporarily unavailable" }, 502);
      const t = ui("en");
      return page(null, { locale: "en" }, t.temporarilyUnavailable, `<section class="shell inner-page"><span class="eyebrow">${t.tryAgain}</span><h1>${t.unavailableHeading}</h1><p class="lead">${t.unavailableText}</p></section>`, 502);
    }
  },
};
