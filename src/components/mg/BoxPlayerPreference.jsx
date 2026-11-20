import React, { useState } from "react";
import { prefersNativeBoxPlayer, saveNativeBoxPreference } from "./boxPlayerPreference.js";

export default function BoxPlayerPreference() {
  const [enabled, setEnabled] = useState(prefersNativeBoxPlayer);
  const [error, setError] = useState(false);
  return <button type="button" aria-pressed={enabled}
    className="min-h-10 shrink-0 rounded-lg border border-white/30 px-3 text-xs text-white focus:ring-2 focus:ring-mg-green"
    onClick={() => {
      const saved = saveNativeBoxPreference(!enabled);
      if (saved) setEnabled(!enabled);
      setError(!saved);
    }}>
    {error ? "Device preference could not be saved" : enabled ? "Native player on this device: on" : "Use native player on this device"}
  </button>;
}
