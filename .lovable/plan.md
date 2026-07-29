## Plan

1. **Set realistic browser behavior**
   - Keep the existing first-tap fullscreen behavior, but do not try to force browser controls to hide on initial page load because mobile browsers only allow fullscreen/address-bar hiding after a user gesture.
   - On the first tap, continue attempting native fullscreen where supported and keep the in-page fullscreen overlay as the reliable fallback.

2. **Make the mobile fullscreen overlay fit the visible screen**
   - Adjust the fullscreen sizing to use the smallest safe value from `visualViewport`, `window.innerHeight`, and dynamic viewport units so the game never extends behind browser controls.
   - Keep safe-area padding for notches and rounded corners.

3. **Fix menu/button clipping in landscape**
   - Replace the current menu `scale()` approach with a fit-to-screen layout for the title, journey, trail map, controls, and scores screens.
   - Reduce minimum scale on short landscape phones and allow menu content to scroll internally only if absolutely necessary, so bottom buttons remain reachable.
   - Move the fullscreen/exit control out of the way of key menu buttons.

4. **Improve mobile app feel**
   - Add a small “tap to enter fullscreen” behavior on the game area before launch, using the existing first-tap helper.
   - Add mobile-friendly viewport metadata if needed so the browser uses dynamic viewport sizing and avoids zoom/resize surprises.

5. **Verify on mobile landscape sizes**
   - Check common phone landscape dimensions, including short-height cases, and confirm every menu screen shows its continue/start buttons without clipping.
   - Confirm desktop behavior remains unchanged.