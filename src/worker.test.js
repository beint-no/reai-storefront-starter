import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

const site = {
  name: "Sample <Shop>",
  markets: [{ handle: "default", defaultLocale: "en", isDefault: true }],
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
        isDefault: true,
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
