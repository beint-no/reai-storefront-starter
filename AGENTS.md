# Private operational provisioning template

Canonical code lives in public beint-no/reai-site-examples. Refresh this template
from the storefront exporter; do not develop a second design source here.
Keep the GitHub template private, the provisioning App's repository access and
the existing runtime binding names intact. Never commit secrets or client data.

Clients receive independently generated private repositories. The private
customer-sites hub is the only overall client submodule registry. This template
is infrastructure and does not aggregate client source. Use dedicated worktrees,
PRs and squash merges; run npm run check and a Wrangler dry run after refreshing.

## Refresh the operational copy

Run `npm run export -- storefront /absolute/new/export-directory` in the
public source repo. Copy that output into a dedicated worktree of this repo,
regenerate package-lock.json with npm install, run npm run check and a Wrangler
dry run, review the diff and squash merge. Keep the template private.

ReAI generates private client repositories from this template, then installs
the client Worker configuration and deployment workflow. The provisioning
GitHub App must have access to this private template. Template updates do not
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

## Automatic PR previews

Open PRs receive a stable isolated Cloudflare Preview URL, updated on pushes
and removed on close. `.github/workflows/preview.yml` builds without deployment
credentials, then requests the trusted preview workflow in beint-no/reai-site-examples through signed
GitHub Actions OIDC. Cloudflare credentials stay in the central deployment repository.
The server maps this repository to its assigned Worker, verifies the current PR,
and provides only a read-only PREVIEW Site credential where catalog access is needed.
Previews are noindex and reject orders, payments and form submissions.
Manually dispatch PR previews with a PR number to backfill an already-open PR.
Register independently created repositories in the server's customer preview registry;
new repositories created through the e-commerce module are recognized automatically.
