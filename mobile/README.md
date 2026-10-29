# The Library — iPhone and Android apps

The store apps are the web app in `../app`, wrapped by [Capacitor](https://capacitorjs.com/docs) 8.
There is one codebase: a change to `app/` reaches the website, the microSD card, the Pi and both apps.

| | |
|---|---|
| App ID | `org.villageservers.library` (permanent once published) |
| Name | The Library |
| Store owner | VillageServer (organisation accounts) |
| Plan and roadmap | [Mobile app path](https://claude.ai/artifact/8fU3PhDZLsKMHiRybNjoq4) |

## How it fits together

- `npm run web` copies `../app` into `www/` (git-ignored), leaving out `admin/`, `assets/og/`,
  `assets/library/` and `sw.js`, and points each page's `api/visibility` script at the live site.
- `core.js` notices it is inside the app (`ET.native`). Then pages link to each other as files,
  the way they do off a card; share links use `https://www.bibletransfer123.org`
  (`ET.publicOrigin`, `ET.publicHref`); `/api/...` calls go to the live site through Capacitor's
  native HTTP; Nearby uses the PeerJS broker; no service worker is installed.
  `tests/test_native.js` covers this.
- Saving inside the app: `save.js` offers "Keep it in this app", which streams the file to the
  app's own storage (`LIBRARY_NO_CLOUD/library/`) with the native FileTransfer plugin, and records
  it under `et.kept`. `ET.save.local(url)` turns a kept address into its on-phone copy, so
  `item.js` plays films and audio from the phone with no internet. `tests/test_keep_in_app.js`.
- `scripts/make_icons.py` redraws the launcher icons and splash screens from
  `app/assets/icon/icon-512.png`.

## Building

Needs Node 22+. Android needs JDK 21 and the Android SDK (platform 36); iPhone needs a Mac with Xcode 26.

```bash
cd mobile
npm install
npm run android:debug   # → android/app/build/outputs/apk/debug/app-debug.apk
npm run ios:open        # opens Xcode; pick a phone and press Run
```

Run `npm run sync` after any change to `app/`. A debug APK installs on any Android phone with
"Install unknown apps" allowed; a store build needs the signing key, which lives with VillageServer,
never in git.

The app leaves out the how-to and VillageServer videos (`assets/media/**.mp4`, 60 MB) and plays
them from the live site, so the download stays near 50 MB.

## Sending the Android app (Google Play)

The upload key is `the-library-upload.jks` (alias `upload`), made 2026-10-29 and kept by
VillageServer. Google Play re-signs the app with its own key (Play App Signing); the upload key
only proves an upload is ours, and Play support can replace it if it is lost.

- **On a computer:** put `keystore.properties` in `mobile/android/` (gitignored) with
  `storeFile=/path/to/the-library-upload.jks`, `storePassword=…`, `keyAlias=upload`, `keyPassword=…`,
  then `npm run android:release`. Out come `android/app/build/outputs/bundle/release/app-release.aab`
  (upload this to Play) and `…/apk/release/app-release.apk` (for cards and links).
- **In GitHub:** add the secrets `ANDROID_KEYSTORE_B64` (`base64 -w0 the-library-upload.jks`) and
  `ANDROID_KEYSTORE_PASSWORD`, then run **Actions → Android app for Google Play**. The two files
  are on the run's page.

Raise `versionCode` in `android/app/build.gradle` for every upload; Play refuses a number it has seen.

## Sending the iPhone app (TestFlight and the App Store)

No Mac needed: **Actions → iPhone app to TestFlight** builds on GitHub's Mac and uploads.
Once the Apple developer account is open:

1. In App Store Connect, **Apps → +**: bundle ID `org.villageservers.library`, SKU `the-library`.
2. **Users and Access → Integrations → App Store Connect API → +**, access **App Manager**.
   Download the `.p8` (only once) and note the Key ID and Issuer ID.
3. Add the repository secrets `APPLE_TEAM_ID` (Membership details), `ASC_KEY_ID`,
   `ASC_ISSUER_ID` and `ASC_KEY_P8` (the whole `.p8` file).
4. Run the workflow. The build number is the run number; the version is `MARKETING_VERSION`
   in `ios/App/App.xcodeproj` (1.0.0). Signing is automatic. The build shows in TestFlight in
   about 15 minutes.

With a Mac instead: `npm run ios:open`, pick the team under Signing & Capabilities, then
**Product → Archive → Distribute App**.

The app is iPhone only for now (`TARGETED_DEVICE_FAMILY = 1`), so the store asks for iPhone
screenshots only; iPads still run it. `App/PrivacyInfo.xcprivacy` is the privacy manifest Apple
reads at upload, and `ITSAppUsesNonExemptEncryption` is false (HTTPS only), so no export
paperwork.

If Gradle gets `429 Too Many Requests` from Maven Central, point it at Google's mirror with an
init script in `~/.gradle/init.d/` (`https://maven-central.storage-download.googleapis.com/maven2/`).

## Reading QR codes and sharing with no internet

- **Scan** (header, and Nearby → Receive): `app/assets/js/features/scan.js` reads codes with the camera inside the app and opens our links among the app's files (`www/routes.json` holds the website's short links).
- **Share with no internet** (Android, Nearby): `HotspotPlugin.java` opens the phone's own Wi-Fi (LocalOnlyHotspot) and `HotspotServer.java` serves only the chosen kept files on port 8080. The page shows two QR codes: join the Wi-Fi, then open the list. The other phone needs no app or internet. iPhone apps cannot open a network like this, so in a mixed pair the Android phone shares.
- **Receive with no internet** (both apps, Send tab): scan the sharing phone's first code; the Android app joins its Wi-Fi by itself (`HotspotPlugin.join`, Android 10+), an iPhone joins in Settings and scans the second code. The app reads `/list.json` and saves the films into its own storage under their original addresses, so they play offline and show under "Saved on this phone". Plain HTTP to the other phone is allowed by `res/xml/network_security_config.xml` (Android) and `NSAllowsLocalNetworking` (iOS).

## Not done yet (Phase 1 and 2)

- Downloads that continue with the screen locked (kept files are listed under "Saved on this phone" on Home, with Delete)
- iPhone as the sharing phone (Multipeer Connectivity, or serving files on the receiver's network), and joining the Wi-Fi from the iPhone app (needs the Hotspot Configuration entitlement)
