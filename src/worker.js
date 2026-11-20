import { ReaiSiteClient } from "../packages/reai-site-client/client.mjs";
import { storeContent } from "./store-content.js";
import { language, ui } from "./ui-copy.js";
import {
  renderCatalogFilters,
  renderCatalogTools,
} from "./catalog-filters.mjs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._-]{8,128}$/;
const STATIC_ASSET_EXT =
  /\.(?:avif|css|ico|jpe?g|js|json|png|svg|txt|webp|woff2?|xml)$/i;
const ANALYTICS_KINDS = new Set([
  "page_view",
  "product_view",
  "add_to_cart",
  "remove_from_cart",
  "checkout_view",
]);
const INFORMATION_PAGES = {
  "/pages/about": "about",
  "/pages/contact": "contact",
  "/pages/shipping": "shipping",
  "/pages/faq": "faq",
  "/policies/returns": "returns",
  "/policies/privacy": "privacy",
  "/policies/terms": "terms",
};
const CACHE_FRESH_MS = 60_000;
const CACHE_SWR_MS = 300_000;
const CACHE_RETENTION_S = 86_400;
const CACHE_RETENTION_MS = 86_400_000;

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "content-security-policy":
    "default-src 'none'; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' https: data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("&#39;", "&apos;");
}

function descriptionHtml(item) {
  if (item.descriptionHtml)
    return `<div class="rich-description">${item.descriptionHtml}</div>`;
  return item.description
    ? `<p class="lead">${escapeHtml(item.description)}</p>`
    : "";
}

function imageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function price(value, currency, locale) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function productPrice(product, store) {
  const prices = (product.variants || [])
    .map((variant) => Number(variant.price))
    .filter(Number.isFinite);
  if (!prices.length) return "";
  const prefix = new Set(prices).size > 1 ? ui(store.locale).from : "";
  return `${prefix}${price(Math.min(...prices), store.currency, store.locale)}`;
}

function picture(
  product,
  {
    className = "",
    eager = false,
    sizes = "(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 25vw",
  } = {},
) {
  const first = product.images?.[0];
  const src = imageUrl(first?.url);
  if (!src)
    return `<div class="image-placeholder ${className}" aria-hidden="true"><span>✳</span></div>`;
  const dimensions =
    Number.isFinite(first.width) && Number.isFinite(first.height)
      ? ` width="${first.width}" height="${first.height}"`
      : "";
  const renditions = (first.renditions || []).filter(
    (image) => imageUrl(image.url) && image.width > 0,
  );
  const responsive = renditions.length
    ? ` srcset="${renditions.map((image) => `${escapeHtml(imageUrl(image.url))} ${image.width}w`).join(", ")}" sizes="${escapeHtml(sizes)}"`
    : "";
  const loading = eager
    ? 'loading="eager" fetchpriority="high"'
    : 'loading="lazy" decoding="async"';
  return `<img class="${className}" src="${escapeHtml(src)}"${dimensions}${responsive} alt="${escapeHtml(first.alt || product.title)}" ${loading}>`;
}

function card(product, store) {
  const href = `/products/${encodeURIComponent(product.handle)}`;
  const t = ui(store.locale);
  const variants = product.variants || [];
  const action =
    variants.length === 1
      ? `<form data-add-to-cart>
        <input type="hidden" name="variantId" value="${escapeHtml(variants[0].id)}">
        <input type="hidden" name="quantity" value="1">
        <button class="button" type="submit"${variants[0].outOfStock ? " disabled" : ""}>${variants[0].outOfStock ? t.outOfStock : t.addToCart}</button>
        <p data-add-message role="status"></p>
      </form>`
      : variants.length > 1
        ? variants.every((variant) => variant.outOfStock)
          ? `<button class="button" disabled>${t.outOfStock}</button>`
          : `<a class="button" href="${href}">${t.chooseVariant}</a>`
        : "";
  const cheapest = variants.reduce(
    (a, b) => (Number(a.price) <= Number(b.price) ? a : b),
    variants[0],
  );
  const reference =
    Number(cheapest?.compareAtPrice) > Number(cheapest?.price)
      ? ` <s class="reference-price">${escapeHtml(price(cheapest.compareAtPrice, store.currency, store.locale))}</s>`
      : "";
  return `<article class="product-card" data-product-id="${escapeHtml(product.id)}">
    <a class="product-image" href="${href}" aria-label="${escapeHtml(product.title)}">${picture(product)}</a>
    <div class="product-meta"><h3><a href="${href}">${escapeHtml(product.title)}</a></h3><span data-product-price>${escapeHtml(productPrice(product, store))}${reference}</span></div>
    <div class="product-actions"><a class="text-link" href="${href}">${t.viewProduct} <span aria-hidden="true">↗</span></a>${action}</div>
  </article>`;
}

function newsletter(site, store) {
  const config = store.content || storeContent;
  if (config.newsletterEnabled === false || !site) return "";
  const t = ui(store.locale);
  return `<section class="shell newsletter" aria-labelledby="newsletter-title"><div><h2 id="newsletter-title">${t.newsletterTitle}</h2><p>${t.newsletterText}</p></div><form data-newsletter><label for="newsletter-email">${t.email}</label><div class="newsletter-fields"><input id="newsletter-email" name="email" type="email" autocomplete="email" maxlength="254" required placeholder="${t.emailPlaceholder}"><button class="button" type="submit">${t.subscribe}</button></div><label class="newsletter-consent"><input type="checkbox" name="consent" required><span>${t.newsletterConsent} ${escapeHtml(config.legalName || site.name)}. <a href="/policies/privacy">${t.privacy}</a></span></label><label class="newsletter-trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><p data-newsletter-status role="status"></p></form></section>`;
}

function cartContents(store) {
  const t = ui(store.locale);
  return `<div data-cart-items><p>${t.loadingCart}</p></div><p data-cart-total class="cart-total"></p><button class="button" type="button" data-start-checkout disabled>${t.checkout}</button><p data-checkout-error role="alert" tabindex="-1" hidden></p><p class="cart-note">${t.cartNote}</p>`;
}

function defaultSiteMarket(site) {
  return (
    site?.markets?.find((entry) => entry.isDefault) || site?.markets?.[0] || null
  );
}

function canonicalHref(site, store, pagePath, marketHandle, locale) {
  const origin = store?.origin;
  if (!origin) return "";
  const basePath = store?.basePath || "";
  const normalizedPath = pagePath || "/";
  const def = defaultSiteMarket(site);
  const isDefault =
    !def || (marketHandle === def.handle && locale === def.defaultLocale);
  if (isDefault || !marketHandle || !locale) {
    return `${origin}${basePath}${normalizedPath}`;
  }
  return `${origin}${basePath}${normalizedPath}?market=${encodeURIComponent(marketHandle)}&locale=${encodeURIComponent(locale)}`;
}

function alternateLinks(site, store, pagePath) {
  if (!store?.origin || !site?.markets?.length) return "";
  const pairs = [];
  const seenLocales = new Set();
  for (const market of site.markets) {
    for (const loc of market.locales || [market.defaultLocale]) {
      if (!loc || seenLocales.has(loc)) continue;
      seenLocales.add(loc);
      pairs.push({
        hreflang: loc,
        href: canonicalHref(site, store, pagePath, market.handle, loc),
      });
    }
  }
  if (pairs.length <= 1) return "";
  const def = defaultSiteMarket(site);
  const xDefault = canonicalHref(
    site,
    store,
    pagePath,
    def?.handle,
    def?.defaultLocale,
  );
  return [
    ...pairs.map(
      ({ hreflang, href }) =>
        `<link rel="alternate" hreflang="${escapeHtml(hreflang)}" href="${escapeHtml(href)}">`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(xDefault)}">`,
  ].join("\n  ");
}

function productJsonLd(site, store, product, canonicalUrl) {
  const offers = (product.variants || [])
    .map((variant) => {
      const amount = Number(variant.price);
      if (!Number.isFinite(amount)) return null;
      const offerUrl = canonicalUrl
        ? `${canonicalUrl}${canonicalUrl.includes("?") ? "&" : "?"}variant=${encodeURIComponent(variant.id)}`
        : undefined;
      return {
        "@type": "Offer",
        price: amount,
        priceCurrency: store.currency,
        ...(variant.sku ? { sku: variant.sku } : {}),
        ...(offerUrl ? { url: offerUrl } : {}),
        ...(typeof variant.outOfStock === "boolean"
          ? {
              availability: variant.outOfStock
                ? "https://schema.org/OutOfStock"
                : "https://schema.org/InStock",
            }
          : {}),
      };
    })
    .filter(Boolean);
  const images = (product.images || [])
    .map((image) => imageUrl(image.url))
    .filter(Boolean);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    ...(canonicalUrl ? { url: canonicalUrl } : {}),
    ...(product.description || product.seoDescription
      ? {
          description: String(
            product.seoDescription || product.description || "",
          )
            .replace(/<[^>]*>/g, "")
            .trim(),
        }
      : {}),
    ...(images.length ? { image: images } : {}),
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand } }
      : {}),
    ...(product.variants?.[0]?.sku ? { sku: product.variants[0].sku } : {}),
    offers: offers.length === 1 ? offers[0] : offers,
  };
  return `<script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>`;
}

function page(site, store, title, body, status = 200, options = {}) {
  const {
    cacheable = true,
    ogType = "website",
    ogImage = null,
    jsonLd = "",
    includeCatalogFilters = false,
    includeCatalogContext = false,
  } = options;
  const config = store.content || storeContent;
  const resolvedLocale = store?.locale || "nb";
  const t = ui(resolvedLocale);
  const content = config[language(resolvedLocale)];
  const name = site?.name || config.legalName || "Storefront";
  const legalName = config.legalName || name;
  const footerCollections = (store?.collections || [])
    .slice(0, 3)
    .map(
      (collection) =>
        `<a href="/collections/${encodeURIComponent(collection.handle)}">${escapeHtml(collection.title)}</a>`,
    )
    .join("");
  const contact = config.contactEmail
    ? `<a href="mailto:${escapeHtml(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a>`
    : `<a href="/pages/contact">${t.contact}</a>`;
  const markets = site?.markets || [];
  const contextHref = (href) => {
    const target = new URL(
      href.replaceAll("&amp;", "&"),
      "https://store.invalid",
    );
    if (store.basePath) target.pathname = store.basePath + target.pathname;
    if (STATIC_ASSET_EXT.test(target.pathname))
      return escapeHtml(target.pathname);
    if (store.marketHandle && !target.searchParams.has("market"))
      target.searchParams.set("market", store.marketHandle);
    if (store.locale && !target.searchParams.has("locale"))
      target.searchParams.set("locale", store.locale);
    return escapeHtml(target.pathname + target.search + target.hash);
  };
  const languages = markets.flatMap((market) =>
    (market.locales || [market.defaultLocale]).map(
      (locale) =>
        `<a data-language-link href="${escapeHtml(`${store.pagePath || "/"}?market=${encodeURIComponent(market.handle)}&locale=${encodeURIComponent(locale)}`)}"${market.handle === store.marketHandle && locale === store.locale ? ' aria-current="true"' : ""}>${escapeHtml(locale.toUpperCase())} · ${escapeHtml(market.name || market.handle)} · ${escapeHtml(market.currency)}</a>`,
    ),
  );
  const languageMenu =
    languages.length > 1
      ? `<details class="language-menu"><summary>${escapeHtml(String(store.locale).toUpperCase())} · ${escapeHtml(store.currency)}</summary><div>${languages.join("")}</div></details>`
      : "";
  const description = store.metaDescription || `${t.meta} ${name}.`;
  const pageTitle = `${title} · ${name}`;
  const canonical =
    status === 200 && cacheable
      ? canonicalHref(
          site,
          store,
          store.pagePath || "/",
          store.marketHandle,
          store.locale,
        )
      : "";
  const alternates =
    status === 200 && cacheable
      ? alternateLinks(site, store, store.pagePath || "/")
      : "";
  const resolvedOgImage =
    ogImage ||
    (store?.origin
      ? `${store.origin}${store.basePath || ""}/storefront-hero.avif`
      : null);
  const seoHead = [
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : "",
    alternates,
    status === 200
      ? `<meta property="og:type" content="${escapeHtml(ogType)}">`
      : "",
    status === 200
      ? `<meta property="og:site_name" content="${escapeHtml(name)}">`
      : "",
    status === 200
      ? `<meta property="og:title" content="${escapeHtml(pageTitle)}">`
      : "",
    status === 200
      ? `<meta property="og:description" content="${escapeHtml(description)}">`
      : "",
    canonical
      ? `<meta property="og:url" content="${escapeHtml(canonical)}">`
      : "",
    status === 200 && resolvedOgImage
      ? `<meta property="og:image" content="${escapeHtml(resolvedOgImage)}">`
      : "",
    jsonLd,
  ]
    .filter(Boolean)
    .join("\n  ");
  const scripts = [
    `<script src="/store.js" type="module"></script>`,
    includeCatalogContext || includeCatalogFilters
      ? `<script src="/assets/catalog-context.js" type="module"></script>`
      : "",
    includeCatalogFilters
      ? `<script src="/assets/catalog-filters.js" type="module"></script>`
      : "",
  ]
    .filter(Boolean)
    .join("");
  const document = `<!doctype html>
<html lang="${escapeHtml(resolvedLocale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#21443b">
  <title>${escapeHtml(pageTitle)}</title>
  ${seoHead}
  <link rel="icon" href="/storefront-mark.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
</head>
<body data-store-base="${escapeHtml(store.basePath || "")}" data-store-market="${escapeHtml(store.marketHandle || "")}" data-store-locale="${escapeHtml(store.locale || "")}">
  <a class="skip-link" href="#main">${t.skip}</a>
  <div class="announcement">${escapeHtml(content.tagline)}</div>
  <header class="site-header shell">
    <a class="wordmark" href="/"><img src="/storefront-mark.svg" alt="" width="38" height="38">${escapeHtml(name)}</a>
    <nav aria-label="${t.shop}"><a href="/collections/all">${t.shop}</a><a href="/collections">${t.collections}</a><a href="/pages/about">${t.about}</a><a href="/pages/contact">${t.contact}</a></nav><div class="header-actions">${languageMenu}<a class="cart-link" data-open-cart href="/cart" aria-haspopup="dialog">${t.cart} <span data-cart-count>0</span></a></div>
  </header>
  <main id="main">${body}</main>
  ${newsletter(site, store)}
  <footer class="site-footer"><div class="shell footer-grid">
    <div class="footer-brand"><a class="wordmark" href="/"><img src="/storefront-mark.svg" alt="" width="38" height="38">${escapeHtml(name)}</a><p>${escapeHtml(content.aboutIntro)}</p></div>
    <div><h2>${t.shop}</h2><a href="/collections/all">${t.allProducts}</a><a href="/collections">${t.collections}</a>${footerCollections}<a href="/cart">${t.yourCart}</a></div>
    <div><h2>${t.help}</h2><a href="/pages/contact">${t.contact}</a><a href="/pages/shipping">${t.shipping}</a><a href="/pages/faq">${t.faq}</a><a href="/policies/returns">${t.returns}</a></div>
    <div><h2>${t.about}</h2><a href="/pages/about">${t.ourStory}</a>${contact}<a href="/policies/privacy">${t.privacy}</a><a href="/policies/terms">${t.terms}</a></div>
  </div><div class="shell footer-bottom"><span>© ${new Date().getUTCFullYear()} ${escapeHtml(legalName)}${config.organizationNumber ? ` · ${escapeHtml(config.organizationNumber)}` : ""}</span><span>${t.poweredBy} <a href="https://reai.no" rel="external">ReAI</a></span></div></footer>
  ${site && store.pagePath !== "/cart" ? `<dialog class="cart-drawer" data-cart-dialog aria-labelledby="cart-drawer-title"><div class="drawer-heading"><h2 id="cart-drawer-title">${t.yourCart}</h2><button type="button" data-close-cart aria-label="${t.close}">×</button></div>${cartContents(store)}<a class="text-link" href="/cart">${t.viewCart} ↗</a></dialog>` : ""}
  ${scripts}
</body>
</html>`;
  return new Response(
    document.replace(/(href|src)="(\/[^\"]*)"/g, (_match, attr, href) =>
      attr === "src"
        ? `src="${escapeHtml((store.basePath || "") + href)}"`
        : `href="${contextHref(href)}"`,
    ),
    {
      status,
      headers: {
        ...SECURITY_HEADERS,
        "content-type": "text/html; charset=utf-8",
        "content-language": resolvedLocale,
        "cache-control":
          status === 200 && cacheable
            ? "public, max-age=60, stale-while-revalidate=300"
            : "no-store",
      },
    },
  );
}

function home(site, store) {
  const config = store.content || storeContent;
  const t = ui(store.locale);
  const content = config[language(store.locale)];
  const collectionLinks = (store.collections || [])
    .slice(0, 3)
    .map((collection, index) => collectionTile(collection, index, store))
    .join("");
  const products = (store.products || []).slice(0, 8);
  return page(
    site,
    store,
    t.shop,
    `
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
    <section class="shell story-panel"><div><span class="eyebrow">${t.meetStore}</span><h2>${t.storyHeading}</h2></div><div><p>${escapeHtml(content.aboutIntro)}</p><a class="text-link" href="/pages/about">${t.knowUs} <span aria-hidden="true">↗</span></a></div></section>`,
  );
}

function collectionTile(collection, index, store) {
  const t = ui(store.locale);
  const image = imageUrl(collection.imageUrl);
  return `<a class="collection-tile collection-tile-${(index % 3) + 1}${image ? " has-image" : ""}" href="/collections/${encodeURIComponent(collection.handle)}">
    ${image ? `<img src="${escapeHtml(image)}" alt="" width="800" height="600" loading="lazy" decoding="async">` : ""}<span>${t.collection} ${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(collection.title)}</strong><span aria-hidden="true">↗</span>
  </a>`;
}

function collectionsPage(site, store) {
  const t = ui(store.locale);
  const collections = store.collections || [];
  return page(
    site,
    store,
    t.collections,
    `<section class="shell inner-page">
    <a class="breadcrumb" href="/">${t.backStore}</a><span class="eyebrow">${t.collectionEyebrow}</span><h1>${t.collections}</h1>
    ${collections.length ? `<div class="collection-grid">${collections.map((collection, index) => collectionTile(collection, index, store)).join("")}</div>` : `<p class="empty-state">${t.noCollections}</p>`}
    <a class="text-link browse-all-link" href="/collections/all">${t.allProducts} ↗</a>
  </section>`,
  );
}

function resolveCollectionProducts(store, collection) {
  const byId = new Map(
    (store.products || []).map((product) => [product.id, product]),
  );
  return (collection.products || []).flatMap((entry) => {
    const full = byId.get(entry.id);
    return full ? [full] : [];
  });
}

function allProductsPage(site, store, availability = null) {
  const t = ui(store.locale);
  const products = store.products || [];
  return page(
    site,
    store,
    t.allProducts,
    `<section class="shell inner-page">
    <a class="breadcrumb" href="/collections">← ${t.collections}</a><span class="eyebrow">${t.productsEyebrow}</span><h1>${t.allProducts}</h1>
    ${catalogGrid(products, store, availability)}
  </section>`,
    200,
    { includeCatalogFilters: true },
  );
}

function collectionPage(site, store, collection, products, availability = null) {
  const t = ui(store.locale);
  store.metaDescription = collection.seoDescription || collection.description;
  return page(
    site,
    store,
    collection.seoTitle || collection.title,
    `<section class="shell inner-page">
    <a class="breadcrumb" href="/collections">← ${t.collections}</a><span class="eyebrow">${t.collection}</span>
    <h1>${escapeHtml(collection.title)}</h1>${descriptionHtml(collection)}
    ${catalogGrid(products, store, availability)}
  </section>`,
    200,
    {
      includeCatalogFilters: true,
      ogImage: imageUrl(collection.imageUrl),
    },
  );
}

function catalogGrid(products, store, availability = null) {
  const locale = language(store.locale);
  if (!products.length)
    return `<p class="empty-state">${ui(store.locale).emptyProducts}</p>`;
  return `<div class="catalog-layout" data-catalog><aside>${renderCatalogFilters(products, store, locale, { explain: false, availability })}</aside><div>${renderCatalogTools(products, locale)}<div class="product-grid">${products.map((product) => card(product, store)).join("")}</div><p data-catalog-empty hidden></p></div></div>`;
}

function productPage(site, store, product, requestedVariant) {
  const config = store.content || storeContent;
  const t = ui(store.locale);
  const variants = product.variants || [];
  const soldOut = variants.every((variant) => variant.outOfStock);
  const selected =
    variants.find(
      (variant) => variant.id === requestedVariant && !variant.outOfStock,
    ) ||
    variants.find((variant) => !variant.outOfStock) ||
    variants[0];
  const options = variants
    .map((variant) => {
      const label =
        variant.options
          ?.map((option) => `${option.name}: ${option.value}`)
          .join(" · ") || t.standard;
      return `<option value="${escapeHtml(variant.id)}" data-price="${escapeHtml(price(variant.price, store.currency, store.locale))}" data-reference="${Number(variant.compareAtPrice) > Number(variant.price) ? escapeHtml(price(variant.compareAtPrice, store.currency, store.locale)) : ""}" data-sku="${escapeHtml(variant.sku || "")}" data-out-of-stock="${Boolean(variant.outOfStock)}"${variant.id === selected?.id ? " selected" : ""}${variant.outOfStock ? " disabled" : ""}>${escapeHtml(label)} · ${escapeHtml(price(variant.price, store.currency, store.locale))}${variant.outOfStock ? ` · ${t.outOfStock}` : ""}</option>`;
    })
    .join("");
  const unavailable = variants.filter((variant) => variant.outOfStock);
  const notification =
    config.stockNotificationsEnabled && unavailable.length
      ? `<form data-stock-signup class="stock-signup"><h2>${t.stockSignupTitle}</h2><label>${t.options}<select name="variantId">${unavailable.map((variant) => `<option value="${escapeHtml(variant.id)}">${escapeHtml(variant.options.map((o) => `${o.name}: ${o.value}`).join(" · ") || t.standard)}</option>`).join("")}</select></label><label>${t.email}<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label class="newsletter-consent"><input name="consent" type="checkbox" required><span>${t.stockConsent}</span></label><a class="text-link" href="/policies/privacy">${t.privacy}</a><button class="button" type="submit">${t.notifyMe}</button><p data-newsletter-status role="status"></p></form>`
      : "";
  store.metaDescription = product.seoDescription || product.description;
  const canonical = canonicalHref(
    site,
    store,
    store.pagePath,
    store.marketHandle,
    store.locale,
  );
  return page(
    site,
    store,
    product.seoTitle || product.title,
    `<section class="shell inner-page" data-analytics-product-id="${escapeHtml(product.id)}">
    <nav class="product-navigation"><a class="breadcrumb" href="/collections/all">${t.backAllProducts}</a><a class="breadcrumb" data-catalog-return hidden>${String(store.locale).startsWith("en") ? "← Back to results" : "← Tilbake til resultatlisten"}</a></nav>
    <div class="product-detail"><div><div class="detail-image" data-gallery-main>${picture(product, { eager: true, sizes: "(max-width: 900px) 100vw, 50vw" })}</div>${
      product.images?.length > 1
        ? `<div class="product-thumbnails" role="group" aria-label="${t.images}">${product.images
            .slice(0, 8)
            .map(
              (image, index) =>
                `<button type="button" data-gallery-image aria-label="${t.image} ${index + 1}" aria-pressed="${index === 0}">${picture({ ...product, images: [image] }, { eager: false, sizes: "96px" })}</button>`,
            )
            .join("")}</div>`
        : ""
    }</div>
      <div class="detail-copy"><span class="eyebrow">${escapeHtml(product.brand || site.name)}</span>
        <h1>${escapeHtml(product.title)}</h1><p class="detail-price" data-variant-price>${escapeHtml(price(selected?.price, store.currency, store.locale))}${Number(selected?.compareAtPrice) > Number(selected?.price) ? ` <s>${escapeHtml(price(selected.compareAtPrice, store.currency, store.locale))}</s>` : ""}</p><p class="variant-sku" data-variant-sku>${selected?.sku ? `SKU: ${escapeHtml(selected.sku)}` : ""}</p>
        ${descriptionHtml(product)}
        ${
          options
            ? `<form data-add-to-cart><label for="variant">${t.options}</label><select id="variant" name="variantId" required${soldOut ? " disabled" : ""}>${options}</select>
          <label for="quantity">${t.quantity}</label><input id="quantity" name="quantity" type="number" min="1" max="20" value="1" required>
          <button class="button" type="submit"${soldOut ? " disabled" : ""}>${soldOut ? t.outOfStock : t.addToCart}</button><p data-add-message role="status"></p></form>`
            : ""
        }${notification}
      </div>
    </div><section class="product-section"><div class="section-heading"><h2>${t.moreProducts}</h2></div><div class="product-grid">${store.products
      .filter((p) => p.id !== product.id)
      .slice(0, 4)
      .map((p) => card(p, store))
      .join("")}</div></section>
  </section>`,
    200,
    {
      ogType: "product",
      ogImage: imageUrl(product.images?.[0]?.url),
      jsonLd: productJsonLd(site, store, product, canonical),
      includeCatalogContext: true,
    },
  );
}

function cartPage(site, store) {
  const t = ui(store.locale);
  return page(
    site,
    store,
    t.cart,
    `<section class="shell inner-page"><a class="breadcrumb" href="/collections/all">${t.continueShopping}</a>
    <h1>${t.yourCart}</h1>${cartContents(store)}</section>`,
    200,
    { cacheable: false },
  );
}

function completePage(site, store) {
  const t = ui(store.locale);
  return page(
    site,
    store,
    t.orderComplete,
    `<section class="shell inner-page" data-checkout-complete>
    <span class="eyebrow">${t.thankYou}</span><h1>${t.orderCompleteHeading}</h1>
    <p class="lead">${t.orderCompleteText}</p>
    <a class="button" href="/collections/all">${t.continueToStore}</a><a class="text-link" href="/cart">${t.viewCart}</a></section><section class="shell product-section"><div class="section-heading"><h2>${t.moreProducts}</h2></div><div class="product-grid">${store.products
      .slice(0, 4)
      .map((product) => card(product, store))
      .join("")}</div></section>`,
    200,
    { cacheable: false },
  );
}

function informationPage(site, store, slug) {
  const config = store.content || storeContent;
  const t = ui(store.locale);
  const key = INFORMATION_PAGES[slug];
  const content = config[language(store.locale)].pages[key];
  if (!content) return null;
  const siteName = site?.name || config.legalName || "Storefront";
  const contact = config.contactEmail
    ? `<a href="mailto:${escapeHtml(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a>`
    : t.fallbackContact;
  const renderText = (value) =>
    escapeHtml(value)
      .replaceAll("{name}", escapeHtml(siteName))
      .replaceAll("{contact}", contact);
  const details = [
    config.legalName &&
      `<p><strong>${t.business}:</strong> ${escapeHtml(config.legalName)}</p>`,
    config.organizationNumber &&
      `<p><strong>${t.organizationNumber}:</strong> ${escapeHtml(config.organizationNumber)}</p>`,
    config.address &&
      `<p><strong>${t.address}:</strong> ${escapeHtml(config.address)}</p>`,
  ]
    .filter(Boolean)
    .join("");
  const sections = content.sections
    .map(
      ([heading, body]) =>
        `<h2>${renderText(heading)}</h2><p>${renderText(body)}</p>`,
    )
    .join("");
  const links =
    key === "contact"
      ? `<div class="inline-links"><a href="/pages/shipping">${t.shipping} ↗</a><a href="/policies/returns">${t.returns} ↗</a></div>`
      : "";
  return page(
    site,
    store,
    content.title,
    `<section class="shell editorial-page"><a class="breadcrumb" href="/">${t.backStore}</a><div class="editorial-heading"><span class="eyebrow">${escapeHtml(content.eyebrow)}</span><h1>${escapeHtml(content.title)}</h1><p class="lead">${escapeHtml(content.lead)}</p></div><div class="editorial-body">${sections}${details}${links}</div></section>`,
  );
}

function sitemapXml(site, store) {
  const paths = [
    "/",
    "/collections",
    "/collections/all",
    ...(store.collections || []).map(
      (collection) => `/collections/${encodeURIComponent(collection.handle)}`,
    ),
    ...(store.products || []).map(
      (product) => `/products/${encodeURIComponent(product.handle)}`,
    ),
    ...Object.keys(INFORMATION_PAGES),
  ];
  const urls = paths
    .map((pathname) => {
      const loc = canonicalHref(
        site,
        store,
        pathname,
        store.marketHandle,
        store.locale,
      );
      return `  <url><loc>${escapeXml(loc)}</loc></url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function delivery(result) {
  const { response } = await result;
  if (!response.ok) {
    const error = new Error(`Site API returned ${response.status}`);
    error.status = response.status;
    error.response = response;
    throw error;
  }
  return response.json();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function checkoutLines(body) {
  if (
    !body ||
    !Array.isArray(body.lines) ||
    body.lines.length < 1 ||
    body.lines.length > 100
  )
    return null;
  const lines = body.lines.map((line) => ({
    variantId: line?.variantId,
    quantity: line?.quantity,
  }));
  if (
    lines.some(
      (line) =>
        typeof line.variantId !== "string" ||
        !UUID.test(line.variantId) ||
        !Number.isInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > 20,
    )
  )
    return null;
  return lines;
}

function sanitizeAnalyticsBatch(body) {
  if (
    !body ||
    !Array.isArray(body.events) ||
    body.events.length < 1 ||
    body.events.length > 25
  )
    return null;
  const events = [];
  for (const event of body.events) {
    if (
      !event ||
      typeof event.id !== "string" ||
      !UUID.test(event.id) ||
      typeof event.sessionId !== "string" ||
      !UUID.test(event.sessionId) ||
      !ANALYTICS_KINDS.has(event.kind) ||
      typeof event.path !== "string" ||
      !event.path.startsWith("/") ||
      event.path.length > 256 ||
      event.path.includes("?") ||
      event.path.includes("#")
    )
      return null;
    if (
      event.productId != null &&
      (typeof event.productId !== "string" || !UUID.test(event.productId))
    )
      return null;
    if (
      event.variantId != null &&
      (typeof event.variantId !== "string" || !UUID.test(event.variantId))
    )
      return null;
    if (
      event.campaignRecipient != null &&
      (typeof event.campaignRecipient !== "string" ||
        !UUID.test(event.campaignRecipient))
    )
      return null;
    if (
      event.quantity != null &&
      (!Number.isInteger(event.quantity) ||
        event.quantity < 1 ||
        event.quantity > 100)
    )
      return null;
    events.push({
      id: event.id,
      sessionId: event.sessionId,
      kind: event.kind,
      path: event.path,
      ...(event.productId ? { productId: event.productId } : {}),
      ...(event.variantId ? { variantId: event.variantId } : {}),
      ...(event.campaignRecipient
        ? { campaignRecipient: event.campaignRecipient }
        : {}),
      ...(event.quantity != null ? { quantity: event.quantity } : {}),
    });
  }
  return {
    events,
    ...(body.emailVisitTracking === true ? { emailVisitTracking: true } : {}),
  };
}

async function boundedJson(request, limit = 16_384) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let raw = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      return null;
    }
    raw += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(raw + decoder.decode());
  } catch {
    return null;
  }
}

function routeHandle(pathname, segment) {
  const match = pathname.match(new RegExp(`^/${segment}/([^/]+)/?$`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function inferredLocale(request, url) {
  const param = url.searchParams.get("locale");
  if (param) return param;
  const accept = request.headers.get("Accept-Language") || "";
  if (/\b(?:nb|nn|no)\b/i.test(accept)) return "nb";
  return "en";
}

function isKnownGetRoute(pathname) {
  if (
    [
      "/",
      "/sitemap.xml",
      "/catalog.json",
      "/reai/availabilities",
      "/collections",
      "/collections/",
      "/collections/all",
      "/collections/all/",
      "/cart",
      "/cart/",
      "/checkout/complete",
      "/checkout/complete/",
    ].includes(pathname)
  )
    return true;
  if (INFORMATION_PAGES[pathname.replace(/\/$/, "")]) return true;
  if (routeHandle(pathname, "collections") !== null) return true;
  if (routeHandle(pathname, "products") !== null) return true;
  return false;
}

function cacheStore() {
  return typeof caches !== "undefined" && caches?.default
    ? caches.default
    : null;
}

async function readCacheEntry(cacheKey) {
  const store = cacheStore();
  if (!store) return null;
  try {
    const cached = await store.match(new Request(cacheKey));
    if (!cached) return null;
    return {
      data: await cached.json(),
      etag: cached.headers.get("ETag"),
      cachedAt: Number(cached.headers.get("X-ReAI-Cached-At")) || 0,
    };
  } catch (error) {
    console.error("Cache read failed", error);
    return null;
  }
}

async function writeCacheEntry(cacheKey, data, etag = null) {
  const store = cacheStore();
  if (!store) return;
  try {
    await store.put(
      new Request(cacheKey),
      new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": `public, max-age=${CACHE_RETENTION_S}`,
          "X-ReAI-Cached-At": String(Date.now()),
          ...(etag ? { ETag: etag } : {}),
        },
      }),
    );
  } catch (error) {
    console.error("Cache write failed", error);
  }
}

async function getCachedSite(client, baseUrl, ctx) {
  const cacheKey = `https://reai-starter-cache.invalid/site/${encodeURIComponent(baseUrl.host)}`;
  const cached = await readCacheEntry(cacheKey);
  const refresh = async () => {
    const site = await delivery(client.site());
    await writeCacheEntry(cacheKey, site);
    return site;
  };
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    if (age <= CACHE_FRESH_MS) return structuredClone(cached.data);
    if (age <= CACHE_FRESH_MS + CACHE_SWR_MS && ctx?.waitUntil) {
      ctx.waitUntil(refresh().catch(console.error));
      return structuredClone(cached.data);
    }
    try {
      return await refresh();
    } catch (error) {
      if (age <= CACHE_RETENTION_MS) {
        console.error("Site refresh failed, serving stale cache", error);
        return structuredClone(cached.data);
      }
      throw error;
    }
  }
  return refresh();
}

async function getCachedStorefront(client, baseUrl, context, ctx) {
  const cacheKey = `https://reai-starter-cache.invalid/storefront/${encodeURIComponent(baseUrl.host)}/${encodeURIComponent(context.market)}/${encodeURIComponent(context.locale)}`;
  const cached = await readCacheEntry(cacheKey);
  const refresh = async () => {
    const result = await client.storefront(context, cached?.etag || null);
    const { response } = result;
    if (response.status === 304 && cached) {
      await writeCacheEntry(cacheKey, cached.data, cached.etag);
      return structuredClone(cached.data);
    }
    if (!response.ok) {
      const error = new Error(`Site API returned ${response.status}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    const data = await response.json();
    await writeCacheEntry(cacheKey, data, response.headers.get("ETag"));
    return structuredClone(data);
  };
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    if (age <= CACHE_FRESH_MS) return structuredClone(cached.data);
    if (age <= CACHE_FRESH_MS + CACHE_SWR_MS && ctx?.waitUntil) {
      ctx.waitUntil(refresh().catch(console.error));
      return structuredClone(cached.data);
    }
    try {
      return await refresh();
    } catch (error) {
      if (age <= CACHE_RETENTION_MS) {
        console.error("Storefront refresh failed, serving stale cache", error);
        return structuredClone(cached.data);
      }
      throw error;
    }
  }
  return refresh();
}

async function loadAvailability(client, products, context) {
  const ids = [
    ...new Set(
      (products || []).flatMap((product) =>
        (product.variants || []).map((variant) => variant.id),
      ),
    ),
  ];
  if (!ids.length) return { entries: [] };
  const batches = [];
  for (let start = 0; start < ids.length; start += 100) {
    batches.push(ids.slice(start, start + 100));
  }
  try {
    const results = await Promise.all(
      batches.map((batch) => delivery(client.availabilities(batch, context))),
    );
    const availability = new Map();
    for (const batch of results) {
      for (const variant of batch.variants || []) {
        availability.set(variant.variantId, variant.status);
      }
    }
    for (const product of products || []) {
      for (const variant of product.variants || []) {
        variant.outOfStock = availability.get(variant.id) !== "AVAILABLE";
      }
    }
    return {
      entries: ids.map((id) => [id, availability.get(id) || "OUT_OF_STOCK"]),
    };
  } catch (error) {
    console.error("Availability check failed", error);
    return { entries: null };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (
      url.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ) {
      url.protocol = "https:";
      return Response.redirect(url.href, 308);
    }
    const response = await handle(request, env, url, ctx);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!headers.has(name)) headers.set(name, value);
    }
    if (url.protocol === "https:")
      headers.set("strict-transport-security", "max-age=31536000");
    if (
      url.hostname.endsWith(".workers.dev") ||
      /^\/cart\/?$/.test(url.pathname) ||
      url.pathname.startsWith("/checkout/") ||
      response.status !== 200
    ) {
      headers.set("x-robots-tag", "noindex, nofollow");
    }
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      headers,
    });
  },
};

async function handle(request, env, url, ctx) {
  const config = env.STOREFRONT_CONTENT || storeContent;
  const basePath = env.STOREFRONT_BASE_PATH || "";
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.method !== "POST"
  )
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...SECURITY_HEADERS, "cache-control": "no-store" },
    });
  if (
    url.pathname.startsWith("/assets/") ||
    [
      "/styles.css",
      "/store.js",
      "/storefront-mark.svg",
      "/storefront-hero.avif",
    ].includes(url.pathname)
  )
    return env.ASSETS.fetch(request);
  if (request.method !== "POST" && url.pathname === "/health") {
    return json({
      ok: true,
      configured: Boolean(env.REAI_API_BASE_URL && env.REAI_SITE_CREDENTIAL),
    });
  }
  if (request.method !== "POST" && url.pathname === "/robots.txt") {
    const disallowAll = url.hostname.endsWith(".workers.dev");
    return new Response(
      disallowAll
        ? "User-agent: *\nDisallow: /\n"
        : `User-agent: *\nAllow: /\nDisallow: /cart\nDisallow: /checkout/\nDisallow: /reai/\nDisallow: /catalog.json\nSitemap: ${url.origin}${basePath}/sitemap.xml\n`,
      {
        headers: {
          ...SECURITY_HEADERS,
          "content-type": "text/plain; charset=utf-8",
          "cache-control": disallowAll ? "no-store" : "public, max-age=3600",
          ...(disallowAll ? { "x-robots-tag": "noindex, nofollow" } : {}),
        },
      },
    );
  }
  if (request.method === "POST") {
    if (
      ![
        "/checkout/start",
        "/newsletter/subscribe",
        "/stock/subscribe",
        "/reai/cart-quote",
        "/reai/analytics",
      ].includes(url.pathname)
    )
      return json({ error: "Method not allowed" }, 405);
    if (request.headers.get("Origin") !== url.origin)
      return json({ error: "Invalid origin" }, 403);
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      return json({ error: "Expected JSON" }, 415);
    if (
      url.pathname === "/checkout/start" &&
      String(env.CHECKOUT_ENABLED || "").trim().toLowerCase() === "false"
    )
      return json({ error: "Checkout is not enabled" }, 403);
    if (
      url.pathname === "/reai/analytics" &&
      (url.hostname.endsWith(".workers.dev") ||
        env.STOREFRONT_ANALYTICS_ENABLED === "false" ||
        env.STOREFRONT_SIGNUP_ENABLED === "false" ||
        !env.REAI_API_BASE_URL ||
        !env.REAI_SITE_CREDENTIAL)
    ) {
      return new Response(null, {
        status: 204,
        headers: { ...SECURITY_HEADERS, "cache-control": "no-store" },
      });
    }
  } else if (!isKnownGetRoute(url.pathname)) {
    const locale = inferredLocale(request, url);
    const t = ui(locale);
    return page(
      null,
      {
        locale,
        basePath,
        origin: url.origin,
        content: config,
        pagePath: url.pathname,
      },
      t.notFound,
      `<section class="shell inner-page"><span class="eyebrow">404</span><h1>${t.notFoundHeading}</h1><a class="button" href="/">${t.backToStore}</a></section>`,
      404,
      { cacheable: false },
    );
  }

  const infoSlug = url.pathname.replace(/\/$/, "");
  const isInfoRoute = request.method !== "POST" && Boolean(INFORMATION_PAGES[infoSlug]);

  if (!env.REAI_API_BASE_URL || !env.REAI_SITE_CREDENTIAL) {
    if (
      request.method === "POST" ||
      ["/catalog.json", "/reai/availabilities"].includes(url.pathname)
    )
      return json({ error: "Store is not configured" }, 503);
    if (url.pathname === "/sitemap.xml")
      return new Response("Store is not configured", {
        status: 503,
        headers: {
          ...SECURITY_HEADERS,
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    const locale = inferredLocale(request, url);
    if (isInfoRoute) {
      return informationPage(
        { name: config.legalName || "Storefront", markets: [] },
        {
          locale,
          basePath,
          origin: url.origin,
          content: config,
          pagePath: infoSlug,
          collections: [],
        },
        infoSlug,
      );
    }
    const t = ui(locale);
    return page(
      null,
      {
        locale,
        basePath,
        origin: url.origin,
        content: config,
        pagePath: url.pathname,
      },
      t.comingSoon,
      `<section class="shell inner-page"><span class="eyebrow">${t.comingSoon}</span><h1>${t.setupHeading}</h1><p class="lead">${t.setupText}</p></section>`,
      503,
      { cacheable: false },
    );
  }

  let resolvedLocale = inferredLocale(request, url);
  try {
    const baseUrl = new URL(env.REAI_API_BASE_URL);
    if (!["http:", "https:"].includes(baseUrl.protocol))
      throw new Error("Invalid API URL");
    const client = new ReaiSiteClient({
      baseUrl: baseUrl.href,
      token: env.REAI_SITE_CREDENTIAL,
      timeoutMs: 15_000,
    });
    if (url.pathname === "/reai/analytics") {
      const body = await boundedJson(request, 8_192);
      const batch = sanitizeAnalyticsBatch(body);
      if (!batch) return json({ error: "Invalid analytics events" }, 400);
      try {
        await client.recordAnalyticsEvents({
          ...batch,
          origin: url.origin,
        });
      } catch (error) {
        console.error("Analytics forwarding failed", error);
      }
      return new Response(null, {
        status: 204,
        headers: { ...SECURITY_HEADERS, "cache-control": "no-store" },
      });
    }
    if (["/newsletter/subscribe", "/stock/subscribe"].includes(url.pathname)) {
      if (request.method !== "POST")
        return json({ error: "Method not allowed" }, 405);
      const stock = url.pathname === "/stock/subscribe";
      if (
        stock
          ? !config.stockNotificationsEnabled
          : config.newsletterEnabled === false
      )
        return json({ error: "Signup unavailable" }, 404);
      if (env.STOREFRONT_SIGNUP_ENABLED === "false")
        return json({ error: "Signup unavailable in preview" }, 503);
      const body = await boundedJson(request, 2048);
      if (
        typeof body?.email !== "string" ||
        body.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
        body.consent !== true ||
        (body.name != null &&
          (typeof body.name !== "string" || body.name.length > 75)) ||
        (body.locale != null &&
          (typeof body.locale !== "string" || body.locale.length > 35)) ||
        (stock && !UUID.test(body.variantId))
      )
        return json(
          { error: "Valid email and explicit consent required" },
          400,
        );
      if (body.website) return json({ accepted: true });
      const input = {
        email: body.email.trim(),
        consent: true,
        ...(body.name?.trim() ? { name: body.name.trim() } : {}),
        ...(body.locale ? { locale: body.locale } : {}),
      };
      const result = await (stock
        ? client.subscribeStock({ ...input, variantId: body.variantId })
        : client.subscribeNewsletter(input));
      if (!result.response.ok)
        return json(
          { error: "Signup is temporarily unavailable" },
          result.response.status === 400 ? 400 : 503,
        );
      return json({ accepted: true });
    }

    if (isInfoRoute) {
      try {
        const site = await getCachedSite(client, baseUrl, ctx);
        const market =
          site.markets?.find(
            (entry) => entry.handle === url.searchParams.get("market"),
          ) || defaultSiteMarket(site);
        if (market) {
          const context = {
            market: market.handle,
            locale: (market.locales || [market.defaultLocale]).includes(
              url.searchParams.get("locale"),
            )
              ? url.searchParams.get("locale")
              : market.defaultLocale,
          };
          resolvedLocale = context.locale;
          const store = await getCachedStorefront(
            client,
            baseUrl,
            context,
            ctx,
          ).catch((error) => {
            console.error(
              "Storefront load failed for information page",
              error,
            );
            return {
              locale: context.locale,
              currency: market.currency || "",
              collections: [],
              products: [],
            };
          });
          store.content = config;
          store.pagePath = infoSlug;
          store.basePath = basePath;
          store.origin = url.origin;
          store.marketHandle = context.market;
          store.locale = store.locale || context.locale;
          return informationPage(site, store, infoSlug);
        }
      } catch (error) {
        console.error(
          "Site lookup failed for information page, rendering fallback",
          error,
        );
      }
      return informationPage(
        { name: config.legalName || "Storefront", markets: [] },
        {
          locale: resolvedLocale,
          basePath,
          origin: url.origin,
          content: config,
          pagePath: infoSlug,
          collections: [],
        },
        infoSlug,
      );
    }

    const site = await getCachedSite(client, baseUrl, ctx);
    const market =
      site.markets?.find(
        (entry) => entry.handle === url.searchParams.get("market"),
      ) || defaultSiteMarket(site);
    if (!market) throw new Error("No Site market configured");
    const context = {
      market: market.handle,
      locale: (market.locales || [market.defaultLocale]).includes(
        url.searchParams.get("locale"),
      )
        ? url.searchParams.get("locale")
        : market.defaultLocale,
    };
    resolvedLocale = context.locale;

    if (url.pathname === "/reai/availabilities") {
      const ids = (url.searchParams.get("resource") || "").split(",");
      if (ids.length > 100 || ids.some((id) => !UUID.test(id)))
        return json({ error: "Invalid variants" }, 400);
      return json(await delivery(client.availabilities(ids, context)));
    }
    if (url.pathname === "/reai/cart-quote") {
      const body = await boundedJson(request);
      const lines = checkoutLines(body);
      if (!lines) return json({ error: "Invalid cart" }, 400);
      const [quoteResult, snapshot] = await Promise.all([
        client.cartQuote({ lines }, context),
        getCachedStorefront(client, baseUrl, context, ctx).catch((error) => {
          console.error("Storefront lookup failed during cart quote", error);
          return null;
        }),
      ]);
      const items = {};
      if (snapshot?.products) {
        const wanted = new Set(lines.map((line) => line.variantId));
        for (const product of snapshot.products) {
          for (const variant of product.variants || []) {
            if (wanted.has(variant.id)) {
              items[variant.id] = {
                title: product.title,
                handle: product.handle,
                options: variant.options || [],
              };
            }
          }
        }
      }
      if (!quoteResult.response.ok) {
        const details = await quoteResult.response.json().catch(() => ({}));
        return json(
          {
            error: details.detail || "Cart could not be quoted",
            code: details.code,
            stockIssues: details.stockIssues,
            items,
          },
          [400, 404, 409].includes(quoteResult.response.status)
            ? quoteResult.response.status
            : 502,
        );
      }
      const quote = await quoteResult.json();
      return json({ ...quote, items });
    }
    if (url.pathname === "/checkout/start") {
      if (request.method !== "POST")
        return json({ error: "Method not allowed" }, 405);
      if (env.STOREFRONT_CHECKOUT_ENABLED === "false")
        return json({ error: "Checkout unavailable in preview" }, 503);
      const rawKey = request.headers.get("Idempotency-Key");
      if (rawKey !== null && !IDEMPOTENCY_KEY.test(rawKey))
        return json({ error: "Invalid Idempotency-Key" }, 400);
      const idempotencyKey = rawKey || crypto.randomUUID();
      const body = await boundedJson(request);
      const lines = checkoutLines(body);
      if (!lines) return json({ error: "Invalid cart" }, 400);
      const returnTarget = new URL(`${basePath}/checkout/complete`, url.origin);
      const def = defaultSiteMarket(site);
      const preserveContext =
        url.searchParams.has("market") ||
        url.searchParams.has("locale") ||
        (def &&
          (context.market !== def.handle ||
            context.locale !== def.defaultLocale));
      if (preserveContext) {
        returnTarget.searchParams.set("market", context.market);
        returnTarget.searchParams.set("locale", context.locale);
      }
      try {
        const session = await delivery(
          client.createCheckoutSession(
            {
              lines,
              returnUrl: returnTarget.href,
            },
            context,
            idempotencyKey,
          ),
        );
        const destination = new URL(session.checkoutUrl);
        if (
          destination.origin !== baseUrl.origin ||
          destination.protocol !== baseUrl.protocol ||
          !/^\/checkout\/session\/[^/]+$/.test(destination.pathname)
        )
          throw new Error("Invalid checkout destination");
        return json({ checkoutUrl: destination.href });
      } catch (error) {
        console.error("Checkout session creation failed", error);
        if (error.response) {
          const details = await error.response.json().catch(() => ({}));
          return json(
            {
              error: details.detail || "Checkout could not be started",
              code: details.code,
              stockIssues: details.stockIssues,
            },
            error.status,
          );
        }
        return json({ error: "Checkout is temporarily unavailable" }, 502);
      }
    }

    const store = await getCachedStorefront(client, baseUrl, context, ctx);
    store.content = config;
    store.pagePath = url.pathname;
    store.basePath = basePath;
    store.origin = url.origin;
    store.marketHandle = context.market;
    store.locale = store.locale || context.locale;

    if (url.pathname === "/sitemap.xml") {
      return new Response(sitemapXml(site, store), {
        headers: {
          ...SECURITY_HEADERS,
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=300, stale-while-revalidate=3600",
        },
      });
    }
    if (url.pathname === "/catalog.json") {
      await loadAvailability(client, store.products || [], context);
      return json({
        products: store.products,
        currency: store.currency,
        locale: store.locale,
      });
    }
    if (url.pathname === "/") {
      await loadAvailability(
        client,
        (store.products || []).slice(0, 8),
        context,
      );
      return home(site, store);
    }
    if (/^\/collections\/?$/.test(url.pathname))
      return collectionsPage(site, store);
    if (/^\/collections\/all\/?$/.test(url.pathname)) {
      const { entries } = await loadAvailability(
        client,
        store.products || [],
        context,
      );
      return allProductsPage(site, store, entries);
    }
    if (/^\/cart\/?$/.test(url.pathname)) return cartPage(site, store);
    if (/^\/checkout\/complete\/?$/.test(url.pathname)) {
      await loadAvailability(
        client,
        (store.products || []).slice(0, 4),
        context,
      );
      return completePage(site, store);
    }
    const collectionHandle = routeHandle(url.pathname, "collections");
    if (collectionHandle !== null) {
      const collection = store.collections?.find(
        (entry) => entry.handle === collectionHandle,
      );
      if (collection) {
        const products = resolveCollectionProducts(store, collection);
        const { entries } = await loadAvailability(client, products, context);
        return collectionPage(site, store, collection, products, entries);
      }
    }
    const productHandle = routeHandle(url.pathname, "products");
    if (productHandle !== null) {
      const product = store.products?.find(
        (entry) => entry.handle === productHandle,
      );
      if (product) {
        const related = (store.products || [])
          .filter((entry) => entry.id !== product.id)
          .slice(0, 4);
        await loadAvailability(client, [product, ...related], context);
        return productPage(
          site,
          store,
          product,
          url.searchParams.get("variant"),
        );
      }
    }
    const t = ui(store.locale);
    return page(
      site,
      store,
      t.notFound,
      `<section class="shell inner-page"><span class="eyebrow">404</span><h1>${t.notFoundHeading}</h1><a class="button" href="/">${t.backToStore}</a></section>`,
      404,
      { cacheable: false },
    );
  } catch (error) {
    console.error("Storefront request failed", error);
    if (
      [
        "/checkout/start",
        "/newsletter/subscribe",
        "/stock/subscribe",
        "/reai/availabilities",
        "/reai/cart-quote",
        "/reai/analytics",
        "/catalog.json",
      ].includes(url.pathname)
    )
      return json({ error: "Service is temporarily unavailable" }, 502);
    if (url.pathname === "/sitemap.xml")
      return new Response("Service is temporarily unavailable", {
        status: 502,
        headers: {
          ...SECURITY_HEADERS,
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    const t = ui(resolvedLocale);
    return page(
      null,
      {
        locale: resolvedLocale,
        basePath,
        origin: url.origin,
        content: config,
        pagePath: url.pathname,
      },
      t.temporarilyUnavailable,
      `<section class="shell inner-page"><span class="eyebrow">${t.tryAgain}</span><h1>${t.unavailableHeading}</h1><p class="lead">${t.unavailableText}</p></section>`,
      502,
      { cacheable: false },
    );
  }
}
