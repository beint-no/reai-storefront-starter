# ReAI storefront starter

A small, public starting point for a Cloudflare Worker storefront backed by the ReAI Site API. It includes one neutral theme with a home page, collection pages, and product pages. The store name, products, collections, images, and prices come from ReAI at request time; they are not copied into this repository.

This first starter is **catalog only**. It does not create checkout sessions or claim that products are available to buy. Checkout, deployment automation, and custom domains can be added in later steps.

## Run locally

Requires Node.js 20 or newer.

```sh
npm ci
cp .dev.vars.example .dev.vars
```

Edit the ignored `.dev.vars` file:

- `REAI_API_BASE_URL`: the ReAI backend origin, such as `http://localhost:8080` for a local application or `https://app.reai.no` for production.
- `REAI_SITE_CREDENTIAL`: a Site credential with `site:read` and `commerce:catalog:read` scopes. Keep it server-side.

Then run:

```sh
npm run dev
```

Wrangler prints the local URL. The Worker requests `GET /site/v1/site` to find the Site name and default market, then `GET /site/v1/commerce/storefront` for the current catalog. If either request fails, visitors see a generic unavailable page; backend errors and credentials are not shown.

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
