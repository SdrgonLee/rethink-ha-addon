import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const addon = join(root, 'rethink')
const generator = join(addon, 'config-generator.mjs')

function options() {
    return {
        hostname: 'rethink.lan',
        discovery_prefix: 'homeassistant',
        rethink_prefix: 'rethink',
        https_bind_port: 4433,
        mqtts_bind_port: 8885,
        mqtt_bind_port: 1885,
        management_port: 44401,
        thinq1_https_port: 46030,
        thinq1_port: 47878,
        sni_certificates: true,
        preserve_existing_devices: true,
        log: ['status', 'incoming', 'HTTPS', 'publish', 'MGMT'],
    }
}

function mqttService(overrides = {}) {
    return {
        host: 'core-mosquitto',
        port: '1883',
        ssl: false,
        username: 'test-user',
        password: 'a"b$c\\test',
        ...overrides,
    }
}

function generate(optionsPath, outputPath, service = mqttService()) {
    return spawnSync(process.execPath, [generator, optionsPath, outputPath], {
        encoding: 'utf8',
        input: JSON.stringify(service),
    })
}

test('fixture generates exact core configuration and escapes credentials', () => {
    const data = mkdtempSync(join(tmpdir(), 'rethink-addon-'))
    const optionsPath = join(data, 'options.json')
    const outputPath = join(data, 'rethink', 'config.json')
    writeFileSync(optionsPath, JSON.stringify(options()))

    assert.equal('mqtt_url' in options(), false)
    assert.equal('mqtt_user' in options(), false)
    assert.equal('mqtt_pass' in options(), false)

    const result = generate(optionsPath, outputPath)
    const config = JSON.parse(readFileSync(outputPath, 'utf8'))

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, '')
    assert.equal(config.homeassistant.mqtt_url, 'mqtt://core-mosquitto:1883')
    assert.equal(config.homeassistant.mqtt_user, 'test-user')
    assert.equal(config.homeassistant.mqtt_pass, 'a"b$c\\test')
    assert.deepEqual(config.https_port, { bind: 4433, advertise: 443, address: '0.0.0.0' })
    assert.deepEqual(config.mqtts_port, { bind: 8885, advertise: 8883, address: '0.0.0.0' })
    assert.deepEqual(config.mqtt_port, { bind: 1885, advertise: 1885, address: '0.0.0.0' })
    assert.equal(config.ca_key_file, 'ca.key')
    assert.equal(config.ca_cert_file, 'ca.cert')
    assert.equal(config.bridge.storage_path, './state')
    assert.equal(config.sni_certificates, true)
    assert.equal(config.bridge.preserve_existing_devices, true)
})

test('TLS MQTT service produces an mqtts URL', () => {
    const data = mkdtempSync(join(tmpdir(), 'rethink-addon-mqtts-'))
    const optionsPath = join(data, 'options.json')
    const outputPath = join(data, 'rethink', 'config.json')
    writeFileSync(optionsPath, JSON.stringify(options()))

    const result = generate(optionsPath, outputPath, mqttService({ port: '8883', ssl: true }))
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(readFileSync(outputPath, 'utf8')).homeassistant.mqtt_url, 'mqtts://core-mosquitto:8883')
})

test('missing or invalid MQTT service fails explicitly without leaking credentials', () => {
    const data = mkdtempSync(join(tmpdir(), 'rethink-addon-no-mqtt-'))
    const optionsPath = join(data, 'options.json')
    const outputPath = join(data, 'rethink', 'config.json')
    writeFileSync(optionsPath, JSON.stringify(options()))

    const result = generate(optionsPath, outputPath, {})
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /MQTT service is required but unavailable or invalid/)
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /a"b\$c\\test/)
})

test('repeated generation preserves CA and bridge state', () => {
    const data = mkdtempSync(join(tmpdir(), 'rethink-addon-state-'))
    const rethink = join(data, 'rethink')
    const state = join(rethink, 'state')
    const optionsPath = join(data, 'options.json')
    const outputPath = join(rethink, 'config.json')
    mkdirSync(state, { recursive: true })
    writeFileSync(optionsPath, JSON.stringify(options()))
    writeFileSync(join(rethink, 'ca.key'), 'PRIVATE-CA-FIXTURE')
    writeFileSync(join(rethink, 'ca.cert'), 'CERT-FIXTURE')
    writeFileSync(join(state, 'oauth2.json'), '{"refresh":"fixture"}')

    assert.equal(generate(optionsPath, outputPath).status, 0)
    assert.equal(generate(optionsPath, outputPath).status, 0)

    assert.equal(readFileSync(join(rethink, 'ca.key'), 'utf8'), 'PRIVATE-CA-FIXTURE')
    assert.equal(readFileSync(join(rethink, 'ca.cert'), 'utf8'), 'CERT-FIXTURE')
    assert.equal(readFileSync(join(state, 'oauth2.json'), 'utf8'), '{"refresh":"fixture"}')
})

test('invalid generation leaves the previous valid config intact', () => {
    const data = mkdtempSync(join(tmpdir(), 'rethink-addon-atomic-'))
    const optionsPath = join(data, 'options.json')
    const outputPath = join(data, 'rethink', 'config.json')
    writeFileSync(optionsPath, JSON.stringify(options()))
    assert.equal(generate(optionsPath, outputPath).status, 0)
    const previous = readFileSync(outputPath, 'utf8')

    const invalid = options()
    invalid.https_bind_port = 70000
    writeFileSync(optionsPath, JSON.stringify(invalid))
    assert.notEqual(generate(optionsPath, outputPath).status, 0)
    assert.equal(readFileSync(outputPath, 'utf8'), previous)
})

test('startup script avoids state reset and ends with exec', () => {
    const script = readFileSync(join(addon, 'run.sh'), 'utf8')
    assert.doesNotMatch(script, /rm\s+-rf/)
    assert.doesNotMatch(script, /password|username/i)
    assert.match(script, /bashio::services\.available mqtt/)
    assert.match(script, /bashio::services mqtt \| node/)
    assert.match(script, /revision="\$\(tr -d '\\r\\n' < "\$\{REVISION_FILE\}"\)"/)
    assert.match(script, /Starting Rethink revision \$\{revision\}/)
    assert.doesNotMatch(script, /Starting Rethink revision [0-9a-f]{40}/)
    assert.match(script, /exec node \/app\/dist\/rethink-cloud\.js/)
})

test('metadata and Dockerfile retain required safety settings and pins', () => {
    const config = readFileSync(join(addon, 'config.yaml'), 'utf8')
    const dockerfile = readFileSync(join(addon, 'Dockerfile'), 'utf8')
    const repository = readFileSync(join(root, 'repository.yaml'), 'utf8')
    const workflow = readFileSync(join(root, '.github', 'workflows', 'publish-ghcr.yml'), 'utf8')

    for (const token of ['host_network: true', 'boot: manual', 'startup: services', 'stage: experimental']) {
        assert.match(config, new RegExp(token))
    }
    assert.match(config, /ingress: true/)
    assert.match(config, /ingress_port: 44401/)
    assert.match(config, /panel_icon: mdi:washing-machine/)
    assert.doesNotMatch(config, /^webui:/m)
    assert.match(config, /services:\s+- mqtt:need/)
    assert.match(config, /mqtts_bind_port: 8885/)
    assert.match(config, /mqtt_bind_port: 1885/)
    assert.doesNotMatch(config, /mqtt_(url|user|pass)/)
    for (const forbidden of ['full_access:', 'privileged:', 'docker_api:', 'addon_config']) {
        assert.doesNotMatch(config, new RegExp(forbidden))
    }
    assert.match(dockerfile, /ghcr\.io\/home-assistant\/base:3\.24-2026\.08\.0/)
    assert.match(config, /version: '0\.1\.23'/)
    assert.match(config, /^image: ghcr\.io\/sdrgonlee\/rethink-ha-addon$/m)
    assert.match(dockerfile, /BUILD_VERSION="0\.1\.23"/)
    assert.match(dockerfile, /RETHINK_REV="94bc1a2cda98ed79b68c61d68a35c784891b1022"/)
    assert.match(dockerfile, /RETHINK_REVISION/)
    assert.match(dockerfile, /apk add --no-cache nodejs openssl jq ca-certificates/)
    assert.match(dockerfile, /RETHINK_REPO="https:\/\/github\.com\/SdrgonLee\/rethink\.git"/)
    assert.match(repository, /https:\/\/github\.com\/SdrgonLee\/rethink-ha-addon/)
    assert.match(workflow, /contents: read/)
    assert.match(workflow, /packages: write/)
    assert.match(workflow, /linux\/amd64/)
    assert.match(workflow, /linux\/arm64/)
    assert.match(workflow, /BUILD_ARCH=\$\{\{ matrix\.arch \}\}/)
    assert.match(workflow, /context: \.\/rethink/)
    assert.match(workflow, /docker buildx imagetools create/)
    assert.match(workflow, /ghcr\.io\/sdrgonlee\/rethink-ha-addon/)
    assert.doesNotMatch(workflow, /(?:^|:)latest(?:$|\s)/m)
})
