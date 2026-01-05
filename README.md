# Baseline Light Wallet

Light wallet that only hits public APIs on a Baseline node. Keys live locally; signing happens client-side with Bitcoin-style P2PKH and Baseline address prefixes.

## What it uses (and avoids)
- Uses: `getblockchaininfo`, `getaddressbalance`, `getaddressutxos`, `getaddresstxids`, `getrawtransaction`, `sendrawtransaction`, `estimatesmartfee`.
- Crypto: BIP39 mnemonic + BIP32 derivation (`m/44'/0'/0'/0/i` by default), P2PKH with Baseline `pubKeyHash=0x35`, WIF support for single-key imports, signing via `bitcoinjs-lib` + `tiny-secp256k1`.
- Storage: encrypted wallet blob in `localStorage` (AES-GCM with PBKDF2 200k iters). Passphrase only kept in-memory for the unlocked session.

## Running
```bash
cd baseline-light
npm install
npm run dev         # hot reload (web)
npm run build       # production bundle
npm run tauri:dev   # native shell (spawns Vite + Tauri)
npm run tauri:build # native binaries for your OS (requires Rust toolchain)

# Mobile (Android/iOS)
# Android prerequisites: JDK 17+, Android SDK/NDK + cmdline tools on PATH (`sdkmanager`), ANDROID_HOME/ANDROID_SDK_ROOT set.
# iOS prerequisites: Xcode toolchain + CocoaPods (run on macOS).
# Once toolchains are present:
#   npm run tauri:android:init  # scaffold android project (once)
#   npm run tauri:android:dev   # device/emulator dev
#   npm run tauri:android:build # release build
#   npm run tauri:ios:init      # scaffold iOS project (once, macOS)
#   npm run tauri:ios:dev       # simulator/dev
#   npm run tauri:ios:build     # release build
```

## Screens
- **Lock**: unlock with passphrase, or forget wallet from the device.
- **Create / Import**: new 12-word mnemonic, or import mnemonic/WIF; encryption required.
- **Home**: aggregate balance + addresses (derived locally), node height indicator.
- **Send**: fetch UTXOs via `getaddressutxos`, build/sign raw tx locally, broadcast with `sendrawtransaction`; fee uses `estimatesmartfee` unless overridden.
- **Settings**: RPC URL/creds, fee target, add deterministic receive addresses, lock/forget wallet.
