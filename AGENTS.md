# Private operational provisioning template

Canonical code lives in public beint-no/reai-site-examples. Refresh this template
from the everyday-store exporter; do not develop a second design source here.
Keep the GitHub template private, the provisioning App's repository access and
the existing runtime binding names intact. Never commit secrets or client data.

Clients receive independently generated private repositories. The private
customer-sites hub is the only overall client submodule registry. This template
is infrastructure and does not aggregate client source. Use dedicated worktrees,
PRs and squash merges; run npm run check and a Wrangler dry run after refreshing.
