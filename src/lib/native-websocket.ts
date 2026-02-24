// WebSocket-compatible wrapper around the NativeWebSocket Capacitor plugin.
// Provides the same interface as the browser WebSocket so it can be used as
// a drop-in replacement via the WebSocketFactory injection in OpenClawClient.

import { NativeWebSocket } from 'capacitor-native-websocket'
import type { TLSOptions } from 'capacitor-native-websocket'

export type { TLSOptions }

type ListenerHandle = { remove: () => Promise<void> }

export interface NativeWebSocketOptions extends TLSOptions {
  origin?: string
}

export class NativeWebSocketWrapper {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3

  readyState: number = NativeWebSocketWrapper.CONNECTING

  onopen: ((ev: any) => void) | null = null
  onclose: ((ev: any) => void) | null = null
  onerror: ((ev: any) => void) | null = null
  onmessage: ((ev: any) => void) | null = null

  private listeners: ListenerHandle[] = []

  constructor(url: string, options?: NativeWebSocketOptions) {
    this.readyState = NativeWebSocketWrapper.CONNECTING
    this.init(url, options)
  }

  /** Browser WebSocket used as fallback when native plugin isn't available. */
  private fallbackWs: WebSocket | null = null

  private async init(url: string, options?: NativeWebSocketOptions): Promise<void> {
    try {
      const openHandle = await NativeWebSocket.addListener('open', () => {
        this.readyState = NativeWebSocketWrapper.OPEN
        this.onopen?.({ type: 'open' })
      })
      this.listeners.push(openHandle)

      const msgHandle = await NativeWebSocket.addListener('message', (event: any) => {
        if (this.readyState !== NativeWebSocketWrapper.OPEN) return
        this.onmessage?.({ type: 'message', data: event.data })
      })
      this.listeners.push(msgHandle)

      const closeHandle = await NativeWebSocket.addListener('close', (event: any) => {
        this.readyState = NativeWebSocketWrapper.CLOSED
        this.onclose?.({ type: 'close', code: event.code, reason: event.reason })
        this.cleanup()
      })
      this.listeners.push(closeHandle)

      const errorHandle = await NativeWebSocket.addListener('error', (event: any) => {
        const msg = event.message || ''
        // Tag TLS errors from the native side so the client can detect them
        const isTLS = typeof msg === 'string' && msg.startsWith('TLS_CERTIFICATE_ERROR:')
        this.onerror?.({ type: 'error', message: msg, isTLSError: isTLS })
      })
      this.listeners.push(errorHandle)

      const { origin, ...tlsOptions } = options || {} as NativeWebSocketOptions
      await NativeWebSocket.connect({ url, tls: tlsOptions, origin })
    } catch (err) {
      const msg = String(err)
      // If the native plugin isn't registered, fall back to browser WebSocket
      if (msg.includes('not implemented')) {
        this.cleanup()
        this.initBrowserFallback(url)
        return
      }
      this.readyState = NativeWebSocketWrapper.CLOSED
      this.onerror?.({ type: 'error', message: msg })
    }
  }

  private initBrowserFallback(url: string): void {
    const ws = new WebSocket(url)
    this.fallbackWs = ws

    ws.onopen = (ev) => {
      this.readyState = NativeWebSocketWrapper.OPEN
      this.onopen?.(ev)
    }
    ws.onmessage = (ev) => {
      this.onmessage?.(ev)
    }
    ws.onclose = (ev) => {
      this.readyState = NativeWebSocketWrapper.CLOSED
      this.onclose?.(ev)
    }
    ws.onerror = (ev) => {
      this.onerror?.(ev)
    }
  }

  send(data: string): void {
    if (this.readyState !== NativeWebSocketWrapper.OPEN) {
      throw new Error('WebSocket is not open')
    }
    if (this.fallbackWs) {
      this.fallbackWs.send(data)
      return
    }
    NativeWebSocket.send({ data }).catch((err: unknown) => {
      this.onerror?.({ type: 'error', message: String(err) })
    })
  }

  close(): void {
    if (this.readyState === NativeWebSocketWrapper.CLOSED ||
        this.readyState === NativeWebSocketWrapper.CLOSING) {
      return
    }
    this.readyState = NativeWebSocketWrapper.CLOSING
    if (this.fallbackWs) {
      this.fallbackWs.close()
      return
    }
    NativeWebSocket.disconnect().catch(() => {}).finally(() => {
      this.readyState = NativeWebSocketWrapper.CLOSED
      this.cleanup()
    })
  }

  private cleanup(): void {
    for (const handle of this.listeners) {
      handle.remove().catch(() => {})
    }
    this.listeners = []
  }
}
