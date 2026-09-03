# Orbit macOS release runbook

Orbit produces separate Apple Silicon and Intel artifacts. A local package is useful for QA, but only the tagged GitHub workflow may describe an artifact as signed and notarized.

## Local QA package

```bash
npm ci
npm run desktop:package:mac
npm run desktop:verify:mac
npm run desktop:smoke:mac
```

This builds the current machine architecture under `out/macos/<version>/<arch>/`:

- `Orbit.app`
- `Orbit-<version>-macos-<arch>.zip`
- `Orbit-<version>-macos-<arch>.dmg`
- `Orbit-<version>-macos-<arch>-manifest.json`

The manifest records `signed: false` and `notarized: false`. The app uses an ad-hoc signature only so its ASAR-integrity and fuse-hardened binary can be exercised locally.

Every `main` push repeats this package, verification, and packaged-runtime smoke test on a clean macOS runner. The smoke process uses a temporary loopback-only port and a disposable encryption key, verifies the real packaged homepage while the manifest verifies the release version, then stops the complete Electron process group.

## GitHub release authority

Configure these repository secrets before running `.github/workflows/macos-release.yml`:

- `MACOS_CERTIFICATE`: base64-encoded Developer ID Application `.p12`
- `MACOS_CERTIFICATE_PASSWORD`: password for that `.p12`
- `MACOS_KEYCHAIN_PASSWORD`: one-time CI keychain password
- `ORBIT_MAC_SIGN_IDENTITY`: full Developer ID Application identity
- `APPLE_ID`: Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password, never the account password
- `APPLE_TEAM_ID`: Apple Developer Team ID

The workflow imports the certificate into a temporary keychain, runs all code and dependency gates, builds both `arm64` and `x64`, signs with hardened runtime, notarizes and staples the app and DMG, verifies hashes/fuses/architecture/Gatekeeper/tickets, uploads a short-lived Actions artifact, and deletes the temporary keychain even on failure.

## Tagged release

1. Finish and verify the release commit on `main`.
2. Confirm `package.json` and `ORBIT_PRODUCT_VERSION` agree.
3. Create and push the exact tag `v<package version>`.
4. Wait for **macOS release** to pass.
5. Download one DMG on a second Mac, verify Gatekeeper identifies the expected Developer ID, install by dragging Orbit to Applications, and run a real import/model/export smoke test.

The package script rejects a mismatched tag and rejects release mode when signing or notarization credentials are incomplete. GitHub Release publication occurs only after both architectures pass. Automatic updates remain intentionally disabled until Orbit has an approved public update URL, signature-retention policy, rollback policy, and release owner; a private repository release is not a public update channel.
