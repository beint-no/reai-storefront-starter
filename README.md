# ReAI storefront starter

A small, public starting point for a Cloudflare Worker storefront backed by the ReAI Site API. It includes one neutral theme with a home page, collection pages, product pages, a cart, and hosted checkout. The store name, products, collections, images, and prices come from ReAI at request time; they are not copied into this repository.

The browser keeps only public variant IDs and quantities in its cart. The Worker creates a checkout session with its server-side Site credential, then sends the shopper to ReAI for customer details, shipping, and payment. ReAI validates current prices and stock again at checkout.

Payment requires an active Adyen ecommerce store for the tenant and a configured ReAI Adyen management API key. A Site can show its catalog and open hosted checkout before those payment prerequisites are ready, but payment will remain unavailable.

## Run locally

Requires Node.js 20 or newer.

```sh
npm ci
cp .dev.vars.example .dev.vars
```

Edit the ignored `.dev.vars` file:

- `REAI_API_BASE_URL`: the ReAI backend origin, such as `http://localhost:8080` for a local application or `https://app.reai.no` for production.
- `REAI_SITE_CREDENTIAL`: a Site credential with `site:read`, `commerce:catalog:read`, and `commerce:checkout:create` scopes. Keep it server-side.

Set the Site's preview domain to the storefront hostname before starting checkout. ReAI accepts the checkout return URL only when it matches the Site's active or preview domain. For local HTTP development, use a public HTTPS tunnel and its hostname.

Then run:

```sh
npm run dev
```

Wrangler prints the local URL. The Worker requests `GET /site/v1/site` to find the Site name and default market, then `GET /site/v1/commerce/storefront` for the current catalog. Checkout posts to the Worker at `/checkout/start`; the Worker calls `POST /site/v1/commerce/checkout-sessions` and returns only the hosted checkout URL. If catalog requests fail, visitors see a generic unavailable page; credentials are not shown.

## Customize

- Edit `public/styles.css` for colors, typography, and layout.
- Edit `src/worker.js` for page copy and HTML structure. Look for `home`, `collectionPage`, and `productPage`.
- Publish products, collections, images, and prices in ReAI. Catalog changes then appear without rebuilding the Worker.

The starter selects the Site's default market and its default locale. Add an explicit market/locale selector before serving a store that needs shoppers to change either one. No merchant name, product data, domain, or Site credential is committed here.

## Deployment boundary

`wrangler.jsonc` uses a clearly marked `test-` Worker name for local experiments. A generated store repository should receive its own Worker identifier and runtime bindings from ReAI's provisioning flow. The Worker expects `REAI_API_BASE_URL` as a runtime variable and `REAI_SITE_CREDENTIAL` as a Worker secret. Do not put the credential in `wrangler.jsonc`, GitHub Actions, or browser code.

The Worker uses no `caches.default`, so the code can also run in Cloudflare Workers for Platforms' untrusted mode. The included Wrangler configuration is for local development and standalone testing; ReAI-managed deployment will be implemented separately.

Run `npm run check` before committing changes.

## License

MIT. See [LICENSE](LICENSE).
