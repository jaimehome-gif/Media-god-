'use client'

import { useEffect } from 'react'
import { isCapacitor, isTvDevice } from '@/lib/capacitor'

/**
 * TV remote / D-pad navigation for the Fire TV & Fire Stick builds.
 *
 * Inside the Android WebView, remote button presses arrive as keyboard events:
 *   D-pad up/down/left/right → ArrowUp/Down/Left/Right
 *   Select / OK              → Enter
 *   Back (remote)            → Capacitor "backButton" event (and Escape on some remotes)
 *
 * This hook implements:
 *  - Spatial (directional) focus navigation between focusable elements.
 *  - Select/OK activation of the focused element.
 *  - Back handling: exit fullscreen → close open dialog → history back → exit app.
 *  - Full-screen playback: when a <video> starts playing on TV, fullscreen its
 *    container; Back exits fullscreen first.
 *  - TV-safe orientation: lock to landscape on TV devices.
 *  - A visible focus ring (TVs have no hover) via a `tv-mode` class on <html>.
 *
 * It only activates on TV devices, so web + phone behaviour is unchanged.
 */
export function useTvNavigation() {
  useEffect(() => {
    if (!isTvDevice()) return

    const html = document.documentElement
    html.classList.add('tv-mode')

    // --- Focus ring styling (TVs have no hover state) ----------------------
    const style = document.createElement('style')
    style.id = 'streamvibe-tv-focus'
    style.textContent = `
      .tv-mode *:focus-visible {
        outline: 3px solid #8b5cf6 !important;
        outline-offset: 2px !important;
        border-radius: 6px;
      }
      .tv-mode *:focus {
        outline: 3px solid #8b5cf6 !important;
        outline-offset: 2px !important;
      }
      .tv-mode .group-hover\\:opacity-100 { opacity: 1 !important; }
    `
    document.head.appendChild(style)

    // --- Orientation lock (TV-safe: landscape) -----------------------------
    let orientationLock: (() => void) | null = null
    try {
      const so = screen.orientation
      const lockPromise = so?.lock?.('landscape')
      if (lockPromise && typeof lockPromise.then === 'function') {
        lockPromise.catch(() => {})
      }
    } catch {
      /* orientation lock not supported — manifest handles it instead */
    }

    // --- Focusable element helpers ----------------------------------------
    const FOCUSABLE =
      'a[href], button:not([disabled]), [role="button"], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-tv-focusable]'

    function getVisibleFocusables(): HTMLElement[] {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>(FOCUSABLE)
      )
      return els.filter((el) => {
        if (el.offsetParent === null && el.getClientRects().length === 0) {
          return false
        }
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
    }

    function rectCenter(r: DOMRect) {
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }

    let lastFocused: HTMLElement | null = null

    function currentFocus(): HTMLElement | null {
      const active = document.activeElement as HTMLElement | null
      if (active && active !== document.body && active.tabIndex !== -1) {
        return active
      }
      return lastFocused
    }

    function focusElement(el: HTMLElement) {
      el.focus({ preventScroll: false })
      lastFocused = el
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    /** Find the nearest focusable element in the given cardinal direction. */
    function findNext(dir: 'up' | 'down' | 'left' | 'right'): HTMLElement | null {
      const cur = currentFocus()
      const candidates = getVisibleFocusables()
      if (candidates.length === 0) return null
      if (!cur) return candidates[0]

      const cr = cur.getBoundingClientRect()
      const cc = rectCenter(cr)
      let best: HTMLElement | null = null
      let bestScore = Infinity

      for (const el of candidates) {
        if (el === cur) continue
        const r = el.getBoundingClientRect()
        const c = rectCenter(r)
        const dx = c.x - cc.x
        const dy = c.y - cc.y

        let score: number
        if (dir === 'right') {
          if (dx <= 1) continue
          score = dx * dx + dy * dy * 4
        } else if (dir === 'left') {
          if (dx >= -1) continue
          score = dx * dx + dy * dy * 4
        } else if (dir === 'down') {
          if (dy <= 1) continue
          score = dy * dy + dx * dx * 4
        } else {
          // up
          if (dy >= -1) continue
          score = dy * dy + dx * dx * 4
        }
        if (score < bestScore) {
          bestScore = score
          best = el
        }
      }
      return best
    }

    function moveFocus(dir: 'up' | 'down' | 'left' | 'right') {
      const next = findNext(dir)
      if (next) {
        focusElement(next)
      }
    }

    // --- Select / OK activation -------------------------------------------
    function activate(el: HTMLElement) {
      const tag = el.tagName
      // Native controls already activate on Enter — don't double-fire.
      if (
        tag === 'BUTTON' ||
        tag === 'A' ||
        tag === 'INPUT' ||
        tag === 'SELECT' ||
        tag === 'TEXTAREA'
      ) {
        return
      }
      el.click()
    }

    // --- Back handling -----------------------------------------------------
    function closeTopDialog(): boolean {
      const dialog = document.querySelector<HTMLElement>(
        '[role="dialog"][data-state="open"]'
      )
      if (dialog) {
        // Radix dialogs close on Escape.
        dialog.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        )
        return true
      }
      // Command menu (cmdk) search dialog.
      const cmdk = document.querySelector<HTMLElement>(
        '[cmdk-root][data-state="open"], [role="dialog"]'
      )
      if (cmdk) {
        cmdk.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        )
        return true
      }
      return false
    }

    function handleBack() {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
        return
      }
      if (closeTopDialog()) return
      if (window.history.length > 1) {
        window.history.back()
      } else {
        void import('@capacitor/app').then(({ App }) => App.exitApp())
      }
    }

    // --- Full-screen playback ---------------------------------------------
    // On TV, when a <video> starts playing, fullscreen its container so the
    // stream fills the screen. Back exits fullscreen first (see handleBack).
    function fullscreenContainer(video: HTMLVideoElement) {
      const container =
        video.closest<HTMLElement>('[data-tv-fullscreen]') ||
        video.closest<HTMLElement>('.aspect-video') ||
        video.parentElement
      if (container && !document.fullscreenElement) {
        container.requestFullscreen?.().catch(() => {})
      }
    }

    function attachVideoListeners() {
      document.querySelectorAll<HTMLVideoElement>('video').forEach((v) => {
        if (v.dataset.tvWatched) return
        v.dataset.tvWatched = '1'
        if (!v.paused) fullscreenContainer(v)
        v.addEventListener('play', () => fullscreenContainer(v), {
          passive: true,
        })
      })
    }

    // --- Key handling ------------------------------------------------------
    function onKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          moveFocus('up')
          break
        case 'ArrowDown':
          e.preventDefault()
          moveFocus('down')
          break
        case 'ArrowLeft':
          e.preventDefault()
          moveFocus('left')
          break
        case 'ArrowRight':
          e.preventDefault()
          moveFocus('right')
          break
        case 'Enter':
          if (document.activeElement && document.activeElement !== document.body) {
            activate(document.activeElement as HTMLElement)
          } else {
            const first = getVisibleFocusables()[0]
            if (first) focusElement(first)
          }
          break
        case 'Escape':
        case 'Back':
          e.preventDefault()
          handleBack()
          break
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    // --- Capacitor hardware Back button ------------------------------------
    let removeBackListener: (() => void) | null = null
    if (isCapacitor()) {
      import('@capacitor/app')
        .then(({ App }) =>
          App.addListener('backButton', () => handleBack())
        )
        .then((h) => {
          removeBackListener = () => h.remove()
        })
        .catch(() => {})
    }

    // --- Initial focus + DOM observation ----------------------------------
    const mo = new MutationObserver(() => {
      attachVideoListeners()
      if (
        !document.activeElement ||
        document.activeElement === document.body
      ) {
        const first = getVisibleFocusables()[0]
        if (first) focusElement(first)
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
    attachVideoListeners()
    const first = getVisibleFocusables()[0]
    if (first) focusElement(first)

    // --- Cleanup -----------------------------------------------------------
    return () => {
      html.classList.remove('tv-mode')
      style.remove()
      document.removeEventListener('keydown', onKeyDown, true)
      mo.disconnect()
      removeBackListener?.()
      try {
        screen.orientation?.unlock?.()
      } catch {
        /* ignore */
      }
      void orientationLock
    }
  }, [])
}
