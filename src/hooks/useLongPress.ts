import { useRef, useCallback, useEffect } from 'react'
import { isNativeMobile, triggerHaptic } from '../lib/platform'

const LONG_PRESS_DURATION = 500 // ms
const MOVE_TOLERANCE = 10 // px

interface LongPressPoint {
  clientX: number
  clientY: number
}

export function useLongPress(
  onLongPress: (point: LongPressPoint) => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startPosRef.current = null
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isNativeMobile()) return

    const touch = e.touches[0]
    // Capture coordinates as plain numbers immediately — the Touch object
    // may be recycled by the browser before the timeout fires.
    const x = touch.clientX
    const y = touch.clientY
    startPosRef.current = { x, y }

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      triggerHaptic('medium')
      onLongPress({ clientX: x, clientY: y })
    }, LONG_PRESS_DURATION)
  }, [onLongPress])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPosRef.current || !timerRef.current) return

    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - startPosRef.current.x)
    const dy = Math.abs(touch.clientY - startPosRef.current.y)

    if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) {
      cancel()
    }
  }, [cancel])

  const onTouchEnd = useCallback(() => {
    cancel()
  }, [cancel])

  // Clear any pending timer on unmount to prevent firing on stale component
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
  }
}
