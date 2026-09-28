const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; style-src 'self'; img-src 'self' https: http: data:; base-uri 'none'; form-action 'none'",
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
  return new Response(`<!doctype html>
<html lang="${escapeHtml(store?.locale || "en")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Explore ${escapeHtml(name)} products and collections.">
  <title>${escapeHtml(title)} · ${escapeHtml(name)}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="announcement">Thoughtfully selected. Made for your everyday.</div>
  <header class="site-header shell">
    <a class="wordmark" href="/">${escapeHtml(name)}<span class="wordmark-dot">.</span></a>
    <nav aria-label="Main navigation"><a href="/#products">All products</a>${collections}</nav>
  </header>
  <main id="main">${body}</main>
  <footer class="site-footer shell"><a class="wordmark" href="/">${escapeHtml(name)}<span class="wordmark-dot">.</span></a><span>Explore what matters to you.</span></footer>
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
      <div class="hero-copy"><span class="eyebrow">Welcome to ${escapeHtml(site.name)}</span>
        <h1>Find something <em>worth keeping.</em></h1>
        <p>Browse our latest products and discover the details that make each one special.</p>
        <a class="button" href="#products">Explore products <span aria-hidden="true">↗</span></a>
      </div>
      <div class="hero-art" aria-hidden="true"><div class="hero-circle"></div><div class="hero-shape"></div><span>GOOD<br>THINGS<br>START<br>HERE</span></div>
    </section>
    ${collectionLinks ? `<section class="shell collection-section"><div class="section-heading"><span class="eyebrow">01 / Browse</span><h2>Explore collections</h2></div><div class="collection-grid">${collectionLinks}</div></section>` : ""}
    <section class="shell product-section" id="products"><div class="section-heading"><span class="eyebrow">02 / Discover</span><h2>Our products</h2></div>
      ${products.length ? `<div class="product-grid">${products.map((product) => card(product, store)).join("")}</div>` : `<p class="empty-state">No products have been published yet. Check back soon.</p>`}
    </section>`);
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
    return `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(price(variant.price, store.currency, store.locale))}</strong></li>`;
  }).join("");
  return page(site, store, product.title, `<section class="shell inner-page">
    <a class="breadcrumb" href="/">← All products</a>
    <div class="product-detail"><div class="detail-image">${picture(product)}</div>
      <div class="detail-copy"><span class="eyebrow">${escapeHtml(product.brand || site.name)}</span>
        <h1>${escapeHtml(product.title)}</h1><p class="detail-price">${escapeHtml(productPrice(product, store))}</p>
        ${product.description ? `<p class="lead">${escapeHtml(product.description)}</p>` : ""}
        ${options ? `<h2>Options</h2><ul class="variants">${options}</ul>` : ""}
      </div>
    </div>
  </section>`);
}

async function siteApi(baseUrl, credential, path) {
  const response = await fetch(new URL(path, baseUrl), {
    headers: { accept: "application/json", authorization: `Bearer ${credential}` },
  });
  if (!response.ok) throw new Error(`Site API returned ${response.status}`);
  return response.json();
}

function routeHandle(pathname, segment) {
  const match = pathname.match(new RegExp(`^/${segment}/([^/]+)/?$`));
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    if (url.pathname === "/styles.css") return env.ASSETS.fetch(request);

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
      const store = await siteApi(baseUrl, env.REAI_SITE_CREDENTIAL, `/site/v1/commerce/storefront?${query}`);

      if (url.pathname === "/") return home(site, store);
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
      return page(null, null, "Temporarily unavailable", `<section class="shell inner-page"><span class="eyebrow">Please try again</span><h1>The store is temporarily unavailable.</h1><p class="lead">We couldn't load the catalog right now.</p></section>`, 502);
    }
  },
};
