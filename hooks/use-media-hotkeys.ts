'use client'

import { useEffect } from 'react'

interface HotkeyHandlers {
  onPlayPause?: () => void;
  onChannelUp?: () => void;
  onChannelDown?: () => void;
  onFullscreen?: () => void;
}

export function useMediaHotkeys({ onPlayPause, onChannelUp, onChannelDown, onFullscreen }: HotkeyHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (['input', 'textarea'].includes((event.target as HTMLElement).tagName.toLowerCase())) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          onPlayPause?.();
          break;
        case 'ArrowUp':
          event.preventDefault();
          onChannelUp?.();
          break;
        case 'ArrowDown':
          event.preventDefault();
          onChannelDown?.();
          break;
        case 'KeyF':
          event.preventDefault();
          onFullscreen?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPlayPause, onChannelUp, onChannelDown, onFullscreen]);
}
