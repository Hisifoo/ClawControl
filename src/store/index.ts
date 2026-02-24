import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { OpenClawClient, Message, Session, Agent, Skill, CronJob, AgentFile, CreateAgentParams, buildIdentityContent } from '../lib/openclaw'
import type { ClawHubSkill, ClawHubSort } from '../lib/clawhub'
import { listClawHubSkills, searchClawHub, getClawHubSkill, getClawHubSkillVersion, getClawHubSkillConvex } from '../lib/clawhub'
import * as Platform from '../lib/platform'
import { getOrCreateDeviceIdentity, clearDeviceIdentity, getDeviceToken, saveDeviceToken, clearDeviceToken } from '../lib/device-identity'
import type { DeviceIdentity } from '../lib/device-identity'

/** Matches internal system sessions like agent:main:main, agent:clarissa:cron, etc. */
/** Matches internal system sessions: agent:X:main, agent:X:cron, agent:X:cron:*, agent:X:subagent:* */
const SYSTEM_SESSION_RE = /^agent:[^:]+:(main|cron)(:|$)/

export interface ToolCall {
  toolCallId: string
  name: string
  phase: 'start' | 'result'
  result?: string
  args?: Record<string, unknown>
  startedAt: number
  afterMessageId?: string
}

export interface SubagentInfo {
  sessionKey: string
  parentSessionId?: string
  label: string
  status: 'running' | 'completed'
  detectedAt: number
  afterMessageId?: string
}

interface AgentDetail {
  agent: Agent
  workspace: string
  files: AgentFile[]
  defaultModel?: string
  modelOptions?: string[]
}

interface AppState {
  // Theme
  theme: 'dark' | 'light'
  setTheme: (theme: 'dark' | 'light') => void
  toggleTheme: () => void

  // Connection
  serverUrl: string
  setServerUrl: (url: string) => void
  authMode: 'token' | 'password'
  setAuthMode: (mode: 'token' | 'password') => void
  gatewayToken: string
  setGatewayToken: (token: string) => void
  connected: boolean
  connecting: boolean
  connectionError: string | null
  setConnectionError: (error: string | null) => void
  client: OpenClawClient | null
  deviceName: string
  setDeviceName: (name: string) => void

  // Device Identity & Pairing
  pairingStatus: 'none' | 'pending'
  pairingDeviceId: string | null
  retryConnect: () => Promise<void>

  // Settings Modal
  showSettings: boolean
  setShowSettings: (show: boolean) => void

  // Certificate Error Modal
  showCertError: boolean
  certErrorUrl: string | null
  showCertErrorModal: (httpsUrl: string) => void
  hideCertErrorModal: () => void

  // UI State
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  collapsedSessionGroups: string[]
  toggleSessionGroup: (label: string) => void
  rightPanelOpen: boolean
  setRightPanelOpen: (open: boolean) => void
  rightPanelTab: 'skills' | 'crons'
  setRightPanelTab: (tab: 'skills' | 'crons') => void

  // Main View State
  mainView: 'chat' | 'skill-detail' | 'cron-detail' | 'create-cron' | 'agent-detail' | 'create-agent' | 'clawhub-skill-detail' | 'server-settings' | 'usage' | 'pixel-dashboard'
  setMainView: (view: 'chat' | 'skill-detail' | 'cron-detail' | 'create-cron' | 'agent-detail' | 'create-agent' | 'clawhub-skill-detail' | 'usage') => void
  selectedSkill: Skill | null
  selectedCronJob: CronJob | null
  selectedAgentDetail: AgentDetail | null
  selectSkill: (skill: Skill) => Promise<void>
  selectCronJob: (cronJob: CronJob) => Promise<void>
  selectAgentForDetail: (agent: Agent) => Promise<void>
  openServerSettings: () => void
  openUsage: () => void
  openCreateCron: () => void
  openDashboard: () => void
  closeDetailView: () => void
  toggleSkillEnabled: (skillId: string, enabled: boolean) => Promise<void>
  saveAgentFile: (agentId: string, fileName: string, content: string) => Promise<boolean>
  refreshAgentFiles: (agentId: string) => Promise<void>
  updateAgentModel: (agentId: string, model: string | null) => Promise<boolean>
  renameAgent: (agentId: string, newName: string) => Promise<boolean>

  // Chat
  messages: Message[]
  addMessage: (message: Message) => void
  clearMessages: () => void
  streamingSessions: Record<string, boolean>
  sessionHadChunks: Record<string, boolean>
  sessionToolCalls: Record<string, ToolCall[]>
  thinkingEnabled: boolean
  setThinkingEnabled: (enabled: boolean) => void

  // Notifications & Unread
  notificationsEnabled: boolean
  setNotificationsEnabled: (enabled: boolean) => Promise<void>
  unreadCounts: Record<string, number>
  clearUnread: (sessionId: string) => void
  streamingSessionId: string | null

  // Sessions
  sessions: Session[]
  currentSessionId: string | null
  setCurrentSession: (sessionId: string) => void
  createNewSession: () => Promise<void>
  deleteSession: (sessionId: string) => void
  updateSessionLabel: (sessionId: string, label: string) => Promise<void>
  spawnSubagentSession: (agentId: string, prompt?: string) => Promise<void>

  // Pinned sessions (local-only)
  pinnedSessionKeys: string[]
  togglePinSession: (sessionKey: string) => void
  isSessionPinned: (sessionKey: string) => boolean

  // Agents
  agents: Agent[]
  currentAgentId: string | null
  setCurrentAgent: (agentId: string) => void
  showCreateAgent: () => void
  createAgent: (params: CreateAgentParams) => Promise<{ success: boolean; error?: string }>
  deleteAgent: (agentId: string) => Promise<{ success: boolean; error?: string }>

  // Skills & Crons
  skills: Skill[]
  cronJobs: CronJob[]

  // ClawHub
  clawHubSkills: ClawHubSkill[]
  clawHubLoading: boolean
  clawHubSearchQuery: string
  clawHubSort: ClawHubSort
  selectedClawHubSkill: ClawHubSkill | null
  skillsSubTab: 'installed' | 'available'
  installingHubSkill: string | null
  installHubSkillError: string | null
  setSkillsSubTab: (tab: 'installed' | 'available') => void
  fetchClawHubSkills: () => Promise<void>
  searchClawHubSkills: (query: string) => Promise<void>
  setClawHubSort: (sort: ClawHubSort) => void
  selectClawHubSkill: (skill: ClawHubSkill) => void
  installClawHubSkill: (slug: string) => Promise<void>
  fetchClawHubSkillDetail: (slug: string) => Promise<void>

  // Subagents
  activeSubagents: SubagentInfo[]
  startSubagentPolling: () => void
  stopSubagentPolling: () => void
  openSubagentPopout: (sessionKey: string) => void
  openToolCallPopout: (toolCallId: string) => void

  // Actions
  initializeApp: () => Promise<void>
  connect: () => Promise<void>
  disconnect: () => void
  sendMessage: (content: string, attachments?: Array<{ type?: string; mimeType?: string; fileName?: string; content: string; previewUrl?: string }>) => Promise<void>
  abortChat: () => Promise<void>
  fetchSessions: () => Promise<void>
  fetchAgents: () => Promise<void>
  fetchSkills: () => Promise<void>
  fetchCronJobs: () => Promise<void>
}

// Module-level polling state (not persisted)
let _subagentPollTimer: ReturnType<typeof setInterval> | null = null
let _baselineSessionKeys: Set<string> | null = null

// Monotonic counter for detecting stale async message loads after session switches.
let _sessionLoadVersion = 0

// Per-session message cache so switching back to a session shows messages instantly
// while the async refresh loads fresh data from the server.
const _sessionMessagesCache = new Map<string, Message[]>()

// Cache of ClawHub skill stats from list results (slug -> { downloads, stars })
const _clawHubStatsCache = new Map<string, { downloads: number; stars: number }>()

/**
 * If the last message is a streaming placeholder (id starts with "streaming-"),
 * finalize it with a stable ID so that subsequent tool calls / subagents can
 * reference it via `afterMessageId`, and new stream chunks will create a fresh
 * streaming message instead of appending to the finalized one.
 */
function finalizeStreamingMessage(messages: Message[]): { messages: Message[]; finalizedId: string | null } {
  if (messages.length === 0) return { messages, finalizedId: null }
  const last = messages[messages.length - 1]
  if (last.role !== 'assistant' || !last.id.startsWith('streaming-')) {
    // Only anchor to the last message if it's an assistant message.
    // Tool calls arriving before any assistant text should go to trailing
    // (rendered in their own bubble) rather than attaching to a user message.
    return { messages, finalizedId: last.role === 'assistant' ? last.id : null }
  }
  const stableId = `msg-finalized-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const updated = [...messages]
  updated[updated.length - 1] = { ...last, id: stableId }
  return { messages: updated, finalizedId: stableId }
}

function shouldNotify(
  notificationsEnabled: boolean,
  msgSessionId: string | null,
  currentSessionId: string | null
): boolean {
  if (!notificationsEnabled) return false
  if (Platform.isAppActive() && msgSessionId === currentSessionId) return false
  return true
}

/** Resolve agent display name from a session key like "agent:jerry:uuid" */
function resolveAgentName(sessionKey: string | null | undefined, agents: Agent[], currentAgentId: string | null): string {
  // Extract agentId from session key format "agent:{agentId}:{uuid}"
  if (sessionKey) {
    const parts = sessionKey.split(':')
    if (parts[0] === 'agent' && parts.length >= 3) {
      const agentId = parts[1]
      const agent = agents.find(a => a.id === agentId)
      if (agent) return agent.name
    }
  }
  // Fallback to current agent
  if (currentAgentId) {
    const agent = agents.find(a => a.id === currentAgentId)
    if (agent) return agent.name
  }
  return 'Agent'
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      // Connection
      serverUrl: '',
      setServerUrl: (url) => set({ serverUrl: url }),
      authMode: 'token',
      setAuthMode: (mode) => set({ authMode: mode }),
      gatewayToken: '',
      setGatewayToken: (token) => {
        set({ gatewayToken: token })
        Platform.saveToken(token).catch(() => { })
      },
      connected: false,
      connecting: false,
      connectionError: null,
      setConnectionError: (error) => set({ connectionError: error }),
      client: null,
      deviceName: '',
      setDeviceName: (name) => set({ deviceName: name }),

      // Device Identity & Pairing
      pairingStatus: 'none',
      pairingDeviceId: null,
      retryConnect: async () => {
        set({ pairingStatus: 'none', pairingDeviceId: null })
        try {
          await get().connect()
        } catch {
          // connect() handles its own error state
        }
      },

      // Settings Modal
      showSettings: false,
      setShowSettings: (show) => set({ showSettings: show }),

      // Certificate Error Modal
      showCertError: false,
      certErrorUrl: null,
      showCertErrorModal: (httpsUrl) => set({ showCertError: true, certErrorUrl: httpsUrl }),
      hideCertErrorModal: () => set({ showCertError: false, certErrorUrl: null }),

      // UI State
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      collapsedSessionGroups: [],
      toggleSessionGroup: (label) => set((state) => {
        const groups = state.collapsedSessionGroups
        return {
          collapsedSessionGroups: groups.includes(label)
            ? groups.filter(g => g !== label)
            : [...groups, label]
        }
      }),
      rightPanelOpen: !Platform.isMobile(),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      rightPanelTab: 'skills',
      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

      // Main View State
      mainView: 'chat',
      setMainView: (view) => set({ mainView: view }),
      selectedSkill: null,
      selectedCronJob: null,
      selectedAgentDetail: null,
      selectSkill: async (skill) => {
        // All skill data comes from skills.status, no need for separate fetch
        set({ mainView: 'skill-detail', selectedSkill: skill, selectedCronJob: null, selectedAgentDetail: null })
      },
      selectCronJob: async (cronJob) => {
        const { client } = get()
        set({ mainView: 'cron-detail', selectedCronJob: cronJob, selectedSkill: null, selectedAgentDetail: null })

        // Fetch full cron job details including content
        if (client) {
          const details = await client.getCronJobDetails(cronJob.id)
          if (details) {
            set({ selectedCronJob: details })
          }
        }
      },
      selectAgentForDetail: async (agent) => {
        const { client } = get()
        set({ mainView: 'agent-detail', selectedAgentDetail: { agent, workspace: '', files: [] }, selectedSkill: null, selectedCronJob: null })

        if (client) {
          // Fetch workspace files and server config (for default model) in parallel
          const [filesResult, serverConfig] = await Promise.all([
            client.getAgentFiles(agent.id),
            client.getServerConfig().catch(() => null)
          ])

          const rawModel = serverConfig?.config?.agents?.defaults?.model
          const defaultModel = rawModel || undefined

          // Build model options from server config fallbacks + primary
          const modelOptions: string[] = []
          if (typeof rawModel === 'object' && rawModel) {
            if (rawModel.primary) modelOptions.push(rawModel.primary)
            if (Array.isArray(rawModel.fallbacks)) {
              for (const f of rawModel.fallbacks) {
                if (typeof f === 'string' && !modelOptions.includes(f)) modelOptions.push(f)
              }
            }
          } else if (typeof rawModel === 'string') {
            modelOptions.push(rawModel)
          }

          if (filesResult) {
            // Fetch content for each file
            const filesWithContent: AgentFile[] = []
            for (const file of filesResult.files) {
              if (!file.missing) {
                const fileContent = await client.getAgentFile(agent.id, file.name)
                filesWithContent.push({
                  ...file,
                  content: fileContent?.content
                })
              } else {
                filesWithContent.push(file)
              }
            }
            set({
              selectedAgentDetail: {
                agent,
                workspace: filesResult.workspace,
                files: filesWithContent,
                defaultModel,
                modelOptions
              }
            })
          } else {
            set((state) => state.selectedAgentDetail ? {
              selectedAgentDetail: { ...state.selectedAgentDetail, defaultModel, modelOptions }
            } : state)
          }
        }
      },
      openServerSettings: () => set({ mainView: 'server-settings', selectedSkill: null, selectedCronJob: null, selectedAgentDetail: null, selectedClawHubSkill: null }),
      openUsage: () => set({ mainView: 'usage', selectedSkill: null, selectedCronJob: null, selectedAgentDetail: null, selectedClawHubSkill: null }),
      openCreateCron: () => set({ mainView: 'create-cron', selectedSkill: null, selectedCronJob: null, selectedAgentDetail: null, selectedClawHubSkill: null }),
      openDashboard: () => set({ mainView: 'pixel-dashboard', selectedSkill: null, selectedCronJob: null, selectedAgentDetail: null, selectedClawHubSkill: null }),
      closeDetailView: () => set({ mainView: 'chat', selectedSkill: null, selectedCronJob: null, selectedAgentDetail: null, selectedClawHubSkill: null }),
      toggleSkillEnabled: async (skillId, enabled) => {
        const { client } = get()
        if (!client) return

        await client.toggleSkill(skillId, enabled)

        // Update local state
        set((state) => ({
          skills: state.skills.map((s) =>
            s.id === skillId ? { ...s, enabled } : s
          ),
          selectedSkill: state.selectedSkill?.id === skillId
            ? { ...state.selectedSkill, enabled }
            : state.selectedSkill
        }))
      },
      saveAgentFile: async (agentId, fileName, content) => {
        const { client } = get()
        if (!client) return false

        const success = await client.setAgentFile(agentId, fileName, content)
        if (success) {
          // Update local state
          set((state) => {
            if (!state.selectedAgentDetail) return state
            return {
              selectedAgentDetail: {
                ...state.selectedAgentDetail,
                files: state.selectedAgentDetail.files.map((f) =>
                  f.name === fileName ? { ...f, content, missing: false } : f
                )
              }
            }
          })

          // Refresh agents list to update identity
          await get().fetchAgents()
        }
        return success
      },
      refreshAgentFiles: async (agentId) => {
        const { client, selectedAgentDetail } = get()
        if (!client || !selectedAgentDetail) return

        const filesResult = await client.getAgentFiles(agentId)
        if (filesResult) {
          const filesWithContent: AgentFile[] = []
          for (const file of filesResult.files) {
            if (!file.missing) {
              const fileContent = await client.getAgentFile(agentId, file.name)
              filesWithContent.push({
                ...file,
                content: fileContent?.content
              })
            } else {
              filesWithContent.push(file)
            }
          }
          set({
            selectedAgentDetail: {
              ...selectedAgentDetail,
              workspace: filesResult.workspace,
              files: filesWithContent
            }
          })
        }
      },
      updateAgentModel: async (agentId, model) => {
        const { client } = get()
        if (!client) return false

        try {
          const { config, hash } = await client.getServerConfig()
          if (!config || !hash) return false

          const agentsSection = config.agents || {}
          const existingList: any[] = Array.isArray(agentsSection.list) ? agentsSection.list : []

          // For the "main" agent, update agents.defaults.model.primary
          if (agentId === 'main') {
            const currentModel = agentsSection.defaults?.model
            let patch: any
            if (typeof currentModel === 'object' && currentModel) {
              // Preserve fallbacks, update primary
              patch = { agents: { defaults: { model: { ...currentModel, primary: model || currentModel.primary } } } }
            } else {
              patch = { agents: { defaults: { model: { primary: model || '' } } } }
            }
            await client.patchServerConfig(patch, hash)
          } else {
            // For other agents, update agents.list[].model
            const updatedList = existingList.map((a: any) => {
              const id = a.id || a.name || ''
              if (id !== agentId) return a
              const updated = { ...a }
              if (model) {
                updated.model = model
              } else {
                delete updated.model
              }
              return updated
            })
            await client.patchServerConfig({ agents: { list: updatedList } }, hash)
          }

          // Wait for server restart and refresh
          await new Promise<void>((resolve) => {
            let resolved = false
            const onConnected = () => {
              if (!resolved) { resolved = true; client.off('connected', onConnected); resolve() }
            }
            client.on('connected', onConnected)
            setTimeout(onConnected, 5000)
          })

          await get().fetchAgents()

          // Update the local agent detail
          set((state) => {
            if (!state.selectedAgentDetail || state.selectedAgentDetail.agent.id !== agentId) return state
            return {
              selectedAgentDetail: {
                ...state.selectedAgentDetail,
                agent: { ...state.selectedAgentDetail.agent, model: model || undefined }
              }
            }
          })

          return true
        } catch (err) {
          return false
        }
      },

      renameAgent: async (agentId, newName) => {
        const { client, selectedAgentDetail } = get()
        if (!client) return false

        try {
          // Read current IDENTITY.md
          const identityFile = selectedAgentDetail?.files.find(f => f.name === 'IDENTITY.md')
          let content = identityFile?.content || ''

          // Update or insert the Name line
          if (/^- \*\*Name:\*\*/m.test(content)) {
            content = content.replace(/^- \*\*Name:\*\*.*/m, `- **Name:** ${newName.trim()}`)
          } else {
            content = `- **Name:** ${newName.trim()}\n${content}`
          }

          const success = await client.setAgentFile(agentId, 'IDENTITY.md', content)
          if (!success) return false

          // Update local state immediately
          set((state) => {
            if (!state.selectedAgentDetail || state.selectedAgentDetail.agent.id !== agentId) return state
            return {
              selectedAgentDetail: {
                ...state.selectedAgentDetail,
                agent: { ...state.selectedAgentDetail.agent, name: newName.trim() },
                files: state.selectedAgentDetail.files.map(f =>
                  f.name === 'IDENTITY.md' ? { ...f, content, missing: false } : f
                )
              }
            }
          })

          await get().fetchAgents()
          return true
        } catch (err) {
          return false
        }
      },

      // Chat
      messages: [],
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      clearMessages: () => set({ messages: [] }),
      streamingSessions: {},
      sessionHadChunks: {},
      sessionToolCalls: {},
      thinkingEnabled: false,
      setThinkingEnabled: (enabled) => set({ thinkingEnabled: enabled }),

      // Notifications & Unread
      notificationsEnabled: false,
      setNotificationsEnabled: async (enabled) => {
        if (enabled) {
          const granted = await Platform.requestNotificationPermission()
          if (!granted) return
        }
        set({ notificationsEnabled: enabled })
      },
      unreadCounts: {},
      clearUnread: (sessionId) => set((state) => {
        const { [sessionId]: _, ...rest } = state.unreadCounts
        return { unreadCounts: rest }
      }),
      streamingSessionId: null,

      // Subagents
      activeSubagents: [],
      startSubagentPolling: () => {
        const { client, sessions } = get()
        if (!client || _subagentPollTimer) return

        // Snapshot current session keys as baseline
        _baselineSessionKeys = new Set(sessions.map(s => s.key || s.id))

        _subagentPollTimer = setInterval(async () => {
          const { client: c, currentSessionId } = get()
          if (!c) return

          try {
            const allSessions = await c.listSessions()
            const newSubagents: SubagentInfo[] = []

            for (const s of allSessions) {
              const key = s.key || s.id
              if (_baselineSessionKeys?.has(key)) continue

              // Skip internal system sessions — they are not subagents
              if (SYSTEM_SESSION_RE.test(key)) continue

              // Only show subagents that belong to the current session
              if (!s.spawned && s.parentSessionId !== currentSessionId) continue
              const parentId = s.parentSessionId || currentSessionId || undefined

              // Skip if already tracked
              const { activeSubagents } = get()
              if (activeSubagents.some(a => a.sessionKey === key)) continue

              newSubagents.push({
                sessionKey: key,
                parentSessionId: parentId,
                label: s.title || key,
                status: 'running',
                detectedAt: Date.now()
              })
            }

            if (newSubagents.length > 0) {
              set((state) => {
                // Finalize current streaming message so subagent blocks render inline
                const { messages: finalizedMsgs, finalizedId } = finalizeStreamingMessage(state.messages)
                const tagged = newSubagents.map(sa => ({
                  ...sa,
                  afterMessageId: finalizedId || undefined
                }))
                return {
                  messages: finalizedMsgs,
                  activeSubagents: [...state.activeSubagents, ...tagged]
                }
              })
            }
          } catch {
            // Polling failure — ignore
          }
        }, 1000)
      },
      stopSubagentPolling: () => {
        if (_subagentPollTimer) {
          clearInterval(_subagentPollTimer)
          _subagentPollTimer = null
        }
        _baselineSessionKeys = null

        // Mark all running subagents as completed
        set((state) => ({
          activeSubagents: state.activeSubagents.map(a =>
            a.status === 'running' ? { ...a, status: 'completed' as const } : a
          )
        }))
      },
      openSubagentPopout: (sessionKey: string) => {
        const { serverUrl, gatewayToken, authMode, activeSubagents } = get()
        const subagent = activeSubagents.find(a => a.sessionKey === sessionKey)
        Platform.openSubagentPopout({
          sessionKey,
          serverUrl,
          authToken: gatewayToken,
          authMode,
          label: subagent?.label || sessionKey
        })
      },
      openToolCallPopout: (toolCallId: string) => {
        // Find the tool call across all sessions
        const { sessionToolCalls } = get()
        let toolCall: ToolCall | undefined
        for (const tcs of Object.values(sessionToolCalls)) {
          toolCall = tcs.find(t => t.toolCallId === toolCallId)
          if (toolCall) break
        }
        if (!toolCall) return

        // Write tool call data to localStorage for the popout to read
        try {
          localStorage.setItem(`toolcall-${toolCallId}`, JSON.stringify(toolCall))
        } catch { /* storage full — ignore */ }

        Platform.openToolCallPopout({ toolCallId, name: toolCall.name })
      },

      // Sessions
      sessions: [],
      currentSessionId: null,

      // Pinned sessions (local-only)
      pinnedSessionKeys: [],
      isSessionPinned: (sessionKey) => get().pinnedSessionKeys.includes(sessionKey),
      togglePinSession: (sessionKey) => set((state) => ({
        pinnedSessionKeys: state.pinnedSessionKeys.includes(sessionKey)
          ? state.pinnedSessionKeys.filter(k => k !== sessionKey)
          : [sessionKey, ...state.pinnedSessionKeys]
      })),
      setCurrentSession: (sessionId) => {
        const { unreadCounts, client, currentSessionId: prevSessionId, messages: currentMessages, sessions } = get()
        const { [sessionId]: _, ...restCounts } = unreadCounts
        // Clear default session key when switching (parent set preserved for concurrent streams)
        client?.setPrimarySessionKey(null)

        // Cache outgoing session's messages (excluding streaming placeholders)
        if (prevSessionId && currentMessages.length > 0) {
          const nonStreaming = currentMessages.filter(m => !m.id.startsWith('streaming-'))
          if (nonStreaming.length > 0) {
            _sessionMessagesCache.set(prevSessionId, nonStreaming)
          }
        }

        const loadVersion = ++_sessionLoadVersion
        const cachedMessages = _sessionMessagesCache.get(sessionId) || []

        // Auto-switch agent to match the session's owner
        const session = sessions.find(s => (s.key || s.id) === sessionId)
        const agentUpdate = session?.agentId && session.agentId !== get().currentAgentId
          ? { currentAgentId: session.agentId } : {}

        set({ currentSessionId: sessionId, messages: cachedMessages, activeSubagents: [], unreadCounts: restCounts, mainView: 'chat', selectedSkill: null, selectedCronJob: null, selectedAgentDetail: null, selectedClawHubSkill: null, ...agentUpdate })
        // Load fresh messages from server. Guard against stale loads when the
        // user rapidly switches sessions.
        client?.getSessionMessages(sessionId).then((historyResult) => {
          if (_sessionLoadVersion !== loadVersion) return
          const { messages: loadedMessages, toolCalls: historyToolCalls } = historyResult
          _sessionMessagesCache.set(sessionId, loadedMessages)
          set((state) => {
            if (state.currentSessionId !== sessionId) return state
            // Preserve any streaming placeholder that arrived during the async load
            const streamingMsgs = state.messages.filter(m => m.id.startsWith('streaming-'))
            const mergedToolCalls = historyToolCalls.length > 0
              ? { ...state.sessionToolCalls, [sessionId]: historyToolCalls.map(tc => ({ ...tc, startedAt: 0 })) }
              : state.sessionToolCalls
            return {
              messages: streamingMsgs.length > 0 ? [...loadedMessages, ...streamingMsgs] : loadedMessages,
              sessionToolCalls: mergedToolCalls
            }
          })
        }).catch(() => { })
      },
      createNewSession: async () => {
        const { client, currentAgentId } = get()
        if (!client) return

        const session = await client.createSession(currentAgentId || undefined)
        const sessionId = session.key || session.id
        set((state) => ({
          sessions: [session, ...state.sessions.filter(s => (s.key || s.id) !== sessionId)],
          currentSessionId: sessionId,
          messages: [],
          activeSubagents: [],
          streamingSessionId: null
        }))
      },
      deleteSession: (sessionId) => {
        if (SYSTEM_SESSION_RE.test(sessionId)) return
        _sessionMessagesCache.delete(sessionId)
        const { client } = get()
        client?.deleteSession(sessionId)
        set((state) => {
          const { [sessionId]: _s, ...restStreaming } = state.streamingSessions
          const { [sessionId]: _h, ...restChunks } = state.sessionHadChunks
          const { [sessionId]: _t, ...restToolCalls } = state.sessionToolCalls
          return {
            sessions: state.sessions.filter((s) => (s.key || s.id) !== sessionId),
            currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
            pinnedSessionKeys: state.pinnedSessionKeys.filter(k => k !== sessionId),
            streamingSessions: restStreaming,
            sessionHadChunks: restChunks,
            sessionToolCalls: restToolCalls,
          }
        })
      },
      updateSessionLabel: async (sessionId, label) => {
        const { client } = get()
        if (!client) return

        await client.updateSession(sessionId, { label })
        set((state) => ({
          sessions: state.sessions.map((s) =>
            (s.key || s.id) === sessionId ? { ...s, title: label } : s
          )
        }))
      },
      spawnSubagentSession: async (agentId, prompt) => {
        const { client } = get()
        if (!client) return

        const session = await client.spawnSession(agentId, prompt)
        const sessionId = session.key || session.id
        set((state) => ({
          sessions: [session, ...state.sessions.filter(s => (s.key || s.id) !== sessionId)],
          currentSessionId: sessionId,
          messages: []
        }))

        // Load any existing messages for the spawned session
        const historyResult = await client.getSessionMessages(session.key || session.id)
        if (historyResult.messages.length > 0) {
          set((state) => ({
            messages: historyResult.messages,
            sessionToolCalls: historyResult.toolCalls.length > 0
              ? { ...state.sessionToolCalls, [sessionId]: historyResult.toolCalls.map(tc => ({ ...tc, startedAt: 0 })) }
              : state.sessionToolCalls
          }))
        }
      },

      // Agents
      agents: [],
      currentAgentId: null,
      setCurrentAgent: (agentId) => {
        const { currentAgentId: prevAgentId, sessions, currentSessionId: prevSessionId, messages: currentMessages } = get()
        if (agentId === prevAgentId) return

        // Cache outgoing session's messages
        if (prevSessionId && currentMessages.length > 0) {
          const nonStreaming = currentMessages.filter(m => !m.id.startsWith('streaming-'))
          if (nonStreaming.length > 0) {
            _sessionMessagesCache.set(prevSessionId, nonStreaming)
          }
        }

        // Find the most recent non-subagent, non-cron session for the new agent
        const agentSession = sessions.find(s => {
          const key = s.key || s.id
          return s.agentId === agentId && !s.spawned && !s.cron && !key.includes(':subagent:') && !key.includes(':cron:')
        })

        const newSessionId = agentSession ? (agentSession.key || agentSession.id) : null
        const cachedMessages = newSessionId ? (_sessionMessagesCache.get(newSessionId) || []) : []
        set({ currentAgentId: agentId, currentSessionId: newSessionId, messages: cachedMessages })

        // Load fresh messages for the existing session, if any
        if (newSessionId) {
          const { client } = get()
          client?.getSessionMessages(newSessionId).then((historyResult) => {
            if (get().currentSessionId === newSessionId) {
              const { messages: loadedMessages, toolCalls: historyToolCalls } = historyResult
              _sessionMessagesCache.set(newSessionId, loadedMessages)
              set((state) => ({
                messages: loadedMessages,
                sessionToolCalls: historyToolCalls.length > 0
                  ? { ...state.sessionToolCalls, [newSessionId]: historyToolCalls.map(tc => ({ ...tc, startedAt: 0 })) }
                  : state.sessionToolCalls
              }))
            }
          }).catch(() => { })
        }
      },
      showCreateAgent: () => set({ mainView: 'create-agent', selectedSkill: null, selectedCronJob: null, selectedAgentDetail: null }),
      createAgent: async (params) => {
        const { client } = get()
        if (!client) return { success: false, error: 'Not connected' }

        try {
          // 1. Patch config to add the agent (this triggers a server restart)
          const result = await client.createAgent({
            name: params.name,
            workspace: params.workspace,
            model: params.model
          })

          if (!result?.ok) {
            return { success: false, error: 'Server returned an error' }
          }

          const agentId = result.agentId
          const needsIdentity = params.name || params.emoji || params.avatar

          // 2. config.patch triggers a server restart via SIGUSR1.
          //    Wait for the client to reconnect so the server knows about
          //    the new agent before we try to write files or fetch agents.
          await new Promise<void>((resolve) => {
            let resolved = false
            const onConnected = () => {
              if (resolved) return
              resolved = true
              client.off('connected', onConnected)
              resolve()
            }
            client.on('connected', onConnected)

            // Safety timeout: if no reconnect within 15s, continue anyway
            setTimeout(() => {
              if (!resolved) {
                resolved = true
                client.off('connected', onConnected)
                resolve()
              }
            }, 15000)
          })

          // 3. Now that the server has restarted with the new config,
          //    write IDENTITY.md with name/emoji/avatar
          if (needsIdentity) {
            const content = buildIdentityContent({
              name: params.name,
              emoji: params.emoji,
              avatar: params.avatar,
              agentId,
              avatarFileName: params.avatarFileName
            })
            try {
              await client.setAgentFile(agentId, 'IDENTITY.md', content)
            } catch (err) {
              // Failed to write IDENTITY.md
            }

            // Write avatar image as a separate file instead of embedding in IDENTITY.md
            if (params.avatar && params.avatarFileName && params.avatar.startsWith('data:')) {
              try {
                // Strip the data URI prefix (e.g. "data:image/png;base64,") to get raw base64
                const base64Content = params.avatar.replace(/^data:[^;]+;base64,/, '')
                const avatarPath = `avatars/${agentId}/${params.avatarFileName}`
                await client.setAgentFile(agentId, avatarPath, base64Content)
              } catch (err) {
                // Failed to write avatar file
              }
            }
          }

          // 4. Refresh agents list and navigate to detail view
          await get().fetchAgents()

          const newAgent = get().agents.find(a => a.id === agentId)
          if (newAgent) {
            set({ currentAgentId: agentId })
            await get().selectAgentForDetail(newAgent)
          } else {
            set({ mainView: 'chat' })
          }

          return { success: true }
        } catch (err: any) {
          return { success: false, error: err?.message || 'Failed to create agent' }
        }
      },

      deleteAgent: async (agentId) => {
        const { client } = get()
        if (!client) return { success: false, error: 'Not connected' }

        try {
          const result = await client.deleteAgent(agentId)
          if (!result?.ok) {
            return { success: false, error: 'Server returned an error' }
          }

          // Wait for reconnect after config.patch triggers server restart
          await new Promise<void>((resolve) => {
            let resolved = false
            const onConnected = () => {
              if (resolved) return
              resolved = true
              client.off('connected', onConnected)
              resolve()
            }
            client.on('connected', onConnected)

            setTimeout(() => {
              if (!resolved) {
                resolved = true
                client.off('connected', onConnected)
                resolve()
              }
            }, 15000)
          })

          // If deleted agent was selected, switch to 'main' or first available
          const { currentAgentId, mainView, selectedAgentDetail } = get()
          if (currentAgentId === agentId) {
            set({ currentAgentId: 'main' })
          }

          // If deleted agent was in detail view, close it
          if (mainView === 'agent-detail' && selectedAgentDetail?.agent.id === agentId) {
            set({ mainView: 'chat', selectedAgentDetail: null })
          }

          // Refresh agents list
          await get().fetchAgents()

          // Fallback: if 'main' doesn't exist, pick first available
          const { agents, currentAgentId: newAgentId } = get()
          if (newAgentId === agentId || !agents.some(a => a.id === newAgentId)) {
            set({ currentAgentId: agents[0]?.id || 'main' })
          }

          return { success: true }
        } catch (err: any) {
          return { success: false, error: err?.message || 'Failed to delete agent' }
        }
      },

      // Skills & Crons
      skills: [],
      cronJobs: [],

      // ClawHub
      clawHubSkills: [],
      clawHubLoading: false,
      clawHubSearchQuery: '',
      clawHubSort: 'downloads',
      selectedClawHubSkill: null,
      skillsSubTab: 'installed',
      installingHubSkill: null,
      installHubSkillError: null,
      setSkillsSubTab: (tab) => {
        set({ skillsSubTab: tab })
        if (tab === 'available' && get().clawHubSkills.length === 0 && !get().clawHubLoading) {
          get().fetchClawHubSkills()
        }
      },
      fetchClawHubSkills: async () => {
        set({ clawHubLoading: true })
        try {
          const skills = await listClawHubSkills(get().clawHubSort)
          // Cache stats for enriching search results later
          for (const s of skills) {
            _clawHubStatsCache.set(s.slug, { downloads: s.downloads, stars: s.stars })
          }
          set({ clawHubSkills: skills })
        } catch {
          // fetch failed
        }
        set({ clawHubLoading: false })
      },
      searchClawHubSkills: async (query) => {
        set({ clawHubSearchQuery: query, clawHubLoading: true })
        try {
          let skills = query.trim()
            ? await searchClawHub(query)
            : await listClawHubSkills(get().clawHubSort)
          // Enrich search results with cached stats (search endpoint doesn't return stats)
          skills = skills.map(s => {
            const cached = _clawHubStatsCache.get(s.slug)
            if (cached && s.downloads === 0 && s.stars === 0) {
              return { ...s, downloads: cached.downloads, stars: cached.stars }
            }
            // Cache stats from list results
            if (s.downloads > 0 || s.stars > 0) {
              _clawHubStatsCache.set(s.slug, { downloads: s.downloads, stars: s.stars })
            }
            return s
          })
          set({ clawHubSkills: skills })
        } catch {
          // search failed
        }
        set({ clawHubLoading: false })
      },
      setClawHubSort: (sort) => {
        set({ clawHubSort: sort })
        get().fetchClawHubSkills()
      },
      selectClawHubSkill: (skill) => {
        set({ mainView: 'clawhub-skill-detail', selectedClawHubSkill: skill, selectedSkill: null, selectedCronJob: null, selectedAgentDetail: null })
      },
      installClawHubSkill: async (slug) => {
        set({ installingHubSkill: slug, installHubSkillError: null })

        const { client, currentSessionId } = get()
        if (!client) {
          set({ installHubSkillError: 'Not connected to server', installingHubSkill: null })
          return
        }

        try {
          // Send chat message — the agent runs clawhub install via exec tool
          await client.installHubSkill(slug, currentSessionId || undefined)

          // Poll for the skill to appear in the skills list (agent runs async)
          const maxAttempts = 24 // ~2 minutes
          const pollInterval = 5000
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, pollInterval))
            // Stop polling if user navigated away or started a different install
            if (get().installingHubSkill !== slug) return
            await get().fetchSkills()
            const installed = get().skills.some(s => {
              const sl = slug.toLowerCase()
              if (s.name.toLowerCase() === sl || s.id.toLowerCase() === sl) return true
              if (s.filePath) {
                const parts = s.filePath.replace(/\\/g, '/').split('/')
                const idx = parts.lastIndexOf('skills')
                if (idx >= 0 && idx + 1 < parts.length && parts[idx + 1].toLowerCase() === sl) return true
              }
              return false
            })
            if (installed) {
              set({ installingHubSkill: null })
              return
            }
          }
          // Timed out — clear state, user can check chat for output
          set({ installingHubSkill: null, installHubSkillError: 'Install may still be running — check the chat for output' })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Install failed'
          console.error('[clawhub] Install failed:', msg)
          set({ installHubSkillError: msg, installingHubSkill: null })
        }
      },
      fetchClawHubSkillDetail: async (slug) => {
        try {
          // Fetch REST detail and Convex data (VT scan) in parallel
          const [detail, convexData] = await Promise.all([
            getClawHubSkill(slug),
            getClawHubSkillConvex(slug)
          ])
          if (detail && get().selectedClawHubSkill?.slug === slug) {
            if (convexData?.vtAnalysis) {
              detail.vtAnalysis = convexData.vtAnalysis
            }
            set({ selectedClawHubSkill: detail })
            // Cache stats
            if (detail.downloads > 0 || detail.stars > 0) {
              _clawHubStatsCache.set(slug, { downloads: detail.downloads, stars: detail.stars })
            }
            // Fetch version details (files, changelog)
            if (detail.version) {
              const versionInfo = await getClawHubSkillVersion(slug, detail.version)
              if (versionInfo && get().selectedClawHubSkill?.slug === slug) {
                set((state) => ({
                  selectedClawHubSkill: state.selectedClawHubSkill ? {
                    ...state.selectedClawHubSkill,
                    changelog: versionInfo.changelog,
                    versionFiles: versionInfo.files
                  } : null
                }))
              }
            }
          }
        } catch {
          // detail fetch failed - keep the list data
        }
      },

      // Actions
      initializeApp: async () => {
        // Get config from platform (Electron, Capacitor, or web)
        const config = await Platform.getConfig()
        if (!get().serverUrl && config.defaultUrl) {
          set({ serverUrl: config.defaultUrl })
        }
        if (config.theme) {
          set({ theme: config.theme as 'dark' | 'light' })
        }

        // Load token from secure storage
        const secureToken = await Platform.getToken()
        if (secureToken) {
          set({ gatewayToken: secureToken })
        } else {
          // Migration: if Zustand has a token from old localStorage but secure storage is empty,
          // migrate it to secure storage
          const legacyToken = get().gatewayToken
          if (legacyToken) {
            await Platform.saveToken(legacyToken).catch(() => { })
          }
        }

        // Clean up legacy gatewayToken from localStorage
        try {
          const raw = localStorage.getItem('clawcontrol-storage')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed.state?.gatewayToken) {
              delete parsed.state.gatewayToken
              localStorage.setItem('clawcontrol-storage', JSON.stringify(parsed))
            }
          }
        } catch { /* ignore */ }

        // Show settings if no URL or token configured
        const { serverUrl, gatewayToken } = get()
        if (!serverUrl || !gatewayToken) {
          set({ showSettings: true })
          return
        }

        // Auto-connect
        try {
          await get().connect()
        } catch {
          // Show settings on connection failure
          set({ showSettings: true })
        }
      },

      connect: async () => {
        const { serverUrl, gatewayToken, client: existingClient, connecting } = get()

        // Prevent concurrent connect() calls (React StrictMode fires effects twice)
        if (connecting) {
          return
        }

        // Show settings if URL is not configured
        if (!serverUrl) {
          set({ showSettings: true })
          return
        }

        // Disconnect existing client to prevent duplicate event handling
        if (existingClient) {
          existingClient.disconnect()
          set({ client: null })
        }

        // Also kill any stale client surviving across Vite HMR reloads.
        const stale = (globalThis as any).__clawdeskClient as OpenClawClient | undefined
        if (stale && stale !== existingClient) {
          try { stale.disconnect() } catch { /* already closed */ }
        }

        set({ connecting: true, pairingStatus: 'none', pairingDeviceId: null })

        // Hoisted so catch block can access for device token retry logic
        let serverHost: string | null = null
        let effectiveToken = gatewayToken
        try {
          serverHost = new URL(serverUrl).host
        } catch {
          // URL parsing failed
        }

        try {
          const { authMode } = get()

          // Load or create device identity for Ed25519 challenge signing.
          // ClawControl no longer supports the insecure-auth bypass; always attempt pairing.
          let deviceIdentity: DeviceIdentity | null = null
          try {
            deviceIdentity = await getOrCreateDeviceIdentity()
          } catch {
            // Ed25519 unavailable — connect without device identity
          }

          // Check for a stored device token for this server.
          if (serverHost) {
            try {
              const storedDeviceToken = await getDeviceToken(serverHost)
              if (storedDeviceToken) {
                effectiveToken = storedDeviceToken
              }
            } catch {
              // Storage read failed
            }
          }

          // On iOS, use the native WebSocket plugin for TLS certificate handling
          let wsFactory: ((url: string) => any) | undefined
          try {
            const host = new URL(serverUrl).host
            wsFactory = Platform.createWebSocketFactory({
              required: false,
              allowTOFU: true,
              storeKey: host,
              origin: 'capacitor://localhost',
            })
          } catch {
            // URL parsing failed, proceed without factory
          }
          const { deviceName } = get()
          const client = new OpenClawClient(serverUrl, effectiveToken, authMode, wsFactory, deviceIdentity, deviceName || undefined)

          // Set up event handlers
          client.on('message', (msgArg: unknown) => {
            const msgPayload = msgArg as Message & { sessionKey?: string }
            const sessionKey = msgPayload.sessionKey
            const { currentSessionId } = get()
            const resolvedKey = sessionKey || currentSessionId
            const isCurrentSession = !sessionKey || !currentSessionId || sessionKey === currentSessionId

            // For non-current sessions, just clear streaming state
            if (!isCurrentSession) {
              if (resolvedKey) {
                set((state) => ({
                  streamingSessions: { ...state.streamingSessions, [resolvedKey]: false }
                }))
              }
              return
            }

            const message: Message = {
              id: msgPayload.id,
              role: msgPayload.role,
              content: msgPayload.content,
              timestamp: msgPayload.timestamp,
              thinking: msgPayload.thinking,
              images: msgPayload.images
            }
            let replacedStreaming = false

            set((state) => {
              const streamingSessions = resolvedKey
                ? { ...state.streamingSessions, [resolvedKey]: false }
                : state.streamingSessions

              // Replace streaming placeholder with the final server message
              const lastIdx = state.messages.length - 1
              const lastMsg = lastIdx >= 0 ? state.messages[lastIdx] : null

              // Helper: re-anchor tool calls from an old message id to the new final id
              const reanchorToolCalls = (oldId: string, sessionToolCalls: typeof state.sessionToolCalls) => {
                const tcKey = resolvedKey || ''
                const tcs = sessionToolCalls[tcKey]
                if (!tcs?.some(tc => tc.afterMessageId === oldId)) return sessionToolCalls
                return {
                  ...sessionToolCalls,
                  [tcKey]: tcs.map(tc =>
                    tc.afterMessageId === oldId ? { ...tc, afterMessageId: message.id } : tc
                  )
                }
              }

              if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id.startsWith('streaming-')) {
                replacedStreaming = true
                const updated = [...state.messages]
                updated[lastIdx] = { ...message }
                return {
                  messages: updated,
                  streamingSessions,
                  sessionToolCalls: reanchorToolCalls(lastMsg.id, state.sessionToolCalls)
                }
              }

              // Also check for finalized messages (msg-finalized-*) that may hold tool calls
              const finalizedIdx = state.messages.findIndex(m =>
                m.role === 'assistant' && m.id.startsWith('msg-finalized-')
              )
              if (finalizedIdx >= 0) {
                const finalizedMsg = state.messages[finalizedIdx]
                const updated = [...state.messages]
                // If the finalized message has no content, remove it (tool-call-only anchor)
                // and re-anchor its tool calls to the new final message
                if (!finalizedMsg.content.trim() && (!finalizedMsg.images || finalizedMsg.images.length === 0)) {
                  updated.splice(finalizedIdx, 1)
                } else {
                  // Keep it but give it the canonical id if it's the same content
                  updated[finalizedIdx] = { ...finalizedMsg }
                }
                const exists = updated.some(m => m.id === message.id)
                return {
                  messages: exists
                    ? updated.map(m => m.id === message.id ? message : m)
                    : [...updated, message],
                  streamingSessions,
                  sessionToolCalls: reanchorToolCalls(finalizedMsg.id, state.sessionToolCalls)
                }
              }

              const exists = state.messages.some(m => m.id === message.id)
              if (exists) {
                return {
                  messages: state.messages.map(m => m.id === message.id ? message : m),
                  streamingSessions
                }
              }
              return {
                messages: [...state.messages, message],
                streamingSessions
              }
            })

            // Only notify for non-streamed responses (streamEnd handles streamed ones)
            if (message.role === 'assistant' && !replacedStreaming) {
              const preview = message.content.slice(0, 100) || (message.images?.length ? 'Image response' : 'New response')
              const { notificationsEnabled, streamingSessionId: msgSession, currentSessionId: activeSession, agents, currentAgentId } = get()
              if (shouldNotify(notificationsEnabled, msgSession, activeSession)) {
                const name = resolveAgentName(msgSession, agents, currentAgentId)
                Platform.showNotification(`${name} responded`, preview).catch(() => { })
              }
            }
          })

          client.on('connected', (payload: unknown) => {
            set({ connected: true, connecting: false, connectionError: null, pairingStatus: 'none', pairingDeviceId: null })

            // Extract and store device token from hello-ok response
            if (serverHost && payload && typeof payload === 'object') {
              const helloOk = payload as Record<string, any>
              const deviceToken = helloOk.auth?.deviceToken
              if (typeof deviceToken === 'string' && deviceToken) {
                saveDeviceToken(serverHost, deviceToken).catch(() => { })
              }
            }
          })

          client.on('pairingRequired', (payload: unknown) => {
            const { deviceId } = (payload || {}) as { requestId?: string; deviceId?: string }
            set({
              connecting: false,
              pairingStatus: 'pending',
              pairingDeviceId: deviceId || null,
              showSettings: true
            })
          })

          client.on('deviceIdentityStale', () => {
            clearDeviceIdentity().catch(() => { })
          })

          client.on('disconnected', () => {
            set({ connected: false, streamingSessions: {}, sessionHadChunks: {}, sessionToolCalls: {} })
            get().stopSubagentPolling()
          })

          client.on('certError', (payload: unknown) => {
            const { httpsUrl } = payload as { url: string; httpsUrl: string }
            get().showCertErrorModal(httpsUrl)
          })

          client.on('streamStart', (payload: unknown) => {
            const { sessionKey } = (payload || {}) as { sessionKey?: string }
            const { currentSessionId } = get()
            const resolvedKey = sessionKey || currentSessionId
            if (resolvedKey) {
              set((state) => ({
                streamingSessions: { ...state.streamingSessions, [resolvedKey]: true },
                sessionHadChunks: { ...state.sessionHadChunks, [resolvedKey]: false },
              }))
            }
            if (!sessionKey || !currentSessionId || sessionKey === currentSessionId) {
              get().startSubagentPolling()
            }
          })

          client.on('streamChunk', (chunkArg: unknown) => {
            const chunk = (chunkArg && typeof chunkArg === 'object')
              ? chunkArg as { text?: string; sessionKey?: string }
              : { text: String(chunkArg) }
            const text = chunk.text || ''
            const sessionKey = chunk.sessionKey
            // Skip empty chunks
            if (!text) return

            const { currentSessionId } = get()
            const resolvedKey = sessionKey || currentSessionId
            const isCurrentSession = !sessionKey || !currentSessionId || sessionKey === currentSessionId

            // For non-current sessions, just track that chunks arrived
            if (!isCurrentSession) {
              if (resolvedKey) {
                set((state) => ({
                  streamingSessions: { ...state.streamingSessions, [resolvedKey]: true },
                  sessionHadChunks: { ...state.sessionHadChunks, [resolvedKey]: true },
                }))
              }
              return
            }

            set((state) => {
              const perSession = resolvedKey ? {
                streamingSessions: { ...state.streamingSessions, [resolvedKey]: true },
                sessionHadChunks: { ...state.sessionHadChunks, [resolvedKey]: true },
              } : {}

              const messages = [...state.messages]
              const lastMessage = messages[messages.length - 1]

              // Only append to an active streaming placeholder — finalized messages
              // should not be extended (a new streaming message will be created instead).
              if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id.startsWith('streaming-')) {
                const updatedMessage = { ...lastMessage, content: lastMessage.content + text }
                messages[messages.length - 1] = updatedMessage
                return { messages, ...perSession }
              } else {
                // Create new assistant placeholder
                const newMessage: Message = {
                  id: `streaming-${Date.now()}`,
                  role: 'assistant',
                  content: text,
                  timestamp: new Date().toISOString()
                }

                // Re-anchor any orphaned (trailing) tool calls to this new message
                // so they render above the text inside the same bubble.
                const tcKey = resolvedKey || ''
                const currentTCs = state.sessionToolCalls[tcKey]
                let sessionToolCalls = state.sessionToolCalls
                if (currentTCs?.some(tc => !tc.afterMessageId)) {
                  const updated = currentTCs.map(tc =>
                    tc.afterMessageId ? tc : { ...tc, afterMessageId: newMessage.id }
                  )
                  sessionToolCalls = { ...state.sessionToolCalls, [tcKey]: updated }
                }

                return { messages: [...messages, newMessage], sessionToolCalls, ...perSession }
              }
            })
          })

          client.on('streamEnd', (payload: unknown) => {
            const { sessionKey } = (payload || {}) as { sessionKey?: string }
            const { currentSessionId } = get()
            const resolvedKey = sessionKey || get().streamingSessionId || currentSessionId

            // Notification / unread logic — works for any session, not just the viewed one
            if (resolvedKey && get().sessionHadChunks[resolvedKey]) {
              const { messages, notificationsEnabled, currentSessionId: activeSession, agents, currentAgentId } = get()
              const agentName = resolveAgentName(resolvedKey, agents, currentAgentId)
              // Only read last message if this is the current session (messages are loaded)
              if (resolvedKey === activeSession) {
                const lastMsg = messages[messages.length - 1]
                if (lastMsg?.role === 'assistant') {
                  const preview = lastMsg.content.slice(0, 100) || (lastMsg.images?.length ? 'Image response' : 'New response')
                  if (shouldNotify(notificationsEnabled, resolvedKey, activeSession)) {
                    Platform.showNotification(`${agentName} responded`, preview).catch(() => { })
                  }
                }
              }

              if (resolvedKey !== activeSession) {
                set((state) => ({
                  unreadCounts: {
                    ...state.unreadCounts,
                    [resolvedKey]: (state.unreadCounts[resolvedKey] || 0) + 1
                  }
                }))
                // Also notify for non-current sessions
                const { notificationsEnabled: ne } = get()
                if (ne) {
                  Platform.showNotification(`${agentName} responded`, `New message in another session`).catch(() => { })
                }
              }
            }

            // Clear per-session streaming state
            if (resolvedKey) {
              set((state) => ({
                streamingSessions: { ...state.streamingSessions, [resolvedKey]: false },
                sessionHadChunks: { ...state.sessionHadChunks, [resolvedKey]: false },
                streamingSessionId: state.streamingSessionId === resolvedKey ? null : state.streamingSessionId,
              }))
            } else {
              set({ streamingSessionId: null })
            }

            // Only stop subagent polling if the current session's stream ended
            if (!sessionKey || !currentSessionId || sessionKey === currentSessionId) {
              get().stopSubagentPolling()
            }
          })

          // When the server reports the canonical session key during streaming,
          // update local state so session lookups and history retrieval use the
          // correct key.
          client.on('streamSessionKey', (payload: unknown) => {
            const { sessionKey } = payload as { runId: string; sessionKey: string }
            if (!sessionKey) return

            const { streamingSessionId, currentSessionId } = get()
            const oldKey = streamingSessionId || currentSessionId
            if (!oldKey || sessionKey === oldKey) return

            set((state) => {
              // Rename the old session to the new key and remove any existing
              // session that already has that key to prevent duplicates.
              let renamed = false
              const sessions = state.sessions.reduce<typeof state.sessions>((acc, s) => {
                const sKey = s.key || s.id
                if (sKey === oldKey && !renamed) {
                  renamed = true
                  acc.push({ ...s, id: sessionKey, key: sessionKey })
                } else if (sKey !== sessionKey) {
                  acc.push(s)
                }
                return acc
              }, [])

              // Migrate per-session streaming state from old key to new key
              const { [oldKey]: wasStreaming, ...restStreaming } = state.streamingSessions
              const { [oldKey]: hadChunks, ...restChunks } = state.sessionHadChunks
              const { [oldKey]: toolCalls, ...restToolCalls } = state.sessionToolCalls

              return {
                currentSessionId: state.currentSessionId === oldKey ? sessionKey : state.currentSessionId,
                streamingSessionId: state.streamingSessionId === oldKey ? sessionKey : state.streamingSessionId,
                sessions,
                streamingSessions: wasStreaming !== undefined ? { ...restStreaming, [sessionKey]: wasStreaming } : state.streamingSessions,
                sessionHadChunks: hadChunks !== undefined ? { ...restChunks, [sessionKey]: hadChunks } : state.sessionHadChunks,
                sessionToolCalls: toolCalls !== undefined ? { ...restToolCalls, [sessionKey]: toolCalls } : state.sessionToolCalls,
              }
            })
          })

          client.on('toolCall', (payload: unknown) => {
            const tc = payload as { toolCallId: string; name: string; phase: string; result?: string; args?: Record<string, unknown>; meta?: string; sessionKey?: string }
            const { currentSessionId } = get()
            if (tc.sessionKey && currentSessionId && tc.sessionKey !== currentSessionId) return

            const toolSessionKey = tc.sessionKey || currentSessionId || ''
            // If server sent meta on result phase but no args, synthesize args for detail display
            const effectiveArgs = tc.args ?? (tc.meta ? { _meta: tc.meta } : undefined)
            set((state) => {
              const currentToolCalls = state.sessionToolCalls[toolSessionKey] || []
              const idx = currentToolCalls.findIndex(t => t.toolCallId === tc.toolCallId)
              if (idx >= 0) {
                const updated = [...currentToolCalls]
                updated[idx] = {
                  ...updated[idx],
                  phase: tc.phase as 'start' | 'result',
                  result: tc.result ?? updated[idx].result,
                  args: effectiveArgs ?? updated[idx].args
                }
                return { sessionToolCalls: { ...state.sessionToolCalls, [toolSessionKey]: updated } }
              }

              // New tool call: finalize the current streaming message so subsequent
              // stream chunks create a new bubble, and link this tool call to it.
              const { messages: finalizedMsgs, finalizedId } = finalizeStreamingMessage(state.messages)
              return {
                messages: finalizedMsgs,
                sessionToolCalls: {
                  ...state.sessionToolCalls,
                  [toolSessionKey]: [...currentToolCalls, {
                    toolCallId: tc.toolCallId,
                    name: tc.name,
                    phase: tc.phase as 'start' | 'result',
                    result: tc.result,
                    args: effectiveArgs,
                    startedAt: Date.now(),
                    afterMessageId: finalizedId || undefined
                  }]
                }
              }
            })
          })

          // Event-driven subagent detection: when the primary session filter
          // blocks an event from a different session, the client emits this.
          client.on('subagentDetected', (payload: unknown) => {
            const { sessionKey } = payload as { sessionKey: string }
            if (!sessionKey) return
            set((state) => {
              // Skip if already tracked
              if (state.activeSubagents.some(a => a.sessionKey === sessionKey)) return state

              const { messages: finalizedMsgs, finalizedId } = finalizeStreamingMessage(state.messages)
              return {
                messages: finalizedMsgs,
                activeSubagents: [...state.activeSubagents, {
                  sessionKey,
                  parentSessionId: state.currentSessionId || undefined,
                  label: sessionKey,
                  status: 'running' as const,
                  detectedAt: Date.now(),
                  afterMessageId: finalizedId || undefined
                }]
              }
            })
          })

          // When the client exhausts its reconnect attempts, stop trying.
          // The user can manually reconnect via settings or by refreshing.
          client.on('reconnectExhausted', () => {
            set({ connecting: false, connected: false })
          })

          // Exec approval notifications: when a tool needs permission, notify the user
          client.on('execApprovalRequested', (payload: unknown) => {
            const data = (payload as any)?.data || payload
            const command = data?.command || data?.tool || 'Unknown command'
            Platform.showNotification('Exec Approval Required', String(command)).catch(() => { })
          })

          await client.connect()
            ; (globalThis as any).__clawdeskClient = client
          set({ client })

          // Fetch initial data
          await Promise.all([
            get().fetchSessions(),
            get().fetchAgents(),
            get().fetchSkills(),
            get().fetchCronJobs()
          ])
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : ''

          // Don't rethrow pairing errors — the UI handles them via pairingStatus
          if (errMsg === 'NOT_PAIRED') {
            return
          }

          // Stale device identity — clear it and reconnect with a fresh keypair (once)
          if (errMsg === 'DEVICE_IDENTITY_STALE') {
            const retries = (get() as any)._staleIdentityRetries || 0
            if (retries >= 1) {
              console.warn('[connect] Stale device identity retry exhausted, giving up')
                ; (set as any)({ connecting: false, connected: false, _staleIdentityRetries: 0 })
              return
            }
            (set as any)({ _staleIdentityRetries: retries + 1 })
            await clearDeviceIdentity()
            set({ connecting: false })
            return get().connect()
          }

          // Don't rethrow cert errors — the CertErrorModal handles them
          if (errMsg.startsWith('Certificate error')) {
            set({ connecting: false, connected: false })
            return
          }

          // If we used a stored device token and it failed, retry with the gateway token
          if (serverHost && effectiveToken !== gatewayToken) {
            await clearDeviceToken(serverHost)
            set({ connecting: false })
            return get().connect()
          }

          const connectionError = err instanceof Error ? err.message : 'Connection failed'
          set({ connecting: false, connected: false, connectionError })
          throw err
        }
      },

      disconnect: () => {
        const { client } = get()
        client?.disconnect()
        if ((globalThis as any).__clawdeskClient === client) {
          (globalThis as any).__clawdeskClient = null
        }
        set({ client: null, connected: false })
      },

      sendMessage: async (content: string, attachments = []) => {
        const { client, currentSessionId, thinkingEnabled, currentAgentId } = get()
        const trimmed = content.trim()
        if (!client || (!trimmed && attachments.length === 0)) return

        let sessionId = currentSessionId
        if (!sessionId) {
          const session = await client.createSession(currentAgentId || undefined)
          sessionId = session.key || session.id
          set((state) => ({
            sessions: [session, ...state.sessions.filter(s => (s.key || s.id) !== sessionId)],
            currentSessionId: sessionId,
            messages: []
          }))
        }

        // Pre-seed the primary session filter so subagent events are dropped
        client.setPrimarySessionKey(sessionId!)

        // Reset streaming state for this session
        // Keep activeSubagents so previous subagent blocks stay visible in chat
        set((state) => ({
          streamingSessions: { ...state.streamingSessions, [sessionId!]: true },
          sessionHadChunks: { ...state.sessionHadChunks, [sessionId!]: false },
          sessionToolCalls: { ...state.sessionToolCalls, [sessionId!]: [] },
          streamingSessionId: sessionId
        }))

        // Add user message immediately
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
          images: attachments.length > 0
            ? attachments
                .filter(a => typeof a.previewUrl === 'string' && a.previewUrl.trim())
                .map(a => ({ url: a.previewUrl as string, mimeType: a.mimeType }))
            : undefined
        }
        set((state) => ({ messages: [...state.messages, userMessage] }))

        // Send to server
        try {
          await client.sendMessage({
            sessionId: sessionId,
            content: trimmed,
            agentId: currentAgentId || undefined,
            thinking: thinkingEnabled,
            attachments: attachments.map(({ previewUrl: _previewUrl, ...attachment }) => attachment)
          })
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error'
          const isAuthOrScope = errMsg.includes('scope') || errMsg.includes('unauthorized') || errMsg.includes('permission')

          if (sessionId) {
            set((state) => ({
              messages: [...state.messages, {
                id: `error-${Date.now()}`,
                role: 'system' as const,
                content: isAuthOrScope
                  ? `Message failed: ${errMsg}`
                  : 'Message failed to send — connection lost. Reconnecting...',
                timestamp: new Date().toISOString()
              }],
              streamingSessions: { ...state.streamingSessions, [sessionId]: false },
              streamingSessionId: null
            }))
          }

          // Only reconnect for connection errors, not auth/scope failures
          if (!isAuthOrScope) {
            get().connect().catch(() => { })
          }
        }
      },

      abortChat: async () => {
        const { client, currentSessionId } = get()
        if (!client || !currentSessionId) return
        if (!get().streamingSessions[currentSessionId]) return
        try {
          await client.abortChat(currentSessionId)
        } catch {
          // Abort is best-effort
        }
        set((state) => ({
          streamingSessions: { ...state.streamingSessions, [currentSessionId]: false },
          sessionHadChunks: { ...state.sessionHadChunks, [currentSessionId]: false },
          sessionToolCalls: { ...state.sessionToolCalls, [currentSessionId]: [] },
          streamingSessionId: state.streamingSessionId === currentSessionId ? null : state.streamingSessionId,
        }))
      },

      fetchSessions: async () => {
        const { client } = get()
        if (!client) return
        const serverSessions = await client.listSessions()

        set((state) => {
          // Deduplicate server sessions by key to prevent duplicate React keys
          const seen = new Set<string>()
          const uniqueServerSessions = serverSessions.filter(s => {
            const key = s.key || s.id
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })

          // Filter out spawned subagent sessions and cron sessions — they
          // clutter the sidebar. Subagents are tracked via SubagentBlock.
          // Always keep the currently active session even if it's spawned.
          const nonSpawnedSessions = uniqueServerSessions.filter(s => {
            const key = s.key || s.id
            if (key === state.currentSessionId) return true
            if (SYSTEM_SESSION_RE.test(key)) return false
            if (key.includes(':subagent:')) return false
            return !s.spawned && !s.parentSessionId && !s.cron
          })

          // Preserve local-only sessions (created but no message sent yet)
          // that aren't in the server's response — but never duplicate a key
          // that already exists in the server results.
          const allServerKeys = new Set(uniqueServerSessions.map(s => s.key || s.id))
          const keptKeys = new Set(nonSpawnedSessions.map(s => s.key || s.id))
          const localOnly = state.sessions.filter(s => {
            const key = s.key || s.id
            return !keptKeys.has(key) && !allServerKeys.has(key) && key.startsWith('agent:')
          })
          return { sessions: [...nonSpawnedSessions, ...localOnly] }
        })
      },

      fetchAgents: async () => {
        const { client } = get()
        if (!client) return
        const agents = await client.listAgents()
        set({ agents })
        if (agents.length > 0 && !get().currentAgentId) {
          set({ currentAgentId: agents[0].id })
        }
      },

      fetchSkills: async () => {
        const { client } = get()
        if (!client) return
        const skills = await client.listSkills()
        set({ skills })
      },

      fetchCronJobs: async () => {
        const { client } = get()
        if (!client) return
        const cronJobs = await client.listCronJobs()
        set({ cronJobs })
      }
    }),
    {
      name: 'clawcontrol-storage',
      partialize: (state) => ({
        theme: state.theme,
        serverUrl: state.serverUrl,
        authMode: state.authMode,
        deviceName: state.deviceName,
        pinnedSessionKeys: state.pinnedSessionKeys,
        sidebarCollapsed: state.sidebarCollapsed,
        collapsedSessionGroups: state.collapsedSessionGroups,
        thinkingEnabled: state.thinkingEnabled,
        notificationsEnabled: state.notificationsEnabled
      })
    }
  )
)

// Per-session selectors — derive current-session values from the per-session maps.
const _emptyToolCalls: ToolCall[] = []
export const selectIsStreaming = (state: AppState) => !!state.streamingSessions[state.currentSessionId || '']
export const selectHadStreamChunks = (state: AppState) => !!state.sessionHadChunks[state.currentSessionId || '']
export const selectActiveToolCalls = (state: AppState) => state.sessionToolCalls[state.currentSessionId || ''] || _emptyToolCalls

// Vite HMR: disconnect stale WebSocket connections when modules are hot-replaced.
// Without this, old module versions keep processing events, causing duplicate streams.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    const { client } = useStore.getState()
    if (client) {
      client.disconnect()
    }
  })
}
