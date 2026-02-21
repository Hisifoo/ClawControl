// App metadata and OpenClaw client identity
//
// Keep these values centralized so the connect payload and device signature stay in sync.

import pkg from '../../package.json'

export const APP_NAME = 'ClawControl'
export const APP_VERSION = pkg.version as string

// Unique ID used in OpenClaw Gateway connect payloads.
// NOTE: Must match the clientId embedded in the device challenge signature payload.
export const OPENCLAW_CLIENT_ID = 'openclaw-control-ui'
export const OPENCLAW_CLIENT_MODE = 'ui'
export const OPENCLAW_ROLE = 'operator'
