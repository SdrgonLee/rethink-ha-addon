import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const [optionsPath = '/data/options.json', outputPath = '/data/rethink/config.json'] = process.argv.slice(2)

function requiredString(options, name) {
    const value = options[name]
    if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must be a non-empty string`)
    return value
}

function string(options, name) {
    const value = options[name]
    if (typeof value !== 'string') throw new Error(`${name} must be a string`)
    return value
}

function port(options, name) {
    const value = options[name]
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be a valid TCP port`)
    return value
}

function boolean(options, name) {
    const value = options[name]
    if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`)
    return value
}

function portObject(bind, advertise = bind) {
    return { bind, advertise, address: '0.0.0.0' }
}

const options = JSON.parse(await readFile(optionsPath, 'utf8'))
if (!Array.isArray(options.log) || options.log.some((entry) => typeof entry !== 'string')) {
    throw new Error('log must be an array of strings')
}

const config = {
    hostname: requiredString(options, 'hostname'),
    homeassistant: {
        mqtt_url: requiredString(options, 'mqtt_url'),
        mqtt_user: string(options, 'mqtt_user'),
        mqtt_pass: string(options, 'mqtt_pass'),
        discovery_prefix: requiredString(options, 'discovery_prefix'),
        rethink_prefix: requiredString(options, 'rethink_prefix'),
    },
    ca_key_file: 'ca.key',
    ca_cert_file: 'ca.cert',
    sni_certificates: boolean(options, 'sni_certificates'),
    https_port: portObject(port(options, 'https_bind_port'), 443),
    mqtts_port: portObject(port(options, 'mqtts_bind_port'), 8883),
    mqtt_port: portObject(port(options, 'mqtt_bind_port')),
    management_port: portObject(port(options, 'management_port')),
    thinq1_https_port: portObject(port(options, 'thinq1_https_port')),
    thinq1_port: portObject(port(options, 'thinq1_port')),
    bridge: {
        storage_path: './state',
        preserve_existing_devices: boolean(options, 'preserve_existing_devices'),
    },
    log: options.log,
}

const outputDir = dirname(outputPath)
const temporaryPath = join(outputDir, `.config.json.${process.pid}.tmp`)
await mkdir(outputDir, { recursive: true })

try {
    await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
    JSON.parse(await readFile(temporaryPath, 'utf8'))
    await chmod(temporaryPath, 0o600)
    await rename(temporaryPath, outputPath)
} catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
}
