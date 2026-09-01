# Rethink Transparent Bridge Home Assistant App

An experimental, unofficial Home Assistant App (formerly Add-on) repository for
running the Rethink ThinQ cloud emulator and transparent ThinQ2 bridge on Home
Assistant OS.

This project is based on [anszom/rethink](https://github.com/anszom/rethink) and
is not affiliated with or endorsed by LG Electronics or Home Assistant.

The Docker build is pinned to a tested Rethink commit. Before publishing, replace
the `RETHINK_REPO` placeholder in `rethink/Dockerfile` and the repository metadata
placeholder in `repository.yaml`. See `rethink/DOCS.md` for configuration and
safety notes.

`build.yaml` is intentionally absent: the current Home Assistant 2026 App format
no longer consumes it. The base image, labels, and custom build arguments are
declared directly in the Dockerfile.
