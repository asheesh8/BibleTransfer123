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

If Gradle gets `429 Too Many Requests` from Maven Central, point it at Google's mirror with an
init script in `~/.gradle/init.d/` (`https://maven-central.storage-download.googleapis.com/maven2/`).

## Reading QR codes and sharing with no internet

- **Scan** (header, and Nearby → Receive): `app/assets/js/features/scan.js` reads codes with the camera inside the app and opens our links among the app's files (`www/routes.json` holds the website's short links).
- **Share with no internet** (Android, Nearby): `HotspotPlugin.java` opens the phone's own Wi-Fi (LocalOnlyHotspot) and `HotspotServer.java` serves only the chosen kept files on port 8080. The page shows two QR codes: join the Wi-Fi, then open the list. The other phone needs no app or internet. iPhone apps cannot open a network like this, so in a mixed pair the Android phone shares.

## Not done yet (Phase 1 and 2)

- Downloads that continue with the screen locked (kept files are listed under "Saved on this phone" on Home, with Delete)
- Receiving into the app over the hotspot (today the other phone saves into its browser's downloads), and joining the Wi-Fi from the in-app scanner
- Native share sheet (Android WebView has no `navigator.share`)
- Store listings, signing, TestFlight and Play internal testing
