'use client'

import { useTvNavigation } from '@/hooks/use-tv-navigation'

/**
 * Activates D-pad / remote TV navigation when the app is running on a TV
 * device (Fire TV / Fire Stick). On web and phone builds this is a no-op, so
 * existing functionality is completely unchanged.
 */
export function TvNavigationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useTvNavigation()
  return <>{children}</>
}
