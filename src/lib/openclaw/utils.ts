// OpenClaw Client - Utility Functions

// Strip ANSI escape sequences (colors, cursor movement, mode switches, OSC, etc.)
// so terminal output from tool calls and streaming text renders cleanly in the UI.
// Uses inline regexes to avoid lastIndex state issues with reused global RegExp objects.
export function stripAnsi(text: string): string {
  return text
    // Standard CSI sequences: ESC[ ... final_byte
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    // OSC sequences: ESC] ... BEL  or  ESC] ... ST(ESC\)
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    // ESC + single character sequences (charset selection, etc.)
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b[()#][A-Z0-9]/g, '')
    // Remaining ESC + one character (e.g. ESC>, ESC=, ESCM, etc.)
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b[A-Z=><!*+\-/]/gi, '')
    // C1 control codes (0x80-0x9F range, e.g. \x9b as CSI)
    // eslint-disable-next-line no-control-regex
    .replace(/\x9b[0-9;?]*[A-Za-z]/g, '')
    // Bell character
    // eslint-disable-next-line no-control-regex
    .replace(/\x07/g, '')
}

// Extract displayable text from a tool result payload.
// The server sends result as { content: [{ type: "text", text: "..." }, ...] }
// or as a plain string (rare). Returns undefined if no text can be extracted.
export function extractToolResultText(result: unknown): string | undefined {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return undefined

  const record = result as Record<string, unknown>
  const content = Array.isArray(record.content) ? record.content : null
  if (!content) {
    // Maybe the result is { text: "..." } or { output: "..." }
    if (typeof record.text === 'string') return record.text
    if (typeof record.output === 'string') return record.output
    return undefined
  }

  const texts = content
    .filter((c: any) => c && typeof c === 'object' && typeof c.text === 'string')
    .map((c: any) => c.text as string)
  return texts.length > 0 ? texts.join('\n') : undefined
}

export function extractTextFromContent(content: unknown): string {
  let text = ''
  if (typeof content === 'string') {
    text = content
  } else if (Array.isArray(content)) {
    text = content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
  } else if (content && typeof content === 'object' && 'text' in content) {
    text = String((content as any).text)
  }
  return stripAnsi(text)
}

export function extractImagesFromContent(content: unknown): Array<{ url: string; mimeType?: string; alt?: string }> {
  if (!Array.isArray(content)) return []
  const images: Array<{ url: string; mimeType?: string; alt?: string }> = []

  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const b = block as Record<string, unknown>
    const type = typeof b.type === 'string' ? b.type : ''
    const alt = typeof b.alt === 'string' ? b.alt : undefined
    const blockMime = typeof b.mimeType === 'string' ? b.mimeType : undefined

    const pushDataUrl = (raw: unknown, mime?: string) => {
      if (typeof raw !== 'string') return
      const trimmed = raw.trim()
      if (!trimmed) return
      if (trimmed.startsWith('data:image/')) {
        images.push({ url: trimmed, mimeType: mime || blockMime, alt })
        return
      }
      const dataMime = (mime || blockMime || 'image/png').trim()
      images.push({ url: `data:${dataMime};base64,${trimmed}`, mimeType: dataMime, alt })
    }

    const pushUrl = (raw: unknown, mime?: string) => {
      if (typeof raw !== 'string') return
      const trimmed = raw.trim()
      if (!trimmed) return
      if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
        images.push({ url: trimmed, mimeType: mime || blockMime, alt })
      }
    }

    if (type === 'image' || type === 'input_image' || type === 'output_image') {
      pushUrl(b.url)
      pushDataUrl(b.data)

      const source = b.source as Record<string, unknown> | undefined
      if (source && typeof source === 'object') {
        const sourceType = typeof source.type === 'string' ? source.type : ''
        const sourceMime = typeof source.mediaType === 'string' ? source.mediaType : undefined
        if (sourceType === 'url') {
          pushUrl(source.url, sourceMime)
        } else if (sourceType === 'base64') {
          pushDataUrl(source.data, sourceMime)
        }
      }

      const image = b.image as Record<string, unknown> | undefined
      if (image && typeof image === 'object') {
        pushUrl(image.url)
        pushDataUrl(image.data)
        pushUrl(image.source)
      }
    }
  }

  const seen = new Set<string>()
  return images.filter((img) => {
    if (!img.url || seen.has(img.url)) return false
    seen.add(img.url)
    return true
  })
}

const AUDIO_EXTENSIONS = /\.(mp3|opus|ogg|wav|m4a|aac|webm)$/i

/**
 * Parse MEDIA: tokens from message text.
 * OpenClaw agents emit "MEDIA: /path/to/file" lines for generated images/audio.
 * This extracts the paths and returns cleaned text with MEDIA lines removed.
 */
export function parseMediaTokens(text: string, gatewayUrl?: string): {
  cleanText: string
  images: Array<{ url: string; mimeType?: string; alt?: string }>
  audioUrls: string[]
} {
  const MEDIA_RE = /\bMEDIA:\s*`?([^\n`]+)`?/gi
  const images: Array<{ url: string; mimeType?: string; alt?: string }> = []
  const audioUrls: string[] = []
  const cleanLines: string[] = []

  for (const line of text.split('\n')) {
    const matches = Array.from(line.matchAll(MEDIA_RE))
    if (matches.length === 0) {
      cleanLines.push(line)
      continue
    }
    for (const match of matches) {
      let mediaPath = match[1].trim()
      // Strip trailing backtick if present
      if (mediaPath.endsWith('`')) mediaPath = mediaPath.slice(0, -1).trim()
      if (!mediaPath) continue

      const isAudio = AUDIO_EXTENSIONS.test(mediaPath)

      // Convert local file path to gateway media URL
      if (mediaPath.startsWith('/') && !mediaPath.startsWith('//')) {
        let baseUrl = ''
        if (gatewayUrl) {
          try {
            const u = new URL(gatewayUrl)
            const protocol = u.protocol === 'wss:' ? 'https:' : u.protocol === 'ws:' ? 'http:' : u.protocol
            baseUrl = `${protocol}//${u.host}`
          } catch { /* ignore */ }
        }
        const url = `${baseUrl}/api/media${mediaPath}`
        if (isAudio) {
          audioUrls.push(url)
        } else {
          images.push({ url, alt: mediaPath.split('/').pop() || 'Generated image' })
        }
      } else if (/^https?:\/\//i.test(mediaPath)) {
        if (isAudio) {
          audioUrls.push(mediaPath)
        } else {
          images.push({ url: mediaPath, alt: 'Generated image' })
        }
      }
    }
    // Keep non-MEDIA parts of the line if any text remains
    const remainder = line.replace(MEDIA_RE, '').trim()
    if (remainder) cleanLines.push(remainder)
  }

  return { cleanText: cleanLines.join('\n'), images, audioUrls }
}

export function isHeartbeatContent(text: string): boolean {
  const upper = text.toUpperCase()
  return upper.includes('HEARTBEAT_OK') || upper.includes('HEARTBEAT.MD') || upper.includes('CRON: HEARTBEAT')
}

/** Content that is agent noise — not meaningful to display. */
export function isNoiseContent(text: string): boolean {
  const trimmed = text.trim()
  return trimmed === 'NO_REPLY' || trimmed === 'no_reply'
}

/**
 * Strip system notification lines injected into streamed text.
 * These are exec status lines like "System: [timestamp] Exec completed (...)"
 * that belong in tool call cards, not in chat text.
 */
export function stripSystemNotifications(text: string): string {
  return text
    .split('\n')
    .filter(line => !/^System:\s*\[\d{4}-\d{2}-\d{2}/.test(line.trim()))
    .join('\n')
}

/** Detect cron-triggered user messages (scheduled reminders, updates, etc.) */
export function isCronTriggerContent(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('a scheduled reminder has been triggered') ||
    lower.includes('scheduled update')
}

/**
 * Strip server-injected metadata prefix from user messages loaded via chat.history.
 *
 * The server wraps inbound user messages with two layers:
 * 1. Context blocks — "Conversation info (untrusted metadata):", "Sender (untrusted metadata):",
 *    "Thread starter (untrusted, for context):", etc.  Each block contains a ```json fenced
 *    code block and is separated by blank lines.
 * 2. An envelope line — "[channel user timestamp] <actual message>"
 *
 * We strip all context blocks and the envelope bracket prefix, preserving the user's message.
 */
export function stripConversationMetadata(text: string): string {
  // Strategy 1: Find the envelope line [channel user timestamp] and extract
  // just the user's message after it. This is the most reliable anchor since
  // the metadata format may vary but the envelope is consistent.
  // Pattern: [word(s) YYYY-MM-DD HH:MM TZ] or [word(s) Mon YYYY-MM-DD ...]
  const envelopeMatch = text.match(/\[[\w#: -]+\d{4}-\d{2}-\d{2}\s[^\]]*\]/)
    || text.match(/\[[\w#: -]+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s[^\]]*\]/)
    || text.match(/\[[^\]]{10,80}(?:EST|CST|MST|PST|UTC|GMT|EDT|CDT|MDT|PDT|[A-Z]{2,4})\s*\]/)
  if (envelopeMatch) {
    const afterEnvelope = text.slice(envelopeMatch.index! + envelopeMatch[0].length).trimStart()
    if (afterEnvelope) return afterEnvelope
  }

  // Strategy 2: Strip known metadata patterns for messages without an envelope.
  let stripped = text

  // Strip "...(untrusted...):" blocks with their fenced JSON.
  stripped = stripped.replace(
    /^(?:[^\n]*\(untrusted[^)]*\):[\s\S]*?```\s*\n*)+/,
    ''
  ).trimStart()

  // Strip leading fenced JSON blocks (with optional label and "json" tag).
  stripped = stripped.replace(
    /^(?:[^\n`]*:\s*\n)?```(?:json)?\s*\n[\s\S]*?```\s*\n*/g,
    ''
  ).trimStart()

  // Strip bare "json\n{ ... }" blocks (language tag without fencing).
  stripped = stripped.replace(
    /^json\s*\n\s*\{[^}]*\}\s*\n*/gi,
    ''
  ).trimStart()

  // Strip bare JSON objects that look like metadata.
  stripped = stripped.replace(
    /^\s*\{[^}]*"(?:conversation_label|sender|thread_starter|channel|metadata)"[^}]*\}\s*\n*/g,
    ''
  ).trimStart()

  // Strip envelope bracket prefix if still present.
  if (stripped.startsWith('[')) {
    const bracketEnd = stripped.indexOf(']')
    if (bracketEnd !== -1 && bracketEnd < 100) {
      stripped = stripped.slice(bracketEnd + 1).trimStart()
    }
  }

  return stripped || text
}

export function resolveSessionKey(raw: any): string | null {
  const key =
    raw?.key ||
    raw?.sessionKey ||
    raw?.id ||
    raw?.session?.key ||
    raw?.session?.sessionKey ||
    raw?.session?.id
  return typeof key === 'string' && key.trim() ? key.trim() : null
}

export function toIsoTimestamp(ts: unknown): string {
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    const ms = ts > 1e12 ? ts : ts * 1000
    return new Date(ms).toISOString()
  }
  if (typeof ts === 'string' || ts instanceof Date) {
    const d = new Date(ts as any)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

// Resolve avatar URL - handles relative paths like /avatar/main
export function resolveAvatarUrl(avatar: string | undefined, agentId: string, wsUrl: string): string | undefined {
  if (!avatar) return undefined

  // Already a full URL or data URI
  if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) {
    return avatar
  }

  // Server-relative path like /avatar/main - convert to full URL
  if (avatar.startsWith('/avatar/')) {
    try {
      const urlObj = new URL(wsUrl)
      const protocol = urlObj.protocol === 'wss:' ? 'https:' : 'http:'
      return `${protocol}//${urlObj.host}${avatar}`
    } catch {
      return undefined
    }
  }

  // Looks like a valid relative file path - construct avatar URL
  if (avatar.includes('/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(avatar)) {
    try {
      const urlObj = new URL(wsUrl)
      const protocol = urlObj.protocol === 'wss:' ? 'https:' : 'http:'
      return `${protocol}//${urlObj.host}/avatar/${agentId}`
    } catch {
      return undefined
    }
  }

  // Invalid avatar (like single character from parsing error)
  return undefined
}
