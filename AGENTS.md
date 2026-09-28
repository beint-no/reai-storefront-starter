# Storefront editing guide

- This repository is a reusable starting point, not a customer storefront. Keep merchant names, domains, product data, and credentials out of source control.
- ReAI is the source of truth for catalog, collections, images, prices, and later checkout. Do not bake product data into HTML or JavaScript.
- The Site credential belongs only in the Worker secret binding. Never send it to the browser or log it.
- Keep presentation changes in `public/styles.css` and page renderers in `src/worker.js`. Prefer the smallest change that meets the request.
- Do not introduce a second commerce backend or client-side calls to the Site API.
- Run `npm run check` after code changes.
