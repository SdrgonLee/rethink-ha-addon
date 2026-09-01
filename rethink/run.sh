#!/usr/bin/with-contenv bashio
set -Eeuo pipefail

readonly DATA_ROOT="${RETHINK_DATA_ROOT:-/data/rethink}"
readonly OPTIONS_FILE="${RETHINK_OPTIONS_FILE:-/data/options.json}"
readonly CONFIG_FILE="${DATA_ROOT}/config.json"
readonly STATE_DIR="${DATA_ROOT}/state"

mkdir -p "${DATA_ROOT}" "${STATE_DIR}"
chmod 0700 "${DATA_ROOT}" "${STATE_DIR}"

if ! bashio::services.available mqtt; then
    bashio::log.fatal 'MQTT service is required but unavailable.'
    bashio::log.fatal 'Install and start an MQTT service such as the Home Assistant Mosquitto Broker.'
    exit 1
fi

if ! bashio::services mqtt | node /usr/local/lib/rethink/config-generator.mjs "${OPTIONS_FILE}" "${CONFIG_FILE}"; then
    bashio::log.fatal 'MQTT service is required but unavailable or invalid.'
    bashio::log.fatal 'Install and start an MQTT service such as the Home Assistant Mosquitto Broker.'
    exit 1
fi

hostname="$(jq -r '.hostname' "${CONFIG_FILE}")"
https_port="$(jq -r '.https_port.bind' "${CONFIG_FILE}")"
mqtts_port="$(jq -r '.mqtts_port.bind' "${CONFIG_FILE}")"
management_port="$(jq -r '.management_port.bind' "${CONFIG_FILE}")"
sni="$(jq -r '.sni_certificates' "${CONFIG_FILE}")"
preserve="$(jq -r '.bridge.preserve_existing_devices' "${CONFIG_FILE}")"

bashio::log.info 'Starting Rethink revision 3046cd6b63f9b19190b6c29d41b543cf1b7d0899'
bashio::log.info "Config: ${CONFIG_FILE}"
bashio::log.info "Host: ${hostname}; HTTPS: ${https_port}; MQTTS: ${mqtts_port}; management: ${management_port}"
bashio::log.info "SNI certificates: ${sni}; preserve existing devices: ${preserve}"

exec node /app/dist/rethink-cloud.js "${CONFIG_FILE}"
