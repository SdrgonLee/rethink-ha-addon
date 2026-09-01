# Rethink Transparent Bridge

This experimental Home Assistant App runs Rethink's local ThinQ cloud emulator,
Home Assistant MQTT discovery connector, management UI, and optional transparent
ThinQ2 bridge. Starting the App starts the server only. It does **not** enable a
device bridge, request an LG client certificate, modify OpenWRT, or intercept a
device. Bridge activation remains an explicit action in the management UI.

## Before starting

Set `mqtt_url` to a broker address reachable from this container and provide its
credentials when required. Do not assume `localhost`: inside a container it means
that same container. For the official Mosquitto App, use its current Home Assistant
internal hostname/alias shown by that App or use a deliberately chosen LAN broker
address. The field is mandatory so an incorrect broker is never guessed.

The App uses host networking. This makes the HAOS host address a straightforward
OpenWRT DNAT target and permits the several ThinQ listeners, but it reduces network
isolation and Home Assistant's security rating. No privileged mode, full access,
Docker API, host PID/UTS, or additional Linux capability is requested.

After startup, open `http://HAOS_IP:44401`. Ingress is not enabled in this version.

## Options

- `hostname`: DNS hostname placed in the local CA certificate; it must not be an IP address.
- `mqtt_url`, `mqtt_user`, `mqtt_pass`: Home Assistant MQTT broker connection.
- `discovery_prefix`, `rethink_prefix`: Home Assistant discovery and Rethink MQTT topic prefixes.
- `https_bind_port`: host listener for ThinQ HTTPS; default 4433, advertised as 443.
- `mqtts_bind_port`: host listener for ThinQ MQTTS; default 8884, advertised as 8883.
- `mqtt_bind_port`: local plaintext device MQTT listener; retained for core compatibility, default 1884.
- `management_port`: management UI, default 44401.
- `thinq1_https_port`, `thinq1_port`: legacy ThinQ1 listeners, defaults 46030 and 47878.
- `sni_certificates`: issue in-memory CA-signed leaf certificates for requested valid SNI names.
- `preserve_existing_devices`: keep an existing ThinQ2 Home registration and alias during bridge pairing.
- `log`: enabled Rethink log categories. Credentials and private material are never included in startup diagnostics.

Suggested OpenWRT redirection is `FX25:443 -> HAOS:4433` and
`FX25:8883 -> HAOS:8884`. Configure routing only during the later device test.

## Persistent private data and backups

Home Assistant provides `/data` as the App's private persistent volume and includes
it in App backups. Supervisor owns `/data/options.json`; this App writes only under:

```text
/data/rethink/
├── config.json
├── ca.key
├── ca.cert
└── state/
    ├── oauth2.json
    └── device_*.json (and other per-device bridge state)
```

The exact state filenames are controlled by Rethink. CA keys, OAuth refresh tokens,
LG client certificates, bridge private keys, topics, and server state remain inside
private `/data`; no `addon_config` mapping or manual config mode is used. Restarting
or updating the App reuses these files. Back up the App before enabling any bridge
and before changing its network configuration. Restoring a backup restores the App
files, but cannot guarantee restoration of a physical appliance's former LG-cloud
credential.

## Certificate and registration warning

When a ThinQ2 Bridge is enabled for the first time, Rethink may obtain a new LG
Cloud client certificate for the same device ID. On some LG ThinQ2 appliances, the
physical appliance's previous direct-cloud credential may no longer work afterward.
Removing Rethink Bridge and returning to direct LG Cloud operation may require
registering the appliance's Wi-Fi again in the ThinQ app. This App does not provide
automatic certificate restoration.

`preserve_existing_devices=true` protects the existing ThinQ2 Home registration;
it does not make certificate issuance reversible. ThinQ1 preservation is rejected
by the core because an equivalent safe workflow is not known.

## Build pin

Version `0.1.0` pins Rethink revision
`3046cd6b63f9b19190b6c29d41b543cf1b7d0899`. Before publishing, replace
`REPLACE_WITH_CORE_REPOSITORY_URL` in the Dockerfile with a repository containing
that exact commit. Do not replace the revision with a floating branch or tag.
