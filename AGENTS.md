# Private operational provisioning template

Canonical code lives in public beint-no/reai-site-examples. Refresh this template
from the everyday-store exporter; do not develop a second design source here.
Keep the GitHub template private, the provisioning App's repository access and
the existing runtime binding names intact. Never commit secrets or client data.

Clients receive independently generated private repositories. The private
customer-sites hub is the only overall client submodule registry. This template
is infrastructure and does not aggregate client source. Use dedicated worktrees,
PRs and squash merges; run npm run check and a Wrangler dry run after refreshing.

## Refresh the operational copy

Run `npm run export -- everyday-store /absolute/new/export-directory` in the
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
