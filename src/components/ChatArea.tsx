import { useRef, useEffect, useMemo, useState, useCallback, Fragment, memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectIsStreaming, selectHadStreamChunks, selectActiveToolCalls, selectStreamingThinking, selectIsCompacting, ToolCall, SubagentInfo } from '../store'
import type { ExecApprovalDecision } from '../lib/openclaw'
import { Message, stripAnsi } from '../lib/openclaw'
import { resolveToolDisplay, extractToolDetail } from '../lib/openclaw/tool-display'
import { openExternal } from '../lib/platform'
import { ToolIcon } from './ToolIcon'
import { SubagentBlock } from './SubagentBlock'
import { format, isSameDay } from 'date-fns'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import logoUrl from '../../build/icon.png'

// Configure marked for chat-friendly rendering: single newlines become <br>,
// GFM tables/strikethrough enabled, synchronous parsing.
marked.setOptions({ breaks: true, gfm: true, async: false })

const robotSvgPath = 'M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm-4 12a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm8 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z'

/** Agent avatar with fallback to robot SVG on load error */
function AgentAvatarImg({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d={robotSvgPath} />
      </svg>
    )
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} />
}

export function ChatArea() {
  const { messages: allMessages, agents, currentAgentId, sessions, currentSessionId, activeSubagents, openSubagentPopout, openToolCallPopout, setDraftMessage, pendingExecApprovals, resolveExecApproval } = useStore(useShallow(state => ({
    messages: state.messages,
    agents: state.agents,
    currentAgentId: state.currentAgentId,
    sessions: state.sessions,
    currentSessionId: state.currentSessionId,
    activeSubagents: state.activeSubagents,
    openSubagentPopout: state.openSubagentPopout,
    openToolCallPopout: state.openToolCallPopout,
    setDraftMessage: state.setDraftMessage,
    pendingExecApprovals: state.pendingExecApprovals,
    resolveExecApproval: state.resolveExecApproval,
  })))
  const isStreaming = useStore(selectIsStreaming)
  const hadStreamChunks = useStore(selectHadStreamChunks)
  const activeToolCalls = useStore(selectActiveToolCalls)
  const streamingThinking = useStore(selectStreamingThinking)
  const isCompacting = useStore(selectIsCompacting)
  const messages = useMemo(
    () => allMessages.filter((m) => m.role !== 'system'),
    [allMessages]
  )
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  // Track session switches so we can instant-scroll when history loads
  const prevSessionRef = useRef(currentSessionId)
  const needsInstantScroll = useRef(true)
  // Sticky scroll: only auto-scroll if user is near bottom
  const isAtBottom = useRef(true)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  // Resolve agent from the current session's agentId (e.g. from key "agent:jerry:...")
  // so each chat shows the correct agent name/avatar, not just the globally selected one.
  const currentSession = sessions.find(s => (s.key || s.id) === currentSessionId)
  const sessionAgentId = currentSession?.agentId || currentAgentId
  const currentAgent = agents.find((a) => a.id === sessionAgentId)

  // Build lookup maps: tool calls and subagents grouped by afterMessageId
  // Must be before the early return to satisfy Rules of Hooks.
  const toolCallsByMessageId = useMemo(() => {
    const map = new Map<string, ToolCall[]>()
    for (const tc of activeToolCalls) {
      const key = tc.afterMessageId || '__trailing__'
      const list = map.get(key)
      if (list) list.push(tc)
      else map.set(key, [tc])
    }
    return map
  }, [activeToolCalls])

  const subagentsByMessageId = useMemo(() => {
    const map = new Map<string, SubagentInfo[]>()
    for (const sa of activeSubagents) {
      // Only show subagents belonging to this session
      if (sa.parentSessionId && sa.parentSessionId !== currentSessionId) continue
      const key = sa.afterMessageId || '__trailing__'
      const list = map.get(key)
      if (list) list.push(sa)
      else map.set(key, [sa])
    }
    return map
  }, [activeSubagents, currentSessionId])

  // Mark session switches so the next render with messages jumps instantly
  useEffect(() => {
    if (prevSessionRef.current !== currentSessionId) {
      prevSessionRef.current = currentSessionId
      needsInstantScroll.current = true
      isAtBottom.current = true
      setShowScrollToBottom(false)
    }
  }, [currentSessionId])

  // Track scroll position to determine if user is near bottom
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const atBottom = distanceFromBottom < 100
      isAtBottom.current = atBottom
      setShowScrollToBottom(!atBottom)
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to bottom: instant on history load, smooth for incremental updates.
  // Only auto-scroll if user is near bottom (sticky scroll).
  useEffect(() => {
    if (messages.length === 0) return
    if (needsInstantScroll.current) {
      needsInstantScroll.current = false
      chatEndRef.current?.scrollIntoView({ behavior: 'instant' })
      return
    }
    if (isAtBottom.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeToolCalls, activeSubagents])

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    isAtBottom.current = true
    setShowScrollToBottom(false)
  }, [])

  if (messages.length === 0) {
    return (
      <div className="chat-area" data-testid="chat-area">
        <div className="chat-empty">
          <div className="empty-logo">
            <img src={logoUrl} alt="ClawControl logo" />
          </div>
          <h2>Start a Conversation</h2>
          <p>Send a message to begin chatting with {currentAgent?.name || 'the AI assistant'}</p>
          <div className="quick-actions">
            <button className="quick-action" onClick={() => setDraftMessage('Explain the concept of ')}>
              <span>Explain a concept</span>
            </button>
            <button className="quick-action" onClick={() => setDraftMessage('Help me write code that ')}>
              <span>Help me code</span>
            </button>
            <button className="quick-action" onClick={() => setDraftMessage('Analyze the following data: ')}>
              <span>Analyze data</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-area" data-testid="chat-area" ref={chatContainerRef}>
      <div className="chat-container">
        {messages.map((message, index) => {
          const isNewDay = index === 0 || !isSameDay(new Date(message.timestamp), new Date(messages[index - 1].timestamp))
          const msgToolCalls = toolCallsByMessageId.get(message.id)
          const msgSubagents = subagentsByMessageId.get(message.id)

          return (
            <Fragment key={message.id}>
              {isNewDay && <DateSeparator date={new Date(message.timestamp)} />}
              {msgToolCalls && msgToolCalls.length > 0 && openToolCallPopout && (
                <ToolCallBubble
                  toolCalls={msgToolCalls}
                  agentAvatar={currentAgent?.avatar}
                  agentName={currentAgent?.name}
                  onOpenPopout={openToolCallPopout}
                />
              )}
              <MessageBubble
                message={message}
                agentName={currentAgent?.name}
                agentAvatar={currentAgent?.avatar}
                streamingThinking={index === messages.length - 1 && isStreaming && !message.thinking ? streamingThinking : undefined}
              />
              {msgSubagents && (
                <div className="subagents-container">
                  {msgSubagents.map((sa) => (
                    <SubagentBlock key={sa.sessionKey} subagent={sa} onOpen={openSubagentPopout} />
                  ))}
                </div>
              )}
            </Fragment>
          )
        })}

        {/* Trailing tool calls and subagents (no afterMessageId) */}
        {toolCallsByMessageId.has('__trailing__') && openToolCallPopout && (
          <ToolCallBubble
            toolCalls={toolCallsByMessageId.get('__trailing__')!}
            agentAvatar={currentAgent?.avatar}
            agentName={currentAgent?.name}
            onOpenPopout={openToolCallPopout}
          />
        )}
        {subagentsByMessageId.has('__trailing__') && (
          <div className="subagents-container">
            {subagentsByMessageId.get('__trailing__')!.map((sa) => (
              <SubagentBlock key={sa.sessionKey} subagent={sa} onOpen={openSubagentPopout} />
            ))}
          </div>
        )}

        {isCompacting && isStreaming && (
          <div className="message agent compaction-indicator-container">
            <div className="message-avatar">
              {currentAgent?.avatar ? (
                <AgentAvatarImg src={currentAgent.avatar} alt={currentAgent.name || 'Agent'} />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d={robotSvgPath} />
                </svg>
              )}
            </div>
            <div className="message-content">
              <div className="compaction-indicator">
                <svg className="spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span>Compacting context...</span>
              </div>
            </div>
          </div>
        )}

        {isStreaming && !hadStreamChunks && (
          <div className="message agent typing-indicator-container">
            <div className="message-avatar">
              {currentAgent?.avatar ? (
                <AgentAvatarImg src={currentAgent.avatar} alt={currentAgent.name || 'Agent'} />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d={robotSvgPath} />
                </svg>
              )}
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        {pendingExecApprovals.length > 0 && (
          <div className="exec-approval-stack">
            {pendingExecApprovals.map((approval) => (
              <ExecApprovalBanner
                key={approval.id}
                approval={approval}
                onResolve={resolveExecApproval}
              />
            ))}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {showScrollToBottom && (
        <button
          className="scroll-to-bottom-btn"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  )
}

function ExecApprovalBanner({
  approval,
  onResolve
}: {
  approval: { id: string; command?: string; args?: string[]; cwd?: string; agent?: string }
  onResolve: (approvalId: string, decision: ExecApprovalDecision) => Promise<void>
}) {
  const [resolving, setResolving] = useState<ExecApprovalDecision | null>(null)

  const handle = useCallback(async (decision: ExecApprovalDecision) => {
    setResolving(decision)
    await onResolve(approval.id, decision)
  }, [approval.id, onResolve])

  const displayCommand = approval.args?.length
    ? `${approval.command} ${approval.args.join(' ')}`
    : approval.command || 'Unknown command'

  return (
    <div className="exec-approval-banner">
      <div className="exec-approval-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>Exec Approval Required</span>
        {approval.agent && <span className="exec-approval-agent">{approval.agent}</span>}
      </div>
      <div className="exec-approval-command">
        <code>{displayCommand}</code>
      </div>
      {approval.cwd && (
        <div className="exec-approval-cwd">in {approval.cwd}</div>
      )}
      <div className="exec-approval-actions">
        <button
          className="exec-approval-btn exec-approval-btn--allow"
          onClick={() => handle('allow')}
          disabled={resolving !== null}
        >
          {resolving === 'allow' ? 'Allowing...' : 'Allow'}
        </button>
        <button
          className="exec-approval-btn exec-approval-btn--always"
          onClick={() => handle('allow-always')}
          disabled={resolving !== null}
        >
          {resolving === 'allow-always' ? 'Adding...' : 'Always Allow'}
        </button>
        <button
          className="exec-approval-btn exec-approval-btn--deny"
          onClick={() => handle('deny')}
          disabled={resolving !== null}
        >
          {resolving === 'deny' ? 'Denying...' : 'Deny'}
        </button>
      </div>
    </div>
  )
}

function DateSeparator({ date }: { date: Date }) {
  let dateText = ''
  try {
    dateText = format(date, 'EEEE, MMMM d, yyyy')
  } catch (e) {
    return null
  }

  return (
    <div className="date-separator">
      <span>{dateText}</span>
    </div>
  )
}

const MessageBubble = memo(function MessageBubble({
  message,
  agentName,
  agentAvatar,
  streamingThinking,
}: {
  message: Message
  agentName?: string
  agentAvatar?: string
  streamingThinking?: string
}) {
  const isUser = message.role === 'user'
  const time = format(new Date(message.timestamp), 'h:mm a')

  return (
    <div className={`message ${isUser ? 'user' : 'agent'}`} data-testid={`message-${message.id}`}>
      {!isUser && (
        <div className="message-avatar">
          {agentAvatar ? (
            <AgentAvatarImg src={agentAvatar} alt={agentName || 'Agent'} />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d={robotSvgPath} />
            </svg>
          )}
        </div>
      )}

      <div className="message-content">
        <div className="message-header">
          {isUser ? (
            <>
              <span className="message-time">{time}</span>
              <span className="message-author">You</span>
            </>
          ) : (
            <>
              <span className="message-author">{agentName || 'Assistant'}</span>
              <span className="message-time">{time}</span>
            </>
          )}
        </div>
        <div className="message-bubble">
          {(message.thinking || streamingThinking) && (
            <ThinkingBlock
              text={message.thinking || streamingThinking || ''}
              streaming={!!streamingThinking && !message.thinking}
            />
          )}
          <MessageContent content={message.content} images={message.images} audioUrl={message.audioUrl} />
        </div>
      </div>

      {isUser && (
        <div className="message-avatar user-avatar">
          <span>You</span>
        </div>
      )}
    </div>
  )
})

/** Collapsible thinking/reasoning block */
function ThinkingBlock({ text, streaming }: { text: string; streaming: boolean }) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="thinking-block">
      <button
        className="thinking-header"
        onClick={() => setCollapsed(!collapsed)}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span>Thinking{streaming ? '' : ' (done)'}</span>
        {streaming && <span className="thinking-pulse" />}
        <svg className={`thinking-chevron${collapsed ? '' : ' thinking-chevron--open'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {!collapsed && (
        <div className="thinking-content">{text}</div>
      )}
    </div>
  )
}

/** Renders a group of tool calls in their own agent-style bubble */
function ToolCallBubble({ toolCalls, agentAvatar, agentName, onOpenPopout }: {
  toolCalls: ToolCall[]
  agentAvatar?: string
  agentName?: string
  onOpenPopout: (id: string) => void
}) {
  return (
    <div className="message agent tool-call-bubble">
      <div className="message-avatar">
        {agentAvatar ? (
          <AgentAvatarImg src={agentAvatar} alt={agentName || 'Agent'} />
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d={robotSvgPath} />
          </svg>
        )}
      </div>
      <div className="message-content">
        <div className="message-bubble">
          {toolCalls.map((tc) => (
            <ToolCallBlock key={tc.toolCallId} toolCall={tc} onOpenPopout={onOpenPopout} />
          ))}
        </div>
      </div>
    </div>
  )
}

const TOOL_INLINE_THRESHOLD = 80
const TOOL_PREVIEW_MAX = 100

function getTruncatedPreview(text: string): string {
  const lines = text.split('\n')
  const preview = lines.slice(0, 2).join('\n')
  if (preview.length > TOOL_PREVIEW_MAX) return preview.slice(0, TOOL_PREVIEW_MAX) + '\u2026'
  if (lines.length > 2) return preview + '\u2026'
  return preview
}

function ToolCallBlock({ toolCall, onOpenPopout }: { toolCall: ToolCall; onOpenPopout: (id: string) => void }) {
  const isRunning = toolCall.phase === 'start'
  const display = resolveToolDisplay(toolCall.name)
  const detail = extractToolDetail(toolCall.args, display.detailKeys)
  const resultText = toolCall.result ? stripAnsi(toolCall.result).trim() : ''
  const hasText = resultText.length > 0
  const isShort = hasText && resultText.length <= TOOL_INLINE_THRESHOLD
  const showCollapsed = hasText && !isShort
  const showInline = hasText && isShort
  const isEmpty = !hasText && !isRunning

  const canClick = hasText || isEmpty
  const handleClick = () => {
    if (hasText) {
      onOpenPopout(toolCall.toolCallId)
    }
  }

  return (
    <div
      className={`chat-tool-card${canClick && !isRunning ? ' chat-tool-card--clickable' : ''}`}
      onClick={canClick && !isRunning ? handleClick : undefined}
      role={canClick && !isRunning ? 'button' : undefined}
      tabIndex={canClick && !isRunning ? 0 : undefined}
      onKeyDown={canClick && !isRunning ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() }
      } : undefined}
    >
      <div className="chat-tool-card__header">
        <div className="chat-tool-card__title">
          <span className="chat-tool-card__icon">
            {isRunning ? (
              <svg className="spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <ToolIcon type={display.icon} size={14} />
            )}
          </span>
          <span>{display.title}</span>
        </div>
        {!isRunning && hasText && (
          <span className="chat-tool-card__action">
            <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        )}
        {isEmpty && (
          <span className="chat-tool-card__status">
            <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        )}
        {isRunning && (
          <span className="chat-tool-card__running-text">Running&hellip;</span>
        )}
      </div>
      {detail && <div className="chat-tool-card__detail">{detail}</div>}
      {isEmpty && <div className="chat-tool-card__status-text muted">Completed</div>}
      {isRunning && <div className="chat-tool-card__status-text muted">In progress&hellip;</div>}
      {showCollapsed && (
        <div className="chat-tool-card__preview mono">{getTruncatedPreview(resultText)}</div>
      )}
      {showInline && (
        <div className="chat-tool-card__inline mono">{resultText}</div>
      )}
    </div>
  )
}

/**
 * Convert a data: URI to a Blob URL for more reliable rendering in Electron/Chromium.
 * Large data URIs can fail to render as img src; Blob URLs bypass this limitation.
 */
function dataUriToBlobUrl(dataUri: string): string | null {
  try {
    const match = dataUri.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/)
    if (!match) return null
    const mime = match[1] || 'image/png'
    const b64 = match[2]
    const bytes = atob(b64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    return URL.createObjectURL(new Blob([arr], { type: mime }))
  } catch {
    return null
  }
}

function ChatImage({ url, alt }: { url: string; alt?: string }) {
  const [error, setError] = useState(false)
  // Track whether we already tried falling back from blob URL to data URI
  const [blobFailed, setBlobFailed] = useState(false)
  const blobUrl = useMemo(() => {
    if (url.startsWith('data:')) return dataUriToBlobUrl(url)
    return null
  }, [url])

  // Revoke blob URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [blobUrl])

  // Use blob URL first, fall back to original data URI if blob fails (e.g. Android WebView)
  const src = (blobUrl && !blobFailed) ? blobUrl : url

  if (error) {
    // For data: URIs, a link is useless — show an inline error placeholder.
    // For http(s) URLs, show a clickable link to open in browser.
    if (url.startsWith('data:')) {
      return <div className="message-image-fallback">{'\uD83D\uDDBC\uFE0F'} {alt || 'Image'} (failed to load)</div>
    }
    return (
      <a href={url} target="_blank" rel="noopener" className="message-image-fallback"
        onClick={(e) => { e.preventDefault(); void openExternal(url) }}>
        {'\uD83D\uDDBC\uFE0F'} {alt || 'Image'}
      </a>
    )
  }

  return (
    <img
      className="message-image"
      src={src}
      alt={alt || 'Attached image'}
      loading="lazy"
      onError={() => {
        // If a blob URL failed, fall back to the original data URI before giving up
        if (blobUrl && !blobFailed) {
          setBlobFailed(true)
        } else {
          setError(true)
        }
      }}
    />
  )
}

// Custom marked renderer that wraps fenced code blocks with a copy button
const renderer = new marked.Renderer()
const originalCode = renderer.code.bind(renderer)
renderer.code = function (this: unknown, ...args: Parameters<typeof originalCode>) {
  const html = originalCode.apply(this, args)
  return `<div class="code-block-wrapper"><button class="code-copy-btn" type="button" aria-label="Copy code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>${html}</div>`
}

function MessageContent({ content, images, audioUrl }: { content: string; images?: Message['images']; audioUrl?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const hasImagePlaceholder = content.includes('[__IMAGE_LOADING__]')
  const displayContent = hasImagePlaceholder
    ? content.replace(/\[__IMAGE_LOADING__\]/g, '').trim()
    : content
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(stripAnsi(displayContent), { async: false, renderer }) as string),
    [displayContent]
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // External link handling: force http(s) links to OS default browser.
      const anchor = target.closest('a') as HTMLAnchorElement | null
      if (anchor) {
        const href = anchor.getAttribute('href') || ''
        const isExternal = /^(https?:\/\/|mailto:|tel:)/i.test(href)
        if (isExternal) {
          e.preventDefault()
          e.stopPropagation()
          void openExternal(href)
          return
        }
        // Allow internal routes (e.g. /foo) and other protocols to behave normally.
      }

      // Copy button handling for fenced code blocks
      const btn = target.closest('.code-copy-btn')
      if (!btn) return
      const wrapper = btn.closest('.code-block-wrapper')
      const code = wrapper?.querySelector('code')
      if (!code) return
      navigator.clipboard.writeText(code.textContent || '').then(() => {
        btn.classList.add('copied')
        setTimeout(() => btn.classList.remove('copied'), 2000)
      })
    }

    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [html])

  return (
    <div>
      {displayContent && <div className="markdown-content" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />}
      {hasImagePlaceholder && !images?.length && (
        <div className="image-loading-placeholder">
          <svg className="spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span>Generating image...</span>
        </div>
      )}
      {images && images.length > 0 && (
        <div className="message-images">
          {images.map((img, idx) => (
            <ChatImage key={`${img.url.slice(0, 80)}-${idx}`} url={img.url} alt={img.alt} />
          ))}
        </div>
      )}
      {audioUrl && (
        <div className="message-audio">
          <audio
            controls
            preload="metadata"
            src={audioUrl}
            onError={(e) => {
              const audio = e.currentTarget
              const wrapper = audio.parentElement
              if (wrapper) {
                wrapper.classList.add('message-audio--expired')
                wrapper.innerHTML = '<span class="audio-expired">Voice message expired</span>'
              }
            }}
          >
            <a href={audioUrl} target="_blank" rel="noopener">Download audio</a>
          </audio>
        </div>
      )}
    </div>
  )
}
