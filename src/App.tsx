import { useEffect } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { TopBar } from './components/TopBar'
import { RightPanel } from './components/RightPanel'
import { InputArea } from './components/InputArea'
import { SettingsModal } from './components/SettingsModal'
import { CertErrorModal } from './components/CertErrorModal'
import { SkillDetailView } from './components/SkillDetailView'
import { CronJobDetailView } from './components/CronJobDetailView'
import { CreateCronJobView } from './components/CreateCronJobView'
import { AgentDetailView } from './components/AgentDetailView'
import { CreateAgentView } from './components/CreateAgentView'
import { ClawHubSkillDetailView } from './components/ClawHubSkillDetailView'
import { HookDetailView } from './components/HookDetailView'
import { ServerSettingsView } from './components/ServerSettingsView'
import { UsageView } from './components/UsageView'
import { AgentDashboard } from './components/AgentDashboard'
import { MobileGestureLayer } from './components/MobileGestureLayer'
import {
  isNativeMobile,
  setStatusBarStyle,
  setupKeyboardListeners,
  setupAppListeners,
  setupBackButton,
  setupAppVisibilityTracking
} from './lib/platform'
import { SplashScreen } from '@capacitor/splash-screen'

function App() {
  const { theme, initializeApp, sidebarOpen, rightPanelOpen, mainView } = useStore()

  useEffect(() => {
    initializeApp()
  }, [initializeApp])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)

    // Update mobile status bar to match theme
    if (isNativeMobile()) {
      setStatusBarStyle(theme === 'dark')
    }
  }, [theme])

  // App visibility tracking (all platforms)
  useEffect(() => {
    const cleanup = setupAppVisibilityTracking()
    return cleanup
  }, [])

  // Mobile platform initialization
  useEffect(() => {
    if (!isNativeMobile()) return

    // Hide splash screen now that the app has rendered
    SplashScreen.hide()

    // Add mobile body class for CSS targeting
    document.body.classList.add('capacitor-mobile')

    // Keyboard handling — set a CSS variable with the keyboard height so the
    // layout can shrink to keep the input area visible above the keyboard.
    const cleanupKeyboard = setupKeyboardListeners(
      (height) => {
        document.body.classList.add('keyboard-visible')
        document.documentElement.style.setProperty('--keyboard-height', `${height}px`)
      },
      () => {
        document.body.classList.remove('keyboard-visible')
        document.documentElement.style.setProperty('--keyboard-height', '0px')
      }
    )

    // App lifecycle - reconnect on resume
    const cleanupApp = setupAppListeners(
      () => {
        const { connected, connect } = useStore.getState()
        if (!connected) {
          connect()
        }
      }
    )

    // Android back button
    const cleanupBack = setupBackButton(() => {
      const state = useStore.getState()
      if (state.mainView !== 'chat') {
        state.closeDetailView()
      } else if (state.sidebarOpen) {
        state.setSidebarOpen(false)
      } else if (state.rightPanelOpen) {
        state.setRightPanelOpen(false)
      }
    })

    return () => {
      cleanupKeyboard()
      cleanupApp()
      cleanupBack()
      document.body.classList.remove('capacitor-mobile')
    }
  }, [])

  const content = (
    <div className="app">
      <Sidebar />

      <main className="main-content">
        <TopBar />
        {mainView === 'chat' && (
          <>
            <ChatArea />
            <InputArea />
          </>
        )}
        {mainView === 'skill-detail' && <SkillDetailView />}
        {mainView === 'cron-detail' && <CronJobDetailView />}
        {mainView === 'create-cron' && <CreateCronJobView />}
        {mainView === 'agent-detail' && <AgentDetailView />}
        {mainView === 'create-agent' && <CreateAgentView />}
        {mainView === 'clawhub-skill-detail' && <ClawHubSkillDetailView />}
        {mainView === 'hook-detail' && <HookDetailView />}
        {mainView === 'server-settings' && <ServerSettingsView />}
        {mainView === 'usage' && <UsageView />}
        {mainView === 'pixel-dashboard' && <AgentDashboard />}
      </main>

      <RightPanel />

      {/* Overlay for mobile */}
      <div
        className={`overlay ${sidebarOpen || rightPanelOpen ? 'active' : ''}`}
        onClick={() => {
          useStore.getState().setSidebarOpen(false)
          useStore.getState().setRightPanelOpen(false)
        }}
      />

      {/* Settings Modal */}
      <SettingsModal />

      {/* Certificate Error Modal */}
      <CertErrorModal />
    </div>
  )

  return isNativeMobile() ? (
    <MobileGestureLayer>{content}</MobileGestureLayer>
  ) : content
}

export default App
