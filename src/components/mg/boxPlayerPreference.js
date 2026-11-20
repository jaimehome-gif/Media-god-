const key = "mg:prefer-native-vod:v1";

export function prefersNativeBoxPlayer() {
  try { return window.localStorage.getItem(key) === "1"; } catch { return false; }
}

export function saveNativeBoxPreference(enabled) {
  try {
    if (enabled) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
    return true;
  } catch { return false; }
}
