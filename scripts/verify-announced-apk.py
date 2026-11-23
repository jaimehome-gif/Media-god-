"""Check the announced APK against Android's package metadata and the release key."""
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

channel, apk = sys.argv[1:]
platforms = {
    "android-mobile": ("android-mobile", "com.mediagod.mobile", "android-mobile-update.json", "MOBILE"),
    "fire-tv": ("firetv-android", "com.mediagod.firetv", "firetv-update.json", "FIRETV"),
}
directory, package, manifest_file, prefix = platforms[channel]
manifest = json.loads((Path("public") / manifest_file).read_text())
sdk = Path(os.environ["ANDROID_HOME"]) / "build-tools" / "35.0.0"
badging = subprocess.check_output([sdk / "aapt", "dump", "badging", apk], text=True)
package_line = next(line for line in badging.splitlines() if line.startswith("package: "))
fields = dict(re.findall(r"(\w+)='([^']*)'", package_line))
if (manifest["channel"], fields["name"], fields["versionCode"], fields["versionName"]) != (
    channel, package, str(manifest["versionCode"]), manifest["versionName"]
):
    sys.exit("APK package or version differs from the announcement")
certificate = subprocess.check_output([
    "keytool", "-exportcert", "-keystore",
    str(Path(directory) / "app" / os.environ[prefix + "_KEYSTORE_PATH"]),
    "-alias", os.environ[prefix + "_KEY_ALIAS"], "-storepass:env", prefix + "_KEYSTORE_PASSWORD",
])
signing = subprocess.check_output([sdk / "apksigner", "verify", "--print-certs", apk], text=True)
signers = re.findall(r"^Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F]{64})$", signing, re.M)
original_signer = "f0402010b19a69e8f46494788d506b669ab7d48bcbb43702ec5aa9a9399ab255"
if hashlib.sha256(certificate).hexdigest() != original_signer:
    sys.exit("Release keystore differs from the original distribution certificate")
if [digest.lower() for digest in signers] != [hashlib.sha256(certificate).hexdigest()]:
    sys.exit("APK certificate differs from the release signing identity")
print(f"Verified {package} {manifest['versionName']} ({manifest['versionCode']})")
