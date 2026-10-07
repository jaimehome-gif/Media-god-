/**
 * Capacitor / Android runtime detection for StreamVibe.
 *
 * The Android app is a thin WebView wrapper around the deployed web app, so
 * these helpers only ever produce a positive result inside the native shell.
 * On the regular web every check returns false / "web", leaving all existing
 * behaviour untouched.
 */

declare global {
  interface Window {
    // Injected by the Capacitor native runtime before page scripts run.
    Capacitor?: {
      getPlatform: () => 'android' | 'ios' | 'web'
      isNativePlatform: () => boolean
    }
  }
}

/** True only when running inside a Capacitor native app (Android/iOS). */
export function isCapacitor(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.Capacitor &&
    window.Capacitor.isNativePlatform()
  )
}

/** The Capacitor platform, or "web" outside the native shell. */
export function getCapacitorPlatform(): 'android' | 'ios' | 'web' {
  if (typeof window === 'undefined' || !window.Capacitor) return 'web'
  return window.Capacitor.getPlatform()
}

export function isAndroid(): boolean {
  return isCapacitor() && getCapacitorPlatform() === 'android'
}

/**
 * Fire TV / Android TV detection. The WebView user agent on Fire TV devices
 * contains "Android TV" and the Amazon model prefix "AFT". A `?tvMode=1`
 * query flag forces TV mode for testing on phones/desktops.
 */
export function isTvDevice(): boolean {
  if (typeof window === 'undefined') return false
  if (new URLSearchParams(window.location.search).get('tvMode') === '1') {
    return true
  }
  if (!isAndroid()) return false
  return /Android\sTV|AFT|Fire\s?TV|Leanback/i.test(navigator.userAgent)
}

export {}
