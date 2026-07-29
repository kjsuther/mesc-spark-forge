## Goal

On phones, the browser URL bar and tab strip keep showing above/below the game. Browsers only let a page hide that chrome in two ways: native fullscreen (works on Android Chrome, **not** on iOS Safari, which has no Fullscreen API for regular elements) or by the user installing the site to the home screen so it launches in standalone mode with no browser UI at all.

The project currently has no web app manifest (`public/` only has `favicon.ico` and `robots.txt`), so the "install / Add to Home Screen" path isn't available yet. That's the fix.

## Plan

1. **Add a web app manifest**
   - New `public/manifest.webmanifest`: app name "Blazing the Trail to Coverage", `display: "fullscreen"` (fallback `standalone`), `orientation: "landscape"`, dark background/theme colors matching the game palette, and icons (192/512 PNG, generated from the existing retro art style).
   - Link it from the root route head, plus iOS-specific tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, `apple-touch-icon`.
   - Result: once added to the home screen, the game opens with **no URL bar and no tabs** on both iOS and Android.

2. **Add an "Install for full screen" prompt on mobile**
   - Small dismissible banner on the Play Game page (and optionally the game title screen), shown only on touch devices that are not already running standalone.
   - Android/Chrome: capture `beforeinstallprompt` and show a one-tap "Install" button.
   - iOS Safari: show short instructions instead ("Tap Share → Add to Home Screen") since iOS has no install API.
   - Hidden once `display-mode: standalone/fullscreen` is detected or the user dismisses it.

3. **Keep and clarify the existing fullscreen behavior**
   - Leave the current first-tap native fullscreen + in-page fullscreen overlay as-is for users who don't install.
   - Reword the title-screen fullscreen control so it's clear it's the best-effort option, with install being the true no-chrome experience.

4. **Verify**
   - Emulated mobile landscape check that the manifest loads, the prompt appears only when not installed, and standalone mode reports no chrome offset.
   - Confirm desktop is unaffected (prompt never renders on non-touch pointers).

## Technical notes

- iOS Safari deliberately blocks `requestFullscreen` on non-video elements; no JS workaround exists. Home-screen install is the only supported way to remove Safari's chrome.
- `display: "fullscreen"` degrades gracefully to `standalone` on iOS.
- The manifest also lets the existing `visualViewport` sizing logic get the whole screen, since installed mode has no dynamic chrome to subtract.
