import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const [optionsPath = '/data/options.json', outputPath = '/data/rethink/config.json'] = process.argv.slice(2)

function requiredString(options, name) {
    const value = options[name]
    if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must be a non-empty string`)
    return value
}

function optionalString(object, name) {
    const value = object[name]
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string') throw new Error(`MQTT service ${name} must be a string`)
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

async function readMqttService() {
    let input = ''
    for await (const chunk of process.stdin) input += chunk

    try {
        const service = JSON.parse(input)
        const host = requiredString(service, 'host')
        const parsedPort = typeof service.port === 'string' ? Number(service.port) : service.port
        if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
            throw new Error('MQTT service port must be a valid TCP port')
        }
        if (typeof service.ssl !== 'boolean') throw new Error('MQTT service ssl must be a boolean')

        const urlHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
        return {
            url: `${service.ssl ? 'mqtts' : 'mqtt'}://${urlHost}:${parsedPort}`,
            username: optionalString(service, 'username'),
            password: optionalString(service, 'password'),
        }
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('MQTT service')) throw error
        throw new Error('MQTT service is required but unavailable or invalid')
    }
}

const options = JSON.parse(await readFile(optionsPath, 'utf8'))
const mqtt = await readMqttService()
if (!Array.isArray(options.log) || options.log.some((entry) => typeof entry !== 'string')) {
    throw new Error('log must be an array of strings')
}

const config = {
    hostname: requiredString(options, 'hostname'),
    homeassistant: {
        mqtt_url: mqtt.url,
        mqtt_user: mqtt.username,
        mqtt_pass: mqtt.password,
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
