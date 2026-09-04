# Rethink Transparent Bridge

This experimental Home Assistant App runs Rethink's local ThinQ cloud emulator,
Home Assistant MQTT discovery connector, management UI, and optional transparent
ThinQ2 bridge. Starting the App starts the server only. It does **not** enable a
device bridge, request an LG client certificate, modify OpenWRT, or intercept a
device. Bridge activation remains an explicit action in the management UI.

## Before starting

This App declares Home Assistant's MQTT service as required. At startup, Bashio
retrieves the service host, port, TLS flag, username, and password from Supervisor.
No broker address or credential is entered in the App options, and there is no
`localhost` fallback. If no MQTT service is installed and running, startup stops
with an explicit error. Manual or external broker override is outside this first
version's scope.

The App uses host networking. This makes the HAOS host address a straightforward
OpenWRT DNAT target and permits the several ThinQ listeners, but it reduces network
isolation and Home Assistant's security rating. No privileged mode, full access,
Docker API, host PID/UTS, or additional Linux capability is requested.

After startup, use the **Open Web UI** button on the App page. Home Assistant
Ingress keeps the management UI inside the Home Assistant frontend and carries
HTTP and WebSocket traffic through the authenticated Home Assistant connection;
no external management-port forwarding is required. The configured
`management_port` must remain equal to the App's fixed Ingress port, 44401.

## Options

- `hostname`: DNS hostname placed in the local CA certificate; it must not be an IP address.
- `discovery_prefix`, `rethink_prefix`: Home Assistant discovery and Rethink MQTT topic prefixes.
- `https_bind_port`: host listener for ThinQ HTTPS; default 4433, advertised as 443.
- `mqtts_bind_port`: host listener for ThinQ MQTTS; default 8885, advertised as 8883.
- `mqtt_bind_port`: local plaintext device MQTT listener; retained for core compatibility, default 1885.
- `management_port`: management UI, default 44401.
- `thinq1_https_port`, `thinq1_port`: legacy ThinQ1 listeners, defaults 46030 and 47878.
- `sni_certificates`: issue in-memory CA-signed leaf certificates for requested valid SNI names.
- `preserve_existing_devices`: keep an existing ThinQ2 Home registration and alias during bridge pairing.
- `log`: enabled Rethink log categories. Credentials and private material are never included in startup diagnostics.

The official Home Assistant Mosquitto App reserves host ports 1884 and 8884, so
Rethink deliberately avoids both. Suggested OpenWRT redirection is
`FX25:443 -> HAOS:4433` and `FX25:8883 -> HAOS:8885`. Configure routing only
during the later device test.

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

Version `0.1.19` pins Rethink revision
[`496bbbebe963101542a3073ba6dbb2a5ac288f66`](https://github.com/SdrgonLee/rethink/commit/496bbbebe963101542a3073ba6dbb2a5ac288f66).
For LG FX25 (`FX___N`) devices, it replaces the duplicate course, soil, rinse, spin, temperature, and
TurboWash read-only entities with the existing control selects. Each select now sends its command
immediately but keeps the last appliance-reported state until the FX25 returns an authoritative state
block; it is therefore explicitly non-optimistic. The existing select unique IDs and MQTT topics remain
unchanged. Automations that used the removed sensor or binary-sensor entities must be moved to their
corresponding select entities. The obsolete `Send to washer` button is also removed.

For KR devices, current operating-state names share a `상태 ·` prefix and selected course-setting names
share a `코스 ·` prefix, so Home Assistant sorts each group together. Other regions use the equivalent
`Status ·` and `Course ·` prefixes. The release retains the verified power-control switch,
bidirectional ThinQ2 application capture, full-cycle status entities, and the Home Assistant Ingress
management UI. The startup log reads the exact core revision from an immutable file produced by the
same Docker build pin.
The pinned source is [SdrgonLee/rethink](https://github.com/SdrgonLee/rethink). Do not replace the
revision with a floating branch or tag. The App repository is
[SdrgonLee/rethink-ha-addon](https://github.com/SdrgonLee/rethink-ha-addon).
