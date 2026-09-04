# Publishing a pre-built release

Home Assistant pulls the generic multi-architecture image declared in
`rethink/config.yaml`. Supervisor appends the exact Add-on `version` as its image tag.

The release workflow publishes these references for version `X.Y.Z`:

- `ghcr.io/sdrgonlee/rethink-ha-addon:X.Y.Z-amd64`
- `ghcr.io/sdrgonlee/rethink-ha-addon:X.Y.Z-aarch64`
- `ghcr.io/sdrgonlee/rethink-ha-addon:X.Y.Z` (multi-arch manifest used by Supervisor)

No `latest` tag is required or consumed.

## Safe release order

Do not publish a new `config.yaml` version on the default branch before its generic
GHCR manifest exists. Prepare the version and Docker pin in a release commit, then:

1. Push a `vX.Y.Z` tag pointing at the release commit, without publishing that commit
   to the default branch yet.
2. Wait for the **Publish GHCR image** workflow to finish successfully.
3. For the first package only, change the GHCR package visibility to **Public**.
4. Confirm that `ghcr.io/sdrgonlee/rethink-ha-addon:X.Y.Z` contains both
   `linux/amd64` and `linux/arm64`.
5. Push or merge the already-built release commit to the default branch.

This ordering keeps Home Assistant users on the previous repository metadata until
the new image is pullable. After the initial workflow is present on the default
branch, `workflow_dispatch` can also build a release branch: select that branch in
GitHub Actions and enter the exact version from its `rethink/config.yaml`, then merge
only after the manifest job succeeds.

The workflow uses the repository-provided `GITHUB_TOKEN`; no PAT or custom secret is
required. Its permissions are limited to `contents: read` and `packages: write`.
