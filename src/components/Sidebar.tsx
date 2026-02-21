import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useStore } from '../store'
import { formatDistanceToNow } from 'date-fns'
import { Agent, Session } from '../lib/openclaw'
import { groupSessionsByDate } from '../utils/dateGrouping'
import { useLongPress } from '../hooks/useLongPress'
import { SessionContextMenu } from './SessionContextMenu'
import { isNativeMobile } from '../lib/platform'
import logoUrl from '../../build/icon.png'

export function Sidebar() {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarOpen,
    setSidebarOpen,
    sessions,
    currentSessionId,
    setCurrentSession,
    createNewSession,
    deleteSession,
    updateSessionLabel,
    agents,
    currentAgentId,
    setCurrentAgent,
    selectAgentForDetail,
    showCreateAgent,
    openDashboard,
    mainView,
    unreadCounts,
    collapsedSessionGroups,
    toggleSessionGroup,
    fetchSessions,
    pinnedSessionKeys,
    togglePinSession
  } = useStore()

  const currentAgent = agents.find((a) => a.id === currentAgentId)

  // Refresh sessions state
  const [refreshing, setRefreshing] = useState(false)
  const handleRefreshSessions = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await fetchSessions()
    } finally {
      setRefreshing(false)
    }
  }

  // Search state with debounce
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedQuery(value), 300)
  }, [])

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Filter out spawned subagent sessions, system sessions, and deduplicate by key.
  const visibleSessions = useMemo(() => {
    const systemSessionRe = /^agent:[^:]+:(main|cron)(:|$)/
    const seen = new Set<string>()
    return sessions.filter(s => {
      const key = s.key || s.id
      if (seen.has(key)) return false
      seen.add(key)
      // Always keep the currently active session visible
      if (key === currentSessionId) return true
      // Hide internal system sessions (agent:X:main, agent:X:cron, agent:X:cron:*)
      if (systemSessionRe.test(key)) return false
      // Hide subagent sessions (agent:X:subagent:*)
      if (key.includes(':subagent:')) return false
      // Hide spawned subagent sessions and cron sessions
      return !s.spawned && !s.parentSessionId && !s.cron
    })
  }, [sessions, currentSessionId])

  // Apply search filter
  const filteredSessions = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim()
    if (!q) return visibleSessions
    return visibleSessions.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.lastMessage && s.lastMessage.toLowerCase().includes(q))
    )
  }, [visibleSessions, debouncedQuery])

  const pinnedKeyOrder = useMemo(() => {
    const m = new Map<string, number>()
    pinnedSessionKeys.forEach((k, i) => m.set(k, i))
    return m
  }, [pinnedSessionKeys])

  const pinnedSessions = useMemo(() => {
    return filteredSessions
      .filter(s => pinnedKeyOrder.has(s.key || s.id))
      .sort((a, b) => (pinnedKeyOrder.get(a.key || a.id) ?? 0) - (pinnedKeyOrder.get(b.key || b.id) ?? 0))
  }, [filteredSessions, pinnedKeyOrder])

  const unpinnedSessions = useMemo(() => {
    return filteredSessions.filter(s => !pinnedKeyOrder.has(s.key || s.id))
  }, [filteredSessions, pinnedKeyOrder])

  // Group unpinned sessions by date
  const sessionGroups = useMemo(() => groupSessionsByDate(unpinnedSessions), [unpinnedSessions])

  // Build agent lookup for emoji badges
  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>()
    for (const agent of agents) {
      map.set(agent.id, agent)
    }
    return map
  }, [agents])

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, sessionId: string } | null>(null)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [sessionToRename, setSessionToRename] = useState<{ id: string, title: string } | null>(null)

  // Close context menu on click elsewhere (desktop only — mobile uses SessionContextMenu's own listener)
  useEffect(() => {
    if (isNativeMobile()) return
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, sessionId: string, currentTitle: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, sessionId })
    setSessionToRename({ id: sessionId, title: currentTitle })
  }

  const handleLongPress = useCallback((sessionId: string, title: string, point: { clientX: number; clientY: number }) => {
    setContextMenu({ x: point.clientX, y: point.clientY, sessionId })
    setSessionToRename({ id: sessionId, title })
  }, [])

  const handleRename = async (newLabel: string) => {
    if (sessionToRename) {
      await updateSessionLabel(sessionToRename.id, newLabel)
      setShowRenameModal(false)
      setSessionToRename(null)
    }
  }

  return (
    <>
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${sidebarOpen ? 'visible' : ''}`}>
        <div className="sidebar-header">
          <div
            className="logo"
            onClick={() => sidebarCollapsed && setSidebarCollapsed(false)}
            style={sidebarCollapsed ? { cursor: 'pointer' } : undefined}
          >
            <img className="logo-icon" src={logoUrl} alt="ClawControl logo" />
            <span className="logo-text">ClawControl</span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        <button className="new-chat-btn" onClick={() => {
          createNewSession();
          setTimeout(() => {
            const input = document.querySelector('.input-area textarea') as HTMLTextAreaElement;
            if (input) input.focus();
          }, 50);
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>New Chat</span>
        </button>

        <button
          className={`dashboard-link-btn ${mainView === 'pixel-dashboard' ? 'active' : ''}`}
          onClick={openDashboard}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>Dashboard</span>
        </button>

        <button
          className={`dashboard-link-btn ${mainView === 'usage' ? 'active' : ''}`}
          onClick={() => useStore.getState().openUsage()}
          style={{ marginTop: '0px' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>Server Usage</span>
        </button>


        <div className="sessions-section">
          <div className="sessions-section-header">
            <h3 className="section-title">Sessions</h3>
            <button
              className={`sessions-refresh-btn ${refreshing ? 'refreshing' : ''}`}
              onClick={handleRefreshSessions}
              aria-label="Refresh sessions"
              title="Refresh sessions"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0115.36-6.36L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 01-15.36 6.36L3 16" />
              </svg>
            </button>
          </div>

          {/* Search input */}
          <div className="sidebar-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                className="sidebar-search-clear"
                onClick={() => { setSearchQuery(''); setDebouncedQuery('') }}
                aria-label="Clear search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="sessions-list">
            {pinnedSessions.length > 0 && (
              <div className="session-group">
                <div className="session-group-header" style={{ cursor: 'default' }}>
                  <svg className="session-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3l3 7h7l-5.5 4.1L18.8 21 12 16.9 5.2 21l2.3-6.9L2 10h7z" />
                  </svg>
                  <span className="session-group-label">Pinned</span>
                  <span className="session-group-count">{pinnedSessions.length}</span>
                </div>
                <div className="session-group-items">
                  {pinnedSessions.map((session) => (
                    <SessionItem
                      key={session.key || session.id}
                      session={session}
                      isActive={(session.key || session.id) === currentSessionId}
                      isPinned={true}
                      currentAgentId={currentAgentId}
                      agentMap={agentMap}
                      unreadCount={unreadCounts[session.key || session.id] || 0}
                      onSelect={setCurrentSession}
                      onContextMenu={handleContextMenu}
                      onLongPress={handleLongPress}
                      onDelete={deleteSession}
                      onTogglePin={togglePinSession}
                    />
                  ))}
                </div>
              </div>
            )}
            {sessionGroups.map((group) => {
              const isCollapsed = collapsedSessionGroups.includes(group.label)
              return (
                <div key={group.label} className={`session-group ${isCollapsed ? 'collapsed' : ''}`}>
                  <div
                    className="session-group-header"
                    onClick={() => toggleSessionGroup(group.label)}
                  >
                    <svg
                      className="session-group-chevron"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <span className="session-group-label">{group.label}</span>
                    <span className="session-group-count">{group.sessions.length}</span>
                  </div>
                  {!isCollapsed && (
                    <div className="session-group-items">
                      {group.sessions.map((session) => (
                        <SessionItem
                          key={session.key || session.id}
                          session={session}
                          isActive={(session.key || session.id) === currentSessionId}
                          isPinned={pinnedKeyOrder.has(session.key || session.id)}
                          currentAgentId={currentAgentId}
                          agentMap={agentMap}
                          unreadCount={unreadCounts[session.key || session.id] || 0}
                          onSelect={setCurrentSession}
                          onContextMenu={handleContextMenu}
                          onLongPress={handleLongPress}
                          onDelete={deleteSession}
                          onTogglePin={togglePinSession}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {filteredSessions.length === 0 && (
              <div className="empty-sessions">
                {debouncedQuery ? (
                  <p>No matching sessions</p>
                ) : (
                  <>
                    <p>No sessions yet</p>
                    <p className="hint">Start a new chat to begin</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="agent-section">
          <h3 className="section-title">Agent</h3>
          <AgentSelector
            agents={agents}
            currentAgent={currentAgent}
            onSelect={setCurrentAgent}
            onOpenDetail={(agent) => selectAgentForDetail(agent)}
            onCreateNew={showCreateAgent}
          />
        </div>

        {/* Mobile close button */}
        <button
          className="sidebar-close-mobile"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </aside>

      {/* Context Menu */}
      {contextMenu && (
        isNativeMobile() ? (
          <SessionContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            sessionId={contextMenu.sessionId}
            isSystemSession={/^agent:[^:]+:(main|cron)(:|$)/.test(contextMenu.sessionId)}
            isPinned={pinnedKeyOrder.has(contextMenu.sessionId)}
            onTogglePin={() => togglePinSession(contextMenu.sessionId)}
            onRename={() => setShowRenameModal(true)}
            onDelete={() => {
              deleteSession(contextMenu.sessionId)
              setContextMenu(null)
            }}
            onClose={() => setContextMenu(null)}
          />
        ) : (
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 1000
            }}
          >
            <div
              className="context-menu-item"
              onClick={() => {
                setShowRenameModal(true)
                setContextMenu(null)
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Rename Session</span>
            </div>
            {!/^agent:[^:]+:(main|cron)(:|$)/.test(contextMenu.sessionId) && (
              <div
                className="context-menu-item"
                onClick={() => {
                  togglePinSession(contextMenu.sessionId)
                  setContextMenu(null)
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 17l-5 3 1.5-5.5L4 10h5.5L12 4l2.5 6H20l-4.5 4.5L17 20z" />
                </svg>
                <span>{pinnedKeyOrder.has(contextMenu.sessionId) ? 'Unpin' : 'Pin'}</span>
              </div>
            )}
          </div>
        )
      )}

      {/* Rename Modal */}
      {showRenameModal && sessionToRename && (
        <RenameModal
          currentTitle={sessionToRename.title}
          onSave={handleRename}
          onClose={() => {
            setShowRenameModal(false)
            setSessionToRename(null)
          }}
        />
      )}
    </>
  )
}

function SessionItem({
  session,
  isActive,
  isPinned,
  currentAgentId,
  agentMap,
  unreadCount,
  onSelect,
  onContextMenu,
  onLongPress,
  onDelete,
  onTogglePin,
}: {
  session: Session
  isActive: boolean
  isPinned: boolean
  currentAgentId: string | null
  agentMap: Map<string, Agent>
  unreadCount: number
  onSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent, sessionId: string, title: string) => void
  onLongPress: (sessionId: string, title: string, point: { clientX: number; clientY: number }) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
}) {
  const sessionKey = session.key || session.id
  const sessionAgent = session.agentId && session.agentId !== currentAgentId
    ? agentMap.get(session.agentId)
    : undefined
  const isNewChat = session.title === 'New Chat'

  // Parse agent:name:id pattern from session keys
  const keyParts = sessionKey.match(/^agent:([^:]+):(.+)$/)
  const hasCustomTitle = !isNewChat && session.title !== sessionKey
  const resolvedAgentName = keyParts && !hasCustomTitle
    ? (
      (session.agentId && agentMap.get(session.agentId)?.name) ||
      (agentMap.get(keyParts[1])?.name) ||
      keyParts[1].charAt(0).toUpperCase() + keyParts[1].slice(1)
    )
    : null
  const parsedSessionId = keyParts && !hasCustomTitle
    ? keyParts[2]
    : null

  const longPressHandlers = useLongPress(
    useCallback((point: { clientX: number; clientY: number }) => {
      onLongPress(sessionKey, session.title, point)
    }, [sessionKey, session.title, onLongPress])
  )

  return (
    <div
      className={`session-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(sessionKey)}
      onContextMenu={isNativeMobile() ? undefined : (e) => onContextMenu(e, sessionKey, session.title)}
      {...longPressHandlers}
    >
      <div className="session-indicator" />
      {session.spawned && (
        <span className="session-spawned-badge" title="Spawned subagent session">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3v12" />
            <path d="M18 9a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M6 21a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M15 6h-4a2 2 0 00-2 2v7" />
          </svg>
        </span>
      )}
      <div className="session-content">
        <div className="session-title-row">
          {sessionAgent?.emoji && (
            <span className="session-agent-badge" title={sessionAgent.name}>
              {sessionAgent.emoji}
            </span>
          )}
          <div className="session-title">
            {resolvedAgentName || session.title}
          </div>
        </div>
        {parsedSessionId ? (
          <div className="session-session-id">{parsedSessionId}</div>
        ) : isNewChat && session.lastMessage ? (
          <div className="session-subtitle">{session.lastMessage}</div>
        ) : session.lastMessage && (
          <div className="session-preview">{session.lastMessage}</div>
        )}
        <div className="session-time">
          {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
        </div>
      </div>
      {unreadCount > 0 && (
        <span className="session-badge">{unreadCount}</span>
      )}
      {!/^agent:[^:]+:(main|cron)(:|$)/.test(sessionKey) && (
        <>
          <button
            className={`session-pin ${isPinned ? 'pinned' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onTogglePin(sessionKey)
            }}
            aria-label={isPinned ? 'Unpin session' : 'Pin session'}
            title={isPinned ? 'Unpin session' : 'Pin session'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 17l-5 3 1.5-5.5L4 10h5.5L12 4l2.5 6H20l-4.5 4.5L17 20z" />
            </svg>
          </button>
          <button
            className="session-delete"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(sessionKey)
            }}
            aria-label="Delete session"
          >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        </>
      )}
    </div>
  )
}

function RenameModal({ currentTitle, onSave, onClose }: {
  currentTitle: string
  onSave: (newLabel: string) => void
  onClose: () => void
}) {
  const [label, setLabel] = useState(currentTitle)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Rename Session</h2>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={(e) => {
            e.preventDefault()
            onSave(label)
          }}>
            <div className="form-group">
              <label>Session Label</label>
              <input
                ref={inputRef}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Enter a new label..."
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function AgentSelector({
  agents,
  currentAgent,
  onSelect,
  onOpenDetail,
  onCreateNew
}: {
  agents: Agent[]
  currentAgent?: Agent
  onSelect: (id: string) => void
  onOpenDetail: (agent: Agent) => void
  onCreateNew: () => void
}) {
  const [open, setOpen] = useState(false)

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentAgent) {
      onOpenDetail(currentAgent)
    }
  }

  return (
    <div className={`agent-selector ${open ? 'open' : ''}`}>
      <div className="agent-selected" onClick={() => setOpen(!open)}>
        <div className="agent-avatar">
          {currentAgent?.emoji ? (
            <span className="agent-emoji-small">{currentAgent.emoji}</span>
          ) : currentAgent?.avatar ? (
            <img src={currentAgent.avatar} alt={currentAgent.name} className="agent-avatar-img-small" />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm-4 12a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm8 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
            </svg>
          )}
        </div>
        <div className="agent-info">
          <div className="agent-name">{currentAgent?.name || 'Select Agent'}</div>
          <div className={`agent-status ${currentAgent?.status || ''}`}>
            {currentAgent?.status || 'Unknown'}
          </div>
        </div>
        <button
          className="agent-settings-btn"
          onClick={handleSettingsClick}
          title="Edit Agent"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <svg className="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      <div className="agent-dropdown">
        <div
          className="agent-option create-new-agent-option"
          onClick={() => {
            onCreateNew()
            setOpen(false)
          }}
        >
          <div className="agent-avatar small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <span>Create New Agent</span>
        </div>
        {agents.map((agent, index) => (
          <div
            key={agent.id || index}
            className={`agent-option ${agent.id === currentAgent?.id ? 'selected' : ''}`}
            onClick={() => {
              onSelect(agent.id)
              setOpen(false)
            }}
          >
            <div className="agent-avatar small">
              {agent.emoji ? (
                <span className="agent-emoji-small">{agent.emoji}</span>
              ) : agent.avatar ? (
                <img src={agent.avatar} alt={agent.name} className="agent-avatar-img-small" />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm-4 12a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm8 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                </svg>
              )}
            </div>
            <span>{agent.name}</span>
            {agent.id === currentAgent?.id && (
              <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
