import { useState } from 'react'
import { useStore } from '../store'

export function HookDetailView() {
  const { selectedHook, closeDetailView, toggleHookEnabled, client, fetchHooks } = useStore()
  const [editingEnv, setEditingEnv] = useState(false)
  const [envText, setEnvText] = useState('')
  const [savingEnv, setSavingEnv] = useState(false)

  if (!selectedHook) return null

  const handleToggle = async () => {
    await toggleHookEnabled(selectedHook.id, !selectedHook.enabled)
  }

  const handleStartEditEnv = () => {
    const entries = Object.entries(selectedHook.env || {})
    setEnvText(entries.map(([k, v]) => `${k}=${v}`).join('\n'))
    setEditingEnv(true)
  }

  const handleSaveEnv = async () => {
    if (!client) return
    setSavingEnv(true)
    try {
      const env: Record<string, string> = {}
      for (const line of envText.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
        }
      }
      await client.updateHookEnv(selectedHook.id, env)
      // Wait for reconnect after config.patch
      await new Promise<void>((resolve) => {
        let resolved = false
        const onConnected = () => { if (!resolved) { resolved = true; client.off('connected', onConnected); resolve() } }
        client.on('connected', onConnected)
        setTimeout(onConnected, 5000)
      })
      await fetchHooks()
      setEditingEnv(false)
    } catch {
      // save failed
    } finally {
      setSavingEnv(false)
    }
  }

  const envEntries = Object.entries(selectedHook.env || {})

  return (
    <div className="detail-view">
      <div className="detail-header">
        <button className="detail-back" onClick={closeDetailView} aria-label="Back to chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
        <div className="detail-title-section">
          <div className="detail-icon hook-icon">
            {selectedHook.emoji ? (
              <span className="hook-emoji">{selectedHook.emoji}</span>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
          </div>
          <div>
            <h1 className="detail-title">{selectedHook.name}</h1>
            {selectedHook.description && (
              <p className="detail-subtitle">{selectedHook.description}</p>
            )}
          </div>
        </div>
        <div className="detail-actions">
          <div className={`status-badge ${selectedHook.enabled ? 'enabled' : 'disabled'}`}>
            {selectedHook.enabled ? 'Enabled' : 'Disabled'}
          </div>
          <button
            className={`toggle-button ${selectedHook.enabled ? 'active' : ''}`}
            onClick={handleToggle}
            aria-label={selectedHook.enabled ? 'Disable hook' : 'Enable hook'}
          >
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
          </button>
        </div>
      </div>

      <div className="detail-content">
        {/* Status Section */}
        <section className="detail-section">
          <h2>Status</h2>
          <div className="status-grid">
            {selectedHook.eligible !== undefined && (
              <div className="status-item">
                <span className="status-label">Eligible</span>
                <span className={`status-value ${selectedHook.eligible ? 'success' : 'warning'}`}>
                  {selectedHook.eligible ? 'Yes' : 'No'}
                </span>
              </div>
            )}
            {selectedHook.source && (
              <div className="status-item">
                <span className="status-label">Source</span>
                <span className="status-value">{selectedHook.source}</span>
              </div>
            )}
            {selectedHook.always !== undefined && (
              <div className="status-item">
                <span className="status-label">Always Active</span>
                <span className="status-value">{selectedHook.always ? 'Yes' : 'No'}</span>
              </div>
            )}
          </div>
        </section>

        {/* Events Section */}
        {selectedHook.events && selectedHook.events.length > 0 && (
          <section className="detail-section">
            <h2>Events</h2>
            <div className="triggers-list">
              {selectedHook.events.map((event, index) => (
                <span key={event || index} className="trigger-badge large">
                  {event}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Requirements Section */}
        {selectedHook.requirements && (
          <section className="detail-section">
            <h2>Requirements</h2>
            <div className="requirements-list">
              {selectedHook.requirements.bins.length > 0 && (
                <div className="requirement-group">
                  <h3>Required Binaries</h3>
                  <div className="requirement-items">
                    {selectedHook.requirements.bins.map((bin) => {
                      const isMissing = selectedHook.missing?.bins.includes(bin)
                      return (
                        <span key={bin} className={`requirement-badge ${isMissing ? 'missing' : 'satisfied'}`}>
                          {isMissing ? '\u2717' : '\u2713'} {bin}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {selectedHook.requirements.env.length > 0 && (
                <div className="requirement-group">
                  <h3>Environment Variables</h3>
                  <div className="requirement-items">
                    {selectedHook.requirements.env.map((envVar) => {
                      const isMissing = selectedHook.missing?.env.includes(envVar)
                      return (
                        <span key={envVar} className={`requirement-badge ${isMissing ? 'missing' : 'satisfied'}`}>
                          {isMissing ? '\u2717' : '\u2713'} {envVar}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Environment Variables Section */}
        <section className="detail-section">
          <div className="cron-content-header">
            <h2>Environment Variables</h2>
            {!editingEnv && (
              <button className="cron-edit-btn" onClick={handleStartEditEnv}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
          {editingEnv ? (
            <div className="cron-edit-panel">
              <textarea
                className="cron-content-editor"
                value={envText}
                onChange={(e) => setEnvText(e.target.value)}
                placeholder="KEY=value (one per line)"
                rows={6}
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
              <div className="cron-section-actions">
                <button className="settings-button" onClick={() => setEditingEnv(false)} disabled={savingEnv}>
                  Cancel
                </button>
                <button className="settings-button primary" onClick={handleSaveEnv} disabled={savingEnv}>
                  {savingEnv ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : envEntries.length > 0 ? (
            <div className="cron-config-display">
              {envEntries.map(([key, value]) => (
                <div key={key} className="cron-config-row">
                  <span className="cron-config-label">{key}</span>
                  <span className="cron-config-value" style={{ fontFamily: 'monospace' }}>{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', opacity: 0.5 }}>No environment variables configured</p>
          )}
        </section>

        {/* File Path */}
        {selectedHook.filePath && (
          <section className="detail-section muted">
            <h2>Hook Location</h2>
            <code className="file-path">{selectedHook.filePath}</code>
          </section>
        )}
      </div>
    </div>
  )
}
