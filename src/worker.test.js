import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

const site = {
  name: "Sample <Shop>",
  markets: [{ handle: "default", defaultLocale: "en", default: true }],
};
const store = {
  locale: "en",
  currency: "USD",
  products: [
    {
      id: "p1",
      handle: "lamp",
      title: "Lamp <script>",
      description: "A useful lamp.",
      images: [{ url: "https://example.com/lamp.jpg", alt: "Desk lamp" }],
      variants: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          price: 25,
          options: [{ name: "Color", value: "Blue" }],
        },
      ],
    },
  ],
  collections: [
    { id: "c1", handle: "home", title: "Home", products: [{ id: "p1" }] },
  ],
};

test("renders Site catalog without exposing the Worker credential", async (context) => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (input, options) => {
    calls.push({ url: String(input), headers: options.headers });
    return Response.json(
      String(input).endsWith("/site/v1/site")
        ? site
        : String(input).includes("/commerce/availability?")
          ? {
              variants: [
                {
                  variantId: store.products[0].variants[0].id,
                  status: "AVAILABLE",
                },
              ],
            }
          : store,
    );
  });
  const env = {
    REAI_API_BASE_URL: "https://app.example.test",
    REAI_SITE_CREDENTIAL: "private-token",
  };
  const response = await worker.fetch(
    new Request("https://store.example/"),
    env,
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Sample &lt;Shop&gt;/);
  assert.match(html, /Lamp &lt;script&gt;/);
  assert.doesNotMatch(html, /private-token/);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].headers.get("Authorization"), "Bearer private-token");
  assert.equal(
    calls[1].url,
    "https://app.example.test/site/v1/commerce/storefront?market=default&locale=en",
  );

  const product = await worker.fetch(
    new Request("https://store.example/products/lamp"),
    env,
  );
  assert.equal(product.status, 200);
  assert.match(await product.text(), /Color: Blue/);
});

test("shows setup page without making an upstream request when configuration is absent", async (context) => {
  context.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected request");
  });
  const response = await worker.fetch(
    new Request("https://store.example/"),
    {},
  );
  assert.equal(response.status, 503);
  assert.match(await response.text(), /being set up/);
});

test("renders editable information pages and linked footer without exposing credentials", async (context) => {
  context.mock.method(globalThis, "fetch", async (input) =>
    Response.json(
      String(input).endsWith("/site/v1/site")
        ? site
        : String(input).includes("/commerce/availability?")
          ? {
              variants: [
                {
                  variantId: store.products[0].variants[0].id,
                  status: "AVAILABLE",
                },
              ],
            }
          : store,
    ),
  );
  const env = {
    REAI_API_BASE_URL: "https://app.example.test",
    REAI_SITE_CREDENTIAL: "private-token",
  };
  for (const path of [
    "/pages/about",
    "/pages/contact",
    "/pages/shipping",
    "/pages/faq",
    "/policies/returns",
    "/policies/privacy",
    "/policies/terms",
  ]) {
    const response = await worker.fetch(
      new Request(`https://store.example${path}`),
      env,
    );
    const html = await response.text();
    assert.equal(response.status, 200, path);
    assert.match(html, /Sample &lt;Shop&gt;/);
    assert.match(html, /<footer class="site-footer">/);
    assert.doesNotMatch(html, /private-token/);
  }
  const home = await worker.fetch(new Request("https://store.example/"), env);
  const html = await home.text();
  assert.match(html, /storefront-hero\.avif/);
  assert.match(html, /href="\/pages\/about\?[^"]*"/);
  assert.match(html, /href="\/policies\/returns\?[^"]*"/);
});

test("creates a hosted checkout session without exposing the Site credential", async (context) => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (input, options) => {
    calls.push({ url: String(input), options });
    if (String(input).endsWith("/site/v1/site")) return Response.json(site);
    return Response.json({
      checkoutUrl: "https://app.example.test/checkout/session/test",
    });
  });
  const env = {
    REAI_API_BASE_URL: "https://app.example.test",
    REAI_SITE_CREDENTIAL: "private-token",
  };
  const response = await worker.fetch(
    new Request("https://store.example/checkout/start", {
      method: "POST",
      headers: {
        Origin: "https://store.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lines: [
          { variantId: "00000000-0000-4000-8000-000000000001", quantity: 2 },
        ],
      }),
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    checkoutUrl: "https://app.example.test/checkout/session/test",
  });
  assert.equal(calls.length, 2);
  assert.equal(
    calls[1].options.headers.get("Authorization"),
    "Bearer private-token",
  );
  assert.ok(calls[1].options.headers.get("Idempotency-Key"));
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    lines: [{ variantId: "00000000-0000-4000-8000-000000000001", quantity: 2 }],
    returnUrl: "https://store.example/checkout/complete",
  });
});

test("rejects cross-origin checkout before contacting ReAI", async (context) => {
  context.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected request");
  });
  const response = await worker.fetch(
    new Request("https://store.example/checkout/start", {
      method: "POST",
      headers: {
        Origin: "https://other.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lines: [
          { variantId: "00000000-0000-4000-8000-000000000001", quantity: 1 },
        ],
      }),
    }),
    {
      REAI_API_BASE_URL: "https://app.example.test",
      REAI_SITE_CREDENTIAL: "private-token",
    },
  );
  assert.equal(response.status, 403);
});

function signup(body, path = "/newsletter/subscribe", headers = {}) {
  return new Request("https://store.example" + path, {
    method: "POST",
    headers: {
      Origin: "https://store.example",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
const configured = {
  REAI_API_BASE_URL: "https://app.example.test",
  REAI_SITE_CREDENTIAL: "private-token",
};
test("newsletter rejects missing consent, cross-origin, invalid email and oversized input before contacting ReAI", async (context) => {
  context.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected write");
  });
  for (const [body, headers, expected] of [
    [{ email: "qa@example.test", consent: false }, {}, 400],
    [{ email: "invalid", consent: true }, {}, 400],
    [
      { email: "qa@example.test", consent: true, extra: "x".repeat(3000) },
      {},
      400,
    ],
    [
      { email: "qa@example.test", consent: true },
      { Origin: "https://other.example" },
      403,
    ],
  ])
    assert.equal(
      (
        await worker.fetch(
          signup(body, "/newsletter/subscribe", headers),
          configured,
        )
      ).status,
      expected,
    );
});
test("newsletter forwards explicit consent and locale through the client and returns no customer identity", async (context) => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ accepted: true, customerId: 99 });
  });
  const response = await worker.fetch(
    signup({
      email: " qa@example.test ",
      consent: true,
      locale: "en",
      name: "QA",
      price: 10,
    }),
    configured,
  );
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://app.example.test/site/v1/newsletter/subscriptions",
  );
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: "qa@example.test",
    consent: true,
    name: "QA",
    locale: "en",
  });
  assert.equal(
    calls[0].init.headers.get("Authorization"),
    "Bearer private-token",
  );
});
test("signup failures are explicit and a return page does not assert paid status", async (context) => {
  context.mock.method(globalThis, "fetch", async (url) =>
    String(url).includes("newsletter/subscriptions")
      ? new Response("", { status: 403 })
      : Response.json(String(url).endsWith("/site") ? site : String(url).includes("/commerce/availability?") ? { variants: [] } : store),
  );
  assert.equal(
    (
      await worker.fetch(
        signup({ email: "qa@example.test", consent: true }),
        configured,
      )
    ).status,
    503,
  );
  const html = await (
    await worker.fetch(
      new Request("https://store.example/checkout/complete"),
      configured,
    )
  ).text();
  assert.match(html, /This page alone does not confirm payment/);
  assert.doesNotMatch(html, /Your payment was completed/);
});
test("selected market and supported locale are retained in pages, stock checks and checkout", async (context) => {
  const calls = [];
  const multilingual = {
    ...site,
    markets: [
      {
        handle: "default",
        defaultLocale: "nb-NO",
        locales: ["nb-NO", "en"],
        currency: "NOK",
        default: true,
      },
    ],
  };
  context.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(
      String(url).endsWith("/site")
        ? multilingual
        : String(url).includes("availability?")
          ? {
              variants: [
                {
                  variantId: store.products[0].variants[0].id,
                  status: "AVAILABLE",
                },
              ],
            }
          : String(url).includes("checkout-sessions")
            ? { checkoutUrl: "https://app.example.test/checkout/session/test" }
            : { ...store, marketHandle: "default" },
    );
  });
  const html = await (
    await worker.fetch(
      new Request(
        "https://store.example/collections/all?market=default&locale=en",
      ),
      configured,
    )
  ).text();
  assert.match(html, /href="\/products\/lamp\?market=default&amp;locale=en"/);
  assert.match(html, /locale=nb-NO/);
  assert.match(html, /data-catalog/);
  assert.ok(
    calls.some((c) => c.url.includes("storefront?market=default&locale=en")),
  );
  await worker.fetch(
    signup(
      { lines: [{ variantId: store.products[0].variants[0].id, quantity: 1 }] },
      "/checkout/start?market=default&locale=en",
    ),
    configured,
  );
  assert.ok(
    calls.some((c) =>
      c.url.includes("checkout-sessions?market=default&locale=en"),
    ),
  );
});
test("checkout rejects a foreign destination and prefix hosting preserves the return path", async (context) => {
  let destination = "https://evil.example/checkout/session/test",
    body;
  context.mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url).endsWith("/site")) return Response.json(site);
    body = JSON.parse(init.body);
    return Response.json({ checkoutUrl: destination });
  });
  const request = () =>
    signup(
      { lines: [{ variantId: store.products[0].variants[0].id, quantity: 1 }] },
      "/checkout/start",
    );
  assert.equal((await worker.fetch(request(), configured)).status, 502);
  destination = "https://app.example.test/checkout/session/test";
  assert.equal(
    (
      await worker.fetch(request(), {
        ...configured,
        STOREFRONT_BASE_PATH: "/designs/starter",
      })
    ).status,
    200,
  );
  assert.equal(
    body.returnUrl,
    "https://store.example/designs/starter/checkout/complete",
  );
});
test("unknown stock blocks purchasing and optional back-in-stock needs independent consent", async (context) => {
  const { storeContent } = await import("./store-content.js");
  const previous = storeContent.stockNotificationsEnabled;
  storeContent.stockNotificationsEnabled = true;
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(
      String(url).endsWith("/site")
        ? site
        : String(url).includes("availability?")
          ? { variants: [] }
          : String(url).includes("stock-subscriptions")
            ? { accepted: true }
            : store,
    );
  });
  try {
    const html = await (
      await worker.fetch(
        new Request("https://store.example/products/lamp"),
        configured,
      )
    ).text();
    assert.match(html, /data-stock-signup/);
    assert.match(html, /Out of stock<\/button>/);
    assert.equal(
      (
        await worker.fetch(
          signup(
            {
              variantId: store.products[0].variants[0].id,
              email: "qa@example.test",
              consent: false,
            },
            "/stock/subscribe",
          ),
          configured,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await worker.fetch(
          signup(
            {
              variantId: store.products[0].variants[0].id,
              email: "qa@example.test",
              consent: true,
            },
            "/stock/subscribe",
          ),
          configured,
        )
      ).status,
      200,
    );
    assert.ok(
      calls.some((c) => c.url.endsWith("/commerce/stock-subscriptions")),
    );
    assert.ok(!calls.some((c) => c.url.endsWith("/newsletter/subscriptions")));
  } finally {
    storeContent.stockNotificationsEnabled = previous;
  }
});

test("handles /health, /robots.txt, and unknown 404 routes without contacting ReAI", async (context) => {
  context.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected upstream request");
  });
  const health = await worker.fetch(
    new Request("https://store.example/health"),
    configured,
  );
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, configured: true });
  assert.equal(
    health.headers.get("strict-transport-security"),
    "max-age=31536000",
  );

  const localHealth = await worker.fetch(
    new Request("http://localhost:8787/health"),
    configured,
  );
  assert.equal(localHealth.status, 200);
  assert.equal(localHealth.headers.get("strict-transport-security"), null);

  const robots = await worker.fetch(
    new Request("https://store.example/robots.txt"),
    configured,
  );
  assert.equal(robots.status, 200);
  const robotsText = await robots.text();
  assert.match(robotsText, /Disallow: \/cart/);
  assert.match(robotsText, /Disallow: \/checkout\//);
  assert.match(robotsText, /Disallow: \/reai\//);
  assert.match(robotsText, /Disallow: \/catalog\.json/);
  assert.match(robotsText, /Sitemap: https:\/\/store\.example\/sitemap\.xml/);

  const workersRobots = await worker.fetch(
    new Request("https://preview.example.workers.dev/robots.txt"),
    configured,
  );
  assert.equal(workersRobots.status, 200);
  assert.equal(workersRobots.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(workersRobots.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(workersRobots.headers.get("strict-transport-security"), "max-age=31536000");
  assert.equal(await workersRobots.text(), "User-agent: *\nDisallow: /\n");

  const workersRobotsHead = await worker.fetch(
    new Request("https://preview.example.workers.dev/robots.txt", { method: "HEAD" }),
    configured,
  );
  assert.equal(workersRobotsHead.status, 200);
  assert.equal(workersRobotsHead.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(await workersRobotsHead.text(), "");

  const disabledCheckout = await worker.fetch(
    signup(
      { lines: [{ variantId: store.products[0].variants[0].id, quantity: 1 }] },
      "/checkout/start",
    ),
    { ...configured, CHECKOUT_ENABLED: "false" },
  );
  assert.equal(disabledCheckout.status, 403);
  assert.equal(disabledCheckout.headers.get("cache-control"), "no-store");
  assert.match(disabledCheckout.headers.get("content-type") || "", /application\/json/);

  const missing = await worker.fetch(
    new Request("https://store.example/does-not-exist", {
      headers: { "Accept-Language": "nb-NO,nb;q=0.9" },
    }),
    configured,
  );
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(missing.headers.get("cache-control"), "no-store");
  assert.match(await missing.text(), /Vi fant ikke denne siden/);
});

test("renders /pages/* and /policies/* gracefully when ReAI is unreachable", async (context) => {
  context.mock.method(globalThis, "fetch", async () => {
    throw new Error("Upstream down");
  });
  const res = await worker.fetch(
    new Request("https://store.example/policies/privacy?locale=nb"),
    configured,
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-language"), "nb");
  assert.match(await res.text(), /Personvern/);
});

test("caches site and storefront with ETag, SWR, and stale-if-error", async (context) => {
  const originalCaches = globalThis.caches;
  const originalNow = Date.now;
  context.after(() => {
    globalThis.caches = originalCaches;
    Date.now = originalNow;
  });
  let now = 1_000_000;
  Date.now = () => now;
  const memory = new Map();
  globalThis.caches = {
    default: {
      async match(req) {
        return memory.get(req.url)?.clone();
      },
      async put(req, res) {
        memory.set(req.url, res.clone());
      },
    },
  };
  let failUpstream = false;
  const calls = [];
  context.mock.method(globalThis, "fetch", async (input, init) => {
    const url = String(input);
    calls.push({ url, ifNoneMatch: init?.headers?.get("If-None-Match") });
    if (failUpstream) throw new Error("Upstream offline");
    if (url.endsWith("/site")) return Response.json(site);
    if (url.includes("/availability"))
      return Response.json({
        variants: [{ variantId: store.products[0].variants[0].id, status: "AVAILABLE" }],
      });
    if (init?.headers?.get("If-None-Match") === 'W/"v1"')
      return new Response(null, { status: 304 });
    return Response.json(store, { headers: { ETag: 'W/"v1"' } });
  });

  const first = await worker.fetch(
    new Request("https://store.example/collections"),
    configured,
    {},
  );
  assert.equal(first.status, 200);
  assert.equal(
    first.headers.get("cache-control"),
    "public, max-age=60, stale-while-revalidate=300",
  );
  assert.equal(calls.length, 2);

  // Within 60s -> full cache hit, no upstream calls
  const second = await worker.fetch(
    new Request("https://store.example/collections"),
    configured,
    {},
  );
  assert.equal(second.status, 200);
  assert.equal(calls.length, 2);

  // Within SWR window -> background revalidation with If-None-Match
  now += 61_000;
  const bg = [];
  const stale = await worker.fetch(
    new Request("https://store.example/collections"),
    configured,
    { waitUntil: (p) => bg.push(p) },
  );
  assert.equal(stale.status, 200);
  await Promise.all(bg);
  assert.ok(calls.some((c) => c.ifNoneMatch === 'W/"v1"'));

  // Past SWR window with upstream failure -> serves stale-if-error
  now += 400_000;
  failUpstream = true;
  const staleError = await worker.fetch(
    new Request("https://store.example/collections"),
    configured,
    {},
  );
  assert.equal(staleError.status, 200);
});

test("preserves curated collection ordering, passes availability to filters, and degrades gracefully on availability failure", async (context) => {
  const orderedStore = {
    locale: "en",
    currency: "USD",
    products: [
      {
        id: "p-first",
        handle: "first",
        title: "First",
        images: [],
        variants: [
          { id: "00000000-0000-4000-8000-000000000011", price: 10, options: [] },
        ],
      },
      {
        id: "p-second",
        handle: "second",
        title: "Second",
        images: [],
        variants: [
          { id: "00000000-0000-4000-8000-000000000012", price: 20, options: [] },
        ],
      },
    ],
    collections: [
      {
        id: "c1",
        handle: "featured",
        title: "Featured",
        seoTitle: "Featured SEO Title",
        seoDescription: "Featured SEO Description",
        products: [{ id: "p-second" }, { id: "p-first" }],
      },
    ],
  };
  let failAvailability = false;
  context.mock.method(globalThis, "fetch", async (input) => {
    const url = String(input);
    if (url.endsWith("/site")) return Response.json(site);
    if (url.includes("/availability")) {
      if (failAvailability) return new Response("error", { status: 503 });
      return Response.json({
        variants: [
          { variantId: "00000000-0000-4000-8000-000000000012", status: "AVAILABLE" },
          { variantId: "00000000-0000-4000-8000-000000000011", status: "OUT_OF_STOCK" },
        ],
      });
    }
    return Response.json(orderedStore);
  });

  const res = await worker.fetch(
    new Request("https://store.example/collections/featured"),
    configured,
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.indexOf("/products/second") < html.indexOf("/products/first"));
  assert.match(html, /<title>Featured SEO Title · Sample &lt;Shop&gt;<\/title>/);
  assert.match(html, /Featured SEO Description/);
  assert.match(html, /catalog-filters\.js/);
  assert.match(html, /00000000-0000-4000-8000-000000000012&quot;,&quot;AVAILABLE/);

  // Availability failure does not 502 the page
  failAvailability = true;
  const degraded = await worker.fetch(
    new Request("https://store.example/collections/featured"),
    configured,
  );
  assert.equal(degraded.status, 200);
});

test("emits SEO metadata, JSON-LD, sitemap.xml, workers.dev noindex, and omits catalog-filters.js off collections", async (context) => {
  const richSite = {
    name: "Nordic Shop",
    markets: [
      {
        handle: "default",
        defaultLocale: "nb-NO",
        locales: ["nb-NO", "en"],
        currency: "NOK",
        default: true,
      },
    ],
  };
  const richStore = {
    locale: "nb-NO",
    currency: "NOK",
    products: [
      {
        id: "00000000-0000-4000-8000-000000000099",
        handle: "wool-coat",
        title: "Wool Coat",
        seoTitle: "Best Wool Coat",
        seoDescription: "Warm Norwegian wool coat.",
        brand: "Nordic",
        images: [{ url: "https://cdn.example/coat.jpg", width: 800, height: 1000 }],
        variants: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            sku: "COAT-1",
            price: 1200,
            options: [{ name: "Size", value: "M" }],
          },
        ],
      },
    ],
    collections: [{ id: "c1", handle: "winter", title: "Winter", products: [] }],
  };
  context.mock.method(globalThis, "fetch", async (input) => {
    const url = String(input);
    if (url.endsWith("/site")) return Response.json(richSite);
    if (url.includes("/availability"))
      return Response.json({
        variants: [{ variantId: "00000000-0000-4000-8000-000000000001", status: "AVAILABLE" }],
      });
    return Response.json(richStore);
  });

  const pdp = await worker.fetch(
    new Request("https://store.example/products/wool-coat?variant=00000000-0000-4000-8000-000000000001"),
    configured,
  );
  assert.equal(pdp.status, 200);
  assert.equal(pdp.headers.get("content-language"), "nb-NO");
  assert.equal(pdp.headers.get("x-robots-tag"), null);
  const pdpHtml = await pdp.text();
  assert.match(pdpHtml, /<title>Best Wool Coat · Nordic Shop<\/title>/);
  assert.match(pdpHtml, /<link rel="canonical" href="https:\/\/store\.example\/products\/wool-coat">/);
  assert.match(pdpHtml, /hreflang="nb-NO"/);
  assert.match(pdpHtml, /hreflang="en"/);
  assert.match(pdpHtml, /hreflang="x-default"/);
  assert.match(pdpHtml, /property="og:type" content="product"/);
  assert.match(pdpHtml, /application\/ld\+json/);
  assert.match(pdpHtml, /"priceCurrency":"NOK"/);
  assert.match(pdpHtml, /loading="eager" fetchpriority="high"/);
  assert.doesNotMatch(pdpHtml, /catalog-filters\.js/);

  const preview = await worker.fetch(
    new Request("https://preview.example.workers.dev/products/wool-coat"),
    configured,
  );
  assert.equal(preview.headers.get("x-robots-tag"), "noindex, nofollow");

  const sitemap = await worker.fetch(
    new Request("https://store.example/sitemap.xml"),
    configured,
  );
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  assert.match(xml, /<loc>https:\/\/store\.example\/products\/wool-coat<\/loc>/);
  assert.match(xml, /<loc>https:\/\/store\.example\/collections\/winter<\/loc>/);
});

test("supports /reai/cart-quote, /reai/analytics, Idempotency-Key validation, and returnUrl context preservation", async (context) => {
  const multilingual = {
    ...site,
    markets: [
      {
        handle: "default",
        defaultLocale: "nb-NO",
        locales: ["nb-NO", "en"],
        currency: "NOK",
        default: true,
      },
    ],
  };
  const calls = [];
  context.mock.method(globalThis, "fetch", async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/site")) return Response.json(multilingual);
    if (url.includes("/cart-quote")) {
      return Response.json({
        currency: "NOK",
        locale: "en",
        discount: 0,
        subtotal: 50,
        total: 50,
        lines: [
          {
            variantId: store.products[0].variants[0].id,
            quantity: 2,
            unitPrice: 25,
            subtotal: 50,
            total: 50,
          },
        ],
      });
    }
    if (url.includes("/analytics/events")) return new Response(null, { status: 200 });
    if (url.includes("/checkout-sessions"))
      return Response.json({ checkoutUrl: "https://app.example.test/checkout/session/test" });
    return Response.json(store);
  });

  const quoteRes = await worker.fetch(
    signup(
      { lines: [{ variantId: store.products[0].variants[0].id, quantity: 2 }] },
      "/reai/cart-quote?market=default&locale=en",
    ),
    configured,
  );
  assert.equal(quoteRes.status, 200);
  const quoteJson = await quoteRes.json();
  assert.equal(quoteJson.total, 50);
  assert.equal(quoteJson.items[store.products[0].variants[0].id].handle, "lamp");

  // Analytics no-op on workers.dev
  const devAnalytics = await worker.fetch(
    new Request("https://demo.test.workers.dev/reai/analytics", {
      method: "POST",
      headers: {
        Origin: "https://demo.test.workers.dev",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            id: "00000000-0000-4000-8000-000000000021",
            sessionId: "00000000-0000-4000-8000-000000000022",
            kind: "page_view",
            path: "/",
          },
        ],
      }),
    }),
    configured,
  );
  assert.equal(devAnalytics.status, 204);
  assert.ok(!calls.some((c) => c.url.includes("/analytics/events")));

  // Analytics forwards on custom domain
  const liveAnalytics = await worker.fetch(
    signup(
      {
        events: [
          {
            id: "00000000-0000-4000-8000-000000000021",
            sessionId: "00000000-0000-4000-8000-000000000022",
            kind: "page_view",
            path: "/",
          },
        ],
      },
      "/reai/analytics",
    ),
    configured,
  );
  assert.equal(liveAnalytics.status, 204);
  assert.ok(calls.some((c) => c.url.includes("/analytics/events")));

  // Invalid Idempotency-Key rejected
  const badKey = await worker.fetch(
    signup(
      { lines: [{ variantId: store.products[0].variants[0].id, quantity: 1 }] },
      "/checkout/start",
      { "Idempotency-Key": "bad key!" },
    ),
    configured,
  );
  assert.equal(badKey.status, 400);

  // Non-default locale preserved in returnUrl
  const checkoutRes = await worker.fetch(
    signup(
      { lines: [{ variantId: store.products[0].variants[0].id, quantity: 1 }] },
      "/checkout/start?market=default&locale=en",
      { "Idempotency-Key": "00000000-0000-4000-8000-000000000033" },
    ),
    configured,
  );
  assert.equal(checkoutRes.status, 200);
  const checkoutCall = calls.find((c) => c.url.includes("/checkout-sessions"));
  assert.equal(
    JSON.parse(checkoutCall.init.body).returnUrl,
    "https://store.example/checkout/complete?market=default&locale=en",
  );
});
