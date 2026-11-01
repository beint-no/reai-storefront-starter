# ReAI storefront source

In the operational beint-no/reai-storefront-starter repository, refresh generic
code from the public beint-no/reai-site-examples exporter. In a customer repository
generated from this template, maintain merchant design and editorial content in
that customer repository; ReAI remains the catalog and checkout source of truth.
The GitHub template is public; keep the provisioning App's repository access and
the existing runtime binding names intact. Never commit secrets or client data.

Clients receive independently generated repositories. The private
customer-sites hub is the only overall client submodule registry. This template
is infrastructure and does not aggregate client source. Use dedicated worktrees,
PRs and squash merges; run npm run check and a Wrangler dry run after refreshing.

## Refresh the operational copy

Run `npm run export -- storefront /absolute/new/export-directory` in the
public source repo. Copy that output into a dedicated worktree of this repo,
regenerate package-lock.json with npm install, run npm run check and a Wrangler
dry run, review the diff and squash merge. Keep the template free of credentials and customer data.

ReAI generates client repositories from this template, then installs
the client Worker configuration and deployment workflow. The provisioning
GitHub App must have access to this public template. Template updates do not
overwrite existing client repositories.

Runtime bindings are REAI_API_BASE_URL and server-side REAI_SITE_CREDENTIAL.
Never commit real credentials. The test Worker name is for local development;
ReAI supplies the actual deployment identity for a generated client store.

Each generated repository is independently usable. Customize src/store-content.js
and public/styles.css, review merchant details/policies, run npm run check, and
use the generated repository's approved publishing workflow.

The starter includes collections, catalog search/filter/sort from backend data,
variant prices and stock, image galleries, a cart drawer and full cart page,
hosted checkout, newsletter consent, language/market selection and information
pages. ReAI owns catalog data; store-content.js owns approved business copy.
A checkout return alone never proves payment and does not clear the cart.
Mobile filters keep a draft until Apply; Cancel/Escape discard it. Cart quantities
update automatically, including removal at zero and undo of the last removed line.
Catalog product links retain a validated local return path with filters, sort,
market/language and a product anchor. Product search matches SKU and options on
the same variant; language switches never rewrite content or education links.
Demo lessons, fashion fixtures and checkout simulations are not part of this template.

Newsletter signup is enabled by default and records explicit consent. Welcome
emails require a configured ReAI flow. stockNotificationsEnabled defaults to
false; enable only with an active back-in-stock flow and approved privacy text.
Stock alerts require separate consent and never subscribe someone to a newsletter.

## Manual GitHub Actions

Checks, deployment and PR previews run only when explicitly dispatched. Pushes,
pull requests and merges do not start workflows. Use the repository's local check,
deployment and preview commands for normal work. A manual PR preview must be
dispatched again after changes, and after closing a PR to remove it. Preview
credentials stay in the trusted controller; previews remain read-only and noindex.

## Direct Cloudflare commands

These commands run from this repository and do not use GitHub Actions. Install
with npm ci first. Authenticate using npm exec --yes --package=wrangler@4.156.0
-- wrangler login, or your CLOUDFLARE_API_TOKEN. Select the account with
CLOUDFLARE_ACCOUNT_ID. Existing Worker secrets and domain configuration are retained.

```sh
npm run deploy:local -- --dry-run
npm run deploy:local
npm run preview:deploy -- design
npm run preview:remove -- design
```

Deployment and preview creation run the relevant existing checks. --dry-run builds
without publishing. Multi-site repositories require a site name; available names
are in tools/worker-sites.json. Previews use a separate local- namespace, block
writes and carry noindex. Removing one leaves manually dispatched PR previews intact.

Catalog previews additionally need a PREVIEW Site credential with only site:read,
commerce:catalog:read and commerce:availability:read. Set
REAI_PREVIEW_CREDENTIAL_FILE to a token file outside Git, or provide
REAI_PREVIEW_CREDENTIAL in your local environment. Never use the live Site token
for a preview or commit a credential. Obtain the read-only credential through
ReAI Site credential management.
