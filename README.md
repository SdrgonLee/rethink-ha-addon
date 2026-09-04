# Rethink Transparent Bridge Home Assistant App

An experimental, unofficial Home Assistant App (formerly Add-on) repository for
running the Rethink ThinQ cloud emulator and transparent ThinQ2 bridge on Home
Assistant OS.

MQTT connection details are obtained automatically from Home Assistant's required
MQTT service; broker credentials are not exposed as App options.

This project is based on [anszom/rethink](https://github.com/anszom/rethink), with
the pinned bridge core published at
[SdrgonLee/rethink](https://github.com/SdrgonLee/rethink). It is not affiliated
with or endorsed by LG Electronics or Home Assistant.

The published multi-architecture Docker image is pinned to a tested Rethink commit. See
[`rethink/DOCS.md`](https://github.com/SdrgonLee/rethink-ha-addon/blob/main/rethink/DOCS.md)
for configuration and safety notes.

Release images are built for `amd64` and `aarch64`, combined at
`ghcr.io/sdrgonlee/rethink-ha-addon:<version>`, and pulled directly by Home Assistant
Supervisor. See [`RELEASING.md`](./RELEASING.md) for the image-first release order.

`build.yaml` is intentionally absent: the current Home Assistant 2026 App format
no longer consumes it. The base image, labels, and custom build arguments are
declared directly in the Dockerfile, which remains usable for local test builds.
