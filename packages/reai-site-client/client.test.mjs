import assert from "node:assert/strict";
import test from "node:test";

import { ReaiSiteClient } from "./client.mjs";

test("builds every Site API operation from the generated contract", async () => {
  const requests = [];
  const client = new ReaiSiteClient({
    baseUrl: "https://api.example/",
    token: "site-token",
    async fetch(input, init) {
      requests.push(new Request(input, init));
      return Response.json({ accepted: true });
    },
  });
  const context = { market: "norway", locale: "nb-NO" };

  await client.site();
  await client.storefront(context, 'W/"storefront"');
  await client.catalog(context, 'W/"catalog"');
  await client.products(context);
  await client.product("shoe/name", context);
  await client.collections(context);
  await client.collection("best sellers", context);
  await client.availabilities(["variant-1", "variant-2"], context);
  await client.availability("variant/id", context);
  await client.checkoutDetails("checkout-id");
  await client.updateCheckout("checkout-id", { revision: 0, customer: { email: "demo@example.invalid" } });
  await client.checkoutDeliveryOptions("checkout-id", { revision: 0, customer: { email: "demo@example.invalid" } });
  await client.prepareCheckoutPayment("checkout-id", { revision: 1 });
  await client.createCheckoutSession({
    lines: [{ variantId: "018f3c2e-8b1a-4d3e-9c4f-5a6b7c8d9e0f", quantity: 2 }],
    returnUrl: "https://shop.example/complete/",
  }, context, "checkout-key");

  assert.deepEqual(requests.map((request) => request.method), [
    "GET", "GET", "GET", "GET", "GET", "GET", "GET", "GET", "GET", "GET", "PATCH", "POST", "POST", "POST",
  ]);
  assert.deepEqual(requests.map((request) => new URL(request.url).pathname), [
    "/site/v1/site",
    "/site/v1/commerce/storefront",
    "/site/v1/commerce/catalog",
    "/site/v1/commerce/products",
    "/site/v1/commerce/products/shoe%2Fname",
    "/site/v1/commerce/collections",
    "/site/v1/commerce/collections/best%20sellers",
    "/site/v1/commerce/availability",
    "/site/v1/commerce/availability/variant%2Fid",
    "/site/v1/commerce/checkout-sessions/checkout-id",
    "/site/v1/commerce/checkout-sessions/checkout-id",
    "/site/v1/commerce/checkout-sessions/checkout-id/delivery-options",
    "/site/v1/commerce/checkout-sessions/checkout-id/prepare-payment",
    "/site/v1/commerce/checkout-sessions",
  ]);
  for (const request of requests.slice(1, 9)) {
    const url = new URL(request.url);
    assert.equal(url.searchParams.get("market"), "norway");
    assert.equal(url.searchParams.get("locale"), "nb-NO");
    assert.equal(request.headers.get("Authorization"), "Bearer site-token");
  }
  assert.equal(requests[1].headers.get("If-None-Match"), 'W/"storefront"');
  assert.equal(requests[2].headers.get("If-None-Match"), 'W/"catalog"');
  assert.deepEqual(new URL(requests[7].url).searchParams.getAll("variantId"), ["variant-1", "variant-2"]);
  assert.equal(requests[13].headers.get("Idempotency-Key"), "checkout-key");
  assert.deepEqual(await requests[13].json(), {
    lines: [{ variantId: "018f3c2e-8b1a-4d3e-9c4f-5a6b7c8d9e0f", quantity: 2 }],
    returnUrl: "https://shop.example/complete/",
  });
});

test("returns typed JSON without changing the upstream response", async () => {
  const client = new ReaiSiteClient({
    token: "site-token",
    async fetch() {
      return Response.json({
        id: "site-id",
        name: "Example",
        sourceLocale: "nb-NO",
        status: "enabled",
        markets: [],
      }, { headers: { ETag: 'W/"site"' } });
    },
  });

  const result = await client.site();
  assert.equal(result.response.headers.get("ETag"), 'W/"site"');
  assert.equal((await result.json()).sourceLocale, "nb-NO");
});

test("requires a server-side Site credential", () => {
  assert.throws(() => new ReaiSiteClient({ token: "" }), /token is required/);
  assert.throws(() => new ReaiSiteClient({ token: "   " }), /token is required/);
});

test("calls fetch as a free function and trims the Site credential", async () => {
  let invokedThis;
  let authorization;
  const client = new ReaiSiteClient({
    token: " site-token \n",
    async fetch(input, init) {
      invokedThis = this;
      authorization = new Request(input, init).headers.get("Authorization");
      return Response.json({ ok: true });
    },
  });
  await client.site();
  assert.equal(invokedThis, undefined);
  assert.equal(authorization, "Bearer site-token");
});

test("supports cartQuote and recordAnalyticsEvents operations", async () => {
  const requests = [];
  const client = new ReaiSiteClient({
    baseUrl: "https://api.example/",
    token: "site-token",
    async fetch(input, init) {
      requests.push(new Request(input, init));
      return Response.json({ accepted: true });
    },
  });
  const context = { market: "norway", locale: "nb-NO" };
  const variantId = "018f3c2e-8b1a-4d3e-9c4f-5a6b7c8d9e0f";
  const eventId = "018f3c2e-8b1a-4d3e-9c4f-5a6b7c8d9e10";
  const sessionId = "018f3c2e-8b1a-4d3e-9c4f-5a6b7c8d9e11";

  await client.cartQuote({ lines: [{ variantId, quantity: 2 }] }, context);
  await client.cartQuote({ lines: [{ variantId, quantity: 1 }] });
  await client.recordAnalyticsEvents({
    origin: "https://shop.example",
    events: [{ id: eventId, sessionId, kind: "page_view", path: "/" }],
  });

  assert.deepEqual(requests.map((r) => [r.method, new URL(r.url).pathname]), [
    ["POST", "/site/v1/commerce/cart-quote"],
    ["POST", "/site/v1/commerce/cart-quote"],
    ["POST", "/site/v1/analytics/events"],
  ]);
  assert.equal(new URL(requests[0].url).searchParams.get("market"), "norway");
  assert.equal(new URL(requests[0].url).searchParams.get("locale"), "nb-NO");
  assert.equal(new URL(requests[1].url).search, "");
  assert.deepEqual(await requests[0].json(), {
    lines: [{ variantId, quantity: 2 }],
  });
  assert.deepEqual(await requests[2].json(), {
    origin: "https://shop.example",
    events: [{ id: eventId, sessionId, kind: "page_view", path: "/" }],
  });
});

test("attaches a default timeout signal unless disabled and rejects invalid timeoutMs", async () => {
  const signals = [];
  const defaultClient = new ReaiSiteClient({
    token: "site-token",
    async fetch(_input, init) {
      signals.push(init?.signal);
      return Response.json({ ok: true });
    },
  });
  await defaultClient.site();
  assert.ok(signals[0] instanceof AbortSignal);

  const noTimeoutClient = new ReaiSiteClient({
    token: "site-token",
    timeoutMs: 0,
    async fetch(_input, init) {
      signals.push(init?.signal);
      return Response.json({ ok: true });
    },
  });
  await noTimeoutClient.site();
  assert.equal(signals[1], undefined);

  assert.throws(() => new ReaiSiteClient({ token: "site-token", timeoutMs: -1 }), RangeError);
  assert.throws(() => new ReaiSiteClient({ token: "site-token", timeoutMs: Number.NaN }), RangeError);
});
