# Home Assistant base 3.24, pinned to the 2026.08.0 release.
ARG HA_BASE=ghcr.io/home-assistant/base:3.24-2026.08.0

FROM ${HA_BASE} AS builder

RUN apk add --no-cache git nodejs npm coreutils

# Keep the verified core revision as an exact commit, not a branch.
ARG RETHINK_REPO="https://github.com/SdrgonLee/rethink.git"
ARG RETHINK_REV="496bbbebe963101542a3073ba6dbb2a5ac288f66"
ENV SKIP_GIT_HOOKS=1

RUN git init /src \
    && git -C /src remote add origin "${RETHINK_REPO}" \
    && git -C /src fetch --depth 1 origin "${RETHINK_REV}" \
    && git -C /src checkout --detach FETCH_HEAD \
    && test "$(git -C /src rev-parse HEAD)" = "${RETHINK_REV}" \
    && printf '%s\n' "${RETHINK_REV}" > /src/RETHINK_REVISION

WORKDIR /src
RUN node -e "const major=Number(process.versions.node.split('.')[0]); if (major < 20) throw new Error('Node.js 20+ required')" \
    && npm ci \
    && npm run build \
    && npm prune --omit=dev

FROM ${HA_BASE} AS runtime

RUN apk add --no-cache nodejs openssl jq ca-certificates \
    && node -e "const major=Number(process.versions.node.split('.')[0]); if (major < 20) throw new Error('Node.js 20+ required')"

WORKDIR /app
COPY --from=builder /src/dist ./dist
COPY --from=builder /src/node_modules ./node_modules
COPY --from=builder /src/package.json ./package.json
COPY --from=builder /src/RETHINK_REVISION ./RETHINK_REVISION
COPY config-generator.mjs /usr/local/lib/rethink/config-generator.mjs
COPY run.sh /usr/local/bin/rethink-addon-run
RUN chmod 0755 /usr/local/bin/rethink-addon-run

ARG BUILD_VERSION="0.1.20"
ARG BUILD_ARCH="local"
LABEL io.hass.version="${BUILD_VERSION}" \
    io.hass.type="app" \
    io.hass.arch="${BUILD_ARCH}" \
    org.opencontainers.image.title="Home Assistant App: Rethink Transparent Bridge" \
    org.opencontainers.image.description="Experimental ThinQ cloud emulator and transparent ThinQ2 bridge"

CMD ["/usr/local/bin/rethink-addon-run"]
