"""The iPhone and Android apps (mobile/) as the stores will receive them."""
import json
import plistlib
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT / "mobile"


class MobileRelease(unittest.TestCase):
    def test_one_version_everywhere(self):
        version = json.loads((MOBILE / "package.json").read_text())["version"]
        gradle = (MOBILE / "android/app/build.gradle").read_text()
        self.assertIn('versionName "%s"' % version, gradle)
        pbx = (MOBILE / "ios/App/App.xcodeproj/project.pbxproj").read_text()
        self.assertEqual(set(re.findall(r"MARKETING_VERSION = ([^;]+);", pbx)), {version})
        config = json.loads((ROOT / "registry/app-config.json").read_text())
        for platform in ("ios", "android"):
            latest = tuple(int(n) for n in config["platforms"][platform]["latest"].split("."))
            self.assertGreaterEqual(latest, tuple(int(n) for n in version.split(".")),
                                    "raise registry/app-config.json latest to the app's version")

    def test_signing_secrets_stay_out_of_git(self):
        ignore = (MOBILE / "android/.gitignore").read_text().split()
        for pattern in ("keystore.properties", "*.jks", "*.keystore"):
            self.assertIn(pattern, ignore)
        self.assertEqual([p for p in MOBILE.rglob("*.jks") if "node_modules" not in p.parts], [])

    def test_iphone_settings_apple_checks_at_upload(self):
        info = plistlib.loads((MOBILE / "ios/App/App/Info.plist").read_bytes())
        self.assertIs(info["ITSAppUsesNonExemptEncryption"], False)
        self.assertEqual(info["UIRequiredDeviceCapabilities"], ["arm64"])
        for key in ("NSCameraUsageDescription", "NSLocalNetworkUsageDescription"):
            self.assertTrue(info[key].strip())
        privacy = plistlib.loads((MOBILE / "ios/App/App/PrivacyInfo.xcprivacy").read_bytes())
        self.assertIs(privacy["NSPrivacyTracking"], False)
        for item in privacy["NSPrivacyCollectedDataTypes"]:
            self.assertIs(item["NSPrivacyCollectedDataTypeTracking"], False)
        pbx = (MOBILE / "ios/App/App.xcodeproj/project.pbxproj").read_text()
        self.assertIn("PrivacyInfo.xcprivacy in Resources */,", pbx)
        self.assertTrue((MOBILE / "ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme").exists())

    def test_no_build_script(self):
        # Vercel runs a root "build" script on every deploy; it broke deploys once.
        self.assertNotIn("build", json.loads((ROOT / "package.json").read_text()).get("scripts", {}))


if __name__ == "__main__":
    unittest.main()
