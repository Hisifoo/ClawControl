import { useRef, useCallback, type ReactNode } from 'react'
import { useStore } from '../store'
import { useSwipeGesture, type SwipeDirection } from '../hooks/useSwipeGesture'

interface Props {
  children: ReactNode
}

/**
 * Orchestrates swipe gestures on mobile. Wraps the app content and translates
 * edge swipes into sidebar/right-panel open/close or detail-view navigation.
 *
 * Swipe logic:
 * | Direction     | State                          | Action              |
 * |---------------|--------------------------------|---------------------|
 * | Left-to-right | rightPanelOpen                 | Close right panel   |
 * | Left-to-right | mainView !== 'chat'            | Close detail view   |
 * | Left-to-right | chat & sidebar closed          | Open sidebar        |
 * | Right-to-left | sidebarOpen                    | Close sidebar       |
 * | Right-to-left | sidebar closed                 | Open right panel    |
 */
export function MobileGestureLayer({ children }: Props) {
  const sidebarRef = useRef<HTMLElement | null>(null)
  const rightPanelRef = useRef<HTMLElement | null>(null)
  const overlayRef = useRef<HTMLElement | null>(null)

  // Track current gesture state
  const gestureAction = useRef<string | null>(null)
  const gestureStartTime = useRef(0)

  // requestAnimationFrame bookkeeping to avoid stale writes after swipe end/cancel
  const rafIdRef = useRef<number | null>(null)
  const gestureSessionRef = useRef(0)
  const gestureActiveRef = useRef(false)

  const acquireRefs = useCallback(() => {
    if (!sidebarRef.current) {
      sidebarRef.current = document.querySelector('.sidebar')
    }
    if (!rightPanelRef.current) {
      rightPanelRef.current = document.querySelector('.right-panel')
    }
    if (!overlayRef.current) {
      overlayRef.current = document.querySelector('.overlay')
    }
  }, [])

  const addSwipingClass = useCallback((el: HTMLElement | null) => {
    el?.classList.add('swiping')
  }, [])

  const removeSwipingClass = useCallback((el: HTMLElement | null) => {
    el?.classList.remove('swiping')
  }, [])

  const clearInlineStyles = useCallback((el: HTMLElement | null) => {
    if (!el) return
    el.style.transform = ''
    el.style.opacity = ''
    el.style.visibility = ''
    el.style.pointerEvents = ''
  }, [])

  const cancelPendingRaf = useCallback(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [])

  const cleanupSwipeVisuals = useCallback(() => {
    const sidebar = sidebarRef.current
    const rightPanel = rightPanelRef.current
    const overlay = overlayRef.current

    // Stop future/stale RAF callbacks from mutating styles
    gestureActiveRef.current = false
    gestureSessionRef.current += 1
    cancelPendingRaf()

    // Remove swiping class (re-enable CSS transitions)
    removeSwipingClass(sidebar)
    removeSwipingClass(rightPanel)
    removeSwipingClass(overlay)

    // Clear inline styles — let CSS classes/state own the final position
    clearInlineStyles(sidebar)
    clearInlineStyles(rightPanel)
    clearInlineStyles(overlay)
  }, [cancelPendingRaf, clearInlineStyles, removeSwipingClass])

  const resolveAction = useCallback((direction: SwipeDirection): string | null => {
    const state = useStore.getState()

    if (direction === 'right') {
      // Left-to-right swipe
      if (state.rightPanelOpen) return 'close-right-panel'
      if (state.mainView !== 'chat') return 'navigate-back'
      if (!state.sidebarOpen) return 'open-sidebar'
    } else {
      // Right-to-left swipe
      if (state.sidebarOpen) return 'close-sidebar'
      if (!state.rightPanelOpen) return 'open-right-panel'
    }
    return null
  }, [])

  const onSwipeStart = useCallback((direction: SwipeDirection) => {
    acquireRefs()

    // New gesture session; invalidate any pending RAF from the previous gesture.
    gestureActiveRef.current = true
    gestureSessionRef.current += 1
    cancelPendingRaf()

    const action = resolveAction(direction)
    gestureAction.current = action
    gestureStartTime.current = Date.now()

    if (!action) return

    // Add swiping class to suppress CSS transitions during drag
    if (action === 'open-sidebar' || action === 'close-sidebar') {
      addSwipingClass(sidebarRef.current)
      addSwipingClass(overlayRef.current)
    } else if (action === 'open-right-panel' || action === 'close-right-panel') {
      addSwipingClass(rightPanelRef.current)
      addSwipingClass(overlayRef.current)
    }
  }, [acquireRefs, resolveAction, addSwipingClass, cancelPendingRaf])

  const onSwipeMove = useCallback((_direction: SwipeDirection, progress: number) => {
    const action = gestureAction.current
    if (!action) return

    const clampedProgress = Math.max(0, Math.min(1, progress))

    // Only keep the latest move frame.
    cancelPendingRaf()

    const sessionAtSchedule = gestureSessionRef.current

    rafIdRef.current = requestAnimationFrame(() => {
      // Ignore stale RAF callbacks after end/cancel/new gesture.
      if (!gestureActiveRef.current) return
      if (sessionAtSchedule !== gestureSessionRef.current) return

      const sidebar = sidebarRef.current
      const rightPanel = rightPanelRef.current
      const overlay = overlayRef.current
      const sidebarWidth = sidebar?.offsetWidth || 280

      switch (action) {
        case 'open-sidebar': {
          // Sidebar starts at translateX(-100%), move toward translateX(0)
          const offset = -sidebarWidth + (sidebarWidth * clampedProgress)
          if (sidebar) sidebar.style.transform = `translateX(${offset}px)`
          if (overlay) {
            overlay.style.opacity = `${clampedProgress * 0.5}`
            overlay.style.visibility = 'visible'
            overlay.style.pointerEvents = 'auto'
          }
          break
        }
        case 'close-sidebar': {
          // Sidebar starts at translateX(0), move toward translateX(-100%)
          const offset = -(sidebarWidth * clampedProgress)
          if (sidebar) sidebar.style.transform = `translateX(${offset}px)`
          if (overlay) {
            overlay.style.opacity = `${(1 - clampedProgress) * 0.5}`
          }
          break
        }
        case 'open-right-panel': {
          const panelWidth = rightPanel?.offsetWidth || 320
          // Right panel starts at translateX(100%), move toward translateX(0)
          const offset = panelWidth - (panelWidth * clampedProgress)
          if (rightPanel) rightPanel.style.transform = `translateX(${offset}px)`
          if (overlay) {
            overlay.style.opacity = `${clampedProgress * 0.5}`
            overlay.style.visibility = 'visible'
            overlay.style.pointerEvents = 'auto'
          }
          break
        }
        case 'close-right-panel': {
          const panelWidth = rightPanel?.offsetWidth || 320
          // Right panel starts at translateX(0), move toward translateX(100%)
          const offset = panelWidth * clampedProgress
          if (rightPanel) rightPanel.style.transform = `translateX(${offset}px)`
          if (overlay) {
            overlay.style.opacity = `${(1 - clampedProgress) * 0.5}`
          }
          break
        }
        // 'navigate-back' has no visual follow-through
      }
    })
  }, [cancelPendingRaf])

  const onSwipeEnd = useCallback((_direction: SwipeDirection, completed: boolean) => {
    const action = gestureAction.current

    // Always cleanup visual state, even if we never resolved an action.
    // (This ensures touchcancel/interruption doesn't leave panels half-open.)
    if (!action) {
      cleanupSwipeVisuals()
      return
    }

    const sidebar = sidebarRef.current
    const rightPanel = rightPanelRef.current
    const overlay = overlayRef.current

    if (!completed) {
      // Gesture was cancelled/interrupted: revert to class/state-driven layout.
      cleanupSwipeVisuals()
      gestureAction.current = null
      return
    }

    // Apply the target CSS class via DOM BEFORE clearing inline styles.
    // This prevents the panel from snapping back to its default off-screen
    // position during the gap between clearing styles and React re-rendering.
    switch (action) {
      case 'open-sidebar':
        sidebar?.classList.add('visible')
        overlay?.classList.add('active')
        break
      case 'close-sidebar':
        sidebar?.classList.remove('visible')
        overlay?.classList.remove('active')
        break
      case 'open-right-panel':
        rightPanel?.classList.remove('hidden')
        rightPanel?.classList.add('visible')
        overlay?.classList.add('active')
        break
      case 'close-right-panel':
        rightPanel?.classList.remove('visible')
        rightPanel?.classList.add('hidden')
        overlay?.classList.remove('active')
        break
    }

    cleanupSwipeVisuals()

    // Update React state to match the DOM classes we just set
    const store = useStore.getState()
    switch (action) {
      case 'open-sidebar':
        store.setSidebarOpen(true)
        break
      case 'close-sidebar':
        store.setSidebarOpen(false)
        break
      case 'open-right-panel':
        store.setRightPanelOpen(true)
        break
      case 'close-right-panel':
        store.setRightPanelOpen(false)
        break
      case 'navigate-back':
        store.closeDetailView()
        break
    }

    gestureAction.current = null
  }, [cleanupSwipeVisuals])

  useSwipeGesture({
    onSwipeStart,
    onSwipeMove,
    onSwipeEnd,
  })

  return <>{children}</>
}
