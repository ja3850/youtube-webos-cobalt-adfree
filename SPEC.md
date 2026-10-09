# SPEC: C4 speed fixes and legacy feature parity (branch `c4-speed-legacy`)

**Target:** LG OLED55C4PUA, webOS 25 (sdk 10.3.1-3007), rooted. Base is RF1705 2.0.5-beta (main @ 7f9de1d).

**Background notes:**
- `notes/speed-analysis.md`: root cause of the speed bugs.
- `notes/feature-diff.md`: porting cards. "Card N" below refers to these.

## Rules for every change
- Only touch `webapp/src/**`, `webapp/test/**` and this file. No native or Cobalt changes in this phase.
- **Cobalt DOM subset:**
  - Allowed: `div`/`span`, inline styles, `MutationObserver`, `localStorage`, `fetch`.
  - Not allowed: `<img>`, `<input>`, `<canvas>`, CSS `filter`/animations, and `Intl` without a fallback.
- **New config keys:**
  - Add them to `defaultConfig` in `config.js`.
  - Add a menu row in `ui.js` via `checkboxTools.add`/`choiceTools.add`.
  - Add a label in all 9 `languages/*.js` (non-English may reuse the English text).
  - Live-apply changes via the `ytaf-config-changed` event where feasible.
- Start new modules from `adblock-main.js` the same way existing optional hooks are started.
- **Tests:** add `node:test` tests under `webapp/test/*.test.mjs` for any pure logic (JSON filters, URL rewrites, MIME rewriting, rate-step math). `npm test` must pass.
- `npm run build` must succeed. Output goes to `webapp/output/adblockMain.js`, `adblockMain.css` and `adblockPreload.js`.
- Commit on your worktree branch with clear messages. Don't push.

## P0: Playback speed (Worker A)
1. **Rate-change resync (Bug 1).** On every `ratechange` of the `<video>`, if the video is playing, not seeking and `readyState >= 2`, do a same-position seek once: `video.currentTime = video.currentTime`.
   - Debounce by 300 ms.
   - Guard against re-entry: a seek must not trigger another resync.
   - It must cover the 1/3 keys and YouTube's own speed menu.
   - Config `speedResyncOnChange` (default true), so it can be turned off on the TV if the native fix lands.
2. **Capability probe fix (Bug 2).** Wrap `MediaSource.isTypeSupported`. If `HTMLMediaElement.prototype.canPlayType` is used by the YouTube player, wrap it with the same rewrite.
   - Round fractional `bitrate=` to an integer.
   - If `framerate > 60` and the current playback rate is > 1 and `framerate / rate <= 60` (within 0.5 tolerance), rewrite to `framerate / rate`, rounded.
   - YouTube's negative probes (`framerate=9999`, `width=99999`, absurd bitrate) must still return false. Never rewrite anything the rule above doesn't cover.
   - Install as early as possible. Put it in the preload script if that's where the JSON hooks live, falling back to the main script. The current rate is read from `document.querySelector('video')`.
3. **Finer steps.**
   - Config `playbackRateSteps`, a choice of:
     - `standard`: 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2. This is the default.
     - `fine`: 0.5 to 2 in steps of 0.1.
   - Keep the rate above or equal to 0.1 and at most 2 (the native shared backend fails outside 0.1–2).
4. **Persist rate (optional, default off).** Config `rememberPlaybackRate`: re-apply the last rate on each new video.

**Acceptance:**
- Unit tests cover the probe rewrite, including the conformance negatives, and the step math.
- On the TV, 1.25x, 1.5x and 2x on a 1080p60 video keep 1080p60 in stats for nerds. Pressing 3 mid-playback doesn't freeze.

## P1: webosbrew parity, JSON layer (Worker B)
Add these to the existing `JSON.parse` response hook. Find where RF filters ads and Shorts in `adblock-preload.js` / `adblock.js` / `shorts-response-filter.mjs`.
- **Remove end screens (Card 9).** Config `removeEndscreen`, default true. Delete `endscreen` when it contains `endscreenRenderer`.
- **Higher-quality thumbnails (Card 7, JSON rewrite only).** Config `upgradeThumbnails`, default false.
  - Rewrite `i.ytimg.com/vi(_webp)?/<id>/(hq|mq|default)default.(jpg|webp)` URLs in thumbnail arrays to `sddefault.jpg`.
  - No WebP probing, no HEAD requests.
- **Guest mode: hide sign-in prompts (Card 10).** Config `hideGuestSignInPrompts`, default true. Use NB's renderer names. Show the menu row only when `isGuestMode()`.

**Acceptance:**
- Fixture-based unit tests for each filter.
- Filters are no-ops when the key is false.
- The response hook never throws: wrap each filter in try/catch.

## P1: webosbrew parity, UI layer (Worker C)
- **Clock (Card 3).** Config `showClock`, default false.
  - A fixed top-right div showing HH:MM, updated each minute.
  - Use `Date`-based formatting. `Intl` is allowed only with a try/catch fallback.
  - Hide it while the player controls are focused/fullscreen, if a reliable selector exists. Otherwise always show it.
- **Hide YouTube logo (Card 8).** Config `hideLogo`, default false. Use an injected `<style>` with `ytlr-redux-connect-ytlr-logo-entity { visibility: hidden }`, toggled live.
- **Force max quality (Card 1, localStorage path).** Config `forceHighResVideo`, default false.
  - Write `localStorage['yt-player-quality']` as in NB `video-quality.js`.
  - Do it early: at startup and on each video change.
  - No player-object API.

**Acceptance:**
- Unit tests for the clock formatting and the quality-record shape.
- Menu rows appear and toggle live.

## P2: after TV validation of P0/P1 (later workers)
- SponsorBlock: `poi_highlight` plus a jump key, skip-once, per-segment modes (Cards 4 and 6).
- Audio-only on the blue key (Card 2). First needs on-TV discovery of whether hiding `<video>` works over the Starfish punch-through plane.
- Red-key black overlay / OLED (Card 13), same caveat as audio-only.
- Programmable shortcuts (Card 12).

## Native follow-up (Opus, later)
Fix `SetPlayRate` mid-playback in `starfish_av_components.cc` `Step()` (Pause, then SetPlayRate, then Play, or an internal reset at `current_`), plus the same in `starfish_video_decoder.cc`.

Consider raising `fps <= 60` to `fps <= 60 * min(rate, 2)` for ≤1440p in `cobalt-23.lts.6-webos-hardware-video-capabilities.patch`. Only do this if the TV decodes 1080p at 120 fps without drops.

## Test loop on the TV (no rebuild)
1. Build with `cd webapp && npm ci && npm run build`.
2. `scp` `webapp/output/adblockMain.{js,css}` to `/media/developer/apps/usr/palm/applications/youtube.leanback.v4/content/web/adblock/`, after backing up the originals.
3. Kill the app and relaunch it.

`adblockPreload.js` changes may need the matching binary hook. Verify by checking the log for `__ytafPreloadExecuted`.
