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
  products: [{
    id: "p1",
    handle: "lamp",
    title: "Lamp <script>",
    description: "A useful lamp.",
    images: [{ url: "https://example.com/lamp.jpg", alt: "Desk lamp" }],
    variants: [{ id: "00000000-0000-4000-8000-000000000001", price: 25, options: [{ name: "Color", value: "Blue" }] }],
  }],
  collections: [{ id: "c1", handle: "home", title: "Home", products: [{ id: "p1" }] }],
};

test("renders Site catalog without exposing the Worker credential", async (context) => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (input, options) => {
    calls.push({ url: String(input), headers: options.headers });
    return Response.json(String(input).endsWith("/site/v1/site") ? site : store);
  });
  const env = { REAI_API_BASE_URL: "https://app.example.test", REAI_SITE_CREDENTIAL: "private-token" };
  const response = await worker.fetch(new Request("https://store.example/"), env);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Sample &lt;Shop&gt;/);
  assert.match(html, /Lamp &lt;script&gt;/);
  assert.doesNotMatch(html, /private-token/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.get("Authorization"), "Bearer private-token");
  assert.equal(calls[1].url, "https://app.example.test/site/v1/commerce/storefront?market=default&locale=en");

  const product = await worker.fetch(new Request("https://store.example/products/lamp"), env);
  assert.equal(product.status, 200);
  assert.match(await product.text(), /Color: Blue/);
});

test("shows setup page without making an upstream request when configuration is absent", async (context) => {
  context.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected request"); });
  const response = await worker.fetch(new Request("https://store.example/"), {});
  assert.equal(response.status, 503);
  assert.match(await response.text(), /being set up/);
});

test("renders editable information pages and linked footer without exposing credentials", async (context) => {
  context.mock.method(globalThis, "fetch", async (input) => Response.json(String(input).endsWith("/site/v1/site") ? site : store));
  const env = { REAI_API_BASE_URL: "https://app.example.test", REAI_SITE_CREDENTIAL: "private-token" };
  for (const path of ["/pages/about", "/pages/contact", "/pages/shipping", "/pages/faq", "/policies/returns", "/policies/privacy", "/policies/terms"]) {
    const response = await worker.fetch(new Request(`https://store.example${path}`), env);
    const html = await response.text();
    assert.equal(response.status, 200, path);
    assert.match(html, /Sample &lt;Shop&gt;/);
    assert.match(html, /<footer class="site-footer">/);
    assert.doesNotMatch(html, /private-token/);
  }
  const home = await worker.fetch(new Request("https://store.example/"), env);
  const html = await home.text();
  assert.match(html, /storefront-hero\.avif/);
  assert.match(html, /href="\/pages\/about"/);
  assert.match(html, /href="\/policies\/returns"/);
});

test("creates a hosted checkout session without exposing the Site credential", async (context) => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (input, options) => {
    calls.push({ url: String(input), options });
    if (String(input).endsWith("/site/v1/site")) return Response.json(site);
    return Response.json({ checkoutUrl: "https://app.example.test/checkout/session/test" });
  });
  const env = { REAI_API_BASE_URL: "https://app.example.test", REAI_SITE_CREDENTIAL: "private-token" };
  const response = await worker.fetch(new Request("https://store.example/checkout/start", {
    method: "POST",
    headers: { Origin: "https://store.example", "Content-Type": "application/json" },
    body: JSON.stringify({ lines: [{ variantId: "00000000-0000-4000-8000-000000000001", quantity: 2 }] }),
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { checkoutUrl: "https://app.example.test/checkout/session/test" });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers.get("Authorization"), "Bearer private-token");
  assert.ok(calls[1].options.headers.get("Idempotency-Key"));
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    lines: [{ variantId: "00000000-0000-4000-8000-000000000001", quantity: 2 }],
    returnUrl: "https://store.example/checkout/complete",
  });
});

test("rejects cross-origin checkout before contacting ReAI", async (context) => {
  context.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected request"); });
  const response = await worker.fetch(new Request("https://store.example/checkout/start", {
    method: "POST",
    headers: { Origin: "https://other.example", "Content-Type": "application/json" },
    body: JSON.stringify({ lines: [{ variantId: "00000000-0000-4000-8000-000000000001", quantity: 1 }] }),
  }), { REAI_API_BASE_URL: "https://app.example.test", REAI_SITE_CREDENTIAL: "private-token" });
  assert.equal(response.status, 403);
});
