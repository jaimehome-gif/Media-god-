// The TV APK appends a Fire TV marker on every device, including generic boxes.
// Use the original WebView UA to identify the OS and exclude Amazon hardware.
export function supportsLegacyBoxWebPlayer(nativeTv, userAgent) {
  if (!nativeTv) return false;
  const original = String(userAgent || "").split(/ MediaGodFireTV\//i)[0];
  const android = original.match(/\bAndroid\s+(\d+)\b/i);
  return Boolean(android && Number(android[1]) <= 9 &&
    !/\bAFT[A-Z0-9]*\b|Amazon|Fire\s*TV/i.test(original));
}