# ReAI storefront provisioning template

Private operational GitHub template used by the existing ReAI store creator.
Canonical starter source, examples and detailed documentation live in the
public [reai-site-examples](https://github.com/beint-no/reai-site-examples) repo.
This repository is generated from its everyday-store export; do not maintain
a second design implementation here.

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
